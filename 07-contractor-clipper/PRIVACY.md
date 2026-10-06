# Contractor Clipper Privacy Policy

Last updated: 2026-10-06

Contractor Clipper is a local-first Chrome extension for clipping supplier product information into reusable sourcing records and professional estimates.

## Data handled in the browser

Contractor Clipper may handle data you explicitly scan or enter, including:
- product title, SKU/MPN/UPC, brand, model, description, price and currency;
- material, finish, colour, dimensions, availability, product image URLs and source page URL/domain;
- supplier names and supplier defaults;
- room/category, quantity, supplier discount, markup and delivery;
- product-library records, labour rates, assemblies and quote templates;
- project/client name, client email, job address, estimate metadata, notes and terms;
- procurement status, PO reference and expected delivery date;
- business branding and local logo data;
- offline client-response metadata imported by the user.

This workspace is stored in `chrome.storage.local` on the user's device. The current release does not upload the quote workspace to a Contractor Clipper cloud database.

## Active-tab website access

Contractor Clipper does not passively collect browsing history and does not request broad supplier-site host permissions. The `activeTab` and `scripting` permissions are used after the user invokes Contractor Clipper and chooses to scan the current HTTP(S) product page.

## Paystack billing

Free does not require a billing account or billing permission.

If the user chooses Pro or Business:
- checkout is hosted by Paystack;
- the billing email entered on the checkout-start page is sent to Paystack to initialize the subscription;
- card/payment details are entered directly on Paystack and are not handled by the extension;
- after verified payment, the billing service issues a signed Contractor Clipper activation license containing a Paystack customer code;
- the extension may send that signed license to the Contractor Clipper billing service to verify whether the subscription is active;
- entitlement responses contain plan/status timing information, not quote or client-project data.

The extension declares `https://procurasheet-billing.onrender.com/*` as an **optional** host permission. Chrome asks for that access only when the user activates or manages a paid license.

## Client approval packages

Business can export a standalone client approval HTML file. The quote snapshot is written into that file locally. When the client selects Accept or Decline, the file creates a response JSON on the client's device containing the quote identity, decision, client-entered name, timestamp and quote fingerprint. Contractor Clipper does not receive the response automatically. The contractor manually imports the response file.

This workflow is response tracking; it is not represented as a qualified electronic-signature service.

## Backups

Workspace backups intentionally exclude the Paystack activation license and paid entitlement cache. A workspace backup can contain projects, supplier settings, branding, reusable products, labour rates, assemblies and quote templates.

## Permissions

- `activeTab` — temporary access to the tab the user explicitly invokes Contractor Clipper on.
- `scripting` — runs the packaged product extractor after the user clicks Scan.
- `storage` — stores projects, libraries, suppliers, settings, plan state and usage locally.
- `sidePanel` — provides the clip-to-quote interface beside supplier pages.
- optional billing origin — verifies or manages a paid Paystack subscription only after user action.

## Sharing, advertising and analytics

Contractor Clipper does not sell workspace data or use it for personalized advertising. The extension has no behavioral analytics in the current release. Billing information is used only for subscription checkout, verification and management.

## Deletion

Users can delete projects, line items, library records and reusable settings. Uninstalling the extension removes its extension storage according to Chrome's normal extension-data behavior. Paid subscriptions are managed/cancelled through Paystack's hosted subscription-management page.

## Support

Public support: https://contractor-clipper.onrender.com/support/
Public privacy page: https://contractor-clipper.onrender.com/privacy/
