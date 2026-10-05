# Contractor Clipper Privacy

Contractor Clipper is designed as a local-first browser extension.

## Data stored
The extension can store clipped product details, supplier names, project/client names, room/category tags, quote settings, business contact details and an optional quote logo in Chrome local extension storage.

## Website access
Contractor Clipper reads the active page only after the user invokes the extension and chooses to scan that page. It uses the page to detect product information such as title, SKU, price, currency, image and source URL.

## Data sharing
The current release does not send clipped website content, quotes, client details, supplier details or branding data to a Contractor Clipper server or third-party analytics service.

## Permissions
- `activeTab`: access the page the user explicitly invokes the extension on.
- `scripting`: run the product extractor on that active page.
- `storage`: save local projects, suppliers and branding.
- `sidePanel`: provide the clip-to-quote workflow in Chrome's side panel.

Exported CSV, Excel and PDF/print files are created on the user's device.
