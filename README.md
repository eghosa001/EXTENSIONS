# EXTENSIONS — 7-product validation lab

Seven small, independently launchable tools. Each product lives in its own folder with its own plan, source, tests and release notes.

| # | Product | Primary customer | Status |
|---|---|---|---|
| 01 | ProcuraSheet — PO CSV Converter | Shopify merchants / buyers | **v1.0.0 store-ready** |
| 02 | BidMatrix Africa | SMEs bidding for tenders | Planned |
| 03 | Stocky Rescue | Former Shopify Stocky users | Planned |
| 04 | PO ↔ Invoice Checker | Buyers / small finance teams | Planned |
| 05 | Tender Change Monitor | Tender bidders / consultants | Planned |
| 06 | Supplier Quote Comparator | Buyers / procurement teams | Planned |
| 07 | Contractor Clipper | Contractors / designers / estimators | MVP built |

## Repository rules

- Products stay isolated; no shared runtime dependency unless it clearly reduces maintenance.
- Build the smallest paid-useful workflow before adding accounts, AI or cloud sync.
- Prefer local-first processing where possible.
- Run only change-scoped tests and checks.
- Validate willingness to pay before expanding a product into a larger SaaS.

See each product's `PLAN.md` for target user, MVP, monetization, launch and roadmap.
