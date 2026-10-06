# ProcuraSheet v1.1.0 release checklist

## Automated release gate
- [x] Manifest V3
- [x] Required permission limited to `storage`
- [x] Billing origin is optional host access, not install-time website access
- [x] Explicit extension CSP and no remote executable code
- [x] CSV/TSV input
- [x] XLSX input
- [x] Header-row detection and manual override
- [x] Robust delimiter detection
- [x] Supplier SKU / Shopify SKU mapping regression coverage
- [x] Accounting-negative validation regression coverage
- [x] Saved supplier templates
- [x] Safe supplier-settings backup/restore
- [x] Free/Pro/Business entitlement model
- [x] Monthly Free export limit logic
- [x] Free saved-supplier limit logic
- [x] Business-only catalog matching
- [x] Business-only reusable Supplier SKU dictionary
- [x] Signed paid-license tokens
- [x] Server-side Paystack subscription verification
- [x] Paystack hosted subscription-management flow
- [x] Billing server excluded from extension ZIP
- [x] 25 MB / 25,000-row input guardrails
- [x] Store listing and privacy disclosures updated

## CI evidence required before merge
- [x] `npm test` passes with zero failures
- [x] `npm run check` passes
- [x] Real Chromium browser smoke passes Free, Pro and Business behavior
- [x] Real Chromium browser smoke validates XLSX import
- [x] 320 px overflow check passes
- [x] Chrome Web Store ZIP builds and excludes tests/server code

## Billing launch requirements
- [ ] Deploy `billing/server.cjs` at `https://procurasheet-billing.onrender.com`
- [ ] Set `PAYSTACK_SECRET_KEY`
- [x] Create/set `PAYSTACK_PLAN_PRO` for the Pro monthly plan
- [x] Create/set `PAYSTACK_PLAN_BUSINESS` for the Business monthly plan
- [x] Set a strong random `BILLING_SIGNING_SECRET`
- [x] Set `PUBLIC_BASE_URL=https://procurasheet-billing.onrender.com`
- [ ] Confirm the Paystack Pro and Business plan amounts are ₦4,900/month and ₦9,900/month in live mode
- [ ] Run one Paystack test-mode Pro checkout and activation
- [ ] Run one Paystack test-mode Business checkout and activation
- [ ] Confirm cancel/downgrade is reflected after entitlement refresh
- [x] Publish final commercial terms/refund policy before accepting live payments

## Final Chrome submission
- [ ] Load the production ZIP in an unmanaged current Chrome profile
- [ ] Confirm the extension installs without an install-time website-access warning
- [ ] Confirm paid-license activation displays the expected optional access prompt
- [ ] Confirm permission denial fails clearly without breaking Free functionality
- [ ] Confirm toolbar popup, converter, icons and responsive layout visually
- [ ] Capture final v1.1 store screenshots
- [ ] Upload v1.1.0 ZIP
- [ ] Complete Web Store privacy disclosures using `docs/store-listing.md`
- [ ] Submit for review
