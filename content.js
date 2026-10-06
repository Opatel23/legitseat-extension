(() => {
  if (window.top !== window || document.getElementById("legitseat-live-host")) return;

  const providers = [
    ["Ticketmaster", ["ticketmaster.com", "livenation.com"]],
    ["SeatGeek", ["seatgeek.com"]],
    ["TickPick", ["tickpick.com"]],
    ["StubHub", ["stubhub.com"]],
    ["Vivid Seats", ["vividseats.com"]],
    ["viagogo", ["viagogo.com"]],
    ["Gametime", ["gametime.co"]],
    ["AXS", ["axs.com"]]
  ];
  const domain = location.hostname.toLowerCase().replace(/^www\./, "");
  const provider = providers.find(([, domains]) => domains.some((item) => domain === item || domain.endsWith("." + item)))?.[0];
  if (!provider) return;

  const host = document.createElement("div");
  host.id = "legitseat-live-host";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host{all:initial}.wrap{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:316px;max-width:calc(100vw - 24px);font-family:Inter,system-ui,-apple-system,sans-serif;color:#edf4ff;filter:drop-shadow(0 18px 38px #0009)}
      button{font:inherit}.toggle{float:right;border:1px solid #4d9cff66;border-radius:999px;background:linear-gradient(135deg,#0e2139,#102b47);color:#fff;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 10px 25px #0006}.panel{clear:both;margin-bottom:8px;border:1px solid #ffffff22;border-radius:17px;background:linear-gradient(155deg,#09182af7,#06101df2);overflow:hidden;backdrop-filter:blur(18px);box-shadow:inset 0 1px #ffffff0d}
      .head{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-bottom:1px solid #ffffff14}.brand{font-size:13px;font-weight:850;letter-spacing:-.01em}.source{margin-top:2px;color:#7de9c3;font-size:9px}.close{width:28px;height:28px;border:0;border-radius:8px;background:#ffffff08;color:#9fb2ce;cursor:pointer;font-size:17px}.close:hover{background:#ffffff12;color:#fff}.controls{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px;border-bottom:1px solid #ffffff12}.controls input{min-width:0;padding:8px;border:1px solid #ffffff20;border-radius:8px;outline:0;background:#071322;color:#fff;font-size:9px}.controls input::placeholder{color:#657c9c}.controls input:focus-visible{border-color:#4da5ff;box-shadow:0 0 0 3px #2789ff25}.compare{grid-column:1/-1;padding:9px;border:1px solid #58b4ff33;border-radius:8px;background:linear-gradient(135deg,#2878ff,#20a4e8);color:#fff;font-size:9px;font-weight:800;cursor:pointer;box-shadow:0 7px 18px #147add35}.compare:hover{filter:brightness(1.1)}.compare:focus-visible,.seat:focus-visible,.toggle:focus-visible,.close:focus-visible{outline:2px solid #76bbff;outline-offset:2px}.compare:disabled{opacity:.55;cursor:wait}.status{padding:8px 11px;color:#9bafca;font-size:8px;line-height:1.4}.verdict{margin:0 10px 9px;padding:9px;border:1px solid #ffffff0d;border-radius:9px;font-size:9px;font-weight:750;line-height:1.4}.verdict.green{background:#123d32;color:#73e8bf}.verdict.yellow{background:#493a16;color:#ffd778}.verdict.red{background:#431d28;color:#ff9caf}.coverage{display:flex;flex-wrap:wrap;gap:5px;padding:0 10px 8px}.source-pill{padding:3px 6px;border-radius:99px;background:#ffffff0e;color:#a9bad2;font-size:7px}.source-pill.live{background:#123d32;color:#73e8bf}.source-pill.failed{background:#431d28;color:#ff9caf}.section-title{display:flex;justify-content:space-between;padding:9px 11px 4px;color:#91a8c8;font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.section-title span{color:#6f87a7;font-weight:650;letter-spacing:0;text-transform:none}.list{max-height:270px;overflow:auto;scrollbar-width:thin;scrollbar-color:#42658b transparent}.seat{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 9px;width:100%;padding:11px 13px;border:0;border-bottom:1px solid #ffffff10;background:none;color:#edf4ff;text-align:left;cursor:pointer;transition:background .12s}.seat:hover{background:#15304d}.seat:disabled{opacity:.55;cursor:not-allowed}.where{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:780}.row{font-size:9px;line-height:1.35;color:#9eb2cf}.price{grid-column:2;grid-row:1/3;color:#71e9be;font-size:13px;font-weight:900;text-align:right;white-space:pre-line;font-variant-numeric:tabular-nums}.foot{padding:9px 13px;color:#8096b4;font-size:8px;line-height:1.45}.hidden{display:none}@media(max-width:420px){.wrap{right:12px;bottom:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
      *,*::before,*::after{box-sizing:border-box}
      .panel{max-height:calc(100vh - 44px);max-height:calc(100dvh - 44px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#42658b transparent}
      .head{position:sticky;top:0;z-index:1;background:#09182a}
      .list{max-height:none;overflow:visible}
      .where{white-space:normal;overflow-wrap:anywhere;line-height:1.4}
      .price{max-width:125px;overflow-wrap:anywhere}
      .row{overflow-wrap:anywhere}
      .close{flex-shrink:0;margin-left:8px}
      .seat:focus-visible{outline-offset:-3px}
      @media(max-width:280px){.controls{grid-template-columns:1fr}.seat{grid-template-columns:1fr}.price{grid-column:1;grid-row:auto;text-align:left;max-width:none}.section-title{flex-wrap:wrap;gap:4px}}
    </style>
    <div class="wrap"><div class="panel"><div class="head"><div><div class="brand">LegitSeat Live</div><div class="source"></div></div><button class="close" type="button" aria-label="Minimize LegitSeat">×</button></div><div class="controls"><input class="preferred-section" aria-label="Preferred section" maxlength="20" placeholder="Preferred section"><input class="preferred-row" aria-label="Preferred row" maxlength="12" placeholder="Preferred row"><input class="qty" aria-label="Ticket quantity" type="number" min="1" max="20" placeholder="Quantity"><input class="entered-price" aria-label="Current price per ticket" type="number" min="0.01" placeholder="Current price each"><button class="compare" type="button">Compare available sources</button></div><div class="status" role="status">Scanning visible tickets…</div><div class="verdict hidden"></div><div class="coverage"></div><div class="local-title section-title hidden">Visible on this page <span></span></div><div class="list"></div><div class="external"></div><div class="foot">Prices reflect captured data. Confirm seats, quantity, and fees on the seller’s page.</div></div><button class="toggle hidden" type="button" aria-label="Open LegitSeat live panel">LegitSeat · <span class="count">0</span> seats</button></div>`;
  document.documentElement.append(host);

  const panel = root.querySelector(".panel");
  const list = root.querySelector(".list");
  const toggle = root.querySelector(".toggle");
  const count = root.querySelector(".count");
  const status = root.querySelector(".status");
  const coverage = root.querySelector(".coverage");
  const localTitle = root.querySelector(".local-title");
  const verdict = root.querySelector(".verdict");
  const external = root.querySelector(".external");
  root.querySelector(".source").textContent = provider + " · updating while you scroll";
  root.querySelector(".close").addEventListener("click", () => {
    panel.classList.add("hidden");
    toggle.classList.remove("hidden");
    chrome.storage.local.set({ livePanelMinimized: true });
  });
  toggle.addEventListener("click", () => {
    toggle.classList.add("hidden");
    panel.classList.remove("hidden");
    chrome.storage.local.set({ livePanelMinimized: false });
  });
  chrome.storage.local.get("livePanelMinimized", ({ livePanelMinimized }) => {
    if (livePanelMinimized) {
      panel.classList.add("hidden");
      toggle.classList.remove("hidden");
    }
  });

  let listings = [];
  let scanTimer = null;
  let comparisonSummary = "";
  let comparing = false;
  let comparisonRevision = 0;
  let deepTargetHandled = false;
  const deepTarget = {
    section: new URLSearchParams(location.search).get("ls_section") || "",
    row: new URLSearchParams(location.search).get("ls_row") || "",
    price: Number(new URLSearchParams(location.search).get("ls_price")) || null
  };
  const selectors = "button, li, article, [role='button'], [role='listitem'], [data-testid*='offer'], [data-testid*='ticket'], [data-testid*='listing'], [class*='offer'], [class*='listing']";
  const parse = (element) => {
    const text = (element.innerText || element.textContent || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
    if (!text || text.length > 1600) return null;
    const section = text.match(/\b(?:Section|Sec|Zone)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 .-]{0,25}?)(?=\s*(?:[•·|,]|\s+-\s)?\s*Row\b)/i)?.[1]?.trim();
    const row = text.match(/\bRow\s*[:#-]?\s*([A-Z0-9][A-Z0-9.-]{0,12})/i)?.[1]?.trim();
    const price = Number(text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1]?.replace(/,/g, ""));
    if (!section || section === "s" || !row || !Number.isFinite(price) || price <= 0) return null;
    const anchor = element.matches("a[href]") ? element : element.querySelector("a[href]");
    return { section, row, price, element, directUrl: anchor?.href || "", textLength: text.length };
  };

  function activate(item) {
    if (!item.element?.isConnected) { scheduleScan(0); return; }
    item.element.scrollIntoView({ behavior: "smooth", block: "center" });
    item.element.style.outline = "3px solid #43e3a8";
    item.element.style.outlineOffset = "3px";
    const clickable = item.element.matches("button, a, [role='button']") ? item.element : item.element.querySelector("button, a, [role='button']") || item.element.closest("button, a, [role='button']");
    if (clickable) clickable.click();
    else if (item.directUrl) location.assign(item.directUrl);
    else item.element.click();
    window.setTimeout(() => { if (item.element?.isConnected) item.element.style.outline = ""; }, 1800);
  }

  function render() {
    list.replaceChildren();
    const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const wantedSection = normalize(root.querySelector(".preferred-section").value);
    const wantedRow = normalize(root.querySelector(".preferred-row").value);
    const quantity = Number(root.querySelector(".qty").value);
    const ranked = [...listings].sort((a, b) => {
      const rank = (item) => wantedSection && normalize(item.section) === wantedSection ? (wantedRow && normalize(item.row) === wantedRow ? 0 : 1) : 2;
      return rank(a) - rank(b) || a.price - b.price;
    });
    const priceSorted = [...listings].sort((a, b) => a.price - b.price);
    const median = priceSorted.length ? priceSorted[Math.floor(priceSorted.length / 2)].price : null;
    for (const [index, item] of ranked.slice(0, 8).entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat";
      button.innerHTML = `<span class="where"></span><span class="row"></span><span class="price"></span>`;
      button.querySelector(".where").textContent = "Section " + item.section;
      const exact = wantedSection && normalize(item.section) === wantedSection && wantedRow && normalize(item.row) === wantedRow;
      const sameSection = wantedSection && normalize(item.section) === wantedSection;
      const valueLabel = exact ? "exact section and row" : sameSection ? "same section" : item.price === priceSorted[0]?.price ? "best visible price" : median && item.price <= median * 0.9 ? "great price" : median && item.price <= median ? "good price" : "nearby option";
      button.querySelector(".row").textContent = "Row " + item.row + " · " + valueLabel;
      button.querySelector(".price").textContent = "$" + item.price.toFixed(2) + " ea" + (Number.isInteger(quantity) && quantity > 0 ? `\n$${(item.price * quantity).toFixed(2)} total` : "");
      button.addEventListener("click", () => activate(item));
      list.append(button);
    }
    count.textContent = String(listings.length);
    localTitle.classList.toggle("hidden", !listings.length);
    localTitle.querySelector("span").textContent = listings.length ? `${listings.length} captured` : "";
    status.textContent = comparisonSummary || (listings.length ? `${listings.length} visible ${provider} listing${listings.length === 1 ? "" : "s"} found.` : "No section/row cards visible yet. Scroll the ticket list.");
  }

  function openProviderUrl(url) {
    chrome.runtime.sendMessage({ type: "LS_OPEN_URL", url }, (response) => {
      if (!response?.ok) status.textContent = response?.message || "The provider link could not be opened.";
    });
  }

  function renderExternal(data) {
    external.replaceChildren();
    coverage.replaceChildren();
    verdict.className = "verdict hidden";
    for (const source of data.provider_status || []) {
      const pill = document.createElement("span");
      pill.className = "source-pill " + source.status;
      pill.textContent = `${source.provider}: ${source.status === "live" ? source.results + " live" : source.status === "failed" ? "failed" : "no matches"}`;
      coverage.append(pill);
    }
    const rawResults = [
      ...(data.seat_matches || []).filter((item) => !item.is_current_page && String(item.provider || "").toLowerCase() !== provider.toLowerCase()),
      ...(data.listings || []).map((item) => ({ ...item, ticket_price: item.lowest, match_quality: "event-wide" }))
    ];
    const uniqueResults = new Map();
    for (const item of rawResults) {
      const key = [item.provider, item.section, item.row, item.ticket_price ?? item.lowest, item.url].map((value) => String(value || "").toLowerCase()).join("|");
      if (!uniqueResults.has(key)) uniqueResults.set(key, item);
    }
    const rank = { "same section and row": 0, "same section": 1, "event-wide": 2 };
    const results = [...uniqueResults.values()].sort((a, b) => (rank[a.match_quality] ?? 3) - (rank[b.match_quality] ?? 3) || Number(a.total_price ?? a.ticket_price ?? a.lowest ?? Infinity) - Number(b.total_price ?? b.ticket_price ?? b.lowest ?? Infinity));
    const requestedQuantity = Number(root.querySelector(".qty").value);
    const currentTotal = Number(data.current_price);
    const bestAlternativeTotal = results.length ? Number(results[0].total_price ?? Number(results[0].ticket_price ?? results[0].lowest) * requestedQuantity) : NaN;
    if (Number.isFinite(currentTotal) && Number.isFinite(bestAlternativeTotal) && bestAlternativeTotal > 0) {
      const difference = currentTotal - bestAlternativeTotal;
      const ratio = difference / bestAlternativeTotal;
      const tone = ratio <= 0.05 ? "green" : ratio <= 0.20 ? "yellow" : "red";
      const label = tone === "green" ? "Near lowest returned price" : tone === "yellow" ? "Compare details" : "Above lowest returned price";
      verdict.className = "verdict " + tone;
      verdict.textContent = difference > 0.01 ? `${label}: the lowest returned option is $${difference.toFixed(2)} lower for this quantity.` : `${label}: your entered total is at or below the lowest returned option.`;
    }
    if (!results.length) {
      comparisonSummary = "No other configured provider returned priced inventory for this event.";
      status.textContent = comparisonSummary;
      return;
    }
    const heading = Object.assign(document.createElement("div"), { className: "section-title" });
    heading.append("Other sources", Object.assign(document.createElement("span"), { textContent: `${results.length} unique` }));
    external.append(heading);
    const lowestEach = Math.min(...results.map((item) => Number(item.ticket_price ?? item.lowest)).filter(Number.isFinite));
    for (const [index, item] of results.slice(0, 6).entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat";
      button.innerHTML = `<span class="where"></span><span class="row"></span><span class="price"></span>`;
      const exactDestination = Boolean(item.listing_level_url);
      button.querySelector(".where").textContent = item.provider + (item.section ? " · Section " + item.section : " · event-wide");
      const each = Number(item.ticket_price ?? item.lowest);
      const distinction = index === 0 ? " · best match" : each === lowestEach ? " · lowest price" : "";
      button.querySelector(".row").textContent = (item.row ? "Row " + item.row : "Seat not guaranteed") + ` · ${exactDestination ? "listing link" : "event page"}` + distinction;
      const total = Number(item.total_price);
      button.querySelector(".price").textContent = "$" + each.toFixed(2) + " ea" + (Number.isFinite(total) ? `\n$${total.toFixed(2)} total` : Number.isInteger(requestedQuantity) && requestedQuantity > 0 ? `\n$${(each * requestedQuantity).toFixed(2)} total` : "");
      if (item.url) button.addEventListener("click", () => openProviderUrl(item.url));
      else { button.disabled = true; button.title = "This provider did not return a destination URL."; }
      external.append(button);
    }
    comparisonSummary = `${results.length} cross-site priced result${results.length === 1 ? "" : "s"} · checked just now.`;
    status.textContent = comparisonSummary;
  }

  function clearComparison() {
    comparisonSummary = "";
    external.replaceChildren();
    coverage.replaceChildren();
    verdict.className = "verdict hidden";
  }

  function compareSources() {
    if (comparing) return;
    const quantity = Number(root.querySelector(".qty").value);
    const each = Number(root.querySelector(".entered-price").value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) { status.textContent = "Quantity must be a whole number from 1 to 20."; return; }
    if (!Number.isFinite(each) || each <= 0 || each > 100000) { status.textContent = "Enter a per-ticket price from $0.01 to $100,000."; return; }
    if (!listings.length) { status.textContent = "Scroll until ticket cards are visible, then compare."; return; }
    const section = root.querySelector(".preferred-section").value.trim();
    const row = root.querySelector(".preferred-row").value.trim();
    comparing = true;
    const revision = ++comparisonRevision;
    const requestUrl = location.href;
    comparisonSummary = "Checking every configured pricing source…";
    status.textContent = comparisonSummary;
    root.querySelector(".compare").disabled = true;
    external.replaceChildren();
    chrome.runtime.sendMessage({ type: "LS_COMPARE_TICKETS", payload: {
      query: document.querySelector('meta[property="og:title"]')?.content || document.title,
      event_url: location.href,
      current_provider: provider,
      event_date: document.querySelector('meta[property="event:start_time"]')?.content || document.querySelector("time[datetime]")?.dateTime || "",
      page_listings: listings.map((item) => ({ section: item.section, row: item.row, quantity, total_price: item.price })),
      section, row, quantity, current_price: each * quantity
    } }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (revision !== comparisonRevision) return;
      comparing = false;
      root.querySelector(".compare").disabled = false;
      if (location.href !== requestUrl) {
        clearComparison();
        status.textContent = "The page changed. Compare again for the current event.";
        return;
      }
      if (runtimeError || !response?.ok) {
        comparisonSummary = response?.message || runtimeError?.message || "Comparison failed.";
        status.textContent = comparisonSummary;
      } else renderExternal(response.data);
    });
  }
  root.querySelector(".compare").addEventListener("click", compareSources);
  for (const selector of [".preferred-section", ".preferred-row", ".qty", ".entered-price"]) root.querySelector(selector).addEventListener("input", () => {
    comparisonRevision += 1;
    comparing = false;
    root.querySelector(".compare").disabled = false;
    clearComparison();
    render();
  });
  root.querySelector(".controls").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      compareSources();
    }
  });

  function scan() {
    scanTimer = null;
    const foundBySeat = new Map();
    for (const element of document.querySelectorAll(selectors)) {
      const item = parse(element);
      if (!item) continue;
      const key = `${item.section.toLowerCase()}|${item.row.toLowerCase()}|${item.price}`;
      const existing = foundBySeat.get(key);
      if (!existing || item.textLength < existing.textLength) foundBySeat.set(key, item);
    }
    listings = [...foundBySeat.values()].sort((a, b) => a.price - b.price).slice(0, 30);
    render();
    if (!deepTargetHandled && deepTarget.section && deepTarget.row) {
      const exact = listings.find((item) => item.section.toLowerCase() === deepTarget.section.toLowerCase() && item.row.toLowerCase() === deepTarget.row.toLowerCase() && (!deepTarget.price || Math.abs(item.price - deepTarget.price) < 1));
      if (exact) {
        deepTargetHandled = true;
        const cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete("ls_section");
        cleanUrl.searchParams.delete("ls_row");
        cleanUrl.searchParams.delete("ls_price");
        history.replaceState(history.state, "", cleanUrl.href);
        status.textContent = `Opening Ticketmaster Section ${exact.section}, Row ${exact.row}…`;
        activate(exact);
      }
    }
  }

  function scheduleScan(delay = 180) {
    if (scanTimer != null) return;
    scanTimer = window.setTimeout(scan, delay);
  }
  new MutationObserver(() => scheduleScan()).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener("scroll", () => scheduleScan(80), { passive: true });
  scheduleScan(0);
})();
