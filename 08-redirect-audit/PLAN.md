# 08 — RedirectAudit

## Product promise
Check the current page and its links for redirects and HTTP errors, explain what is wrong, and export a clean report without opening a full SEO crawler.

## Platform
Chrome + Microsoft Edge extension (Manifest V3).

## Customer
SEO consultants, website owners, marketers, developers and small agencies.

## Current product
- V1.0.0 store-ready Chrome/Edge MV3 build.
- Exact redirect-hop modelling from Chrome `webRequest` events for the extension's own audit requests.
- Background-owned scan state survives popup closure and restores progress/results.
- Explicit cancellation keeps completed partial results.
- HEAD-first checks with GET fallback, 9-second timeout, concurrency cap and 8-hop redirect safety limit.
- Internal/external classification, HTTP-on-HTTPS warnings, filters and CSV export.
- Optional broad host access requested only from the user-initiated Scan action.
- Production 16/32/48/128px PNG runtime icons.
- Store listing copy, privacy disclosure, QA checklist and production audit included.
- Product-scoped automated tests and syntax checks only.
- Real Chromium browser smoke passes in GitHub Actions; only a short human check of Chrome's optional website-access prompt remains advisable before submission.

## MVP
- Scan the current page.
- Check discovered links for 200/301/302/404/410/500-class responses.
- Detect redirect chains and redirect loops.
- Separate internal and external links.
- Flag insecure HTTP links on HTTPS pages.
- Filter by status/problem type.
- Copy/export results as CSV.
- Local-first processing where browser security rules allow it.

## Differentiation
Do not clone a full technical SEO suite. Position it between a single-URL redirect checker and a heavy crawler: fast page-level auditing with a simple report a freelancer can send to a client.

## Demand evidence
Redirect Path on the Chrome Web Store currently shows about 300,000 users, demonstrating strong demand for lightweight redirect/status inspection.

Reference:
https://chromewebstore.google.com/detail/redirect-path/aomidfkchockcldhbkggjokdkkebmdll

## Monetization
- Free: current URL + limited page scan.
- Pro target: $4–$8/month or $29–$49/year.
- Pro: larger scans, export, saved reports, multi-tab checks and client-ready summaries.
- Avoid backend/account infrastructure until paid demand is proven.

## Validation
Measure:
1. Number of scans per active user.
2. Percentage of users exporting a report.
3. Repeat use across different domains.
4. Whether users ask for whole-site scanning.
5. Conversion when free scan limits are reached.

## Do not overbuild
No rank tracking, keyword research, backlink database, AI SEO writer or full-site cloud crawler in V1.
