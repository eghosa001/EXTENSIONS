# RedirectAudit

RedirectAudit is a small Chrome/Edge Manifest V3 extension that checks the current page for broken URLs, redirects, redirect chains and insecure HTTP links.

## V0.1.0

- Scans the current page plus up to 149 unique HTTP/HTTPS links.
- Checks HTTP status with HEAD-first probing and GET fallback.
- Follows redirects up to 8 hops and detects loops when redirect headers are available.
- Falls back to final-response inspection when a browser/server hides manual redirect details.
- Separates internal/external links.
- Flags HTTP links found on HTTPS pages.
- Filters broken links, redirects and insecure links.
- Searches results by URL/link text.
- Copies or downloads CSV reports.
- Stores only the last scan locally for quick reopening.
- Requests broad website permission only when the user starts a scan.

## Load locally

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this `08-redirect-audit` folder.
5. Open a normal HTTP/HTTPS page and click RedirectAudit.

## Privacy

The core product has no account, analytics service or backend. Network requests go directly from the browser to the URLs being checked. See `PRIVACY.md`.

## Development

```bash
npm test
npm run check
```

Only product-scoped checks should be run for changes in this folder.
