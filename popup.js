const get = (id) => document.getElementById(id);
let currentDomain = null;
let currentTab = null;
const MARKETPLACES = [
  { name: "Ticketmaster", domains: ["ticketmaster.com", "livenation.com"] },
  { name: "SeatGeek", domains: ["seatgeek.com"] },
  { name: "TickPick", domains: ["tickpick.com"] },
  { name: "StubHub", domains: ["stubhub.com"] },
  { name: "Vivid Seats", domains: ["vividseats.com"] },
  { name: "viagogo", domains: ["viagogo.com"] },
  { name: "Gametime", domains: ["gametime.co"] },
  { name: "AXS", domains: ["axs.com"] },
  { name: "Eventbrite", domains: ["eventbrite.com"] }
];

function currentMarketplace() {
  return MARKETPLACES.find((marketplace) => marketplace.domains.some((domain) => currentDomain === domain || currentDomain?.endsWith("." + domain))) || null;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => chrome.runtime.sendMessage(message, (response) =>
    chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(response)));
}

function setStatusBox(element, level, title, message) {
  element.className = (element.id === "risk" ? "risk " : "grade ") + level;
  element.querySelector("strong").textContent = title;
  element.querySelector(".muted").textContent = message;
}

function renderRisk(result) {
  currentDomain = result?.domain || null;
  get("domain").textContent = currentDomain || "This page cannot be checked";
  if (!result) {
    setStatusBox(get("risk"), "unknown", "Unavailable", "Open a regular website and try again.");
    return;
  }
  setStatusBox(get("risk"), result.risk_level, result.risk_level, result.message);
  const reasons = result.reasons.length ? result.reasons : ["No common domain-based warning signs detected."];
  get("trustBreakdown").replaceChildren(...reasons.map((textContent) =>
    Object.assign(document.createElement("li"), { textContent })));
  get("reportBtn").disabled = false;
}

