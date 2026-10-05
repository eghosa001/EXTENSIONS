# Privacy Policy — ProcuraSheet

**Effective date:** 5 October 2026

ProcuraSheet is a local-first browser extension whose single purpose is to convert supplier spreadsheet line items into a validated CSV that can be imported into Shopify Purchase Orders.

## Data processed

When you choose a supplier CSV/XLSX file, optional Shopify product export, supplier name, column mapping, or SKU correction, the extension processes that information inside your browser.

## Data storage

Saved supplier templates and Supplier SKU → Shopify SKU mappings are stored in Chrome/Edge extension local storage on your device.

## Data transmission and sharing

Version 1.0.0 does **not** transmit supplier files, product catalogs, purchase-order data, mappings, browsing history, or personal information to the developer or to any third party. It has no analytics, advertising SDK, remote code, account system, or backend API.

The only external page the extension can open is `https://admin.shopify.com/` when you explicitly click **Open Shopify Admin**. No data is sent to Shopify by the extension; you choose whether to import the generated CSV yourself.

## Permissions

The extension requests only the `storage` permission. This is used to remember supplier column mappings and SKU corrections locally so repeat conversions are faster.

## Changes

If a future version adds cloud sync, accounts, analytics, AI processing, payments, or Shopify OAuth, this policy will be updated before those features are released and any required disclosures/consent will be added.

## Contact

For support or privacy questions, open an issue in the public project repository:
https://github.com/eghosa001/EXTENSIONS/issues
