# Contractor Clipper

Contractor Clipper v1.0.0 is a local-first Chrome extension for supplier sourcing, reusable product/labour libraries and professional contractor estimates.

## v1 workflow
1. Open a supplier product page and scan it from the Chrome side panel.
2. Review title, SKU, brand/model, price, material/finish/colour, dimensions, availability and product images.
3. Apply supplier discount, markup, delivery, room/category and quantity.
4. Add the product to a project and optionally save it to the reusable product library.
5. Build the estimate with saved labour rates, templates, assemblies, client/job details, tax, discount and branding.
6. Export PDF, CSV or Excel-compatible SpreadsheetML according to plan.
7. Business can track procurement/PO status and exchange offline client-approval response files.

## Plans
- Free — ₦0: 2 active projects, 20 clips/month, 25 library products, 2 saved labour rates, basic estimates/PDF and 1 quote template.
- Pro — ₦4,000/month or ₦40,000/year: unlimited solo workflow, multi-image products, unlimited libraries/rates, supplier defaults/discounts, branding, assemblies/templates and CSV/Excel.
- Business — ₦8,500/month or ₦85,000/year: everything in Pro plus unlimited assemblies, procurement/PO tracking and client approval-response workflow.

Paid checkout and recurring billing are handled by Paystack. Card details never enter the extension. Project/client/quote data remain in Chrome local storage.

## Development
Load this folder as an unpacked extension in Chrome 114+.

Run only Contractor Clipper's scoped checks:

```bash
npm test
npm run check
```

See `PRIVACY.md`, `docs/store-listing.md` and `docs/store-disclosures.md`.
