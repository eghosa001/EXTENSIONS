# 04 — PO ↔ Invoice Checker

## Product promise
Upload a purchase order and supplier invoice and immediately see price, quantity, tax and line-item discrepancies before paying.

## Customer
Retail buyers, small finance teams, wholesalers and operations teams without an ERP.

## MVP
Accept CSV/XLSX first; map both documents; match by SKU/barcode/supplier SKU; compare ordered vs invoiced quantity, unit cost, tax and totals; surface exceptions; export discrepancy report and supplier dispute email draft.

## Architecture
Local-first browser app. Shared matching engine with strict confidence levels: exact SKU, exact barcode, supplier SKU, then manual match. No fuzzy auto-match that could hide financial errors.

## Monetization
Free: 5 comparisons/month. Pro: $19–29/month. Team tier later for approvals/history.

## Launch
Target Shopify/WooCommerce merchants and importers. Demonstrate one invoice with deliberate overbilling. Success gate: users catch or confidently clear real invoices.

## Roadmap
PDF invoice extraction, packing slip third-way match, approval workflow, accounting integrations.
