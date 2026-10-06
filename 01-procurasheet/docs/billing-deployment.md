# ProcuraSheet billing deployment

ProcuraSheet v1.1 keeps all supplier/order processing inside the extension. The billing service exists only to create Stripe subscription checkout sessions, verify an activated license against Stripe, and create Stripe Customer Portal sessions.

## Required environment variables

- `STRIPE_SECRET_KEY` — Stripe server secret. Never place this in the extension.
- `STRIPE_PRICE_PRO` — recurring Stripe Price ID for Pro ($9/month).
- `STRIPE_PRICE_BUSINESS` — recurring Stripe Price ID for Business ($19/month).
- `BILLING_SIGNING_SECRET` — strong random secret used to sign opaque ProcuraSheet license tokens.
- `PUBLIC_BASE_URL` — production origin, currently `https://procurasheet.onrender.com`.
- `PORT` — supplied by the hosting platform.

## Start command

```bash
npm run start:billing
```

The service uses only Node.js built-ins and the platform-provided `fetch`; there are no runtime npm dependencies.

## Routes

- `GET /api/health` — health check
- `GET /pricing` — public plan page
- `GET /billing/checkout?plan=pro|business` — creates Stripe Checkout and redirects
- `GET /billing/success?session_id=...` — verifies completed checkout and displays a signed activation license
- `POST /api/billing/entitlement` — verifies a local license and returns the current entitlement
- `POST /api/billing/portal` — creates a Stripe Customer Portal session
- `GET /privacy`
- `GET /support`

## Security boundaries

- Card details never pass through the extension or ProcuraSheet server; they are entered on Stripe-hosted pages.
- The activation license contains only a Stripe subscription identifier protected by an HMAC signature.
- The extension sends no supplier files, catalogs, purchase-order rows or Shopify credentials to this service.
- The Web Store package intentionally excludes the `billing/` directory.
- Unknown prices, canceled subscriptions and invalid signatures always resolve to Free/no paid access.

## Test before live mode

Use Stripe test-mode keys and test Price IDs first. Verify Pro activation, Business activation, customer portal, cancel/downgrade behavior and license refresh before replacing the environment values with live-mode credentials.
