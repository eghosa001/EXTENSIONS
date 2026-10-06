# Contractor Clipper v1.0.0 release evidence

Validated on 2026-10-06.

## Code and browser gates

- PR: #17 — Upgrade Contractor Clipper to paid professional v1
- Validated head: `3c820451ae9b2d2b0e8075714dd028d8d6e78fac`
- Contractor Clipper scoped unit/syntax workflow: PASS
- Shared ProcuraSheet billing regression workflow: PASS
- One-time headed Chromium v1 release-QA run: **37540683416 — PASS**
- Release-QA artifact: `contractor-clipper-v1.0.0-release-qa`
- GitHub artifact digest: `sha256:1999aa1444085c322885ec01f9893314b16089dadfb3bca9d660abd98f23d644`

## Browser evidence

The passing Chromium run verified:
- Manifest V3 and Side Panel registration.
- Production least-privilege contract plus localhost-only permission in the temporary QA copy.
- Free plan project/export/branding limits.
- Rich scan of title, SKU, brand, model, material, finish, colour, dimensions, availability and multiple images.
- Free product-library and monthly clip usage behavior.
- 320 px side-panel layout with no horizontal overflow.
- Pro entitlement behavior without network dependence while the cached lease is valid.
- Product library and saved labour-rate library.
- Supplier discount quote mathematics.
- Itemized labour lines.
- Custom quote branding.
- Reusable assemblies and quote templates.
- Rich CSV and SpreadsheetML XML exports.
- Workspace backup excludes billing license and entitlement state.
- Business procurement status, PO reference and expected delivery date.
- Business offline client approval package.
- Quote-fingerprint-checked client response import.
- Client-facing print/PDF hides internal Cost and Markup.
- Browser-restart persistence of quote, labour, procurement, assemblies, templates and client response.
- Clean Chrome Web Store package build.
- Store screenshot exactly 1280×800.

## Real supplier extraction

Strict success requires HTTP 2xx/3xx, a genuine product title and SKU or price evidence.

Passing suppliers in the v1 run:
- IKEA — HTTP 200; product title, SKU and price detected.
- Floor & Decor — HTTP 200; product title, SKU and price detected.
- Rejuvenation — HTTP 200; genuine product title and price detected.
- Pottery Barn — HTTP 200; product title, SKU and price detected.
- West Elm — HTTP 200; product title, SKU and price detected.

Lamps Plus returned a generic result without SKU/price evidence and was correctly excluded.

## Artifact hashes

- Chrome Web Store ZIP: `sha256:1febd4a0f80087830514d8395cc51c06633248e4981f8dd143ab782d617e59be`
- 1280×800 Store screenshot: `sha256:875801fadac74719325ffc9c51733487727b63726ff8b56211286d03e7ae0cb4`

## Pricing validated in code

- Free: ₦0.
- Pro monthly: ₦4,000.
- Pro annual: ₦40,000.
- Business monthly: ₦8,500.
- Business annual: ₦85,000.

The billing service finds or creates exact Paystack plans from these amounts and intervals. Unit tests verify plan creation, checkout initialization, signed licenses and entitlement mapping without exposing Paystack secret keys.

## Operational payment status

The code gate is complete. Production Paystack subscriptions must not be described as live until the merged Render billing deployment reports that the four Contractor Clipper plans were found/created successfully and the production Contractor Clipper billing health endpoint responds successfully.

The temporary heavy v1 browser workflow can be removed after this evidence is recorded so normal CI stays lightweight and change-scoped.
