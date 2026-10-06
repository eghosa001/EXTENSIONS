# Chrome Web Store listing — RedirectAudit

## Summary
Audit page links for broken URLs, HTTP status codes, redirects, redirect chains and insecure HTTP links.

## Description
RedirectAudit gives developers, SEO professionals and website owners a fast page-level link audit without opening a full site crawler.

Scan the page you are viewing to identify:
- broken and erroring links (4xx/5xx)
- single redirects and multi-hop redirect chains
- redirect loops and excessive redirect hops
- final destination URLs
- insecure HTTP links found on HTTPS pages
- internal versus external links

Search and filter the results, then copy or download a CSV report. Scans run in the extension background, so closing the popup does not discard an active scan or completed results.

RedirectAudit is local-first: it has no account, analytics SDK or application backend. Website access is requested only when you explicitly start a scan.

## Suggested category
Developer Tools

## Permission justifications
- **activeTab** — access only the page on which the user invokes RedirectAudit.
- **scripting** — collect HTTP/HTTPS links after the user starts a scan.
- **storage** — store active/last scan locally so popup closure does not lose progress/results.
- **webRequest** — observe RedirectAudit's own audit requests and record server redirect hops; it does not block or modify browsing traffic.
- **Optional http/https host access** — requested from the explicit Scan action because links can point to arbitrary domains.

## Graphic assets
Store artwork is maintained as release collateral: 128px store icon, 440x280 promo tile and 1280x800 screenshot.
