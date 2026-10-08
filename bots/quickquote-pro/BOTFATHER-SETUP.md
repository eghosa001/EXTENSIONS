# Telegram onboarding — @QuickQuoteProBot

Public bot: https://t.me/QuickQuoteProBot

**Security first:** The initial BotFather API token appeared in a chat. Regenerate it using BotFather's `/token` command, select @QuickQuoteProBot, and generate a replacement. Never put either token in GitHub, command arguments, documentation, bug reports, or screenshots. Do not send replacement credentials via chat.

## BotFather profile

**Bot display name:**
QuickQuote Pro | Invoices & Quotes

**Description (BotFather /setdescription):**
Create professional quotations and invoices right in Telegram. Add your business, customer, products or services, and prices to receive a ready-to-share PDF. Supports NGN, USD, GBP, EUR, GHS, KES and CAD. Get 3 free PDFs monthly; upgrade with Telegram Stars for more. No AI required.

**About (BotFather /setabouttext):**
Professional quotations and invoices as PDFs, made directly in Telegram.

**Commands (BotFather /setcommands):**
start - Start creating quotations and invoices
help - View setup and bot commands
business - Set your business name
currency - Choose a currency
quote - Start a quotation
invoice - Start an invoice
add - Add a line item to your document
done - Generate and receive a PDF
cancel - Cancel the current draft
plan - View free quota and Pro access
upgrade - Buy 30-day Pro access with Stars
privacy - Read data handling summary
paysupport - Get billing support
delete_my_data - Request profile deletion

**Profile picture (BotFather /setuserpic):**
Create a unique square logo featuring a clean document shape, a subtle checkmark, and the letters QQ. Avoid Telegram's trademarks, tiny text, and unofficial claims.

## Deployment — administrator checklist

Runtime: Cloudflare Worker + D1, as implemented in `worker.mjs`; repository does not yet contain cloud credentials.

1. Create Cloudflare D1 database `quickquote-pro`.
2. Configure `wrangler.toml` using `wrangler.toml.example` and the real D1 ID.
3. Apply `schema.sql` to remote D1 before accepting users.
4. Rotate the previously shared bot token via BotFather `/token`; save the **replacement** via `wrangler secret put BOT_TOKEN`, typed locally.
5. Generate a separate 32+ character webhook secret, save via `wrangler secret put WEBHOOK_SECRET`; this is **not** your Telegram API token.
6. Set `SUPPORT_CONTACT` to a real support username you control.
7. Deploy the Worker using `wrangler deploy`.
8. Register an HTTPS webhook with Telegram's `setWebhook` method using the Worker URL and webhook secret. Use a local environment and never place the API token inside GitHub Actions logs or public URLs.
9. Test `/start`, `/business`, `/quote`, `/add`, `/done`, `/invoice`, `/cancel`, currency selection and `/privacy`.
10. Test real Telegram Stars payment authorization, duplicate updates, Pro entitlement and refund/support handling in an appropriate test environment before launching paid access.
11. Run narrowly scoped checks: `node --test bots/quickquote-pro/test.mjs` at repository root.
12. Only announce the bot as live when payment flow and document generation have been verified against the deployed webhook.

This checklist is not proof of a live deployment. Creating a bot in BotFather **does not** launch its backend.
