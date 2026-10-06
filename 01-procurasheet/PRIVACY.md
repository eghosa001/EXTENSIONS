# Privacy Policy — ProcuraSheet

**Effective date:** 6 October 2026

ProcuraSheet is a local-first browser extension whose single purpose is to convert supplier spreadsheet line items into a validated CSV that can be imported into Shopify Purchase Orders.

## Supplier and order data

Supplier CSV/XLSX files, optional Shopify product exports, column mappings, normalized purchase-order rows, SKU corrections and generated CSV files are processed locally in the browser. ProcuraSheet does not upload those files or order rows to its billing service.

## Local storage

The extension can store the following on your device using browser extension storage:

- supplier names and saved column templates;
- Business-plan Supplier SKU → Shopify SKU mappings;
- monthly export usage counters;
- the currently cached plan entitlement;
- a paid-plan license token, if you activate one.

The settings backup feature exports supplier templates and SKU mappings only. It deliberately excludes the license token and subscription state.

## Paid-plan verification

If you choose a paid plan, the ProcuraSheet website collects the billing email you enter and sends it to Paystack to start the subscription checkout. Card details are entered on Paystack-hosted payment pages. The extension does not receive or store your billing email or full payment-card details.

After checkout, a ProcuraSheet license token is issued for the subscription. When you explicitly activate or manage that paid license, the extension requests optional website access to `https://procurasheet.onrender.com/*` and sends only the license token to ProcuraSheet's billing service. The service verifies the associated subscription with Paystack and returns the current entitlement (Free, Pro, or Business).

The billing service does not need or receive supplier spreadsheets, catalog exports, purchase-order rows, browsing history, or Shopify credentials.

## Permissions

- `storage`: stores local supplier templates, SKU mappings, export usage and paid-plan state.
- Optional website access to `https://procurasheet.onrender.com/*`: requested only for paid-license activation, subscription-status verification, and opening the secure billing portal.

The extension does not request broad website access.

## Analytics, advertising and remote code

Version 1.1.0 contains no advertising SDK and no remote executable code. Executable extension logic is packaged with the extension. Billing requests return data only; they do not deliver executable JavaScript.

## Shopify

When you click **Open Shopify Admin**, ProcuraSheet opens `https://admin.shopify.com/`. The extension does not send generated purchase-order data to Shopify automatically and never asks for your Shopify password.

ProcuraSheet is an independent product and is not affiliated with, endorsed by, or sponsored by Shopify Inc.

## Payments

Payment processing is performed by Paystack. Paystack may process billing information under its own privacy terms when you use its hosted checkout or billing portal.

## Contact

For support or privacy questions, use:
https://github.com/eghosa001/EXTENSIONS/issues
