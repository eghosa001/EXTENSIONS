# Contractor Clipper v1.0.0 release checklist

## Code/package
- [x] Manifest V3.
- [x] Side-panel entry point.
- [x] No blanket host permissions.
- [x] Local migration from MVP storage schema.
- [x] Change-scoped Node tests.
- [x] Change-scoped syntax checks.
- [x] GitHub Actions path filter for this product only.
- [x] CI packaging artifact.

## Manual browser smoke test before submission
- [ ] Load unpacked in current Chrome stable.
- [ ] Clip from at least five materially different supplier sites.
- [ ] Confirm title, SKU, price/currency, supplier and image capture quality.
- [ ] Confirm side panel remains usable at narrow widths.
- [ ] Create, duplicate and delete projects.
- [ ] Add company logo and verify it prints cleanly.
- [ ] Open exported CSV and XLS in spreadsheet software.
- [ ] Use Print → Save as PDF and inspect the PDF.
- [ ] Restart Chrome and confirm local projects persist.

## Chrome Web Store assets
- [ ] 128×128 store icon.
- [ ] Required screenshots showing clip flow and estimate workspace.
- [ ] Public privacy-policy URL hosting `PRIVACY.md` content.
- [ ] Support URL/email.
- [ ] Complete data disclosure using `docs/data-disclosure.md`.

## Monetization
Do not gate the v1 build behind a fake local license. Introduce Free/Pro limits only after a real payment + license verification path exists.
