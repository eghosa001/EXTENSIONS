# Contractor Clipper privacy policy

**Effective date: October 5, 2026**

Contractor Clipper is a local-first browser extension for clipping supplier products into project estimates.

## What the extension processes
When the user explicitly clicks **Scan product**, Contractor Clipper reads information from the active webpage so the user can review and save a product. This can include the product name, SKU, price, currency, supplier/brand, product image URLs and source URL.

Users may also enter project names, client names/contact details, project addresses, company contact details, estimate notes and a company logo.

## Where data is stored
Version 1.0.0 stores extension data in the browser's local extension storage (`chrome.storage.local`). Contractor Clipper does not send clipped page content, project data, client data, branding data or estimate data to a Contractor Clipper server because version 1.0.0 has no backend.

## Data selling, advertising and analytics
Contractor Clipper does not sell user data. Version 1.0.0 contains no advertising SDK, behavioral analytics, tracking pixel, cloud sync, account system or payment collection.

## Permissions
- `activeTab`: temporary access to the tab the user explicitly invokes the extension on.
- `scripting`: runs the product extractor in that active tab after the user chooses to scan.
- `storage`: saves projects, estimates, suppliers and preferences locally.
- `sidePanel`: provides the persistent clipping interface.

The extension does not request blanket host permissions.

## User control
Users can remove individual items, suppliers and projects from the extension. Removing the extension also removes its local extension storage according to the browser's extension-data behavior.

## Future features
If accounts, payments, analytics, cloud sync, AI processing or external price monitoring are introduced, this policy and the Chrome Web Store data disclosures must be updated before those features are released.
