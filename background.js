const BACKEND_BASE = "https://legitseat-backend.onrender.com";
const OFFICIAL_VENDORS = ["ticketmaster.com", "livenation.com", "axs.com", "eventbrite.com", "seatgeek.com", "stubhub.com", "vividseats.com", "tickpick.com", "viagogo.com", "gametime.co", "ticketclub.com"];
const SUSPICIOUS_TLDS = new Set(["xyz", "top", "shop", "buzz", "click", "ru", "tk"]);
const TICKET_WORDS = ["ticket", "tickets", "seat", "concert", "tour"];

function extractDomain(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch { return null; }
}

function isVendorDomain(domain, vendor) { return domain === vendor || domain.endsWith(`.${vendor}`); }

function localAssessment(domain) {
  const lower = domain.toLowerCase();
  const reasons = [];
  if (!OFFICIAL_VENDORS.some((vendor) => isVendorDomain(lower, vendor)) && TICKET_WORDS.some((word) => lower.includes(word))) {
    reasons.push("Ticket-related domain is not a recognized major marketplace.");
  }
  const tld = lower.split(".").pop();
  if (SUSPICIOUS_TLDS.has(tld)) reasons.push(`Higher-risk domain extension: .${tld}`);
  const riskLevel = reasons.length >= 2 ? "high" : reasons.length === 1 ? "medium" : "unknown";
  const message = riskLevel === "high" ? "Multiple warning signs detected. Verify the seller before paying."
    : riskLevel === "medium" ? "A warning sign was detected. Proceed carefully."
      : "No automated warning signs found. This is not a guarantee of legitimacy.";
  return { domain, risk_level: riskLevel, message, reasons };
}

function assessUrl(url) { const domain = extractDomain(url); return domain ? localAssessment(domain) : null; }

function getLocalSettings() {
  return chrome.storage.local.get(["ticketmasterApiKey", "seatgeekClientId", "ticketsDevApiKey"]);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeoutId;
  const timer = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
      const error = new Error("Timed out after " + seconds + (seconds === 1 ? " second" : " seconds"));
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }), timer]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function directGrade(currentPrice, marketLow) {
  if (!currentPrice || !marketLow) return null;
  const difference = (currentPrice - marketLow) / marketLow;
  if (difference <= 0.05) return { color: "green", label: "Near lowest returned price", difference_percent: Math.round(difference * 100) };
  if (difference <= 0.20) return { color: "yellow", label: "Compare details", difference_percent: Math.round(difference * 100) };
  return { color: "red", label: "Above lowest returned price", difference_percent: Math.round(difference * 100) };
}

