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
      :host{all:initial}.wrap{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:286px;font-family:Inter,system-ui,sans-serif;color:#edf4ff;filter:drop-shadow(0 16px 30px #0008)}
      button{font:inherit}.toggle{float:right;border:1px solid #4d9cff66;border-radius:999px;background:#0b1a2e;color:#fff;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer}.panel{clear:both;margin-bottom:8px;border:1px solid #ffffff20;border-radius:15px;background:#07111ff2;overflow:hidden;backdrop-filter:blur(16px)}
      .head{display:flex;justify-content:space-between;align-items:center;padding:11px 12px;border-bottom:1px solid #ffffff16}.brand{font-size:12px;font-weight:850}.source{color:#7de9c3;font-size:9px}.close{border:0;background:none;color:#91a8c8;cursor:pointer}.controls{display:grid;grid-template-columns:1fr 1fr auto;gap:5px;padding:8px;border-bottom:1px solid #ffffff12}.controls input{min-width:0;padding:6px;border:1px solid #ffffff20;border-radius:6px;background:#0c1b2e;color:#fff;font-size:9px}.compare{border:0;border-radius:6px;background:#2878ff;color:#fff;font-size:9px;font-weight:750;cursor:pointer}.status{padding:7px 10px;color:#91a8c8;font-size:8px}.list{max-height:250px;overflow:auto}.seat{display:grid;grid-template-columns:1fr auto;gap:3px 8px;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #ffffff12;background:none;color:#edf4ff;text-align:left;cursor:pointer}.seat:hover{background:#16304d}.where{font-size:11px;font-weight:750}.row{font-size:9px;color:#9eb2cf}.price{grid-column:2;grid-row:1/3;color:#6ce6bb;font-size:14px;font-weight:900}.external-title{padding:8px 10px 3px;color:#91a8c8;font-size:8px;text-transform:uppercase}.foot{padding:8px 12px;color:#8298b7;font-size:8px;line-height:1.35}.hidden{display:none}
    </style>
    <div class="wrap"><div class="panel"><div class="head"><div><div class="brand">LegitSeat Live</div><div class="source"></div></div><button class="close" type="button">×</button></div><div class="controls"><input class="qty" type="number" min="1" max="20" placeholder="Quantity"><input class="entered-price" type="number" min="0.01" placeholder="Price each"><button class="compare" type="button">Compare</button></div><div class="status">Scanning visible tickets…</div><div class="list"></div><div class="external"></div><div class="foot">Verified visible inventory only. Exact-seat actions open the matching listing.</div></div><button class="toggle hidden" type="button">LegitSeat · <span class="count">0</span> seats</button></div>`;
  document.documentElement.append(host);

  const panel = root.querySelector(".panel");
  const list = root.querySelector(".list");
  const toggle = root.querySelector(".toggle");
  const count = root.querySelector(".count");
  const status = root.querySelector(".status");
  const external = root.querySelector(".external");
  root.querySelector(".source").textContent = provider + " · updating while you scroll";
  root.querySelector(".close").addEventListener("click", () => { panel.classList.add("hidden"); toggle.classList.remove("hidden"); });
  toggle.addEventListener("click", () => { toggle.classList.add("hidden"); panel.classList.remove("hidden"); });

  let listings = [];
  let scanTimer = null;
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
    const median = listings.length ? listings[Math.floor(listings.length / 2)].price : null;
    for (const [index, item] of listings.slice(0, 8).entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat";
      button.innerHTML = `<span class="where"></span><span class="row"></span><span class="price"></span>`;
      button.querySelector(".where").textContent = "Section " + item.section;
      const valueLabel = index === 0 ? "best visible price" : median && item.price <= median * 0.9 ? "great price" : median && item.price <= median ? "good price" : "visible listing";
      button.querySelector(".row").textContent = "Row " + item.row + " · " + valueLabel;
      button.querySelector(".price").textContent = "$" + item.price.toFixed(2) + " ea";
      button.addEventListener("click", () => activate(item));
      list.append(button);
    }
    count.textContent = String(listings.length);
    status.textContent = listings.length ? `${listings.length} visible ${provider} listing${listings.length === 1 ? "" : "s"} found.` : "No section/row cards visible yet. Scroll the ticket list.";
  }

  function openProviderUrl(url) {
    chrome.runtime.sendMessage({ type: "LS_OPEN_URL", url }, (response) => {
      if (!response?.ok) status.textContent = response?.message || "The provider link could not be opened.";
    });
  }

  function renderExternal(data) {
    external.replaceChildren();
    const results = [
      ...(data.seat_matches || []).filter((item) => !item.is_current_page),
      ...(data.listings || []).map((item) => ({ ...item, ticket_price: item.lowest, match_quality: "event-wide" }))
    ].sort((a, b) => Number(a.ticket_price ?? a.lowest ?? Infinity) - Number(b.ticket_price ?? b.lowest ?? Infinity));
    if (!results.length) {
      status.textContent = "No other configured provider returned verified priced inventory for this event.";
      return;
    }
    external.append(Object.assign(document.createElement("div"), { className: "external-title", textContent: "Other verified sources" }));
    for (const [index, item] of results.slice(0, 6).entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat";
      button.innerHTML = `<span class="where"></span><span class="row"></span><span class="price"></span>`;
      button.querySelector(".where").textContent = item.provider + (item.section ? " · Section " + item.section : " · event-wide");
      button.querySelector(".row").textContent = (item.row ? "Row " + item.row : "Event-wide; exact seat not guaranteed") + (index === 0 ? " · best cross-site price" : "");
      button.querySelector(".price").textContent = "$" + Number(item.ticket_price ?? item.lowest).toFixed(2) + " ea";
      button.addEventListener("click", () => openProviderUrl(item.url));
      external.append(button);
    }
    status.textContent = `${results.length} cross-site priced result${results.length === 1 ? "" : "s"} returned after checking configured providers.`;
  }

  function compareSources() {
    const quantity = Number(root.querySelector(".qty").value);
    const each = Number(root.querySelector(".entered-price").value);
    if (!Number.isInteger(quantity) || quantity < 1) { status.textContent = "Enter quantity before comparing."; return; }
    if (!Number.isFinite(each) || each <= 0) { status.textContent = "Enter the displayed price per ticket."; return; }
    if (!listings.length) { status.textContent = "Scroll until ticket cards are visible, then compare."; return; }
    status.textContent = "Checking every configured pricing source…";
    external.replaceChildren();
    chrome.runtime.sendMessage({ type: "LS_COMPARE_TICKETS", payload: {
      query: document.querySelector('meta[property="og:title"]')?.content || document.title,
      event_url: location.href,
      current_provider: provider,
      event_date: document.querySelector('meta[property="event:start_time"]')?.content || document.querySelector("time[datetime]")?.dateTime || "",
      page_listings: listings.map((item) => ({ section: item.section, row: item.row, quantity, total_price: item.price })),
      section: "", row: "", quantity, current_price: each * quantity
    } }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) status.textContent = response?.message || chrome.runtime.lastError?.message || "Comparison failed.";
      else renderExternal(response.data);
    });
  }
  root.querySelector(".compare").addEventListener("click", compareSources);

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
