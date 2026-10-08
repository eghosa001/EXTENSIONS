const STAR_PRICE = 300;
const FREE_LIMIT = 3;
const PRO_LIMIT = 500; // Fair use cap per UTC calendar month.
const MAX_UPDATE_BYTES = 65536;
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
export function parseRate(raw) {
  const input=String(raw).trim();
  if(!/^(?:100(?:\.0{1,2})?|[0-9]{1,2}(?:\.[0-9]{1,2})?)$/.test(input)) throw Error("Enter a percentage from 0 to 100, with up to 2 decimals.");
  return Math.round(Number(input)*100);
}
export function calculateTotals(items,taxRate=0,discountRate=0) {
  const subtotal=totalMinor(items);
  const discount=Math.round(subtotal/10000*discountRate);
  const taxable=subtotal-discount;
  const tax=Math.round(taxable/10000*taxRate);
  const total=taxable+tax;
  if(!Number.isSafeInteger(total)) throw Error("Document total too large.");
  return {subtotal,discount,tax,total};
}
// PDF's standard Helvetica supports Windows-1252. Emit printable bytes as
// ASCII octal escapes to keep stream lengths/xref offsets byte-accurate.
const win1252 = new Map([[0x20ac,128],[0x201a,130],[0x0192,131],[0x201e,132],
  [0x2026,133],[0x2020,134],[0x2021,135],[0x02c6,136],[0x2030,137],
  [0x0160,138],[0x2039,139],[0x0152,140],[0x017d,142],[0x2018,145],
  [0x2019,146],[0x201c,147],[0x201d,148],[0x2022,149],[0x2013,150],
  [0x2014,151],[0x02dc,152],[0x2122,153],[0x0161,154],[0x203a,155],
  [0x0153,156],[0x017e,158],[0x0178,159]]);
