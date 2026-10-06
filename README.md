# EXTENSIONS — 12-product validation lab

Twelve small, independently launchable tools. Each product lives in its own folder with its own plan, source, tests and release notes.

| # | Product | Primary customer | Platform | Status |
|---|---|---|---|---|
| 01 | ProcuraSheet — PO CSV Converter | Shopify merchants / buyers | Chrome/Edge | **v1.0.0 store-ready** |
| 02 | BidMatrix Africa | SMEs bidding for tenders | Browser extension | Planned |
| 03 | Stocky Rescue | Former Shopify Stocky users | Browser extension | Planned |
| 04 | PO ↔ Invoice Checker | Buyers / small finance teams | Browser extension | Planned |
| 05 | Tender Change Monitor | Tender bidders / consultants | Browser extension | Planned |
| 06 | Supplier Quote Comparator | Buyers / procurement teams | Browser extension | Planned |
| 07 | Contractor Clipper | Contractors / designers / estimators | Chrome/Edge | **v0.3.0 release-ready** |
| 08 | RedirectAudit | SEO consultants / developers / site owners | Chrome/Edge | **v1.0.0 store-ready** |
| 09 | LinkPack | Researchers / marketers / developers | Chrome/Edge | Planned |
| 10 | Page2AI | Researchers / developers / AI power users | Chrome/Edge | Planned |
| 11 | SheetInvoice | Freelancers / small businesses | Google Workspace | Planned |
| 12 | Quote2WhatsApp | WooCommerce merchants | WordPress/WooCommerce | Planned |

## Product selection rule

Prioritize products that are:
- Small enough for a polished V1 without becoming a large SaaS project.
- Distributed through an existing marketplace or store.
- Useful without expensive backend infrastructure.
- Supported by visible competitor demand.
- Simple enough for one developer to maintain.
- Able to demonstrate value within minutes.
- Monetizable through Pro features, subscription or a straightforward annual/lifetime licence.

## Repository rules

- Products stay isolated; no shared runtime dependency unless it clearly reduces maintenance.
- Build the smallest paid-useful workflow before adding accounts, AI or cloud sync.
- Prefer local-first processing where possible.
- Run only change-scoped tests and checks.
- Validate willingness to pay before expanding a product into a larger SaaS.
- A planned product does not become an active build until its narrow MVP and monetization test are clear.

See each product's `PLAN.md` for target user, MVP, monetization, demand evidence, validation and roadmap boundaries.
