# Contractor Clipper

Contractor Clipper is a local-first Chrome/Edge extension that turns products on supplier websites into client-ready contractor estimates.

## Release status

**v1.0.0 — store-ready product build**

The extension now covers the complete standalone sourcing-and-estimating workflow:

- Open the extension from the toolbar into a persistent Chrome side panel.
- Scan only the active page after a user action; no blanket host permission is requested.
- Capture product name, price, currency, SKU, supplier, source URL and multiple image candidates.
- Choose the best product image before saving.
- Add quantity, markup, room/area, category and notes.
- Save to multiple projects and clients.
- Automatically remember suppliers by hostname.
- Edit quantities, prices, markups, room and category from the estimate workspace.
- Add labour, delivery, discount and tax with automatic totals.
- Add company name/contact details and a local company logo.
- Export detailed CSV and Excel-compatible `.xls` files.
- Print or save a branded estimate as PDF using the browser print dialog.
- Duplicate and delete projects.
- Keep project, client, supplier and branding data in `chrome.storage.local`.

## Local testing

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `07-contractor-clipper` folder.
5. Pin Contractor Clipper, open a supplier product page, then click the extension icon.
6. The side panel opens. Scan the product, review the captured fields and add it to a project.
7. Open **Workspace** to edit the estimate, configure branding, export CSV/Excel or Print/Save as PDF.

## Change-scoped checks

```bash
npm test
npm run check
```

There are no runtime npm dependencies and no build step.

## Data model

Existing 0.1.0 projects are migrated in place at runtime. New optional fields are added with safe defaults, so previously clipped items remain usable.

## Privacy posture

The release is local-first and account-free. It has no backend, analytics, ads, authentication, payment collection or cloud sync. The extension reads the active webpage only when the user scans it. See `PRIVACY.md` and `docs/data-disclosure.md` before submitting the store listing.