function pdfEscape(value) {
  let text = "";
  for (const ch of String(value).normalize("NFC").replace(/\s+/g, " ")) {
    const cp = ch.codePointAt(0);
    const byte = cp >= 32 && cp <= 126 || cp >= 160 && cp <= 255 ? cp : win1252.get(cp);
    if (byte === undefined) { text += "?"; continue; }
    if (byte > 126) text += "\\" + byte.toString(8).padStart(3,"0");
    else if (byte === 40 || byte === 41 || byte === 92) text += "\\" + ch;
    else text += ch;
  }
  return text;
}
// Conservative width estimate avoids clipping business names and labels.
function fitText(value, maxWidth, size) {
  let out = "", width = 0;
  for (const char of String(value).replace(/\s+/g, " ")) {
    const unit = /[MW@%]/.test(char) ? .92 : /[il1.:, ]/.test(char) ? .29 : .65;
    if (width + unit * size > maxWidth - 3 * size) return out.trimEnd() + "...";
    out += char;
    width += unit * size;
  }
  return out;
}
function pdfText(text, x, y, size = 11) {
  return "BT /F1 " + size + " Tf 1 0 0 1 " + x + " " + y + " Tm (" + pdfEscape(text) + ") Tj ET\n";
}
export function makePdf({kind, business, contact="", client, project, currency, items, premium, reference, date, taxRate=0, discountRate=0, note="", due=""}) {
  if (!items?.length || items.length > 20) throw Error("A document needs 1–20 items.");
  const amounts = calculateTotals(items,taxRate,discountRate);
  const pages = [];
  for (let start = 0; start < items.length; start += 12) {
    const part = items.slice(start, start + 12);
    let stream = "0.12 0.21 0.28 rg\n";
    stream += pdfText(fitText(business, 500, 20), 42, 795, 20);
    if (contact) stream += pdfText(fitText(contact, 490, 9), 42, 776, 9);
    stream += pdfText(kind === "invoice" ? "INVOICE" : "QUOTATION", 42, 751, 16);
    stream += pdfText("Ref: " + reference, 42, 731, 10);
    stream += pdfText("Date (UTC): " + date, 42, 714, 10);
    if(due) stream += pdfText((kind==="invoice"?"Due: ":"Valid until: ")+due, 330, 714, 10);
    stream += pdfText(fitText("Bill to: " + client, 500, 11), 42, 683, 11);
    stream += pdfText(fitText("Project: " + project, 500, 11), 42, 665, 11);
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
      stream += pdfText(fitText(item.name, 282, 10), 48, y, 10);
      stream += pdfText(String(item.quantity), 348, y, 10);
      stream += pdfText(formatMinor(item.unit), 402, y, 9);
      stream += pdfText(formatMinor(item.quantity * item.unit), 473, y, 8);
      stream += "0.87 0.9 0.91 RG 42 " + (y - 11) + " m 553 " + (y - 11) + " l S\n";
    });
    if (start + 12 >= items.length) {
      let y=151;
      stream += pdfText("Subtotal: " + currency+" "+formatMinor(amounts.subtotal), 320, y, 10);
      if(discountRate) {y-=16; stream += pdfText("Discount ("+(discountRate/100)+"%): -"+formatMinor(amounts.discount),320,y,10);}
      if(taxRate) {y-=16; stream += pdfText("Tax ("+(taxRate/100)+"%): "+formatMinor(amounts.tax),320,y,10);}
      stream += pdfText(fitText("TOTAL (" + currency + "): " + formatMinor(amounts.total), 500, 13), 300, 76, 13);
      if (note) stream += pdfText(fitText("Note: "+note, 270, 9),42,100,9);
    }
    stream += pdfText(premium ? "Thank you for your business." : "Created with QuickQuote Pro | t.me/QuickQuoteProBot", 42, 44, 9);
    stream += pdfText("Page "+(pages.length+1)+" of "+Math.ceil(items.length/12),480,44,9);
    pages.push(stream);
  }
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages.map((_, i) => (4 + 2 * i) + " 0 R").join(" ");
  objects[2] = "<< /Type /Pages /Kids [" + kids + "] /Count " + pages.length + " >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
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
const HOME_BUTTONS = [[{text:"New quotation",callback_data:"new:quote"},{text:"New invoice",callback_data:"new:invoice"}],
  [{text:"My plan",callback_data:"plan"},{text:"Upgrade ⭐",callback_data:"upgrade"}]];
const DRAFT_BUTTONS = [[{text:"✅ Generate PDF",callback_data:"done"},{text:"↩ Undo item",callback_data:"undo"}],
  [{text:"❌ Cancel",callback_data:"cancel"}]];
