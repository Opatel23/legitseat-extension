const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
const context = {
  URL,
  URLSearchParams,
  Set,
  Map,
  Date,
  setTimeout,
  clearTimeout,
  console,
  chrome: {
    storage: { local: { get: async () => context.onlyTicketsDev ? { ticketsDevApiKey: "inventory-key" } : { ticketmasterApiKey: "test-key" } } },
    runtime: { onMessage: { addListener() {} }, lastError: null },
    tabs: {
      create: async () => ({ id: 99 }),
      remove: async () => {},
      onUpdated: { addListener(listener) { setImmediate(() => listener(99, { status: "complete" })); }, removeListener() {} },
      onRemoved: { addListener() {}, removeListener() {} }
    },
    scripting: { executeScript: async () => [{ frameId: 0, result: [{ section: "224", row: "22", price: 190, directUrl: "", textLength: 60 }] }] }
  },
  fetch: async (url) => {
    const value = String(url);
    context.lastFetchUrl = value;
    if (value.includes("api.tickets.dev/v1/vividseats/scrape")) return {
      ok: true,
      status: 200,
      json: async () => ({ source: "vividseats", eventName: "Test Event", venueName: "Test Arena", sourceUrl: "https://www.vividseats.com/test-event", currency: "USD", listings: [{ listingId: "vs-1", section: "224", row: "22", quantity: 4, sellableQuantities: "2,4", ticketPrice: 170, fee: 30, totalPrice: 200 }] })
    };
    if (value.includes("discovery/v2/events.json")) return {
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { events: [{ id: "TM123", name: "Test Event", url: "https://www.ticketmaster.com/event/TM123", dates: { start: { localDate: "2026-09-01" } }, _embedded: { venues: [{ name: "Test Arena" }] } }] } })
    };
    if (value.includes("top-picks/v1/events/TM123")) return context.denyTopPicks ? { ok: false, status: 403, json: async () => ({}) } : {
        ok: true,
        status: 200,
        json: async () => ({
          picks: [{ section: "224", row: "22", quality: 0.95, offers: ["offer-1"] }],
          _embedded: { offer: [{ offerId: "offer-1", currency: "USD", faceValue: 180, totalPrice: 205, limit: { max: 4 } }] }
        })
      };
    throw new Error("Unexpected URL: " + value);
  }
};
vm.createContext(context);
vm.runInContext(source + "\nglobalThis.runComparison = directComparison; globalThis.runFetchWithTimeout = fetchWithTimeout;", context);

(async () => {
  const result = await context.runComparison({
    query: "Test Event",
    event_url: "https://seatgeek.com/test-event",
    current_provider: "SeatGeek",
    event_date: "2026-09-01",
    section: "224",
    row: "22",
    quantity: 2,
    current_price: 500,
    page_listings: [{ section: "224", row: "22", total_price: 250 }]
  });
  const ticketmaster = result.seat_matches.find((item) => item.provider === "Ticketmaster");
  assert.ok(ticketmaster, "Ticketmaster Top Picks seat should be returned");
  assert.equal(ticketmaster.match_quality, "same section and row");
  assert.equal(ticketmaster.ticket_price, 205);
  assert.equal(ticketmaster.total_price, 410);
  assert.match(ticketmaster.url, /ls_section=224/);
  assert.match(ticketmaster.url, /ls_row=22/);
  assert.equal(result.market_low, 410);

  context.denyTopPicks = true;
  const wrongDate = await context.runComparison({ query: "Test Event", event_url: "https://seatgeek.com/test-event", event_date: "2026-09-02", quantity: 2, current_price: 500, page_listings: [] });
  assert.equal(wrongDate.seat_matches.length, 0, "A different event date must not supply comparable seats");
  assert.equal(wrongDate.listings.length, 0);
  const renderedFallback = await context.runComparison({
    query: "Test Event", event_url: "https://seatgeek.com/test-event", current_provider: "SeatGeek",
    event_date: "2026-09-01", section: "224", row: "22", quantity: 2, current_price: 500,
    page_listings: [{ section: "224", row: "22", total_price: 250 }]
  });
  const capturedTicketmaster = renderedFallback.seat_matches.find((item) => item.provider === "Ticketmaster");
  assert.ok(capturedTicketmaster, "Rendered Ticketmaster fallback should be returned when Top Picks is denied");
  assert.equal(capturedTicketmaster.ticket_price, 190);
  assert.equal(capturedTicketmaster.total_price, 380);
  assert.match(capturedTicketmaster.url, /ls_section=224/);

  context.onlyTicketsDev = true;
  const normalizedInventory = await context.runComparison({
    query: "Test Event", event_url: "https://www.vividseats.com/test-event", current_provider: "Vivid Seats",
    section: "224", row: "22", quantity: 2, current_price: 500, page_listings: []
  });
  assert.match(context.lastFetchUrl, /api\.tickets\.dev\/v1\/vividseats\/scrape/);
  assert.match(context.lastFetchUrl, /apiKey=inventory-key/);
  assert.equal(normalizedInventory.seat_matches[0].ticket_price, 200, "all-in price should be shown per ticket");
  assert.equal(normalizedInventory.seat_matches[0].total_price, 400, "all-in price should be multiplied by requested quantity");
  assert.equal(normalizedInventory.seat_matches[0].face_price, 170);
  assert.equal(normalizedInventory.provider_status[0].status, "live");

  const cardPattern = /\b(?:Section|Sec|Zone)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,25}?)(?=\s*(?:[•·|,]|\s+-\s)?\s*Row\b)/i;
  assert.equal("Section 224 Row 22".match(cardPattern)[1], "224");
  assert.equal("Section s Row 4".match(cardPattern)[1], "s");

  const workingFetch = context.fetch;
  context.fetch = () => new Promise(() => {});
  await assert.rejects(context.runFetchWithTimeout("https://example.test", {}, 5), /Timed out after 1 second/);
  context.fetch = workingFetch;
  await assert.rejects(context.runComparison({ query: "Test", quantity: 21, current_price: 500 }), /between 1 and 20/);
  await assert.rejects(context.runComparison({ query: "Test", quantity: 2, current_price: 0 }), /valid ticket total/);
  console.log("LegitSeat comparison tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