function extractPageListing() {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() || "";
  const meta = (selector) => document.querySelector(selector)?.content || "";
  const info = {
    title: (meta('meta[property="og:title"]') || text("h1") || document.title).slice(0, 160),
    date: (meta('meta[property="event:start_time"]') || document.querySelector("time[datetime]")?.dateTime || "").slice(0, 32),
    venue: "", section: "", row: "", quantity: null, price: null, visibleListings: []
  };
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw = JSON.parse(node.textContent);
      for (const item of (Array.isArray(raw) ? raw : [raw])) {
        const offer = Array.isArray(item?.offers) ? item.offers[0] : item?.offers;
        if (item?.["@type"] === "Event") {
          info.title = item.name || info.title;
          info.date = item.startDate || info.date;
          info.venue = item.location?.name || info.venue;
        }
        if (offer) {
          info.price = Number(offer.lowPrice || offer.price) || info.price;
          info.section = offer.seatSection || offer.section || info.section;
          info.row = offer.seatRow || offer.row || info.row;
          info.quantity = Number(offer.eligibleQuantity?.value || offer.inventoryLevel?.value) || info.quantity;
        }
      }
    } catch {}
  }
  const body = (document.body?.innerText || "").slice(0, 200000);
  const pick = (patterns) => {
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) return match[1].trim();
    }
    return "";
  };
  info.section ||= pick([/\bSection\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,20})/i, /\bSec\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,12})/i]);
  info.row ||= pick([/\bRow\s*[:#-]?\s*([A-Z0-9][A-Z0-9.-]{0,10})/i]);
  info.quantity ||= Number(pick([/\b(?:Qty|Quantity|Tickets)\s*[:#-]?\s*(\d{1,2})/i])) || null;
  info.price ||= Number(meta('meta[property="product:price:amount"]')) || null;
  const candidates = document.querySelectorAll('[data-testid*="offer" i], [data-testid*="ticket" i], [data-testid*="listing" i], [aria-label*="ticket" i], [class*="offer" i], [class*="listing" i], [class*="ticket" i], [role="listitem"]');
  const seen = new Set();
  for (const element of candidates) {
    const value = (element.innerText || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    if (!value || value.length > 1200) continue;
    const priceMatch = value.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    if (!priceMatch) continue;
    const sectionMatch = value.match(/\b(?:Section|Sec|Zone)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,25}?)(?=\s*(?:[•·|,]|\s+-\s)?\s*Row\b)/i);
    const rowMatch = value.match(/\bRow\s*[:#-]?\s*([A-Z0-9][A-Z0-9.-]{0,12})/i);
    const quantityMatch = value.match(/\b(?:Qty|Quantity|Tickets?|Seats?)\s*[:#-]?\s*(\d{1,2})/i);
    const section = sectionMatch?.[1]?.trim() || "";
    if (section === "s") continue;
    const listing = { section, row: rowMatch?.[1]?.trim() || "", quantity: Number(quantityMatch?.[1]) || 1, total_price: Number(priceMatch[1].replace(/,/g, "")) };
    const key = [listing.section, listing.row, listing.quantity, listing.total_price].join("|");
    if (listing.total_price > 0 && !seen.has(key)) { seen.add(key); info.visibleListings.push(listing); }
    if (info.visibleListings.length >= 30) break;
  }
  const ticketmasterPattern = /\bSec\s+([^\n•]{1,30})\s*•\s*Row\s+([^\n]{1,20})\s*\n(?:[^\n]*\n){0,2}?\$\s*([\d,]+(?:\.\d{2})?)/gi;
  for (const match of body.matchAll(ticketmasterPattern)) {
    const listing = { section: match[1].trim(), row: match[2].trim(), quantity: info.quantity || 1, total_price: Number(match[3].replace(/,/g, "")) };
    const key = [listing.section, listing.row, listing.quantity, listing.total_price].join("|");
    if (listing.total_price > 0 && !seen.has(key)) { seen.add(key); info.visibleListings.push(listing); }
    if (info.visibleListings.length >= 50) break;
  }
  if (!info.price && info.visibleListings.length) info.price = Math.min(...info.visibleListings.map((item) => item.total_price));
  return info;
}

async function loadStatus() {
  try {
    [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await sendMessage({ type: "LS_ASSESS_URL", url: currentTab?.url });
    renderRisk(response?.result);
    if (currentTab?.id) {
      let result = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        [{ result }] = await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: extractPageListing });
        if (result?.visibleListings?.length) break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 600));
      }
      if (!result) return;
      get("eventQuery").value = [result.title, result.venue, result.date].filter(Boolean).join(" · ");
      get("section").value = result.section;
      get("row").value = result.row;
      currentTab.visibleListings = result.visibleListings || [];
      currentTab.eventDate = result.date || "";
      currentTab.venue = result.venue || "";
    }
  } catch {
    renderRisk(null);
  }
}

async function focusCurrentPageListing(item) {
  if (!currentTab?.id) return;
  const target = item.frame_id != null ? { tabId: currentTab.id, frameIds: [item.frame_id] } : { tabId: currentTab.id };
  const [{ result }] = await chrome.scripting.executeScript({
    target,
    args: [String(item.listing_id || ""), String(item.section || ""), String(item.row || ""), Number(item.ticket_price || 0)],
    func: (listingId, section, row, eachPrice) => {
      const compact = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const sectionKey = compact(section);
      const rowKey = compact(row);
      let element = listingId ? document.querySelector(`[data-legitseat-listing-id="${CSS.escape(listingId)}"]`) : null;
      if (!element) {
        const candidates = [...document.querySelectorAll("button, li, article, [role='button'], [role='listitem'], [data-testid*='offer'], [data-testid*='ticket'], [data-testid*='listing']")]
          .map((candidate) => {
            const value = candidate.innerText || candidate.textContent || "";
            const normalized = compact(value);
            let score = 0;
            if (sectionKey && (normalized.includes("sec" + sectionKey) || normalized.includes("section" + sectionKey) || normalized.includes("zone" + sectionKey))) score += 5;
            if (rowKey && normalized.includes("row" + rowKey)) score += 5;
            const shownPrice = Number(value.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1]?.replace(/,/g, ""));
            if (eachPrice && Number.isFinite(shownPrice) && Math.abs(shownPrice - eachPrice) < 0.02) score += 2;
            return { candidate, score, length: value.length };
          })
          .filter((entry) => entry.score >= (sectionKey && rowKey ? 10 : 5))
          .sort((a, b) => b.score - a.score || a.length - b.length);
        element = candidates[0]?.candidate || null;
      }
      if (!element) return false;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      const clickable = element.matches("button, a, [role='button']") ? element : element.querySelector("button, a, [role='button']") || element.closest("button, a, [role='button']") || element;
      // Click before the extension popup closes; delayed isolated-world tasks
      // can be destroyed by Chrome as soon as focus returns to the page.
      clickable.click();
      return true;
    }
  });
  if (!result && item.url && item.listing_level_url) chrome.tabs.update(currentTab.id, { url: item.url });
  else if (!result) throw new Error("The marketplace removed that live listing. Run Compare again to refresh inventory.");
}

function ticketCard(item, requestedQuantity) {
  const card = document.createElement("div");
  card.className = "ticket";
  const title = Object.assign(document.createElement("div"), {
    className: "ticket-title",
    textContent: item.provider + " · " + (item.section ? "Section " + item.section : "Event inventory")
  });
  const meta = Object.assign(document.createElement("div"), {
    className: "ticket-meta",
    textContent: [item.row && "Row " + item.row, requestedQuantity + (requestedQuantity === 1 ? " ticket" : " tickets"),
      item.ticket_price != null && "$" + Number(item.ticket_price).toFixed(2) + " each",
      item.fee != null && "$" + Number(item.fee).toFixed(2) + " fees"].filter(Boolean).join(" · ")
  });
  const price = Object.assign(document.createElement("div"), {
    className: "ticket-price",
    textContent: "$" + Number(item.total_price ?? item.lowest).toFixed(2) + " total"
  });
  let link;
  if (item.provider === "Current page" || item.is_current_page) {
    link = Object.assign(document.createElement("button"), { type: "button", textContent: "View this seat" });
    Object.assign(link.style, { width: "max-content", padding: "0", border: "0", background: "none", color: "#66b8ff", fontSize: "9px", cursor: "pointer" });
    link.addEventListener("click", async () => {
      try { await focusCurrentPageListing(item); }
      catch (error) { get("priceStatus").textContent = error.message; }
    });
  } else {
    link = Object.assign(document.createElement("button"), { type: "button", textContent: item.listing_level_url ? "Open this seat" : "Open " + item.provider + " event" });
    Object.assign(link.style, { width: "max-content", padding: "0", border: "0", background: "none", color: "#66b8ff", fontSize: "9px", cursor: "pointer" });
    link.addEventListener("click", () => {
      try {
        const url = new URL(item.url, currentTab?.url).href;
        chrome.tabs.create({ url });
      } catch {
        get("priceStatus").textContent = "This provider did not return a usable listing link.";
      }
    });
  }
  const badges = document.createElement("div");
  badges.className = "badges";
  if (item.match_quality) {
    const badge = Object.assign(document.createElement("span"), {
      className: "badge " + (item.match_quality === "same section and row" ? "exact" : ""),
      textContent: item.match_quality
    });
    badges.append(badge);
  }
  card.append(title, meta, price, link, badges);
  return card;
}

function renderListings(data) {
  const container = get("listings");
  container.replaceChildren();
  const requestedQuantity = Math.max(1, Number(data.requested_seat?.quantity) || 1);
  const items = [
    ...(data.seat_matches || []),
    ...(data.listings || []).map((item) => ({ ...item, ticket_price: item.lowest, total_price: Number(item.lowest) * requestedQuantity, match_quality: "event-wide" }))
  ];
  items.forEach((item) => container.append(ticketCard(item, requestedQuantity)));
}

function parseTicketmasterInventory(pageText) {
  const listings = [];
  const seen = new Set();
  const text = String(pageText || "").replace(/\u00a0/g, " ");
  // Ticketmaster changes whitespace and inserts labels such as "Standard
  // Admission" between the seat and price. Match the nearest price within the
  // same compact card instead of depending on a fixed number of lines.
  const pattern = /\b(?:Sec(?:tion)?|Zone)[.:\s]+([^\n•·|,]{1,35}?)\s*(?:[•·|,]|\s+-\s)?\s*Row[.:\s]+([a-z0-9-]{1,28})[\s\S]{0,500}?\$\s*([\d,]+(?:\.\d{1,2})?)/gi;
  for (const match of text.matchAll(pattern)) {
    const listing = { section: match[1].trim(), row: match[2].trim(), quantity: 1, total_price: Number(match[3].replace(/,/g, "")) };
    const key = [listing.section, listing.row, listing.total_price].join("|");
    if (listing.total_price > 0 && !seen.has(key)) { seen.add(key); listings.push(listing); }
    if (listings.length >= 100) break;
  }
  return listings;
}

async function readCurrentPageInventory() {
  if (!currentTab?.id) return [];
  const capture = async (allFrames) => chrome.scripting.executeScript({
    target: { tabId: currentTab.id, allFrames },
    func: () => {
      const chunks = [document.body?.innerText || ""];
      const listings = [];
      let index = 0;
      for (const element of document.querySelectorAll("button, li, article, [role='button'], [role='listitem'], [data-testid*='offer'], [data-testid*='ticket'], [data-testid*='listing']")) {
        const value = element.innerText || element.textContent || "";
        if (!/\b(?:Sec(?:tion)?|Zone)\b/i.test(value) || !/\bRow\b/i.test(value) || !/\$\s*[\d,]+/.test(value)) continue;
        chunks.push(value);
        const section = value.match(/\b(?:Section|Sec|Zone)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,25}?)(?=\s*(?:[•·|,]|\s+-\s)?\s*Row\b)/i)?.[1]?.trim();
        const row = value.match(/\bRow\s*[:#-]?\s*([A-Z0-9][A-Z0-9.-]{0,12})/i)?.[1]?.trim();
        const price = Number(value.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1]?.replace(/,/g, ""));
        if (!section || section === "s" || !row || !Number.isFinite(price) || price <= 0) continue;
        const id = element.dataset.legitseatListingId || `ls-${Date.now().toString(36)}-${index++}`;
        element.dataset.legitseatListingId = id;
        const anchor = element.matches("a[href]") ? element : element.querySelector("a[href]");
        listings.push({ listing_id: id, section, row, quantity: 1, total_price: price, direct_url: anchor?.href || "", text_length: value.length });
      }
      return { text: chunks.join("\n\n").slice(0, 1000000), listings };
    }
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let frames;
    try {
      frames = await capture(true);
    } catch {
      // Ticketmaster embeds protected payment/advertising frames. Chrome can
      // reject an all-frame injection because of one such frame, even though
      // the main event page is readable.
      frames = await capture(false);
    }
    const structured = new Map();
    for (const frame of frames) {
      for (const item of frame.result?.listings || []) {
        const key = `${item.section.toLowerCase()}|${item.row.toLowerCase()}|${item.total_price}`;
        const candidate = { ...item, frame_id: frame.frameId };
        const existing = structured.get(key);
        if (!existing || candidate.text_length < existing.text_length) structured.set(key, candidate);
      }
    }
    const listings = structured.size
      ? [...structured.values()]
      : parseTicketmasterInventory(frames.map((frame) => frame.result?.text || "").join("\n\n"));
    if (listings.length) return listings;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return [];
}

async function compareTickets() {
  const query = get("eventQuery").value.trim();
  const button = get("compareBtn");
  const status = get("priceStatus");
  const grade = get("priceGrade");
  if (query.length < 3) {
    status.textContent = "Enter a clearer event name.";
    return;
  }
  button.disabled = true;
  button.textContent = "Scanning live inventory...";
  status.textContent = "";
  grade.classList.add("hidden");
  get("listings").replaceChildren();
  let livePageListings = currentTab?.visibleListings || [];
  let scanError = "";
  try {
    const freshListings = await readCurrentPageInventory();
    if (freshListings.length) livePageListings = freshListings;
  } catch (error) {
    scanError = error?.message || "Chrome blocked page access";
  }
  const marketplace = currentMarketplace();
  if (marketplace && !livePageListings.length) {
    status.textContent = scanError
      ? `Ticket page scan failed: ${scanError}. Refresh the page and retry.`
      : `No live seat cards captured yet. Open the ${marketplace.name} ticket list, wait until section, row, and price cards appear, then retry.`;
    button.disabled = false;
    button.textContent = "Find better live seats";
    return;
  }
  if (marketplace) status.textContent = `Captured ${livePageListings.length} live ${marketplace.name} listings. Comparing…`;
  const quantity = Number(get("quantity").value);
  const eachPrice = Number(get("currentPrice").value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    status.textContent = "Enter the number of tickets before comparing.";
    button.disabled = false;
    button.textContent = "Find better live seats";
    return;
  }
  if (!Number.isFinite(eachPrice) || eachPrice <= 0) {
    status.textContent = "Enter the displayed per-ticket price before comparing.";
    button.disabled = false;
    button.textContent = "Find better live seats";
    return;
  }
  const payload = {
    query, event_url: currentTab?.url, page_listings: livePageListings, current_provider: marketplace?.name || "Current page", event_date: currentTab?.eventDate || "", venue: currentTab?.venue || "", section: get("section").value.trim(), row: get("row").value.trim(),
    quantity,
    current_price: eachPrice * quantity
  };
  try {
    const response = await sendMessage({ type: "LS_COMPARE_TICKETS", payload });
    if (!response?.ok) throw new Error(response?.message);
    const data = response.data;
    renderListings(data);
    if (!data.configured_providers.length) {
      status.textContent = data.warnings?.length
        ? data.warnings.join(" ")
        : "No live prices were captured for this page.";
    } else if (!data.seat_matches.length && !data.listings.length) {
      status.textContent = data.warnings?.length ? data.warnings.join(" ") : "No priced matches found. Try only the artist or team names.";
    } else {
      status.textContent = "Updated " + new Date(data.checked_at).toLocaleTimeString() + " · " +
        (data.seat_matches.length ? data.seat_matches.length + " seat matches" : "event-level prices");
      grade.classList.remove("hidden");
      if (data.grade) {
        setStatusBox(grade, data.grade.color, data.grade.label,
          Math.abs(data.grade.difference_percent) + "% " + (data.grade.difference_percent >= 0 ? "above" : "below") +
          " the best comparable total ($" + data.market_low.toFixed(2) + " for " + quantity + ").");
      } else {
        setStatusBox(grade, "unknown", "Best live price",
          "$" + data.market_low.toFixed(2) + " total for " + quantity + (quantity === 1 ? " ticket." : " tickets."));
      }
    }
  } catch (error) {
    status.textContent = error.message || "Live inventory is unavailable.";
  } finally {
    button.disabled = false;
    button.textContent = "Find better live seats";
  }
}

const GUARDIAN_KEY = "legitseatCheckoutGuardian";

async function readGuardianPage() {
  if (!currentTab?.id) throw new Error("Open a ticket listing or checkout page first.");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      const body = (document.body?.innerText || "").replace(/\u00a0/g, " ").slice(0, 400000);
      const value = (pattern) => {
        const match = body.match(pattern);
        return match ? match[1].trim() : "";
      };
      const money = (pattern) => {
        const raw = value(pattern);
        return raw ? Number(raw.replace(/,/g, "")) : null;
      };
      return {
        title: (document.querySelector('meta[property="og:title"]')?.content || document.querySelector("h1")?.innerText || document.title || "").slice(0, 160),
        section: value(/\b(?:Section|Sec)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,25})/i),
        row: value(/\bRow\s*[:#-]?\s*([A-Z0-9][A-Z0-9.-]{0,12})/i),
        quantity: Number(value(/\b(?:Qty|Quantity|Tickets?|Seats?)\s*[:#x-]?\s*(\d{1,2})/i)) || null,
        total: money(/\b(?:Order\s+Total|Grand\s+Total|Total)\b[^$\n]{0,50}\$\s*([\d,]+(?:\.\d{2})?)/i),
        fees: money(/\b(?:Service\s+Fees?|Fees?)\b[^$\n]{0,50}\$\s*([\d,]+(?:\.\d{2})?)/i),
        delivery: value(/\b(?:Delivery|Delivery method|Ticket delivery)\b\s*[:#-]?\s*([^\n]{2,80})/i),
        url: location.origin + location.pathname,
        domain: location.hostname.toLowerCase().replace(/^www\./, "")
      };
    }
  });
  return result;
}

function guardianLine(message, alert = false) {
  const item = document.createElement("li");
  if (alert) item.className = "alert";
  item.textContent = message;
  return item;
}

async function renderGuardian() {
  const { [GUARDIAN_KEY]: journey } = await chrome.storage.local.get(GUARDIAN_KEY);
  const timeline = get("guardianTimeline");
  timeline.replaceChildren();
  get("clearGuardian").classList.toggle("hidden", !journey);
  if (!journey) return;
  for (const entry of journey.timeline || []) {
    const time = new Date(entry.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    timeline.append(guardianLine(`${time} · ${entry.message}`, entry.alert));
  }
  get("guardianStatus").textContent = `Integrity ID ${journey.id} · saved locally`;
}

async function saveFingerprint() {
  const page = await readGuardianPage();
  const quantity = Math.max(1, Number(get("quantity").value) || page.quantity || 1);
  const each = Number(get("currentPrice").value) || null;
  const snapshot = {
    event: get("eventQuery").value.trim() || page.title,
    section: get("section").value.trim() || page.section,
    row: get("row").value.trim() || page.row,
    quantity,
    each,
    total: each ? each * quantity : page.total,
    fees: page.fees,
    delivery: page.delivery,
    domain: page.domain,
    url: page.url,
    capturedAt: new Date().toISOString()
  };
  const fingerprintInput = JSON.stringify(snapshot);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintInput));
  const id = "LS-" + [...new Uint8Array(digest)].slice(0, 5).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  await chrome.storage.local.set({ [GUARDIAN_KEY]: { id, baseline: snapshot, timeline: [{ at: snapshot.capturedAt, message: `Listing saved · ${snapshot.section ? "Section " + snapshot.section : "seat"}${snapshot.row ? ", Row " + snapshot.row : ""} · ${quantity} ticket${quantity === 1 ? "" : "s"}${snapshot.total ? " · $" + snapshot.total.toFixed(2) + " promised total" : ""}`, alert: false }] } });
  await renderGuardian();
}

function moneyDifference(current, original) {
  return Math.round((current - original) * 100) / 100;
}

async function checkGuardianDrift() {
  const stored = await chrome.storage.local.get(GUARDIAN_KEY);
  const journey = stored[GUARDIAN_KEY];
  if (!journey) throw new Error("Save the original listing before checking checkout.");
  const current = await readGuardianPage();
  const baseline = journey.baseline;
  const changes = [];
  if (current.total != null && baseline.total != null && Math.abs(current.total - baseline.total) >= 0.01) {
    const difference = moneyDifference(current.total, baseline.total);
    changes.push(`Total ${difference > 0 ? "increased" : "decreased"} by $${Math.abs(difference).toFixed(2)} ($${baseline.total.toFixed(2)} → $${current.total.toFixed(2)})`);
  }
  if (current.fees != null && (baseline.fees == null || current.fees !== baseline.fees)) changes.push(`Fees now $${current.fees.toFixed(2)}`);
  if (current.section && baseline.section && current.section.toLowerCase() !== baseline.section.toLowerCase()) changes.push(`Section changed: ${baseline.section} → ${current.section}`);
  if (current.row && baseline.row && current.row.toLowerCase() !== baseline.row.toLowerCase()) changes.push(`Row changed: ${baseline.row} → ${current.row}`);
  if (current.quantity && current.quantity !== baseline.quantity) changes.push(`Quantity changed: ${baseline.quantity} → ${current.quantity}`);
  if (current.delivery && baseline.delivery && current.delivery.toLowerCase() !== baseline.delivery.toLowerCase()) changes.push(`Delivery changed: ${baseline.delivery} → ${current.delivery}`);
  if (current.domain && current.domain !== baseline.domain) changes.push(`Checkout redirected: ${baseline.domain} → ${current.domain}`);
  const message = changes.length ? `${changes.length} difference${changes.length === 1 ? "" : "s"}: ${changes.join("; ")}` : "Checkout matches the saved listing ✓";
  journey.timeline = [...(journey.timeline || []), { at: new Date().toISOString(), message, alert: changes.length > 0 }].slice(-20);
  await chrome.storage.local.set({ [GUARDIAN_KEY]: journey });
  await renderGuardian();
}

async function clearGuardian() {
  await chrome.storage.local.remove(GUARDIAN_KEY);
  get("guardianStatus").textContent = "Saved checkout journey cleared.";
  await renderGuardian();
}

async function submitReport() {
  const reason = get("reportReason").value;
  if (!reason) {
    get("status").textContent = "Choose a report reason.";
    return;
  }
  const button = get("submitReport");
  button.disabled = true;
  try {
    const response = await sendMessage({ type: "LS_REPORT_DOMAIN", domain: currentDomain, reason, details: get("reportDetails").value });
    get("status").textContent = response?.message || "Unable to submit report.";
    if (response?.ok) get("reportForm").classList.add("hidden");
  } catch {
    get("status").textContent = "Unable to submit report.";
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  get("compareBtn").addEventListener("click", compareTickets);
  get("reportBtn").addEventListener("click", () => get("reportForm").classList.toggle("hidden"));
  get("submitReport").addEventListener("click", submitReport);
  get("saveFingerprint").addEventListener("click", () => saveFingerprint().catch((error) => { get("guardianStatus").textContent = error.message; }));
  get("checkDrift").addEventListener("click", () => checkGuardianDrift().catch((error) => { get("guardianStatus").textContent = error.message; }));
  get("clearGuardian").addEventListener("click", clearGuardian);
  renderGuardian();
  loadStatus();
});
