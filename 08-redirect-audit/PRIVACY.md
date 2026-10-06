# RedirectAudit Privacy

RedirectAudit works without an account, analytics SDK or application server.

## Data handled
When the user explicitly starts a scan, RedirectAudit reads the current page URL and HTTP/HTTPS links present on that page. It sends normal browser requests directly to those URLs to inspect response status and redirects.

## Local storage
The active/most recent scan is stored in Chrome/Edge local extension storage so progress and results survive closing and reopening the popup. Stored data contains URLs, link text, HTTP status/redirect information and timestamps. It is not uploaded to a RedirectAudit service.

## External transmission
RedirectAudit does not transmit scan results, browsing history, page contents, identifiers or analytics to a RedirectAudit-controlled server. Target websites necessarily receive audit requests. Audit requests use `credentials: omit`, so user cookies or HTTP authentication credentials are intentionally not attached.

## Permissions
- `activeTab`: work with the page on which the user invokes RedirectAudit.
- `scripting`: extract links from that active page after the user starts a scan.
- `storage`: persist active/last scan state locally.
- `webRequest`: observe the extension's own audit requests to record HTTP redirect hops. RedirectAudit does not block, modify or redirect normal browsing traffic.
- Optional `http://*/*` and `https://*/*` host access: requested only when the user starts scanning because page links can point to arbitrary domains.

## Payments and accounts
V1.0.0 has no payment processing and no user account system.
