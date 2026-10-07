# Chrome Web Store listing — v1.1.2

## Name
ProcuraSheet — PO CSV Converter

## Short description
Convert supplier CSV/XLSX sheets into validated purchase-order CSVs compatible with Shopify.

## Category
Productivity

## Single purpose
Convert supplier spreadsheet line items into a validated CSV formatted for import into Shopify Purchase Orders.

## Detailed description
Stop retyping supplier spreadsheets into Shopify purchase orders.

ProcuraSheet reads supplier CSV, TSV and common XLSX files locally, detects likely headers and columns, lets you review every line, flags unsafe rows, and exports the exact Shopify Purchase Order CSV columns.

**Core workflow**
- Local CSV, TSV and XLSX parsing
- Header-row detection when supplier metadata appears above the table
- Mapping for Shopify SKU, Barcode, Supplier SKU, Quantity, Cost and Tax
- Blocking validation for missing identity, invalid quantity, negative cost, invalid tax and duplicate identifiers
- Optional review CSV
- Shopify PO CSV export
- Local supplier-template backup and restore

**Plans**
- Free: 5 exports/month and 2 saved supplier templates
- Pro (₦6,000/month): unlimited exports and supplier templates
- Business (₦13,000/month): Pro plus local Shopify catalog matching and reusable Supplier SKU → Shopify SKU memory

Supplier spreadsheets, catalog exports and order rows are never uploaded to the billing service.

## Permission justification

### Required permission
`storage`: saves supplier templates, plan usage, paid-plan state and Business-plan SKU mappings locally on the user's device.

### Optional website access
`https://procurasheet-billing.onrender.com/*`: optional website access is requested only after an explicit paid-license action. It is used to verify the ProcuraSheet license/subscription and open a Paystack-hosted subscription-management session. It is not used to read arbitrary websites.

## Remote code
No. All executable extension code is packaged with the extension. The billing service returns subscription data only and cannot deliver executable extension logic.

## Data disclosure
Supplier files, Shopify catalog exports and purchase-order rows are processed locally. For paid plans, the extension may transmit a ProcuraSheet license token to the ProcuraSheet billing service so it can verify subscription status with Paystack. Payment-card data is entered on Paystack-hosted pages, not in the extension.

## Suggested support URL
https://github.com/eghosa001/EXTENSIONS/issues

## Suggested homepage
https://procurasheet.onrender.com/

## Privacy policy URL
https://procurasheet.onrender.com/privacy

## Store assets
Use product-specific 16/32/48/128 extension icons, a 128×128 Web Store icon, at least one 1280×800 screenshot, and the prepared promo artwork. Regenerate screenshots after the v1.1.2 billing UI is finalized.

## Trademark / affiliation
ProcuraSheet is an independent product and is not affiliated with, endorsed by, or sponsored by Shopify Inc. Shopify is a trademark of Shopify Inc. References to Shopify describe compatibility only.

## Chrome Web Store privacy answers
- Personally identifiable information: **Yes — billing email for paid subscriptions.** The extension itself does not read the email from browser pages; the ProcuraSheet billing website collects the email only when the user chooses a paid subscription and sends it to Paystack to initiate checkout.
- Health information: **No**
- Financial/payment information: **No card data is collected by the extension**; payment is handled by Paystack-hosted checkout.
- Authentication information: **Paid license token only**, stored locally and transmitted solely to ProcuraSheet's billing verification endpoint.
- Personal communications: **No**
- Location: **No**
- Web history: **No**
- User activity: **No**
- Website content: **No arbitrary website content**; user-selected supplier/catalog files are processed locally and not transmitted.

Re-check these answers against the final Web Store wording at submission time.


## v1.1.2 UI fix
The toolbar popup now uses a stable 380 px width contract and no longer collapses into an unreadable ultra-narrow state. The full converter page remains responsive on small screens.
