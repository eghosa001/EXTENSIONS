// Synchronise @QuickQuoteProBot without ever embedding credentials in source.
const token=process.env.QUICKQUOTE_BOT_TOKEN;
const secret=process.env.QUICKQUOTE_WEBHOOK_SECRET;
const workerUrl=process.env.QUICKQUOTE_WORKER_URL;
if(!token || !/^[A-Za-z0-9_-]{32,256}$/.test(secret||"") || !workerUrl) throw Error("Missing secure bot deployment settings.");
const site=new URL(workerUrl);
if(site.protocol!=="https:" || site.username || site.password || site.search || site.hash || site.pathname!=="/") throw Error("Worker URL must be a clean HTTPS origin ending in /");
const api=async(method,data={})=>{
  const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok || !result.ok) throw Error(method+" failed: "+(result.description||response.status));
  return result.result;
};
const me=await api("getMe");
if(me.username?.toLowerCase()!=="quickquoteprobot") throw Error("Token does not match @QuickQuoteProBot.");
const commands=[
  ["start","Start QuickQuote Pro"],["help","Instructions"],["business","Set business name"],
  ["contact","Set business contact details"],["currency","Choose currency"],["quote","Create a quotation"],
  ["invoice","Create an invoice"],["add","Add a document item"],["preview","Review document"],
  ["tax","Set tax percentage"],["discount","Set discount percentage"],["note","Add a note"],
  ["due","Set document due date"],["undo","Remove last item"],["done","Generate PDF"],
  ["cancel","Cancel draft"],["plan","View your plan"],["upgrade","Buy Pro access"],
  ["paysupport","Payment and billing help"],["privacy","View privacy summary"],
  ["delete_my_data","Request deletion"]
].map(([command,description])=>({command,description}));
await api("setMyName",{name:"QuickQuote Pro"});
await api("setMyDescription",{description:"Create professional quotations and invoices directly in Telegram. Enter your business information, item details, taxes and discounts to receive a shareable PDF. Three PDFs free monthly. Pro access through Telegram Stars is available after payment verification."});
await api("setMyShortDescription",{short_description:"Create quotations and invoices as shareable PDFs, directly inside Telegram."});
await api("setMyCommands",{commands});
await api("setWebhook",{url:site.origin+"/telegram",secret_token:secret,
 allowed_updates:["message","pre_checkout_query","callback_query"],drop_pending_updates:false,max_connections:25});
console.log("QuickQuote Pro profile, command menu and webhook registered at "+site.origin);
