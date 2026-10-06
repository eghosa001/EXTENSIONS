# RedirectAudit Privacy

RedirectAudit is designed to work without an account or external application server.

## Data handled

When the user starts a scan, RedirectAudit reads the current page URL and the HTTP/HTTPS links present on that page. It then requests those URLs from the browser to inspect response status and redirects.

## Storage

The most recent scan result may be stored in Chrome/Edge local extension storage so the result can be restored when the popup is reopened on the same page. This data remains in the user's browser unless the browser itself synchronizes or backs up extension storage.

## External transmission

RedirectAudit does not send scan results, browsing history, page content, personal information or analytics to a RedirectAudit-controlled server. The URLs being audited necessarily receive normal network requests because checking their HTTP response is the product's core function.

## Permissions

- `activeTab`: access the page the user explicitly opens RedirectAudit on.
- `scripting`: collect the links on that active page.
- `storage`: remember the last local scan.
- Optional `http://*/*` and `https://*/*` website access: requested when the user starts a scan so RedirectAudit can check target URLs and follow redirects. The user can deny or revoke this permission.

## Payments and accounts

V0.1.0 contains no payment processing and no user account system.
