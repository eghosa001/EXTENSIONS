# Contractor Clipper v0.3.0 production release checklist

## Automated production gate
- [x] Manifest V3
- [x] Side Panel API compatibility declared with minimum Chrome 114
- [x] Minimum permissions only: activeTab, scripting, storage, sidePanel
- [x] No broad host permissions
- [x] Restrictive extension-page CSP
- [x] Product extraction module covered by scoped tests
- [x] Structured-data and metadata extraction fallbacks
- [x] Currency inference fallback
- [x] Quote math clamps invalid/negative costing inputs
- [x] Products and delivery reconcile separately in totals
- [x] Client print/PDF hides internal cost and markup
- [x] Project/client/estimate metadata supported
- [x] Local backup and restore
- [x] CSV export
- [x] Excel-compatible SpreadsheetML XML export
- [x] Unsafe URL protocols blocked before rendering
- [x] Imported data normalized
- [x] Cross-page storage changes refresh the workspace
- [x] Version metadata aligned
- [x] No remote code or hidden network primitives
- [x] Change-scoped Node tests and syntax checks

## Privacy and store copy
- [x] Local-first privacy document
- [x] Permission purposes documented
- [x] Pre-scan website-data disclosure in the extension UI
- [x] Chrome Web Store listing copy updated for v0.3.0
- [x] Privacy-practices disclosure guide prepared
- [x] Publish a public HTTPS privacy-policy URL — GitHub-hosted policy
- [x] Publish a public support URL/contact page — public GitHub Issues

## Store assets
- [x] Product-specific 16, 32, 48 and 128 px extension icons
- [x] Chrome Web Store 128 px store icon
- [x] Polished 1280×800 quote-workspace store screenshot generated and dimension-verified
- [x] 440×280 Chrome Web Store promotional tile

## Browser release QA — completed
- [x] Load unpacked Manifest V3 extension in headed Chromium
- [x] Verify Side Panel registration and toolbar-action open behavior
- [x] Test extraction on at least 3 genuine live supplier sites
- [x] Require live pages to return 2xx/3xx plus real SKU or price evidence before counting
- [x] Verify product title, SKU, price, currency and image extraction/correction workflow
- [x] Save supplier memory and verify it is reused on the matching host
- [x] Clip while quote workspace is already open and confirm live refresh
- [x] Create, duplicate and delete projects
- [x] Verify estimate number, validity, client email/address and notes
- [x] Verify delivery, markup, labour, discount, tax and grand-total calculations
- [x] Verify printed/PDF quote does not expose cost or markup
- [x] Add a local logo and verify branded estimate rendering
- [x] Export and inspect CSV successfully
- [x] Export SpreadsheetML XML and open it successfully in LibreOffice Calc
- [x] Backup workspace, change data, restore backup and verify recovery
- [x] Relaunch Chromium and confirm local data persists
- [x] Test 320 px side-panel width and keyboard-triggered Scan
- [x] Build and integrity-test the clean Web Store ZIP
- [x] Verify store screenshot is exactly 1280×800

See `docs/release-evidence-2026-10-06.md` for the reproducible evidence and hashes.

## Commercial validation after release candidate
- [ ] Test with at least 5 contractors/designers
- [ ] Measure whether users create a second quote without help
- [ ] Record supplier sites where extraction needs correction
- [ ] Test willingness to pay around $7.99–$12.99/month
- [ ] Do not add cloud sync/accounts until validation justifies the extra privacy/security surface
