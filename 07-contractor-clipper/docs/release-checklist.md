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
- [ ] At least one polished store screenshot
- [x] 440×280 Chrome Web Store promotional tile

## Manual Chrome QA — required before submission
- [ ] Load unpacked in current stable Chrome
- [ ] Click toolbar icon and confirm the side panel opens immediately
- [ ] Test extraction on at least 3–5 real supplier sites
- [ ] Verify structured-data and fallback extraction on real pages
- [ ] Verify product image/title/SKU/price/currency correction workflow
- [ ] Save a known supplier and a new supplier
- [ ] Clip while quote workspace is already open and confirm live refresh
- [ ] Create, duplicate and delete projects
- [ ] Verify estimate number, validity, client email/address and notes
- [ ] Verify delivery, markup, labour, discount and tax totals manually
- [ ] Verify printed/PDF quote does not expose cost or markup
- [ ] Add a logo and verify print quality
- [ ] Export/open CSV successfully
- [ ] Export/open Excel XML successfully in Microsoft Excel or LibreOffice Calc
- [ ] Backup workspace, change data, restore backup and verify recovery
- [ ] Restart Chrome and confirm local data persists
- [ ] Test narrow side-panel width and keyboard-only navigation

## Commercial validation before cloud expansion
- [ ] Test with at least 5 contractors/designers
- [ ] Measure whether users create a second quote without help
- [ ] Record supplier sites where extraction needs correction
- [ ] Test willingness to pay around $7.99–$12.99/month
- [ ] Do not add cloud sync/accounts until validation justifies the extra privacy/security surface
