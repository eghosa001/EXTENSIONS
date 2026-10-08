# QuickQuote Pro — Telegram quotation and invoice bot

**Bot:** https://t.me/QuickQuoteProBot • **Platform:** Cloudflare Workers + D1 + Telegram Stars • **AI API cost:** zero

## What users can do

Create branded PDF quotations and invoices inside Telegram without installing another app. The bot has guided buttons and step-by-step document entry, but still supports fast slash commands.

- Business name and contact details, seven currencies (NGN, USD, GBP, EUR, GHS, KES and CAD)
- Up to 20 line items per document; prices kept in integer minor units
- Optional percentage tax, discount, note and due/valid-until date
- Document preview, undo and cancel
- Shareable multipage PDFs with page numbers and standard Helvetica + WinAnsi support for Latin accents
- Free: **3 PDFs per UTC month**; Pro: **300 Stars, one-time for 30 days**, up to **500 PDFs per UTC month**
- Stars invoice checkout verification, duplicate delivery protection, refund event reconciliation
- In-chat support tickets, owner-only replies/refunds and data deletion

**Important:** No paid purchases are enabled in the default configuration. Green CI does not mean the bot has been deployed or that real payments are verified.

## User commands

Start with /start and tap **New quotation** or **New invoice**, then send customer and project separated by a vertical bar, e.g. `Amina Yusuf | Kitchen renovation`. Enter line items like `Ceiling fan | 3 | 25000`. Tap **Generate PDF** or send /done.

Additional commands: /business, /contact, /currency, /quote, /invoice, /add, /undo, /tax, /discount, /note, /due, /preview, /plan, /upgrade, /paysupport, /privacy, /delete_my_data, /confirmdelete, /cancel and /whoami.

Examples: `/tax 7.5`, `/discount 10`, `/due 2026-11-02`, `/contact hello@example.com | +234...`.

## Run focused tests

Node.js 22 or newer, no additional dependencies:

```sh
cd bots/quickquote-pro
node --check worker.mjs
node --test test.mjs
```

The dedicated GitHub Actions workflow also checks the SQLite payment, refund and support triggers.

## Owner setup and deployment

1. **Rotate the previously exposed API token.** Open BotFather, select @QuickQuoteProBot, send /token, generate a new token and keep it private. Never reuse the token shared in chat.
2. Create Cloudflare D1 database **quickquote-pro** and note its UUID.
3. Create a scoped Cloudflare API token with permissions to deploy/edit Workers and D1 databases for your account.
4. Obtain your **own** numeric Telegram user ID for support. Once the bot is reachable, /whoami returns it; alternatively use Telegram's account info tool before launch.
5. In the GitHub EXTENSIONS repository open **Settings → Secrets and variables → Actions**, and create these six secrets:
   - `CLOUDFLARE_API_TOKEN` — scoped Cloudflare deployment credential
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account identifier
   - `CLOUDFLARE_D1_DATABASE_ID` — UUID of quickquote-pro
   - `QUICKQUOTE_BOT_TOKEN` — **newly rotated** BotFather token
   - `QUICKQUOTE_WEBHOOK_SECRET` — separate 32+ character random string using letters, numbers, underscore or hyphen
   - `QUICKQUOTE_SUPPORT_CHAT_ID` — numeric ID of your Telegram account
6. In **GitHub Actions → QuickQuote controlled deployment → Run workflow**, enter your correct public HTTPS Cloudflare Worker origin (for example `https://quickquote-pro.YOURSUBDOMAIN.workers.dev/`). Keep **enable_paid_features** set to **false**.
7. The workflow runs tests, updates D1 schema, deploys the Worker, stores secrets in Cloudflare, checks /health, verifies your token belongs to QuickQuoteProBot, and registers the Telegram profile, commands and webhook.
8. Test actual Telegram chat behaviour, PDF downloads on desktop/phones, quotas, support tickets and deletion before advertising publicly.
9. Before enabling paid access, test Stars checkout, retries, successful purchase, entitlement and /refund against Telegram's current official testing procedures and payout requirements. Only then rerun the deployment workflow with **enable_paid_features=true**.

Do **not** put real tokens into commits, issue comments, YAML files or chat messages. A release should use stored secrets only.

### Operator support

The numeric user ID configured as `SUPPORT_CHAT_ID` can send:

- `/tickets` — list recent open billing tickets
- `/reply 42 | Your response` — reply and close support ticket 42
- `/refund CHARGE_ID` — call Telegram's refundStarPayment API for a stored successful charge
- `/whoami` — display the current Telegram user ID

Never enter another user's numeric ID as the support operator.

## Privacy, money and quality boundaries

The app doesn't store document PDF copies, collect card details, or use external AI services. It stores drafts, usage records, payment transaction references and support messages in Cloudflare D1. See [Privacy](PRIVACY.md) and [Terms](TERMS.md).

PDF text supports many Latin-script accents but not all Unicode writing systems. Legal/tax details must be checked by the user. Cloudflare/Telegram limits still apply. A separate live QA gate is required before calling it production-ready.
