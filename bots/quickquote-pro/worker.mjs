const STAR_PRICE = 300;
const FREE_LIMIT = 3;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const CURRENCIES = new Set(["NGN", "USD", "GBP", "EUR", "GHS", "KES", "CAD"]);
const encoder = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);

export function moneyMinor(raw) {
  const s = String(raw).trim();
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(s)) throw Error("Price must be 0–9999999.99 with at most 2 decimals.");
  const [major, fraction = ""] = s.split(".");
  return Number(major) * 100 + Number(fraction.padEnd(2, "0"));
}
export function formatMinor(value) {
  return (value / 100).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
export function parseItem(raw) {
  const pieces = raw.split("|").map(s => s.trim());
  if (pieces.length !== 3 || !pieces[0] || pieces[0].length > 65) throw Error("Use: /add Description | Quantity | Unit price");
  if (!/^[1-9]\d{0,2}$/.test(pieces[1])) throw Error("Quantity must be a whole number from 1 to 999.");
  return {name: pieces[0], quantity: Number(pieces[1]), unit: moneyMinor(pieces[2])};
}
export function totalMinor(items) {
  return items.reduce((sum, item) => sum + item.quantity * item.unit, 0);
}
function pdfEscape(value) {
  return String(value).normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
}
function pdfText(text, x, y, size = 11) {
  return "BT /F1 " + size + " Tf 1 0 0 1 " + x + " " + y + " Tm (" + pdfEscape(text) + ") Tj ET\n";
}
export function makePdf({kind, business, client, project, currency, items, premium, reference, date}) {
  if (!items?.length || items.length > 20) throw Error("A document needs 1–20 items.");
  const total = totalMinor(items);
  if (!Number.isSafeInteger(total)) throw Error("Total is too large.");
  const pages = [];
  for (let start = 0; start < items.length; start += 12) {
    const part = items.slice(start, start + 12);
    let stream = "0.12 0.21 0.28 rg\n";
    stream += pdfText(String(business).slice(0, 55), 42, 795, 20);
    stream += pdfText(kind === "invoice" ? "INVOICE" : "QUOTATION", 42, 751, 16);
    stream += pdfText("Ref: " + reference, 42, 731, 10);
    stream += pdfText("Date (UTC): " + date, 42, 714, 10);
    stream += pdfText("Bill to: " + String(client).slice(0, 63), 42, 683, 11);
    stream += pdfText("Project: " + String(project).slice(0, 61), 42, 665, 11);
    stream += "0.14 0.45 0.52 rg\n";
    stream += "42 627 511 27 re f\n";
    stream += "1 1 1 rg\n";
    stream += pdfText("ITEM", 48, 636, 10);
    stream += pdfText("QTY", 348, 636, 10);
    stream += pdfText("UNIT", 402, 636, 10);
    stream += pdfText("TOTAL", 483, 636, 10);
    stream += "0.12 0.21 0.28 rg\n";
    part.forEach((item, i) => {
      const y = 603 - i * 37;
      stream += pdfText(String(item.name).slice(0, 46), 48, y, 10);
      stream += pdfText(String(item.quantity), 348, y, 10);
      stream += pdfText(formatMinor(item.unit), 402, y, 9);
      stream += pdfText(formatMinor(item.quantity * item.unit), 483, y, 9);
      stream += "0.87 0.9 0.91 RG 42 " + (y - 11) + " m 553 " + (y - 11) + " l S\n";
    });
    if (start + 12 >= items.length) {
      stream += pdfText("TOTAL (" + currency + "): " + formatMinor(total), 330, 102, 15);
    }
    stream += pdfText(premium ? "Prepared with QuickQuote Pro" : "Created with QuickQuote - Telegram bot", 42, 44, 9);
    pages.push(stream);
  }
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages.map((_, i) => (4 + 2 * i) + " 0 R").join(" ");
  objects[2] = "<< /Type /Pages /Kids [" + kids + "] /Count " + pages.length + " >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((stream, i) => {
    const page = 4 + i * 2, content = page + 1;
    objects[page] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents " + content + " 0 R >>";
    objects[content] = "<< /Length " + encoder.encode(stream).length + " >>\nstream\n" + stream + "endstream";
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = encoder.encode(pdf).length;
    pdf += i + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xref = encoder.encode(pdf).length;
  pdf += "xref\n0 " + objects.length + "\n0000000000 65535 f \n";
  for (let i = 1; i < objects.length; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Root 1 0 R /Size " + objects.length + " >>\nstartxref\n" + xref + "\n%%EOF\n";
  return encoder.encode(pdf);
}
async function telegram(env, method, data) {
  const r = await fetch("https://api.telegram.org/bot" + env.BOT_TOKEN + "/" + method,
    {method: "POST", body: data instanceof FormData ? data : JSON.stringify(data),
      headers: data instanceof FormData ? {} : {"content-type": "application/json"}});
  const result = await r.json().catch(() => ({ok: false, description: "Telegram returned invalid JSON"}));
  if (!r.ok || !result.ok) throw Error(method + ": " + (result.description || "Telegram API error"));
  return result.result;
}
async function say(env, chat, text) {
  return telegram(env, "sendMessage", {chat_id: chat, text});
}
const readUser = (env, id) => env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
async function ensureUser(env, id) {
  await env.DB.prepare("INSERT OR IGNORE INTO users(id) VALUES (?)").bind(id).run();
  return readUser(env, id);
}
const isPro = (user) => user.plan_until > now();
async function usage(env, id) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM documents WHERE user_id=? AND created_at >= strftime('%s','now','start of month')").bind(id).first();
  return Number(row.n);
}
export function validPayment(data, order, id) {
  return !!order && order.status === "pending" && order.user_id === id
    && order.stars === STAR_PRICE && data.currency === "XTR"
    && data.total_amount === STAR_PRICE && data.invoice_payload === order.payload
    && order.created_at >= now() - 86400;
}
async function checkout(env, query) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE payload=?").bind(query.invoice_payload).first();
  const ok = validPayment(query, order, query.from.id);
  return telegram(env, "answerPreCheckoutQuery",
    {pre_checkout_query_id: query.id, ok, ...(ok ? {} : {error_message: "Invalid or expired order. Use /upgrade to request a new invoice."})});
}
async function handleSuccessfulPayment(env, message) {
  const payment = message.successful_payment;
  const order = await env.DB.prepare("SELECT * FROM orders WHERE payload=?").bind(payment.invoice_payload).first();
  if (!validPayment(payment, order, message.from.id)) {
    // The same valid payment can be redelivered by Telegram; never re-grant access.
    if (order?.status === "paid" && order.charge_id === payment.telegram_payment_charge_id) return;
    await say(env, message.chat.id, "Payment needs manual review. Please use /paysupport.");
    return;
  }
  const result = await env.DB.prepare(
    "UPDATE orders SET status='paid', charge_id=?, paid_at=? WHERE payload=? AND status='pending'"
  ).bind(payment.telegram_payment_charge_id, now(), payment.invoice_payload).run();
  if (result.meta.changes === 1) {
    await say(env, message.chat.id, "Payment confirmed. QuickQuote Pro is active for 30 days. Use /plan to check access.");
  }
}
async function sendPdf(env, chat, pdf, filename) {
  const data = new FormData();
  data.set("chat_id", String(chat));
  data.set("document", new File([pdf], filename, {type: "application/pdf"}));
  data.set("caption", "Your document is ready.");
  return telegram(env, "sendDocument", data);
}
async function handleMessage(env, message, updateId) {
  if (message.chat.type !== "private" || !message.from?.id) return;
  const id = message.from.id, chat = message.chat.id;
  if (message.successful_payment) return handleSuccessfulPayment(env, message);
  const user = await ensureUser(env, id);
  const value = String(message.text || "").trim();
  const command = (value.split(/\s+/)[0] || "").toLowerCase().replace(/@[\w_]+$/, "");
  const arg = value.slice(value.indexOf(" ") + 1).trim();
  if (command === "/start" || command === "/help") {
    return say(env, chat, "QuickQuote Pro | Quotations & Invoices\n\n1. /business Your business name\n2. /currency NGN (or USD, GBP, EUR, GHS, KES, CAD)\n3. /quote Client | Project (or /invoice Client | Project)\n4. /add Item | Quantity | Unit price\n5. Repeat /add and send /done to receive your PDF.\n\nOther commands: /cancel, /plan, /upgrade, /privacy, /paysupport. Free: 3 PDFs/month; Pro: " + STAR_PRICE + " Stars for 30 days. No AI tokens needed.");
  }
  if (command === "/business") {
    if (!arg || arg.length > 70) return say(env, chat, "Use /business Your business name (max 70 characters).");
    await env.DB.prepare("UPDATE users SET business=? WHERE id=?").bind(arg, id).run();
    return say(env, chat, "Business name saved: " + arg);
  }
  if (command === "/currency") {
    const currency = arg.toUpperCase();
    if (!CURRENCIES.has(currency)) return say(env, chat, "Supported currencies: " + [...CURRENCIES].join(", "));
    await env.DB.prepare("UPDATE users SET currency=? WHERE id=?").bind(currency, id).run();
    return say(env, chat, "Currency updated: " + currency);
  }
  if (command === "/quote" || command === "/invoice") {
    const pair = arg.split("|").map(s => s.trim());
    if (pair.length !== 2 || !pair[0] || !pair[1] || pair.some(s => s.length > 75)) {
      return say(env, chat, "Use " + command + " Client name | Project name");
    }
    const draft = {kind: command.slice(1), client: pair[0], project: pair[1], items: []};
    await env.DB.prepare("UPDATE users SET draft=? WHERE id=?").bind(JSON.stringify(draft), id).run();
    return say(env, chat, "Draft started for " + pair[0] + ". Add a line:\n/add Item name | Quantity | Unit price\nExample: /add Ceiling fan | 3 | 25000\nWhen finished, send /done.");
  }
  if (command === "/cancel") {
    await env.DB.prepare("UPDATE users SET draft=NULL WHERE id=?").bind(id).run();
    return say(env, chat, "Draft cancelled.");
  }
  if (command === "/add") {
    if (!user.draft) return say(env, chat, "Start with /quote Client | Project or /invoice Client | Project.");
    const draft = JSON.parse(user.draft);
    if (draft.items.length >= 20) return say(env, chat, "A maximum of 20 line items is supported.");
    let item;
    try { item = parseItem(arg); } catch (err) { return say(env, chat, err.message); }
    draft.items.push(item);
    await env.DB.prepare("UPDATE users SET draft=? WHERE id=?").bind(JSON.stringify(draft), id).run();
    return say(env, chat, "Added " + item.name + ". Total: " + user.currency + " " + formatMinor(totalMinor(draft.items)) + ". Add another item or use /done.");
  }
  if (command === "/done") {
    if (!user.draft) return say(env, chat, "No draft. Use /quote or /invoice to begin.");
    const draft = JSON.parse(user.draft);
    if (!draft.items.length) return say(env, chat, "Add at least one item using /add.");
    if (!isPro(user) && await usage(env, id) >= FREE_LIMIT) return say(env, chat, "Your 3 free PDFs for this month are used. Send /upgrade for Pro.");
    const date = new Date().toISOString().slice(0, 10);
    const reference = "QQ-" + String(updateId);
    const pdf = makePdf({kind: draft.kind, business: user.business, client: draft.client,
      project: draft.project, currency: user.currency, items: draft.items,
      premium: isPro(user), reference, date});
    const reserved = await env.DB.prepare(
      "INSERT OR IGNORE INTO documents(update_id,user_id,kind,created_at) VALUES(?,?,?,?)"
    ).bind(updateId, id, draft.kind, now()).run();
    if (reserved.meta.changes !== 1) return; // Retry guard.
    try {
      await sendPdf(env, chat, pdf, draft.kind + "-" + reference + ".pdf");
    } catch (err) {
      await env.DB.prepare("DELETE FROM documents WHERE update_id=? AND user_id=?").bind(updateId, id).run();
      throw err;
    }
    await env.DB.prepare("UPDATE users SET draft=NULL WHERE id=?").bind(id).run();
    return say(env, chat, "Document delivered. Create another using /quote or /invoice.");
  }
  if (command === "/plan") {
    return say(env, chat, isPro(user)
      ? "Pro access until " + new Date(user.plan_until * 1000).toISOString().slice(0, 10) + " UTC. Unlimited documents (fair use)."
      : "Free plan: " + Math.max(0, FREE_LIMIT - await usage(env, id)) + "/" + FREE_LIMIT + " PDFs remaining this month. Pro: " + STAR_PRICE + " Stars/30 days. /upgrade");
  }
  if (command === "/upgrade") {
    const payload = "qq_" + id + "_" + crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare("INSERT INTO orders(payload,user_id,stars,created_at) VALUES(?,?,?,?)")
      .bind(payload, id, STAR_PRICE, now()).run();
    return telegram(env, "sendInvoice", {chat_id: chat, title: "QuickQuote Pro — 30 days",
      description: "Unlock unlimited quotation and invoice PDFs for 30 days. One-time payment; no automatic renewal.",
      payload, currency: "XTR", prices: [{label: "30-day Pro access", amount: STAR_PRICE}]});
  }
  if (command === "/paysupport") {
    return say(env, chat, "For a Telegram Stars billing issue, contact " + (env.SUPPORT_CONTACT || "the bot owner") + ". Include your payment date and Telegram username. Never share a password or recovery code.");
  }
  if (command === "/privacy") {
    return say(env, chat, "We store Telegram user ID, business name, currency, draft items, PDF counts, plan status and payment references. Generated PDFs are sent to your chat, not stored. Use /delete_my_data to request deletion; then /confirmdelete. Support: " + (env.SUPPORT_CONTACT || "bot owner"));
  }
  if (command === "/delete_my_data") return say(env, chat, "To permanently remove your bot data and any paid access, send /confirmdelete. This does not refund past purchases.");
  if (command === "/confirmdelete") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM documents WHERE user_id=?").bind(id),
      env.DB.prepare("DELETE FROM orders WHERE user_id=?").bind(id),
      env.DB.prepare("DELETE FROM users WHERE id=?").bind(id)
    ]);
    return say(env, chat, "Your bot profile and associated data have been deleted.");
  }
  return say(env, chat, "Unknown command. Use /help for instructions.");
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return new Response("ok");
    if (url.pathname !== "/telegram" || request.method !== "POST") return new Response("Not found", {status: 404});
    if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || env.WEBHOOK_SECRET.length < 32 || !env.DB)
      return new Response("Bot not configured", {status: 503});
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET)
      return new Response("Forbidden", {status: 403});
    if (Number(request.headers.get("content-length") || 0) > 200000)
      return new Response("Payload too large", {status: 413});
    let update;
    try { update = await request.json(); } catch { return new Response("Bad JSON", {status: 400}); }
    if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) return new Response("Bad update", {status: 400});
    const accepted = await env.DB.prepare("INSERT OR IGNORE INTO updates(id,seen_at) VALUES(?,?)")
      .bind(update.update_id, now()).run();
    if (accepted.meta.changes !== 1) return new Response("ok");
    try {
      if (update.pre_checkout_query) await checkout(env, update.pre_checkout_query);
      else if (update.message) await handleMessage(env, update.message, update.update_id);
      return new Response("ok");
    } catch (err) {
      // Release dedupe record so Telegram can retry transient API/database failures.
      await env.DB.prepare("DELETE FROM updates WHERE id=?").bind(update.update_id).run();
      console.error("Update failed:", String(err.message).replaceAll(env.BOT_TOKEN, "[redacted]"));
      return new Response("Retry", {status: 503});
    }
  }
};
