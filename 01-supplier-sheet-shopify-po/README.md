# Supplier Sheet → Shopify PO

**Version 1.0.0 — release candidate**

A local-first Manifest V3 browser extension that converts arbitrary supplier CSV/XLSX sheets into Shopify's Purchase Order CSV format.

## Why it exists

Shopify can import purchase-order line items from CSV, but suppliers rarely send files in Shopify's exact column structure. This extension removes the manual retyping step while keeping the merchant in control of the final Shopify import.

## Features

- CSV, TSV and common XLSX input
- Header-row detection when supplier metadata appears above the table
- Automatic column mapping with manual correction
- Saved supplier templates
- Supplier SKU → Shopify SKU memory
- Optional Shopify catalog export matching by barcode
- Strict validation before export
- Review CSV for unresolved rows
- Exact PO output columns: `SKU, Barcode, Supplier SKU, Quantity, Cost, Tax`
- Built-in sample file
- Local-only processing; no backend or Shopify credentials

## Install locally

1. Download/unzip the release package.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the extension folder.

## Checks

```bash
npm test
npm run check
```

No install step or runtime npm dependencies are required.

## Privacy

See `PRIVACY.md`. Version 1.0.0 transmits no supplier/catalog/order data off-device.

## Publishing

See `docs/store-listing.md` and `docs/release-checklist.md`.
