# RedirectAudit V1.0.0 Production Audit

## Scope
Page-level link and redirect auditor; not a recursive crawler, rank tracker, backlink database or SEO suite.

## Architecture quality
- Manifest V3 service worker.
- No remote code or third-party runtime scripts.
- No backend, account or analytics dependency.
- Redirect hops observed through non-blocking `chrome.webRequest` events while audit requests use ordinary `fetch`.
- Active scan state and incremental results persisted in `chrome.storage.local`.
- Closing popup does not cancel a scan.
- Explicit cancellation aborts active requests.
- Stale running state is marked interrupted after service-worker restart.

## Security and privacy
- Only HTTP/HTTPS URLs accepted.
- URL fragments removed before deduplication.
- Requests use `credentials: omit`.
- Broad website access is optional, not install-time host permission.
- `webRequest` is observational only; no blocking listener or `webRequestBlocking`.
- Extension CSP permits only packaged scripts.

## Reliability controls
HEAD-first probing; GET fallback on HTTP errors; 9-second per-request timeout; concurrency 6; 150 URLs/page including current page; 8-hop redirect safety limit; loop detection; partial results after cancellation; tested CSV escaping.

## Automated checks
Focused tests cover URL normalization/deduplication/classification, HTTP-on-HTTPS, issue flags and summaries, CSV escaping, manifest permission boundaries, runtime icons/files, release documentation, exact redirect-chain modelling, loops and redirect-hop safety. `npm run check` syntax-checks all runtime JavaScript.

## Package validation
Chromium packs the directory without manifest errors. Runtime icons are included at 16/32/48/128px. Store artwork has been generated separately for listing upload.

## Real Chromium browser smoke
A real MV3 browser smoke passed in GitHub Actions on 2026-10-06 using Playwright 1.63.0's bundled Chromium / Chrome for Testing in headless Chromium channel mode.

The test:
- loaded the unpacked extension and discovered the generated extension ID from its service worker;
- scanned controlled 200, 301→200, 302→301→200, 404, 500, redirect-loop and HEAD-405/GET-200 fixtures;
- verified 8 scanned URLs, 3 redirecting/problem-chain URLs and 3 broken/problem URLs;
- verified popup metrics and redirect filtering;
- verified CSV download;
- closed the popup mid-scan and confirmed the background scan completed and restored after reopening;
- verified cancellation retains partial results;
- verified 9-second timeout handling.

The browser smoke uses a temporary test copy of the manifest that promotes the same optional HTTP/HTTPS host origins to pre-granted `host_permissions` so CI does not depend on Chrome's browser-UI permission bubble. The committed production manifest remains unchanged and keeps broad host access optional. Manifest tests verify that production permission boundary.

## Release status
V1.0.0 is store-ready from a code/package/testing perspective. A short human install check of Chrome's optional website-access prompt is still advisable immediately before submission, because browser-chrome permission UI is intentionally outside DOM automation.
