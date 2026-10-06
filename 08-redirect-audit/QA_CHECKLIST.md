# RedirectAudit release smoke checklist

Run this only for a release candidate or a change touching scanning/permissions/UI.

## Functional smoke
1. Load the unpacked extension in an unmanaged Chrome/Edge profile.
2. Open a page containing links that return 200, 301→200, 302→301→200, 404 and 500.
3. Start Scan and approve optional website access.
4. Confirm statuses, final URLs and redirect counts match the network behaviour.
5. Confirm an HTTP link on an HTTPS page is labelled `HTTP on HTTPS`.
6. Start a scan, close the popup, reopen it and confirm progress/results restore.
7. Cancel a scan and confirm completed results remain exportable.
8. Deny/revoke optional website permission and confirm a clear error is shown rather than a crash.
9. Verify Broken, Redirects, HTTP, Internal/External and text filters.
10. Copy CSV and Download CSV; open the exported file and verify quoting/columns.

## Regression fixtures
Recommended local fixtures: 200 OK; 301→200; 302→301→200; 404; 500; redirect loop; HEAD 405 but GET 200; delayed response near timeout.

## Store visual check
Confirm light and dark modes are readable, the toolbar icon is crisp, the popup does not clip at 520px width, and store screenshots match the current UI.
