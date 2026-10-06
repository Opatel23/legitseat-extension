# LegitSeat Extension

LegitSeat is a Chrome extension for inspecting ticket listings and comparing available provider data. Comparisons run in the extension using visible page listings and optional provider credentials. The separate backend receives marketplace reports.

This is a testing build, not a verified universal ticket search engine. Marketplace layouts and API access vary. Event-level starting prices do not guarantee a seat, quantity, or final checkout total. Current-page quantity totals are estimates when the page does not disclose inventory. Verify event date, venue, fees, and availability before buying.

The automated tests use simulated provider responses. Live marketplace navigation and report delivery still require manual testing. Domain signals and Checkout Guardian are aids, not ticket authenticity guarantees.

The Python service is maintained separately in the `legitseat-backend` repository. This repository contains only the browser extension.

## Sites with page scanning

- Ticketmaster and Live Nation
- SeatGeek
- StubHub
- Vivid Seats
- TickPick
- Viagogo
- Gametime
- AXS

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository folder.
4. Open the extension options page to configure optional marketplace API credentials.

Credentials are stored in Chrome local extension storage. Do not commit API keys or place them directly in the source files.

## Test

Run the background-service tests with Node.js 20 or newer:

```powershell
node --test tests/background.test.cjs
```

## Repository contents

- `manifest.json` — Manifest V3 configuration and site permissions
- `background.js` — service worker, API requests, normalization, and comparisons
- `content.js` — event-page extraction
- `popup.html` / `popup.js` — comparison interface
- `options.html` / `options.js` — local credential settings
- `tests/` — automated background-service tests