async function say(env, chat, text, buttons) {
  return telegram(env, "sendMessage", {chat_id: chat, text,
    ...(buttons ? {reply_markup:{inline_keyboard:buttons}} : {})});
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
export function validPayment(data, order, id, checkExpiration = true) {
  return !!order && order.status === "pending" && order.user_id === id
    && order.stars === STAR_PRICE && data.currency === "XTR"
    && data.total_amount === STAR_PRICE && data.invoice_payload === order.payload
    && (!checkExpiration || order.created_at >= now() - 86400);
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
  if (!validPayment(payment, order, message.from.id, false)) {
    if (order?.status !== "paid" || order.charge_id !== payment.telegram_payment_charge_id) {
      await say(env, message.chat.id, "Payment needs manual review. Please use /paysupport.");
      return;
    }
  } else {
    await env.DB.prepare(
      "UPDATE orders SET status='paid', charge_id=?, paid_at=? WHERE payload=? AND status='pending'"
    ).bind(payment.telegram_payment_charge_id, now(), payment.invoice_payload).run();
  }
  const pendingAck = await env.DB.prepare("SELECT status,ack_sent FROM orders WHERE payload=?").bind(payment.invoice_payload).first();
  if (pendingAck?.status === "paid" && !pendingAck.ack_sent) {
    await say(env, message.chat.id, "Payment confirmed! QuickQuote Pro is active for 30 days. Use /plan to check your access.", HOME_BUTTONS);
    await env.DB.prepare("UPDATE orders SET ack_sent=1 WHERE payload=? AND status='paid'").bind(payment.invoice_payload).run();
  }
}
async function handleRefund(env, message) {
  const refund=message.refunded_payment;
  if (refund.currency!=="XTR" || refund.total_amount!==STAR_PRICE) return;
  const result=await env.DB.prepare(
    "UPDATE orders SET status='refunded' WHERE payload=? AND user_id=? AND charge_id=? AND status='paid'"
  ).bind(refund.invoice_payload, message.chat.id, refund.telegram_payment_charge_id).run();
  if(result.meta.changes===1) {
    await say(env,message.chat.id,"Your Stars payment was refunded and the corresponding Pro access has been adjusted. Use /plan to see your current access.");
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
  if (message.refunded_payment) return handleRefund(env, message);
  const user = await ensureUser(env, id);
  const value = String(message.text || "").trim();
  const command = (value.split(/\s+/)[0] || "").toLowerCase().replace(/@[\w_]+$/, "");
  const arg = value.includes(" ") ? value.slice(value.indexOf(" ") + 1).trim() : "";
  if (!value.startsWith("/") && user.flow) {
    const flowCommand = {quote_details:"/quote",invoice_details:"/invoice",items:"/add",business:"/business"}[user.flow];
    if (flowCommand) return handleMessage(env,{...message,text:flowCommand+" "+value},updateId);
  }
  if (command === "/start" || command === "/help") {
    return say(env, chat, "QuickQuote Pro • Invoices & Quotations\n\nTap New quotation or New invoice below to begin. I will guide you step by step.\n\nFirst-time setup: /business Your business name\nBusiness details: /contact Your email and phone\nCurrency: /currency NGN, USD, GBP, EUR, GHS, KES or CAD\n\nQuick commands: /quote Client | Project, /add Item | Quantity | Unit price, /tax 7.5, /discount 10, /note Thank you, /due YYYY-MM-DD, /preview, /done.\n\nFree: 3 PDFs/month. Pro: 300 Stars/30 days, up to 500 PDFs/month. No AI API charges. /privacy /paysupport",HOME_BUTTONS);
  }
  if (command === "/business") {
    if (!arg) {
      await env.DB.prepare("UPDATE users SET flow='business' WHERE id=?").bind(id).run();
      return say(env,chat,"What is the name of your business? Type it below (max 70 characters).");
    }
    if (arg.length>70) return say(env, chat, "Business name is too long (max 70 characters).");
    await env.DB.prepare("UPDATE users SET business=?,flow=NULL WHERE id=?").bind(arg,id).run();
    return say(env, chat, "Business name saved: " + arg,HOME_BUTTONS);
  }
  if (command === "/contact") {
    if (arg.length>110) return say(env,chat,"Contact information must be under 110 characters.");
    await env.DB.prepare("UPDATE users SET contact=? WHERE id=?").bind(arg,id).run();
    return say(env,chat,"Business contact details saved.",HOME_BUTTONS);
  }
  if (command === "/currency") {
    const currency = arg.toUpperCase();
    if (!CURRENCIES.has(currency)) return say(env, chat, "Supported currencies: " + [...CURRENCIES].join(", "));
    await env.DB.prepare("UPDATE users SET currency=? WHERE id=?").bind(currency, id).run();
    return say(env, chat, "Currency updated: " + currency);
  }
  if (command === "/quote" || command === "/invoice") {
    const pair = arg.split("|").map(s => s.trim());
    if (!arg) {
      await env.DB.prepare("UPDATE users SET flow=?,draft=NULL WHERE id=?").bind(command.slice(1)+"_details",id).run();
      return say(env,chat,"Send the client's name and project separated by |.\nExample: Jane Smith | Kitchen renovation");
    }
    if (pair.length !== 2 || !pair[0] || !pair[1] || pair.some(s => s.length > 75)) {
      return say(env, chat, "Send Client name | Project name (max 75 characters each).");
    }
    const draft = {kind: command.slice(1), client: pair[0], project: pair[1], items: [],taxRate:0,discountRate:0,note:"",due:""};
    await env.DB.prepare("UPDATE users SET draft=?,flow='items' WHERE id=?").bind(JSON.stringify(draft), id).run();
    return say(env, chat, "Draft started for " + pair[0] + ".\n\nSend an item as: Name | Quantity | Unit price\nExample: Ceiling fan | 3 | 25000\n\nSend another item on the next line, or tap Generate PDF when finished.",DRAFT_BUTTONS);
  }
  if (command === "/cancel") {
    await env.DB.prepare("UPDATE users SET draft=NULL,flow=NULL WHERE id=?").bind(id).run();
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
    return say(env, chat, "Added: " + item.name + "\nSubtotal: " + user.currency + " " + formatMinor(totalMinor(draft.items)) + "\n" + draft.items.length + "/20 items. Send another item or tap Generate PDF.",DRAFT_BUTTONS);
  }
  if (["/tax","/discount","/note","/due","/preview"].includes(command)) {
    if (!user.draft) return say(env,chat,"Start a quotation or invoice first.",HOME_BUTTONS);
    const draft=JSON.parse(user.draft);
    if(command==="/preview"){
      const totals=calculateTotals(draft.items,draft.taxRate||0,draft.discountRate||0);
      const lines=draft.items.map((v,i)=>String(i+1)+". "+v.name+" ×"+v.quantity+" — "+user.currency+" "+formatMinor(v.quantity*v.unit));
      return say(env,chat,"Preview: "+draft.kind.toUpperCase()+"\n"+draft.client+" | "+draft.project+
        "\n\n"+(lines.join("\n")||"No items yet")+
        "\n\nSubtotal: "+user.currency+" "+formatMinor(totals.subtotal)+
        "\nDiscount: "+formatMinor(totals.discount)+
        "\nTax: "+formatMinor(totals.tax)+
        "\nTotal: "+user.currency+" "+formatMinor(totals.total),DRAFT_BUTTONS);
    }
    if(command==="/tax"||command==="/discount") {
      let rate;
      try { rate=parseRate(arg); } catch(err){return say(env,chat,err.message);}
      draft[command==="/tax"?"taxRate":"discountRate"]=rate;
    } else if (command==="/note"){
      if(arg.length>130) return say(env,chat,"Note must be 130 characters or less.");
      draft.note=arg;
    } else {
      if(arg && (!/^\d{4}-\d{2}-\d{2}$/.test(arg)||!Number.isFinite(Date.parse(arg+"T00:00:00Z"))||
        new Date(arg+"T00:00:00Z").toISOString().slice(0,10)!==arg))
        return say(env,chat,"Use /due YYYY-MM-DD (or /due with no date to clear).");
      draft.due=arg;
    }
    await env.DB.prepare("UPDATE users SET draft=? WHERE id=?").bind(JSON.stringify(draft),id).run();
    return say(env,chat,"Updated. Use /preview to review or Generate PDF when ready.",DRAFT_BUTTONS);
  }
  if (command === "/undo") {
    if (!user.draft) return say(env,chat,"Start a quotation or invoice first.",HOME_BUTTONS);
    const draft=JSON.parse(user.draft);
    if (!draft.items.length) return say(env,chat,"No items to undo.",DRAFT_BUTTONS);
    const last=draft.items.pop();
    await env.DB.prepare("UPDATE users SET draft=? WHERE id=?").bind(JSON.stringify(draft),id).run();
    return say(env,chat,"Removed "+last.name+". Remaining items: "+draft.items.length,DRAFT_BUTTONS);
  }
  if (command === "/done") {
    if (!user.draft) return say(env, chat, "No draft. Use /quote or /invoice to begin.");
    const draft = JSON.parse(user.draft);
    if (!draft.items.length) return say(env, chat, "Add at least one item using /add.");
    const used=await usage(env,id);
    if (used >= (isPro(user) ? PRO_LIMIT : FREE_LIMIT)) return say(env,chat,isPro(user) ? "You reached the 500 document monthly fair-use limit. Contact /paysupport if you need business-volume access." : "Your 3 free PDFs for this month are used. Send /upgrade for Pro.");
    const date = new Date().toISOString().slice(0, 10);
    const reference = "QQ-" + String(updateId);
    const pdf = makePdf({kind: draft.kind, business: user.business, client: draft.client,
      project: draft.project, currency: user.currency, items: draft.items,
      premium: isPro(user), reference, date, contact:user.contact,
      taxRate:draft.taxRate||0, discountRate:draft.discountRate||0,
      note:draft.note||"", due:draft.due||""});
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
    return say(env, chat, "Document delivered! Start another when ready.",HOME_BUTTONS);
  }
  if (command === "/plan") {
    const used=await usage(env,id);
    return say(env, chat, isPro(user)
      ? "Pro valid until " + new Date(user.plan_until * 1000).toISOString().slice(0, 10) + " UTC. Remaining this month: "+Math.max(0,PRO_LIMIT-used)+"/"+PRO_LIMIT+" PDFs."
      : "Free plan: " + Math.max(0, FREE_LIMIT-used) + "/" + FREE_LIMIT + " PDFs remaining this month. Pro: " + STAR_PRICE + " Stars/30 days (500 PDFs/month). /upgrade",HOME_BUTTONS);
  }
  if (command === "/upgrade") {
    const payload = "qq_" + id + "_" + crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare("INSERT INTO orders(payload,user_id,stars,created_at) VALUES(?,?,?,?)")
      .bind(payload, id, STAR_PRICE, now()).run();
    return telegram(env, "sendInvoice", {chat_id: chat, title: "QuickQuote Pro — 30 days",
      description: "Up to 500 quotation and invoice PDFs monthly for 30 days. One-time payment; no automatic renewal.",
      payload, currency: "XTR", prices: [{label: "30-day Pro access", amount: STAR_PRICE}]});
  }
  if (command === "/paysupport") {
    return say(env, chat, "For a Telegram Stars billing issue, contact " + (env.SUPPORT_CONTACT || "the bot owner") + ". Include your payment date and Telegram username. Never share a password or recovery code.");
  }
  if (command === "/privacy") {
    return say(env, chat, "We store your Telegram ID, business name, currency, draft items, document counts, plan status and Telegram Stars charge references. PDFs are delivered to your chat, not stored by this service. You can request removal using /delete_my_data and /confirmdelete; deletion also removes paid access, but does not refund purchases. Support: " + (env.SUPPORT_CONTACT || "bot owner"));
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
  return say(env, chat, "I didn't recognize that. Tap an option or use /help.",HOME_BUTTONS);
}
async function handleCallback(env, callback, updateId) {
  const chat=callback.message?.chat;
  if(!chat || chat.type!=="private" || !callback.from?.id || callback.from.id!==chat.id) return;
  await telegram(env,"answerCallbackQuery",{callback_query_id:callback.id});
  const map={ "new:quote":"/quote","new:invoice":"/invoice",done:"/done",
    undo:"/undo",cancel:"/cancel",plan:"/plan",upgrade:"/upgrade"};
  const command=map[callback.data];
  if(command) return handleMessage(env,{chat,from:callback.from,text:command},updateId);
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
    if (Number(request.headers.get("content-length") || 0) > MAX_UPDATE_BYTES)
      return new Response("Payload too large", {status: 413});
    let update;
    try {
      const text=await request.text();
      if (encoder.encode(text).length>MAX_UPDATE_BYTES) return new Response("Payload too large",{status:413});
      update=JSON.parse(text);
    } catch { return new Response("Bad JSON", {status: 400}); }
    if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) return new Response("Bad update", {status: 400});
    const accepted = await env.DB.prepare("INSERT OR IGNORE INTO updates(id,seen_at) VALUES(?,?)")
      .bind(update.update_id, now()).run();
    if (accepted.meta.changes !== 1) return new Response("ok");
    try {
      if (update.pre_checkout_query) await checkout(env, update.pre_checkout_query);
      else if (update.callback_query) await handleCallback(env,update.callback_query,update.update_id);
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
