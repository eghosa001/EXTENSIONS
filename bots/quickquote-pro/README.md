# QuickQuote Pro — Telegram invoice and quotation bot

Functional MVP built for Telegram, Cloudflare Workers and D1. **No AI API calls or AI token charges.**

## Features
- Make professional PDF quotations and invoices with up to 20 line items
- Set business name, choose currency (NGN, USD, GBP, EUR, GHS, KES, CAD)
- Exact decimal monetary arithmetic; multi-page PDFs; PDF injection-safe text
- Three free PDFs per calendar month (UTC); Pro unlocks unlimited PDFs with reasonable usage
- 300 Telegram Stars for **one-time, 30-day** Pro access (no auto-renewal)
- Stars pre-checkout validation, payment deduplication and database-triggered entitlement
- Signed Telegram webhook, retry deduplication, billing support and data deletion
- Cloudflare Workers + D1; no npm dependencies and no hosted AI model

## Deploy
1. In Telegram open @BotFather and send /newbot; securely copy the BOT_TOKEN.
2. From this directory: copy wrangler.toml.example to wrangler.toml.
3. Install Wrangler with npm install -g wrangler and run wrangler login.
4. Create database: wrangler d1 create quickquote-pro. Copy the returned database_id into wrangler.toml.
5. Apply schema to the remote database: wrangler d1 execute quickquote-pro --remote --file=./schema.sql
6. Create a random 32–64 character webhook secret made only of A-Z, a-z, 0-9, underscore, or hyphen.
7. Use wrangler secret put BOT_TOKEN, then wrangler secret put WEBHOOK_SECRET.
8. In wrangler.toml set SUPPORT_CONTACT to a support username (e.g. @YourSupportHandle).
9. Deploy using wrangler deploy and note your workers.dev URL.
10. Set webhook by POSTing to https://api.telegram.org/botYOUR_TOKEN/setWebhook with JSON:
    {"url":"https://YOUR_WORKER.workers.dev/telegram","secret_token":"YOUR_SECRET","allowed_updates":["message","pre_checkout_query"]}
11. Send /start to your bot. Use /quote Test client | Test project, /add Fan | 2 | 1200, and /done.
12. Test Stars payments using Telegram's documented test environment before real sales.

Warning: Never commit BOT_TOKEN, WEBHOOK_SECRET, real Wrangler database IDs, Telegram payment credentials or user data. The sample config intentionally uses a placeholder database ID and cannot deploy until configured.

## Commands
/start, /help, /business, /currency, /quote, /invoice, /add, /done, /cancel, /plan, /upgrade, /privacy, /delete_my_data, /confirmdelete, /paysupport.

This version creates PDFs but does not store document file copies; only a usage log. Prices refer to the Telegram Stars purchase charge, not necessarily cash proceeds. Verify payout eligibility and tax obligations independently. Real Telegram payment flows require live webhook credentials and have NOT been verified merely by unit tests.

## Run focused tests
node --test test.mjs

## Launch checklist
- [ ] Provision D1 and configure secrets (secret token >=32 safe characters)
- [ ] Install bot commands using BotFather
- [ ] Set up real support contact and publish privacy terms
- [ ] Test free flows and all currency formats on mobile
- [ ] Test Stars pre-checkout, payment success, duplicate delivery, refund manually
- [ ] Verify Telegram Stars payout availability for your account and country
- [ ] Add production request/error monitoring and a public landing page
- [ ] Validate paying demand with real customers before adding more products

Architecture intentionally avoids AI costs, third-party payment gateways for digital services, and customer document storage.