function normalizeSeat(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ticketsDevMarketplace(url) {
  const domain = extractDomain(url) || "";
  if (isVendorDomain(domain, "ticketmaster.com") || isVendorDomain(domain, "livenation.com")) return "ticketmaster";
  if (isVendorDomain(domain, "vividseats.com")) return "vividseats";
  if (isVendorDomain(domain, "stubhub.com")) return "stubhub";
  if (isVendorDomain(domain, "seatgeek.com")) return "seatgeek";
  if (isVendorDomain(domain, "tickpick.com")) return "tickpick";
  if (isVendorDomain(domain, "gametime.co")) return "gametime";
  if (domain === "viagogo.com" || domain.endsWith(".viagogo.com") || /^viagogo\.[a-z.]+$/i.test(domain)) return "viagogo";
  return null;
}

function waitForTabLoad(tabId, timeoutMs = 18000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (updatedId, changeInfo) => { if (updatedId === tabId && changeInfo.status === "complete") finish(); };
    const onRemoved = (removedId) => { if (removedId === tabId) finish(); };
    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

async function scanMarketplacePage(url, provider, quantity) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const injection = {
        func: () => {
          const results = [];
          const candidates = document.querySelectorAll("button, li, article, [role='button'], [role='listitem'], [data-testid*='offer'], [data-testid*='ticket'], [data-testid*='listing'], [class*='offer'], [class*='listing']");
          for (const element of candidates) {
            const text = (element.innerText || element.textContent || "").replace(/\u00a0/g, " ").trim();
            if (!text || text.length > 1600) continue;
            const section = text.match(/\b(?:Section|Sec|Zone)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,25}?)(?=\s*(?:[•·|,]|\s+-\s)?\s*Row\b)/i)?.[1]?.trim();
            const row = text.match(/\bRow\s*[:#-]?\s*([A-Z0-9][A-Z0-9.-]{0,12})/i)?.[1]?.trim();
            const price = Number(text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1]?.replace(/,/g, ""));
            if (!section || section === "s" || !row || !Number.isFinite(price) || price <= 0) continue;
            const anchor = element.matches("a[href]") ? element : element.querySelector("a[href]");
            results.push({ section, row, price, directUrl: anchor?.href || "", textLength: text.length });
          }
          return results;
        }
      };
      let frames;
      try {
        frames = await chrome.scripting.executeScript({ ...injection, target: { tabId: tab.id, allFrames: true } });
      } catch {
        frames = await chrome.scripting.executeScript({ ...injection, target: { tabId: tab.id } });
      }
      const bySeat = new Map();
      for (const frame of frames) {
        for (const item of frame.result || []) {
          const key = `${normalizeSeat(item.section)}|${normalizeSeat(item.row)}|${item.price}`;
          const existing = bySeat.get(key);
          if (!existing || item.textLength < existing.textLength) bySeat.set(key, item);
        }
      }
      if (bySeat.size) return [...bySeat.values()].slice(0, 60).map((item) => ({ ...item, provider, quantity }));
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    return [];
  } catch {
    return [];
  } finally {
    if (tab?.id != null) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function directComparison(payload) {
  const settings = await getLocalSettings();
  const listings = [];
  const seatMatches = [];
  const warnings = [];
  const configured = [];
  const providerStatus = [];
  const wantedSection = normalizeSeat(payload.section);
  const wantedRow = normalizeSeat(payload.row);
  const requestedQuantity = Number(payload.quantity);
  const currentTotal = Number(payload.current_price);
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 20) throw new Error("Quantity must be between 1 and 20 tickets.");
  if (!Number.isFinite(currentTotal) || currentTotal <= 0 || currentTotal > 2000000) throw new Error("Enter a valid ticket total before comparing.");
  const isTicketmasterPage = /(?:^|\.)ticketmaster\.com$/i.test(extractDomain(payload.event_url) || "");
  for (const item of Array.isArray(payload.page_listings) ? payload.page_listings.slice(0, 50) : []) {
    const price = Number(item.total_price);
    // Ticketmaster cards often omit available quantity. That does not mean
    // only one seat exists, so never discard an otherwise valid live card.
    const quantity = requestedQuantity;
    if (!Number.isFinite(price) || price <= 0 || price > 100000) continue;
    const sectionMatch = wantedSection && normalizeSeat(item.section) === wantedSection;
    const rowMatch = wantedRow && normalizeSeat(item.row) === wantedRow;
    seatMatches.push({ provider: payload.current_provider || "Current page", is_current_page: true, listing_id: item.listing_id || "", frame_id: item.frame_id, event: payload.query, venue: payload.venue || null, captured_at: new Date().toISOString(), section: item.section || "", row: item.row || "", quantity, total_price: price * quantity, ticket_price: price, fee: null, currency: "USD", url: item.direct_url || payload.event_url, listing_level_url: Boolean(item.direct_url), match_quality: sectionMatch && rowMatch ? "same section and row" : sectionMatch ? "same section" : "event-wide" });
  }
  if (seatMatches.length) {
    configured.push(isTicketmasterPage ? "Ticketmaster live page" : "Visible page inventory");
    providerStatus.push({ provider: payload.current_provider || "Current page", status: "live", results: seatMatches.length });
  }

  // Discovery is an event-catalog API, not Ticketmaster's live seat inventory.
  // On Ticketmaster pages, prices must come from the listing cards rendered for
  // the signed-in visitor; treating missing Discovery priceRanges as a failure
  // produced the repeated, misleading error this extension used to show.
  if (settings.ticketmasterApiKey && !isTicketmasterPage) {
    configured.push("Ticketmaster");
    const ticketmasterStart = seatMatches.length + listings.length;
    try {
      const cleanQuery = String(payload.query || "").split("·")[0].replace(/\s*[|–—-]\s*(?:Ticketmaster|SeatGeek|StubHub).*$/i, "").trim();
      const eventId = String(payload.event_url || "").match(/ticketmaster\.[^/]+\/[^?#]*\/event\/([a-z0-9]+)/i)?.[1];
      const withoutTicketSuffix = cleanQuery.replace(/\s+Tickets?\b.*$/i, "").trim();
      const performerOnly = withoutTicketSuffix.split(":")[0].trim();
      const searches = [...new Set([withoutTicketSuffix, performerOnly, cleanQuery, String(payload.query || "").trim()])].filter((value) => value.length >= 3);
      let events = [];
      if (eventId) {
        const params = new URLSearchParams({ apikey: settings.ticketmasterApiKey });
        const response = await fetchWithTimeout(`https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(eventId)}.json?${params}`);
        if (response.status === 401 || response.status === 403) throw new Error("API key was rejected");
        if (response.ok) events = [await response.json()];
      }
      if (!events.length) {
        for (const keyword of searches) {
          const params = new URLSearchParams({ apikey: settings.ticketmasterApiKey, keyword, countryCode: "US", size: "20", sort: "relevance,desc" });
          const response = await fetchWithTimeout(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
          if (response.status === 401 || response.status === 403) throw new Error("API key was rejected");
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          events = data?._embedded?.events || [];
          if (events.length) break;
        }
      }
      const wantedDate = String(payload.event_date || "").slice(0, 10);
      const matchingEvents = events.filter((event) => !wantedDate || event.dates?.start?.localDate === wantedDate);
      const topPickEvent = matchingEvents[0];
      let topPicksDenied = false;
      const ticketmasterSeatStart = seatMatches.length;
      if (topPickEvent?.id) {
        const topPickParams = new URLSearchParams({
          apikey: settings.ticketmasterApiKey,
          quantity: String(requestedQuantity),
          limit: "50",
          selection: "Any",
          sort: "quality"
        });
        if (payload.section) topPickParams.set("sections", payload.section);
        const topPickResponse = await fetchWithTimeout(`https://app.ticketmaster.com/top-picks/v1/events/${encodeURIComponent(topPickEvent.id)}?${topPickParams}`);
        if (topPickResponse.ok) {
          const topPickData = await topPickResponse.json();
          const offers = new Map((topPickData?._embedded?.offer || []).map((offer) => [offer.offerId, offer]));
          for (const pick of topPickData.picks || []) {
            const offer = (pick.offers || []).map((id) => offers.get(id)).find((item) => item?.totalPrice != null || item?.faceValue != null);
            const each = Number(offer?.totalPrice ?? offer?.faceValue);
            if (!Number.isFinite(each) || each <= 0 || (offer?.limit?.max && offer.limit.max < requestedQuantity)) continue;
            const sectionMatch = wantedSection && normalizeSeat(pick.section) === wantedSection;
            const rowMatch = wantedRow && normalizeSeat(pick.row) === wantedRow;
            const deepUrl = new URL(topPickEvent.url);
            deepUrl.searchParams.set("ls_section", pick.section || "");
            deepUrl.searchParams.set("ls_row", pick.row || "");
            deepUrl.searchParams.set("ls_price", String(each));
            seatMatches.push({
              provider: "Ticketmaster",
              event: topPickEvent.name,
              venue: topPickEvent._embedded?.venues?.[0]?.name || null,
              captured_at: new Date().toISOString(),
              section: pick.section || "",
              row: pick.row || "",
              quantity: requestedQuantity,
              total_price: each * requestedQuantity,
              ticket_price: each,
              fee: offer?.totalPrice != null && offer?.faceValue != null ? Math.max(0, Number(offer.totalPrice) - Number(offer.faceValue)) : null,
              currency: offer?.currency || "USD",
              url: deepUrl.href,
              listing_level_url: false,
              assisted_seat_search: true,
              match_quality: sectionMatch && rowMatch ? "same section and row" : sectionMatch ? "same section" : "event-wide",
              quality_score: pick.quality ?? null
            });
          }
        } else if (topPickResponse.status === 401 || topPickResponse.status === 403) {
          topPicksDenied = true;
        }
      }
      if (topPickEvent?.url && seatMatches.length === ticketmasterSeatStart) {
        const captured = await scanMarketplacePage(topPickEvent.url, "Ticketmaster", requestedQuantity);
        for (const item of captured) {
          const sectionMatch = wantedSection && normalizeSeat(item.section) === wantedSection;
          const rowMatch = wantedRow && normalizeSeat(item.row) === wantedRow;
          const assistedUrl = new URL(topPickEvent.url);
          assistedUrl.searchParams.set("ls_section", item.section);
          assistedUrl.searchParams.set("ls_row", item.row);
          assistedUrl.searchParams.set("ls_price", String(item.price));
          seatMatches.push({
            provider: "Ticketmaster",
            event: topPickEvent.name,
            venue: topPickEvent._embedded?.venues?.[0]?.name || null,
            captured_at: new Date().toISOString(),
            section: item.section,
            row: item.row,
            quantity: requestedQuantity,
            total_price: item.price * requestedQuantity,
            ticket_price: item.price,
            fee: null,
            currency: "USD",
            url: assistedUrl.href,
            listing_level_url: false,
            assisted_seat_search: true,
            match_quality: sectionMatch && rowMatch ? "same section and row" : sectionMatch ? "same section" : "event-wide"
          });
        }
      }
      if (topPicksDenied && seatMatches.length === ticketmasterSeatStart) warnings.push("Ticketmaster did not authorize seat-level inventory, and its rendered event page returned no readable listings.");
      let pricedEvents = 0;
      for (const event of matchingEvents) {
        const price = event.priceRanges?.[0];
        if (price?.min != null) {
          pricedEvents += 1;
          listings.push({ provider: "Ticketmaster", event: event.name, date: event.dates?.start?.localDate, lowest: price.min, average: null, highest: price.max, currency: price.currency || "USD", url: event.url, price_type: "published event range" });
        }
      }
      if (!events.length) warnings.push(`Ticketmaster found no events for “${performerOnly}”.`);
      else if (!pricedEvents) warnings.push("Ticketmaster found the event, but did not provide an event-level price range.");
      providerStatus.push({ provider: "Ticketmaster", status: seatMatches.length + listings.length > ticketmasterStart ? "live" : "no_results", results: seatMatches.length + listings.length - ticketmasterStart });
    } catch (error) { warnings.push(`Ticketmaster failed: ${error.message}`); providerStatus.push({ provider: "Ticketmaster", status: "failed", results: 0 }); }
  }

  if (isTicketmasterPage && !seatMatches.length) {
    warnings.push("No live Ticketmaster seat cards were captured. Open the ticket list, wait for sections and rows to appear, then try again.");
  }

  if (settings.seatgeekClientId && String(payload.current_provider || "").toLowerCase() !== "seatgeek") {
    configured.push("SeatGeek");
    const seatGeekStart = listings.length;
    try {
      const params = new URLSearchParams({ client_id: settings.seatgeekClientId, q: payload.query, per_page: "5" });
      const response = await fetchWithTimeout(`https://api.seatgeek.com/2/events?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const wantedDate = String(payload.event_date || "").slice(0, 10);
      const events = (data.events || []).filter((event) => !wantedDate || event.datetime_local?.slice(0, 10) === wantedDate);
      for (const event of events.slice(0, 3)) {
        if (event.stats?.lowest_price != null) listings.push({ provider: "SeatGeek", event: event.title, date: event.datetime_local?.slice(0, 10), lowest: event.stats.lowest_price, average: event.stats.average_price, highest: event.stats.highest_price, currency: "USD", url: event.url, listing_level_url: false, price_type: "event-wide starting price; seat not guaranteed" });
      }
      providerStatus.push({ provider: "SeatGeek", status: listings.length > seatGeekStart ? "live" : "no_results", results: listings.length - seatGeekStart });
    } catch (error) { warnings.push(`SeatGeek failed: ${error.message}`); providerStatus.push({ provider: "SeatGeek", status: "failed", results: 0 }); }
  }

  const ticketsDevMarketplaceName = ticketsDevMarketplace(payload.event_url);
  if (settings.ticketsDevApiKey && ticketsDevMarketplaceName) {
    configured.push("Seat-level inventory");
    const inventoryStart = seatMatches.length;
    try {
      const params = new URLSearchParams({ url: payload.event_url, apiKey: settings.ticketsDevApiKey });
      const response = await fetchWithTimeout(`https://api.tickets.dev/v1/${ticketsDevMarketplaceName}/scrape?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const snapshot = await response.json();
      const wantedSection = normalizeSeat(payload.section);
      const wantedRow = normalizeSeat(payload.row);
      for (const item of snapshot.listings || []) {
        const sellable = String(item.sellableQuantities || "").split(",").filter((value) => value.trim()).map(Number).filter((value) => Number.isInteger(value) && value > 0);
        if ((item.quantity || 0) < requestedQuantity || (sellable.length && !sellable.includes(requestedQuantity))) continue;
        const sectionMatch = wantedSection && normalizeSeat(item.section) === wantedSection;
        const rowMatch = wantedRow && normalizeSeat(item.row) === wantedRow;
        if (wantedSection && !sectionMatch) continue;
        const listingUrl = item.url || item.listingUrl || item.checkoutUrl || null;
        const allInEach = Number(item.totalPrice);
        if (!Number.isFinite(allInEach) || allInEach <= 0) continue;
        seatMatches.push({ provider: String(snapshot.source || "Marketplace").replace(/^./, (c) => c.toUpperCase()), event: snapshot.eventName, venue: snapshot.venueName, captured_at: snapshot.capturedAt, section: item.section, row: item.row, quantity: requestedQuantity, available_quantity: item.quantity, total_price: allInEach * requestedQuantity, ticket_price: allInEach, face_price: item.ticketPrice, fee: item.fee, currency: snapshot.currency || "USD", url: listingUrl || snapshot.sourceUrl || payload.event_url, listing_level_url: Boolean(listingUrl), price_type: "all-in per ticket", match_quality: sectionMatch && rowMatch ? "same section and row" : sectionMatch ? "same section" : "event-wide" });
      }
      seatMatches.sort((a, b) => (a.match_quality === "same section and row" ? -1 : 0) - (b.match_quality === "same section and row" ? -1 : 0) || (a.total_price ?? Infinity) - (b.total_price ?? Infinity));
      providerStatus.push({ provider: `tickets.dev/${ticketsDevMarketplaceName}`, status: seatMatches.length > inventoryStart ? "live" : "no_results", results: seatMatches.length - inventoryStart });
    } catch (error) { warnings.push(`Seat inventory failed: ${error.message}`); providerStatus.push({ provider: `tickets.dev/${ticketsDevMarketplaceName}`, status: "failed", results: 0 }); }
  }

  const matchRank = { "same section and row": 0, "same section": 1, "event-wide": 2 };
  seatMatches.sort((a, b) => (matchRank[a.match_quality] ?? 3) - (matchRank[b.match_quality] ?? 3) || Number(b.quality_score ?? -1) - Number(a.quality_score ?? -1) || Number(a.total_price ?? Infinity) - Number(b.total_price ?? Infinity));
  const seatPrices = seatMatches.filter((item) => item.currency === "USD").map((item) => Number(item.total_price)).filter(Number.isFinite);
  const eventPrices = listings.filter((item) => item.currency === "USD").map((item) => Number(item.lowest) * requestedQuantity).filter(Number.isFinite);
  const marketLow = seatPrices.length ? Math.min(...seatPrices) : eventPrices.length ? Math.min(...eventPrices) : null;
  return { query: payload.query, checked_at: new Date().toISOString(), current_price: payload.current_price, market_low: marketLow, grade: directGrade(payload.current_price, marketLow), requested_seat: { section: payload.section || "", row: payload.row || "", quantity: requestedQuantity }, seat_matches: seatMatches.slice(0, 12), listings: listings.slice(0, 10), configured_providers: configured, provider_status: providerStatus, warnings, source_mode: "direct" };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LS_ASSESS_URL") sendResponse({ result: assessUrl(message.url) });
  else if (message?.type === "LS_OPEN_URL") {
    const domain = extractDomain(message.url);
    if (!domain || !OFFICIAL_VENDORS.some((vendor) => isVendorDomain(domain, vendor))) sendResponse({ ok: false, message: "Blocked an unrecognized ticket link." });
    else chrome.tabs.create({ url: message.url }, () => sendResponse({ ok: !chrome.runtime.lastError }));
    return true;
  }
  else if (message?.type === "LS_REPORT_DOMAIN") {
    fetchWithTimeout(`${BACKEND_BASE}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: message.domain, reason: message.reason, details: message.details }) }, 15000)
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Report failed"); return body; })
      .then((body) => sendResponse({ ok: true, message: body.message || "Report submitted." }))
      .catch((error) => sendResponse({ ok: false, message: error.message || "The reporting service is unavailable. Try again later." }));
    return true;
  }
  else if (message?.type === "LS_COMPARE_TICKETS") {
    // Comparisons run locally so a stale Render deployment cannot override live
    // page inventory. The backend remains responsible for owner reports only.
    directComparison(message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, message: error.message || "Live price data is unavailable." }));
    return true;
  }
});
