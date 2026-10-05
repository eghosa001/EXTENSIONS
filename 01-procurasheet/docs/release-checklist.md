# v1.0.0 release checklist

## Code
- [x] Manifest V3
- [x] Narrow `storage` permission only
- [x] No remote executable code
- [x] CSV/TSV import
- [x] XLSX import
- [x] Automatic header-row detection + manual override
- [x] Column auto-mapping + manual override
- [x] Saved supplier templates
- [x] Supplier SKU → Shopify SKU memory
- [x] Optional Shopify catalog barcode matching
- [x] Strict blocking validation
- [x] Review CSV
- [x] Shopify PO CSV output
- [x] Reset workflow
- [x] Built-in sample file
- [x] 25 MB / 25,000-row guardrails
- [x] 16/32/48/128 extension icons
- [x] Store listing copy and privacy disclosures prepared

## Chrome Web Store
- [ ] Register/confirm Chrome Web Store developer account
- [ ] Verify publisher email
- [ ] Upload the v1.0.0 ZIP
- [ ] Fill Privacy practices using `docs/store-listing.md`
- [ ] Upload the prepared store artwork from the launch pack
- [ ] Submit for review

## Manual smoke test before submission
1. Load the unpacked extension.
2. Click **Try sample file**.
3. Confirm header row 3 is detected.
4. Confirm quantity/cost/VAT mapping is detected.
5. Add Shopify SKU values for rows that only have Supplier SKU.
6. Confirm blocked rows become ready/review.
7. Export Shopify PO CSV.
8. Open the CSV and confirm exact columns: SKU, Barcode, Supplier SKU, Quantity, Cost, Tax.
9. Save a supplier template, reload extension, and verify the mapping can be reapplied.
