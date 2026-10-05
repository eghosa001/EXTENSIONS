# Contractor Clipper

Contractor Clipper v0.3.0 is a local-first Chrome extension that turns supplier product pages into professional contractor estimates.

## Workflow
1. Open a supplier or product page.
2. Click the Contractor Clipper toolbar action to open the side panel.
3. Scan the page and review the detected product.
4. Add supplier, room/category, quantity, markup and delivery if needed.
5. Add the item to a project.
6. Open Quotes to add client/job details, edit costs, add labour/discount/tax, apply branding, back up the workspace and export a client estimate.

## Local development
In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this `07-contractor-clipper` folder.

Run only this product's scoped checks:

```bash
npm test
npm run check
```

## Data model
Projects, clipped items, remembered suppliers and quote branding are stored in `chrome.storage.local`. The current release has no Contractor Clipper backend and requires no account.

See `PRIVACY.md`, `PLAN.md` and `docs/store-listing.md` for release and product details.
