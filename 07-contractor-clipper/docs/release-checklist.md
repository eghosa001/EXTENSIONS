# Contractor Clipper v1.0.0 production release checklist

## Core Chrome product
- [x] Manifest V3
- [x] Chrome 114+ Side Panel compatibility
- [x] Production permissions limited to activeTab, scripting, storage and sidePanel
- [x] No normal supplier-site host permissions
- [x] Optional billing host permission only for the fixed billing origin
- [x] Restrictive extension-page CSP
- [x] No remote code
- [x] No hidden network requests outside the dedicated billing client
- [x] Product/client/quote workspace stays in Chrome local storage
- [x] Workspace backup excludes billing license and entitlement

## Product extraction
- [x] Product title
- [x] SKU / MPN / UPC / GTIN
- [x] Brand / model
- [x] Description
- [x] Price / currency
- [x] Material / finish / colour
- [x] Dimensions
- [x] Availability
- [x] Up to 12 product images
- [x] Structured-data, metadata and specification-table fallbacks
- [x] Unsafe URL protocols blocked
- [x] At least three genuine live supplier domains pass strict extraction QA
- [x] Five genuine suppliers passed the final v1 run

## Free plan
- [x] ₦0 price
- [x] 2 active projects
- [x] 20 clips/month
- [x] 25 product-library items
- [x] 2 saved labour rates
- [x] 3 saved suppliers
- [x] 1 quote template
- [x] Basic estimate / print / PDF remains useful
- [x] Paid branding and advanced exports stay gated

## Pro plan
- [x] ₦4,000/month
- [x] ₦40,000/year
- [x] Unlimited clipping/projects
- [x] Multiple product images
- [x] Unlimited product/labour libraries
- [x] Supplier defaults
- [x] Supplier discounts
- [x] Quote branding
- [x] Reusable assemblies
- [x] Quote templates
- [x] Rich CSV and Excel-compatible SpreadsheetML exports
- [x] Itemized labour

## Business plan
- [x] ₦8,500/month
- [x] ₦85,000/year
- [x] Everything in Pro
- [x] Unlimited assemblies
- [x] Procurement status tracking
- [x] PO reference
- [x] Expected delivery date
- [x] Offline client approval package
- [x] Quote fingerprint stored before response
- [x] Response JSON must match project and fingerprint
- [x] Acceptance/decline metadata displayed in estimate workspace

## Quote quality
- [x] Supplier discount applies before markup
- [x] Delivery separated from product totals
- [x] Itemized labour reconciles into totals
- [x] Quote-level discount and tax
- [x] Internal Cost and Markup hidden from client print/PDF
- [x] Client approval package excludes supplier cost/markup/discount internals
- [x] Remove-logo action
- [x] Backup/restore
- [x] Browser restart persistence
- [x] Narrow 320 px side-panel QA

## Billing security
- [x] Paystack secret remains server-side
- [x] Card details handled by Paystack-hosted checkout
- [x] Signed `cc1` activation license
- [x] License contains Paystack customer code only
- [x] Entitlement lease is time-limited
- [x] Inactive/unknown subscriptions resolve to Free
- [x] Business preferred when multiple active paid plans exist
- [x] Monthly + annual plan creation is exact and tested
- [x] Paystack subscription-management link is server-generated
- [x] Production Render deploy created/found all four Paystack plans in Paystack live mode
- [x] Production billing health endpoint verified by live smoke run 37541385587
- [x] All four production checkout landing routes verified; no card charge was intentionally created during automated QA

## Public/store
- [x] Public product site provisioned on Render
- [x] Pricing page content
- [x] Privacy policy updated for Paystack and client approval
- [x] Subscription terms
- [x] Support/activation FAQ
- [x] Store listing v1.0.0
- [x] Store privacy disclosures
- [x] Extension icons and existing promotional asset
- [x] Passing 1280×800 Store screenshot
- [x] Clean v1.0.0 Store ZIP excludes tests and server billing code

## Evidence
- [x] Contractor Clipper scoped CI passed
- [x] Shared ProcuraSheet billing regression checks passed
- [x] Headed Chromium run 37540683416 passed
- [x] Artifact digest recorded
- [x] Store ZIP and screenshot hashes recorded

See `v1-release-evidence-2026-10-06.md`.
