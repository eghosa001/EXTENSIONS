# Contractor Clipper Privacy

Contractor Clipper is a local-first browser extension whose single purpose is to turn product information from supplier websites into project estimates.

## Data the extension handles
Contractor Clipper may handle and store:
- Product/website content that you explicitly scan, including product title, SKU/MPN, price, currency, image URL and source page URL/domain.
- Project and client information that you choose to enter, such as client/company name, client email and job address.
- Quote data such as quantities, markup, delivery, labour, discounts, tax, notes and estimate numbers.
- Supplier names and supplier website domains used for remembered supplier matching.
- Your optional business contact details and quote logo.

This information is stored in Chrome local extension storage. Contractor Clipper does not passively collect your browsing history. It accesses the current page only after you click **Scan current product**.

## How the data is used
The data is used only to provide the extension's supplier-product-to-estimate workflow: detecting a product, saving it to a project, calculating an estimate, remembering a supplier, exporting files, restoring a backup and printing a client estimate.

## Data transmission and sharing
The current release does not transmit clipped website content, page URLs, project/client details, suppliers, quote data or branding to a Contractor Clipper server, analytics provider, advertising provider or other third party.

The extension contains no advertising or behavioral tracking.

## Local backup and deletion
You can export a local JSON backup from the quote workspace and restore it later. You can remove line items and projects from the workspace. Uninstalling the extension removes its Chrome extension storage according to Chrome's normal extension-data behavior.

## Permissions
- `activeTab`: temporary access to the tab you explicitly invoke Contractor Clipper on.
- `scripting`: run the product extractor on that active page after you click Scan.
- `storage`: save local projects, suppliers, quote settings and branding.
- `sidePanel`: provide the clip-to-quote workflow beside the supplier website.

Contractor Clipper does not request broad host permissions.

## Limited use
Contractor Clipper uses handled user data only to provide or improve its disclosed single-purpose functionality. It does not sell user data, use it for personalized advertising, or allow humans to read it through a Contractor Clipper backend because the current release has no such backend.

Exported CSV, Excel XML, JSON backup and PDF/print files are created on the user's device.
