# Contractor Clipper

A local-first Manifest V3 browser extension for clipping products from supplier websites into contractor estimates and quotes.

## MVP

- Scan the active product page for title, SKU, price, currency, image, and URL.
- Review/edit captured data before saving.
- Organize products into multiple projects.
- Calculate quantity, markup, labour, discount, tax, and quote totals.
- Export quote line items to CSV.
- Print/save a clean estimate as PDF.
- Store all MVP data locally in extension storage.

## Test locally in Chrome or Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository folder.
5. Open a product page, click Contractor Clipper, then select **Scan current product**.

## Minimal checks

```bash
npm test
npm run check
```

There are no runtime npm dependencies and no build step.

## Launch path

Start with unpacked testing, then publish the same Chromium package to Microsoft Edge Add-ons and Chrome Web Store. A Firefox adaptation can follow after the Chromium MVP is validated.
