# ProcuraSheet billing deployment

ProcuraSheet v1.1.2 keeps supplier/order processing inside the extension. The billing service starts Paystack subscription checkout, verifies an activated license against current Paystack subscriptions, and generates Paystack's hosted subscription-management link.

## Why Paystack

ProcuraSheet is operated from Nigeria. Paystack supports Nigerian businesses, recurring subscriptions, and international card payments when international payments are enabled for the merchant. Nigerian businesses can also be enabled for USD transactions.

## Required environment variables

- `PAYSTACK_SECRET_KEY` — Paystack secret key. Never place it in the extension or public website source.
- `PAYSTACK_PLAN_PRO` — Paystack monthly Plan code for ProcuraSheet Pro.
- `PAYSTACK_PLAN_BUSINESS` — Paystack monthly Plan code for ProcuraSheet Business.
- `BILLING_SIGNING_SECRET` — strong random secret used to sign ProcuraSheet activation licenses.
- `PUBLIC_BASE_URL` — production origin, currently `https://procurasheet-billing.onrender.com`.
- `PORT` — supplied by the hosting platform.

## Plan setup

Create two recurring monthly plans in the Paystack Dashboard.

Recommended launch pricing:
- Pro: ₦6,000/month
- Business: ₦13,000/month

The launch plans are NGN-denominated. International card support may still be enabled in Paystack for eligible foreign customers; Paystack handles any supported card-currency conversion while ProcuraSheet charges the advertised NGN amount.

## Start command

```bash
npm run start:billing
```

The billing service uses Node.js built-ins plus the platform-provided `fetch`; there are no billing SDK dependencies.

## Routes

- `GET /api/health` — service health
- `GET /pricing` — public plan page
- `GET /billing/checkout?plan=pro|business` — collects the billing email before redirecting to Paystack
- `POST /billing/start` — initializes the Paystack plan transaction
- `GET /billing/success?reference=...` — verifies the Paystack transaction and displays the signed activation license
- `POST /api/billing/entitlement` — verifies the license and checks the customer's current Paystack subscriptions
- `POST /api/billing/portal` — returns Paystack's hosted subscription-management link
- `GET /privacy`
- `GET /support`
- `GET /terms`

## Security boundaries

- Card details never pass through the extension or ProcuraSheet server; they are entered on Paystack-hosted checkout.
- The billing website sends the user's billing email to Paystack solely to initialize the chosen subscription.
- The activation license contains only a signed Paystack customer code, not card details.
- Entitlement checks query Paystack for active/non-renewing ProcuraSheet plan subscriptions.
- The extension sends no supplier files, catalogs, purchase-order rows or Shopify credentials to the billing service.
- The Web Store package intentionally excludes the `billing/` directory.
- Unknown plans, inactive subscriptions and invalid license signatures resolve to Free access.
- Paystack's hosted subscription-management page is used for card updates and cancellation.

## Test before live mode

1. Create test-mode Pro and Business monthly plans.
2. Put the test plan codes and test secret key in the hosting environment.
3. Complete a Pro checkout, copy the generated license, and activate it in the extension.
4. Repeat for Business and confirm catalog matching unlocks.
5. Open Manage billing and verify the Paystack management page.
6. Cancel a test subscription and confirm a later entitlement refresh removes paid access.
7. Only then replace test credentials with live Paystack credentials.

## Production prerequisite

The billing backend cannot be live until a Paystack account is connected/configured and the two plan codes exist. The extension itself remains usable on Free without the billing backend.
