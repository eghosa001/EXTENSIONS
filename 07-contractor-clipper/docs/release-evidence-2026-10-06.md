# Contractor Clipper v0.3.0 release evidence

Release candidate validated on 2026-10-06.

## GitHub release gate
- Pull request: #4 — Finish Contractor Clipper 100-point release gate
- Final headed-browser run: 37411736895
- Head commit validated: `207997d48dcdaa3e75026bccde234252e429cd29`
- Scoped Contractor Clipper tests and syntax checks: PASS
- Headed Chromium extension release QA: PASS
- Clean Chrome Web Store ZIP build and archive integrity check: PASS
- 1280×800 screenshot dimension check: PASS
- Release-QA artifact upload: PASS
- GitHub artifact digest: `sha256:2d6d0952da8c783acfc26d792e953d52ef809e519607aeb1a09ff88c195805c0`

## Browser workflow evidence
The final browser run verified:
- unpacked Manifest V3 extension loads in Chromium;
- Side Panel registration and `openPanelOnActionClick` behavior;
- keyboard-triggered Scan/Add workflow;
- product title, SKU, price and currency extraction on a deterministic product page;
- supplier memory;
- live quote workspace refresh after clipping;
- 320 px side-panel overflow behavior;
- project create, duplicate and delete;
- client, estimate, validity and notes metadata;
- business branding and local logo handling;
- JSON backup and restore;
- CSV export;
- SpreadsheetML XML export;
- print/PDF privacy behavior;
- local storage persistence across browser relaunch.

## Live supplier extraction
The strict gate only counts a supplier when the page returns HTTP 2xx/3xx and the extractor finds a genuine product title plus SKU or price evidence.

Passing live product pages in the final run:
- IKEA — HTTP 200; title, SKU, price, currency and image extracted.
- Floor & Decor — HTTP 200; title, SKU, price, currency and image extracted.
- Pottery Barn — HTTP 200; title, SKU, price, currency and image extracted.
- West Elm — HTTP 200; title, SKU, price, currency and image extracted.

Non-passing candidates were not counted:
- Lamps Plus returned a generic page without product SKU/price evidence.
- Rejuvenation returned HTTP 403.

This exceeds the required minimum of three genuine supplier domains.

## Export and privacy verification
The generated SpreadsheetML export was opened headlessly in LibreOffice Calc and converted successfully to XLSX.

The generated client-estimate PDF was text-extracted and checked for the internal labels `Cost` and `Markup`; neither label was present.

## Release artifacts
- Web Store ZIP SHA-256: `29ed703b6be05f839e87018c3228061ed69d526b891e6c31f5e7ab8168cc0769`
- Store screenshot SHA-256: `0822a71531963c3fb19f9eaaffd49b529e21113a0a2c15d01f60329cd490afde`
- Store screenshot: 1280×800 PNG.
- Web Store ZIP: `contractor-clipper-v0.3.0.zip`.

The one-time heavy browser workflow was removed after this evidence was captured so normal repository CI remains change-scoped and lightweight.
