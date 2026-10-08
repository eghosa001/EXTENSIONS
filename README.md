# EXTENSIONS — launched tools and Telegram bot studio

This repository contains independently deployable products, each with its own source, setup and tests.

## Implemented browser extensions (preserved)
- 01-procurasheet — Shopify PO/CSV processing extension, with store/release assets
- 07-contractor-clipper — contractor product clipper and estimate workflows
- 08-redirect-audit — redirect auditing extension with browser tests

## Telegram bots
- bots/quickquote-pro — **implemented MVP** of QuickQuote Pro, a PDF quotation/invoice Telegram bot (no AI tokens, Telegram Stars Pro access). Requires bot secrets, Cloudflare D1 provisioning and live payment validation before launch.
- bots/memberflow — **research/plan only**, paid-community membership automation. No bot code or subscription service shipped.

## Working principles
- Preserve shipped products; don't confuse plans with functioning products.
- Prefer compact user flows, realistic pricing, payments verified with test events, and no unnecessary AI or recurring costs.
- Keep authentication secrets outside Git and handle payments idempotently.
- Run only change-scoped tests/CI.
- Do not deploy paid services before validating support, refunds, data deletion and payout rules.
