# 03 — Stocky Rescue

## Product promise
Convert exported Stocky data into a searchable archive and Shopify-transition workbook so merchants don't lose purchasing history after Stocky's shutdown.

## Customer
Shopify POS retailers that used Stocky for suppliers, POs, costs and purchasing history.

## MVP
Import Stocky CSV/JSON exports; normalize suppliers, purchase orders and line items; browse/search old POs; reconstruct supplier purchase history; export supplier/SKU history and Shopify-ready PO planning CSVs; flag data that cannot be migrated directly.

## Architecture
Local-first web/extension app with IndexedDB for larger archives. No server required. Deterministic import adapters per Stocky export type.

## Monetization
Time-limited cash product: $49 basic archive, $99 full archive, optional $199 assisted migration. Avoid subscription unless users ask for ongoing purchasing features.

## Launch
Urgency-led SEO/community outreach around “Stocky shutdown migration,” Shopify agencies and POS consultants. Provide a free archive health scan.

## Roadmap
Only if demand persists: historical cost trends, supplier lead-time reconstruction, new Shopify PO CSV generation and handoff to product 01.
