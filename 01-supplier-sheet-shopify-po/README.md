# Supplier Sheet → Shopify PO

A local-first Manifest V3 extension that turns arbitrary supplier CSV/XLSX files into Shopify's native purchase-order CSV shape.

## What it does

- Reads CSV, TSV and common XLSX workbooks locally.
- Auto-detects supplier columns and lets the user correct the mapping.
- Saves column mappings per supplier.
- Learns Supplier SKU → Shopify SKU corrections.
- Optionally reads a Shopify product export to backfill SKU from barcode.
- Blocks unsafe rows instead of silently dropping them.
- Exports: `SKU, Barcode, Supplier SKU, Quantity, Cost, Tax`.
- Produces a review CSV for unresolved rows.

## Local testing

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this folder.
5. Open the extension and choose **Open converter**.
6. Test with `samples/supplier-example.csv`.

## Checks

```bash
npm test
npm run check
```

No install step or runtime dependencies are required.

## Current boundary

The extension creates the product-line CSV that Shopify Purchase Orders accepts. Shopify still owns supplier selection, destination, payment terms, saving the draft and receiving inventory.
