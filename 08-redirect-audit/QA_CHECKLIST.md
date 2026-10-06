# RedirectAudit release QA checklist

## Automated browser coverage — passing

`tests/browser-smoke.cjs` runs in Playwright's bundled Chromium on GitHub Actions and verifies:
- extension service worker loads and a real extension ID is assigned;
- 200, 301→200 and 302→301→200 behavior;
- 404 and 500 handling;
- redirect-loop detection;
- HEAD 405 → GET 200 fallback;
- popup summary metrics and redirect filter;
- CSV download;
- scan survival after popup closure and restoration after reopening;
- cancellation with partial results preserved;
- request timeout handling.

The CI test uses a temporary manifest copy with the production optional host origins pre-granted so it does not depend on Chrome's browser-UI permission dialog.

## Final human submission check

Before uploading a release to the Chrome Web Store:
1. Load the production ZIP/unpacked build in an unmanaged Chrome or Edge profile.
2. Open a normal HTTP/HTTPS page and press **Scan page**.
3. Confirm Chrome displays the expected optional website-access permission prompt on first scan.
4. Approve it and confirm a basic scan starts.
5. Revoke website access once and confirm RedirectAudit shows a clear permission-denied message rather than crashing.
6. Confirm the toolbar icon and popup are visually crisp in light and dark themes.

This manual check is intentionally limited to browser chrome/permission UI; the scanning behavior itself is covered by automated Chromium smoke tests.
