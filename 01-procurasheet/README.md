# ProcuraSheet

Public site: https://procurasheet.onrender.com/

**Version 1.1.0 — production hardening branch**

ProcuraSheet is a local-first Manifest V3 browser extension that converts supplier CSV/XLSX sheets into Shopify Purchase Order CSV format.

## Product workflow

1. Import CSV, TSV, TXT, or XLSX supplier data.
2. Detect the header row and map supplier columns.
3. Review every normalized purchase-order line.
4. Fix blocked rows; warnings remain visible.
5. Export the exact columns: `SKU, Barcode, Supplier SKU, Quantity, Cost, Tax`.
6. Import the generated CSV manually in Shopify Admin.

Supplier spreadsheets and optional Shopify product exports are processed locally in the extension.

## Plans

- **Free — $0:** 3 Shopify PO exports per calendar month and 2 saved supplier templates.
- **Pro — $9/month:** unlimited exports and unlimited saved supplier templates.
- **Business — $19/month:** Pro features plus local Shopify catalog matching and reusable Supplier SKU → Shopify SKU memory.

Paid-plan verification uses a license token and ProcuraSheet's billing service. Supplier files, catalog files, normalized rows, mappings, and exported order data are never sent to the billing service.

## Features

- CSV, TSV and common XLSX input
- Header-row detection below supplier metadata
- Consistency-based delimiter detection
- Automatic column mapping with manual correction
- Saved supplier templates
- Business-only reusable supplier-SKU dictionary
- Business-only Shopify catalog matching by barcode
- Strict quantity, cost, tax, duplicate and identity validation
- Review CSV for unresolved rows
- Local backup/restore for supplier settings
- Built-in sample file
- 25 MB input and 25,000-row guardrails
- No Shopify password or Shopify OAuth required

## Security model

The extension requests only `storage` at install time. Access to `https://procurasheet.onrender.com/*` is optional and is requested only when a user activates or manages a paid license. No remote executable code is loaded; all extension logic is packaged with the Web Store ZIP.

The server-side billing code is under `billing/` and is deliberately excluded from the Chrome Web Store ZIP.

## Checks

```bash
npm test
npm run check
```

Real Chromium workflow coverage is in `tests/browser-smoke.cjs`.

## Publishing

See:
- `PRIVACY.md`
- `docs/store-listing.md`
- `docs/release-checklist.md`
- `docs/billing-deployment.md`
