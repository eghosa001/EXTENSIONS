# RedirectAudit V0.1.0 Production Audit

## Product boundary

V0.1.0 is intentionally a page-level link/redirect auditor, not a full SEO crawler.

## Security and privacy

- No remote code.
- No third-party scripts.
- No backend or analytics.
- Optional broad host access is requested only from the explicit Scan action.
- No credentials are attached to audit requests (`credentials: omit`).
- Only HTTP/HTTPS URLs are scanned.
- Page anchors are normalized without fragments before deduplication.

## Reliability

- HEAD requests are preferred to reduce transfer.
- GET fallback handles servers that reject HEAD.
- Each request has a timeout.
- Redirects are capped at 8 hops.
- Scan concurrency is capped at 6.
- Page scan is capped at 150 URLs in V0.1.0.
- Manual redirect opacity falls back to final-response inspection instead of silently failing.

## Known limitations

- Some servers/CDNs intentionally block automated HEAD/GET probes or return different status codes to extensions.
- Manual redirect headers may be hidden in some browser/server combinations, reducing intermediate-chain detail.
- Authentication-protected links can appear unreachable because audit requests intentionally omit credentials.
- JavaScript-only navigation is not treated as an HTTP redirect.
- This release scans links found on one page; it is not a recursive site crawler.

## Release checks

Run only the tests/checks scoped to this product:

```bash
npm test
npm run check
```
