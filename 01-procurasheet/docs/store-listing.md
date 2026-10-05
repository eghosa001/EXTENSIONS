# Chrome Web Store listing — v1.0.0

## Name
ProcuraSheet — PO CSV Converter

## Short description
Convert supplier CSV/XLSX sheets into validated purchase-order CSVs compatible with Shopify.

## Category
Productivity

## Single purpose
Convert supplier spreadsheet line items into a validated CSV formatted for import into Shopify Purchase Orders.

## Detailed description
Stop retyping supplier spreadsheets into Shopify purchase orders.

ProcuraSheet converts supplier CSV, TSV and common XLSX files into a clean Shopify Purchase Order CSV. It detects likely headers and columns, lets you review every mapping, flags unsafe rows, and remembers each supplier's layout for the next order.

**What it does**
- Reads CSV, TSV and XLSX supplier files locally
- Detects header rows even when supplier metadata appears above the table
- Maps Shopify SKU, Barcode, Supplier SKU, Quantity, Cost and Tax
- Remembers column mappings per supplier
- Learns Supplier SKU → Shopify SKU corrections
- Optionally uses a Shopify product export to match SKU by barcode
- Blocks rows with missing product identity or invalid quantity
- Exports a Shopify-ready PO CSV plus an optional review CSV
- Includes a built-in sample file so you can test the workflow immediately

**Privacy**
Files are processed locally in your browser. Version 1.0.0 has no backend, analytics, ads, remote code, or account system. It never asks for Shopify credentials.

## Permission justification
`storage`: Used only to save supplier column templates and Supplier SKU → Shopify SKU corrections in extension-local storage so repeat conversions are faster.

## Remote code
No. All executable code is packaged with the extension.

## Data collection disclosure
The extension does not collect or transmit user data to the developer or third parties. Supplier files and optional Shopify product exports are processed locally. Saved templates remain in extension local storage.

## Suggested support URL
https://github.com/eghosa001/EXTENSIONS/issues

## Suggested homepage
https://github.com/eghosa001/EXTENSIONS/tree/main/01-procurasheet

## Privacy policy URL before GitHub Pages is enabled
https://github.com/eghosa001/EXTENSIONS/blob/main/01-supplier-sheet-shopify-po/PRIVACY.md

## Store assets
The prepared launch pack contains a 128x128 icon, two 1280x800 screenshots, a 440x280 promo tile, and a 1400x560 optional marquee tile.

## Trademark / affiliation
ProcuraSheet is an independent product and is not affiliated with, endorsed by, or sponsored by Shopify Inc. Shopify is a trademark of Shopify Inc. References to Shopify describe compatibility only.

## Public URLs
- Homepage: https://procurasheet.onrender.com/
- Support: https://procurasheet.onrender.com/support/
- Privacy policy: https://procurasheet.onrender.com/privacy/
