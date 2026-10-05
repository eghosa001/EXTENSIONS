# 06 — Supplier Quote Comparator

## Product promise
Normalize multiple supplier quotes into one apples-to-apples landed-cost comparison.

## Customer
SME buyers, importers, contractors, retailers and procurement consultants.

## MVP
Upload 2–5 CSV/XLSX quotes; map item code/description/qty/unit cost/MOQ/freight/lead time/payment terms; normalize currency; match common lines; compare landed cost and constraints; export recommendation worksheet.

## Architecture
Local-first browser app. Deterministic currency input initially (user supplies FX rate) to avoid hidden live-rate risk. Exact-code matching plus manual linking; fuzzy suggestions never auto-merge.

## Monetization
Free: 2 comparisons/month. Pro: $15–29/month. One-off paid report option for infrequent buyers.

## Launch
Procurement and import/export communities. Demo where lowest unit price is not the lowest landed cost.

## Roadmap
PDF quote extraction, live FX, historical vendor scoring, RFQ request workflow and negotiation tracking.
