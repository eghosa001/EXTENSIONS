# RedirectAudit

RedirectAudit is a focused Chrome/Edge Manifest V3 extension for auditing the current page's links for HTTP errors, redirects, redirect chains, loops and insecure HTTP URLs.

## V1.0.0 release candidate
- Scans the current page plus up to 149 unique HTTP/HTTPS links.
- Uses Chrome `webRequest` redirect events to record redirect hops while the extension performs non-blocking audit requests.
- HEAD-first checks with GET fallback for HTTP error responses to reduce false positives from servers that mishandle HEAD.
- Detects single redirects, multi-hop chains, loops and an 8-hop safety limit.
- Detects 4xx/5xx/unreachable responses.
- Separates internal/external links and flags HTTP links on HTTPS pages.
- Search plus issue/scope filters.
- CSV copy/download.
- Scan runs in the background and survives popup closure; reopening restores progress/results.
- Explicit cancel action.
- Local-only scan state; no account, analytics or backend.
- Broad host access is optional and requested only when the user explicitly starts a scan.

## Load locally
1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this `08-redirect-audit` folder.
5. Open a normal HTTP/HTTPS page and click RedirectAudit.
6. On the first scan, approve website access.

## Development
```bash
npm test
npm run check
```

Only product-scoped checks should run for changes in this folder.

## Release assets
Runtime icons: `assets/icons/`. Store copy: `STORE_LISTING.md`. Release QA: `QA_CHECKLIST.md` and `PRODUCTION_AUDIT.md`.
