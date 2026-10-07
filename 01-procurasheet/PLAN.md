# 01 — Supplier Sheet → Shopify PO

**Current release: v1.1.3**

## Product promise
Turn a supplier's messy CSV/XLSX price/order sheet into a Shopify-native purchase-order CSV in minutes, without retyping line items.

## Why now
Shopify's native Purchase Orders accept bulk CSV imports. A line can be identified by SKU, barcode or both, with Supplier SKU, Quantity, Cost and Tax fields. The missing workflow is converting arbitrary supplier spreadsheets into that shape and remembering each supplier's conventions.

## Customer
Small and mid-sized Shopify merchants, retail buyers, inventory managers, agencies migrating clients away from manual/Stocky workflows.

## MVP workflow
1. Upload supplier CSV/XLSX.
2. Detect headers and first worksheet.
3. Auto-map columns to Shopify PO fields.
4. Review/edit mapping.
5. Normalize SKUs, barcodes, quantities, costs and tax.
6. Flag rows that Shopify cannot safely import.
7. Remember supplier column mapping and supplier-SKU → Shopify-SKU corrections locally.
8. Optionally load a Shopify catalog export to resolve barcodes/SKUs.
9. Export exact PO CSV: SKU, Barcode, Supplier SKU, Quantity, Cost, Tax.
10. Open Shopify Purchase Orders and import the generated CSV.

## MVP boundaries
No accounting, forecasting, receiving, supplier email or ERP. No cloud account. No automatic PO-header creation. The product solves the conversion/reconciliation step only.

## Architecture
Manifest V3 browser extension. Supplier files, catalog files, mappings and purchase-order rows are parsed and stored locally. The only backend is the fixed ProcuraSheet billing service used for paid-plan checkout, license verification and Paystack subscription management. CSV parsing and the lightweight XLSX reader run inside the extension. Supplier templates and Business SKU mappings stay in extension local storage. Optional catalog lookup stays on-device.

## Validation and safety
Blocking validation: missing SKU+barcode, missing/zero quantity, duplicate identity. Warnings: suspicious barcode length, blank cost/tax, duplicate supplier SKU. Never silently drop invalid rows.

## Monetization
Free: 5 PO exports/month and 2 saved supplier templates.
Pro: ₦6,000/month — unlimited PO exports and unlimited saved supplier templates.
Business: ₦13,000/month — Pro plus local Shopify catalog matching and reusable Supplier SKU → Shopify SKU memory.
Paid subscriptions use Paystack-hosted checkout; card details never enter the extension.

## Launch
Chrome/Edge first. Landing page demo with before/after supplier file. Recruit 10 Shopify merchants from inventory/retail communities and agencies. Measure: successful import rate, minutes saved, repeat use within 14 days.

## Roadmap after proof
PDF/confirmation extraction, cloud template sync, shared team mappings, direct Shopify OAuth catalog lookup, automatic supplier SKU learning, purchase-order history analytics.

## Success gate
Do not expand until at least 5 external merchants complete a real Shopify PO import and 2 ask to keep using it or pay.
