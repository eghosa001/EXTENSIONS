# Contractor Clipper — product plan

## Product promise
Clip supplier products while browsing, reuse product/labour/supplier knowledge, and turn the result into a professional client estimate without repetitive copy-and-paste.

## Target users
Contractors, builders, interior designers, decorators, architects, renovators, procurement agents, handymen, furniture installers, electricians, plumbers, landscapers, event planners and estimators.

## v1 product depth
- Chrome MV3 side panel with active-tab-only extraction.
- Rich product extraction: title, SKU/MPN/UPC, brand/model, description, price/currency, material, finish, colour, dimensions, availability and up to 12 images.
- Product library, labour-rate library, supplier defaults, quote templates and reusable assemblies.
- Quantity, supplier discount, markup, delivery, itemized labour, quote discount and tax.
- Branded client estimates with hidden internal cost/markup.
- CSV, Excel-compatible SpreadsheetML and print/PDF.
- Procurement status, PO reference and expected-date tracking for Business.
- Offline client approval package + fingerprint-checked response import for Business.
- Local JSON workspace backup/restore that excludes the paid activation license.
- Paystack recurring billing with signed-license entitlement verification.

## Launch pricing
- Free: ₦0.
- Pro: ₦4,000/month or ₦40,000/year.
- Business: ₦8,500/month or ₦85,000/year.

The price is intentionally far below large all-in-one platforms while avoiding a disposable micro-price.

## Product principles
- Local-first quote data.
- Minimum Chrome permissions.
- No broad supplier host permission.
- No card details in extension/backend.
- No feature should crowd the core Scan → Review → Add flow.
- Paid checks may fail safely to cached entitlement for a limited lease; unknown/inactive plans resolve to Free.

## Later, only if validated by users
Optional cloud/team collaboration and server-side AI extraction remain separate privacy/cost decisions. v1 uses deterministic structured-data/spec extraction so the core workflow remains fast, private and inexpensive.
