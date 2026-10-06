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

## Live-browser release gate
Before publishing, load the unpacked build in an unmanaged Chrome/Edge profile and run `QA_CHECKLIST.md`. The available Chromium environment is organization-managed and blocks `chrome://extensions`, so this final interactive smoke cannot be honestly claimed from this environment.
