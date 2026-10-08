# QuickQuote Pro privacy notice

Last updated: 8 October 2026. Public bot: https://t.me/QuickQuoteProBot

The bot processes your Telegram ID, chosen business name and contact information, currency, active document drafts, PDF usage counts, plan status, limited Telegram Stars payment identifiers, and messages sent to our support function. The data is used to generate your documents, apply usage limits, fulfil purchases, process refunds and handle support.

Generated PDF copies are sent to your Telegram chat, not saved as documents in our database. Telegram may retain files and messages according to your own chat settings. Cloudflare Workers and D1 process and store the minimum data needed for the bot's operation. We do not ask for bank-card details, sell your personal data, or send your document contents to an external AI service.

Routine housekeeping automatically removes webhook retry IDs older than 7 days, generated-document usage logs older than 93 days, unpaid checkout attempts older than 14 days, and closed support tickets older than 90 days. Paid transaction references and active support requests are kept until user deletion or operational resolution.

You can ask the bot to delete your application data using /delete_my_data followed by /confirmdelete. This deletes your active drafts, profile, PDF usage logs, support tickets and local payment references, and cancels unused Pro access; it does not remove Telegram chat history or initiate a refund. If you have a payment dispute, use /paysupport before deletion, and keep your receipt. Service-provider backups and legally required external payment records may remain subject to their own policies.

The bot uses a verified Telegram webhook and protects configuration secrets. Access to the operator's support/refund commands is restricted by Telegram user ID. No system is perfectly secure.

**Support contact:** /paysupport at @QuickQuoteProBot.
