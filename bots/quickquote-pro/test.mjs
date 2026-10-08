import {test} from "node:test";
import assert from "node:assert/strict";
import bot, {moneyMinor, formatMinor, parseItem, totalMinor, makePdf, validPayment, parseRate, calculateTotals} from "./worker.mjs";
const item = {name:"Fan",quantity:3,unit:2500000};
test("precise amounts and line totals", () => {
  assert.equal(moneyMinor("25000.75"), 2500075);
  assert.equal(formatMinor(2500075), "25,000.75");
  assert.deepEqual(parseItem("Fan | 3 | 25000"), item);
  assert.equal(totalMinor([item]), 7500000);
  for (const bad of ["-1","1.234","1e9","999999999","NaN"]) assert.throws(() => moneyMinor(bad));
  assert.throws(() => parseItem("Fan | 0 | 45"));
});
test("PDF is complete, multipage, and escapes unsafe text", () => {
  const pdf = makePdf({kind:"quote",business:"Eghosa (Service)",client:"Client \\ A",project:"Electrical",
    currency:"NGN", items:Array(20).fill(item),premium:false,reference:"QQ-123",date:"2026-10-08"});
  const doc = new TextDecoder().decode(pdf);
  assert.match(doc, /^%PDF-1.4/);
  assert.match(doc, /\/Count 2\b/);
  assert.match(doc, /TOTAL \\\(NGN\\\): 1,500,000\.00/);
  assert.match(doc, /Eghosa \\\(Service\\\)/);
  const xrefPos = Number(doc.match(/startxref\n(\d+)/)[1]);
  assert.equal(doc.slice(xrefPos, xrefPos+4), "xref");
  assert.match(doc, /%%EOF\n$/);
});
test("paid order validation binds price, currency, buyer and expiry", () => {
  const order={payload:"qq_3_abc",user_id:3,stars:300,status:"pending",created_at:Math.floor(Date.now()/1000)};
  const data={invoice_payload:order.payload,total_amount:300,currency:"XTR"};
  assert.equal(validPayment(data,order,3),true);
  assert.equal(validPayment({...data,total_amount:3},order,3),false);
  assert.equal(validPayment({...data,currency:"USD"},order,3),false);
  assert.equal(validPayment(data,order,5),false);
  assert.equal(validPayment(data,{...order,status:"paid"},3),false);
});
test("webhook rejects missing or wrong secret before touching storage", async()=>{
  for (const secret of [null,"wrong"]) {
    const headers = secret ? {"X-Telegram-Bot-Api-Secret-Token":secret}:{};
    const request=new Request("https://example.workers.dev/telegram",{method:"POST",headers,body:"{}"});
    const response=await bot.fetch(request,{BOT_TOKEN:"fake",WEBHOOK_SECRET:"x".repeat(32),DB:{},SUPPORT_CHAT_ID:"123"});
    assert.equal(response.status,403);
  }
  assert.equal((await bot.fetch(new Request("https://example.workers.dev/health"),{})).status,503);
  assert.equal((await bot.fetch(new Request("https://example.workers.dev/health"),{DB:{},BOT_TOKEN:"fake",WEBHOOK_SECRET:"x".repeat(32),SUPPORT_CHAT_ID:"123"})).status,200);
});

test("rounding, tax and discounts use integer minor currency units",()=>{
  assert.equal(parseRate("7.5"),750);
  assert.equal(parseRate("100"),10000);
  for (const v of ["-1","101","7.123","1e2"]) assert.throws(()=>parseRate(v));
  assert.deepEqual(calculateTotals([{quantity:2,unit:10005}],750,1000),
    {subtotal:20010,discount:2001,tax:1351,total:19360});
  assert.equal(calculateTotals([],0,0).total,0);
});
test("PDF formats international Latin names, long entries, tax and page numbers",()=>{
  const pdf=makePdf({kind:"invoice",business:"Café Élan & Renovation Services International",
    contact:"contact@example.com",client:"José Fernández",
    project:"Complete ceiling repair and installation", currency:"EUR",
    items:[{name:"W".repeat(90),quantity:1,unit:12500}],premium:true,
    taxRate:750,discountRate:1000,note:"Thanks",due:"2026-10-30",
    reference:"QQ-900",date:"2026-10-08"});
  const data=new TextDecoder().decode(pdf);
  assert.match(data,/\/WinAnsiEncoding/);
  assert.match(data,/Caf\\351/);
  assert.match(data,/Jos\\351/);
  assert.match(data,/Subtotal: EUR 125.00/);
  assert.match(data,/TOTAL \\\(EUR\\\): 120\.94/);
  assert.match(data,/Page 1 of 1/);
  assert.ok(!data.includes("W".repeat(60)));
});
