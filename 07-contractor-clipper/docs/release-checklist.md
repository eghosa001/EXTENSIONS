# Contractor Clipper v0.3.0 production release checklist

## Automated production gate
- [x] Manifest V3
- [x] Side Panel API compatibility declared with minimum Chrome 114
- [x] Minimum production permissions only: activeTab, scripting, storage, sidePanel
- [x] No broad production host permissions
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
- [x] Public HTTPS privacy-policy URL
- [x] Public support URL

## Store assets
- [x] Product-specific 16, 32, 48 and 128 px extension icons
- [x] Chrome Web Store 128 px store icon
- [x] Polished 1280×800 store screenshot generated from passing release QA
- [x] 440×280 Chrome Web Store promotional tile

## Browser release QA
- [x] Load unpacked in headed Chromium
- [x] Side Panel registration and open-on-action behavior validated
- [x] Scan action works from keyboard focus/Enter
- [x] Deterministic active-page scan/add flow
- [x] Real product extraction on at least three genuine supplier domains
- [x] Structured product extraction on live supplier pages
- [x] Metadata/fallback extraction covered by deterministic fixture and scoped tests
- [x] Supplier save and remembered supplier matching
- [x] Clip while quote workspace is open and confirm live refresh
- [x] Create, duplicate and delete projects
- [x] Estimate number, validity, client email/address and notes
- [x] Delivery, markup, labour, discount and tax totals
- [x] Printed/PDF quote does not expose cost or markup
- [x] Add a logo and verify rendered branding
- [x] Export/open CSV successfully
- [x] Export SpreadsheetML successfully and open/convert with LibreOffice Calc
- [x] Backup workspace, change data, restore backup and verify recovery
- [x] Restart browser and confirm local data persists
- [x] 320 px side-panel width has no horizontal overflow
- [x] Keyboard focus operation verified

## Final release evidence
- [x] Scoped CI run 37411736929 passed
- [x] Headed browser release QA run 37411736895 passed
- [x] Clean v0.3.0 Web Store ZIP archive tested
- [x] Store screenshot dimensions verified at 1280×800
- [x] Four real supplier domains met the strict product-extraction success rule in the final artifact
- [x] Final production audit recorded at 100/100

## Commercial validation after release-quality gate
These are growth/market-validation tasks, not production defects:
- [ ] Test with at least 5 contractors/designers
- [ ] Measure whether users create a second quote without help
- [ ] Record additional supplier sites where extraction needs correction
- [ ] Test willingness to pay around $7.99–$12.99/month
- [ ] Do not add cloud sync/accounts until validation justifies the extra privacy/security surface
