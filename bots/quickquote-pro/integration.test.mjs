import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import bot from "./worker.mjs";

function fixture() {
  const db=new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
  const D1={
    prepare(sql){
      const statement=db.prepare(sql);
      const execute=(args)=>({
        async run(){
          const data=statement.run(...args);
          return {meta:{changes:Number(data.changes),last_row_id:Number(data.lastInsertRowid)}};
        },
        async first(){return statement.get(...args)||null;},
        async all(){return {results:statement.all(...args)};}
      });
      return {...execute([]),bind(...args){return execute(args);}};
    },
    async batch(statements){
      db.exec("BEGIN");
      try{
        const values=[];
        for(const s of statements) values.push(await s.run());
        db.exec("COMMIT");
        return values;
      }catch(e){db.exec("ROLLBACK");throw e;}
    }
  };
  const env={DB:D1,BOT_TOKEN:"test-bot",WEBHOOK_SECRET:"x".repeat(32),
    SUPPORT_CHAT_ID:"100",PAYMENTS_ENABLED:"true"};
  const calls=[];
  const original=globalThis.fetch;
  globalThis.fetch=async (url,options)=>{
    const method=String(url).split("/").pop();
    const payload=options.body instanceof FormData ? options.body : JSON.parse(options.body);
    calls.push({method,payload});
    return Response.json({ok:true,result:true});
  };
  let updateId=1000;
  const push=async(update)=>{
    const request=new Request("https://quickquote.test/telegram",{method:"POST",
      headers:{"X-Telegram-Bot-Api-Secret-Token":env.WEBHOOK_SECRET,"content-type":"application/json"},
      body:JSON.stringify({update_id:++updateId,...update})});
    const response=await bot.fetch(request,env);
    assert.equal(response.status,200);
    return updateId;
  };
  const message=(text,user=42)=>push({message:{message_id:updateId+100,from:{id:user},chat:{id:user,type:"private"},text}});
  const service=(name,payload,user=42)=>push({message:{message_id:updateId+100,from:{id:user},chat:{id:user,type:"private"},[name]:payload}});
  const callback=(data)=>push({callback_query:{id:"cb"+(updateId+1),from:{id:42},message:{chat:{id:42,type:"private"}},data}});
  return {db,env,calls,message,service,callback,push,stop:()=>{globalThis.fetch=original;db.close();}};
}
test("guided Telegram PDF flow, buttons, preview, correct quota and replay safety",async()=>{
  const f=fixture();
  try{
    await f.message("/start");
    assert.ok(f.calls.some(c=>c.method==="sendMessage" && c.payload.reply_markup?.inline_keyboard));
    await f.message("/business Bichi Repairs");
    await f.message("/contact hello@example.com");
    await f.callback("new:quote");
    await f.message("Amaka | Electrical works");
    await f.message("Three ceiling fans | 3 | 10000.50");
    await f.message("/discount 10");
    await f.message("/tax 7.5");
    await f.message("/preview");
    assert.match(f.calls.at(-1).payload.text,/29,026.45/);
    await f.callback("done");
    const uploads=f.calls.filter(c=>c.method==="sendDocument");
    assert.equal(uploads.length,1);
    assert.match(await uploads[0].payload.get("document").text(),/^%PDF-1.4/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM documents").get().n,1);
    await f.message("/quote Second | Task");await f.message("/add Item | 1 | 2");await f.message("/done");
    await f.message("/quote Third | Task");await f.message("/add Item | 1 | 2");await f.message("/done");
    await f.message("/quote Fourth | Task");await f.message("/add Item | 1 | 2");await f.message("/done");
    assert.equal(f.calls.filter(c=>c.method==="sendDocument").length,3);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM documents").get().n,3);
  }finally{f.stop();}
});
test("Stars payments grant once, operator refunds once and support replies work",async()=>{
  const f=fixture();
  try{
    await f.message("/upgrade");
    const invoice=f.calls.find(c=>c.method==="sendInvoice").payload;
    assert.equal(invoice.currency,"XTR");
    assert.equal(invoice.prices[0].amount,300);
    await f.push({pre_checkout_query:{id:"checkout1",from:{id:42},invoice_payload:invoice.payload,currency:"XTR",total_amount:300}});
    assert.equal(f.calls.at(-1).payload.ok,true);
    const paid={invoice_payload:invoice.payload,currency:"XTR",total_amount:300,telegram_payment_charge_id:"charge_A"};
    await f.service("successful_payment",paid);
    const entitlement=f.db.prepare("SELECT plan_until FROM users WHERE id=42").get().plan_until;
    assert.ok(entitlement>Math.floor(Date.now()/1000));
    await f.service("successful_payment",paid);
    assert.equal(f.db.prepare("SELECT plan_until FROM users WHERE id=42").get().plan_until,entitlement);
    await f.message("/paysupport");
    await f.message("My paid upgrade is not showing in my plan");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM support_tickets").get().n,1);
    assert.ok(f.calls.some(c=>c.method==="sendMessage" && c.payload.chat_id==="100"));
    await f.message("/tickets",100);
    await f.message("/reply 1 | Payment verified, thank you.",100);
    assert.equal(f.db.prepare("SELECT status FROM support_tickets WHERE id=1").get().status,"closed");
    await f.message("/refund charge_A",100);
    assert.ok(f.calls.some(c=>c.method==="refundStarPayment"));
    assert.equal(f.db.prepare("SELECT status FROM orders WHERE charge_id='charge_A'").get().status,"refunded");
    assert.equal(f.db.prepare("SELECT plan_until FROM users WHERE id=42").get().plan_until,entitlement-2592000);
    await f.service("refunded_payment",paid);
    assert.equal(f.db.prepare("SELECT plan_until FROM users WHERE id=42").get().plan_until,entitlement-2592000);
  }finally{f.stop();}
});
