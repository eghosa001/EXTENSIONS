const {URL}=require("node:url");
const {PLAN_SPECS,signLicense,verifyLicense,normalizeCheckout,validateEmail,entitlementFromSubscriptions}=require("./core.cjs");

const PAYSTACK_API="https://api.paystack.co";
const PAYSTACK_TIMEOUT_MS=12000;
const BODY_LIMIT=16*1024;
const BASE="/contractor-clipper";
const PLAN_CACHE_MS=10*60*1000;

function required(env,key){
  const value=String(env?.[key]||"").trim();
  if(!value)throw new Error(key+" is not configured.");
  return value;
}
function htmlEscape(value){return String(value==null?"":value).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));}
function headers(type){return {"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()"};}
function json(res,status,payload){res.writeHead(status,{...headers("application/json; charset=utf-8"),"access-control-allow-origin":"*"});res.end(JSON.stringify(payload));}
function page(res,status,title,body){
  res.writeHead(status,{...headers("text/html; charset=utf-8"),"content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscape(title)+'</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:48px auto;padding:0 20px;color:#17202a;background:#f6f7fb}main{background:#fff;border:1px solid #dfe3e8;border-radius:18px;padding:28px}h1{letter-spacing:-.03em}a{color:#7a5100}label{display:block;font-weight:700;margin:18px 0 6px}input{width:100%;box-sizing:border-box;border:1px solid #d7dce3;border-radius:10px;padding:11px}button{margin-top:12px;border:0;border-radius:10px;background:#111827;color:#fff;padding:11px 15px;font-weight:750}.note{font-size:12px;color:#66707d}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.plan{border:1px solid #e0e3e8;border-radius:14px;padding:18px}.price{font-size:24px;font-weight:850}.save{color:#17663a;font-weight:700}@media(max-width:700px){.plans{grid-template-columns:1fr}}</style><main>'+body+'</main></html>');
}
async function readBody(req){
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>BODY_LIMIT)throw Object.assign(new Error("Request body too large."),{statusCode:413});chunks.push(chunk);}
  return Buffer.concat(chunks).toString("utf8");
}
async function readJson(req){const raw=await readBody(req);if(!raw)return {};try{return JSON.parse(raw);}catch{throw Object.assign(new Error("Invalid JSON body."),{statusCode:400});}}
async function readForm(req){return Object.fromEntries(new URLSearchParams(await readBody(req)).entries());}
function expectedDomain(env){
  const key=required(env,"PAYSTACK_SECRET_KEY");
  if(key.startsWith("sk_live_"))return "live";
  if(key.startsWith("sk_test_"))return "test";
  throw new Error("PAYSTACK_SECRET_KEY has an invalid format.");
}
async function request(endpoint,{method="GET",body}={},env,fetchImpl){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),PAYSTACK_TIMEOUT_MS);
  const options={method,signal:controller.signal,headers:{authorization:"Bearer "+required(env,"PAYSTACK_SECRET_KEY"),accept:"application/json"}};
  if(body!==undefined){options.headers["content-type"]="application/json";options.body=JSON.stringify(body);}
  try{
    const response=await fetchImpl(PAYSTACK_API+endpoint,options);
    let payload={};try{payload=await response.json();}catch{}
    if(!response.ok||payload.status===false){const error=new Error(String(payload.message||"Paystack request failed."));error.statusCode=response.status>=400&&response.status<500?400:502;throw error;}
    return payload.data;
  }catch(error){
    if(error?.name==="AbortError"){const e=new Error("Paystack request timed out.");e.statusCode=502;throw e;}
    throw error;
  }finally{clearTimeout(timer);}
}
function parseMetadata(value){if(value&&typeof value==="object"&&!Array.isArray(value))return value;if(typeof value!=="string"||!value.trim())return {};try{const p=JSON.parse(value);return p&&typeof p==="object"&&!Array.isArray(p)?p:{};}catch{return {};}}
function transactionPlanCode(transaction){
  for(const value of [transaction?.plan,transaction?.plan_object]){
    if(typeof value==="string"&&/^PLN_[A-Za-z0-9]+$/.test(value))return value;
    if(value&&typeof value==="object"){const code=String(value.plan_code||"");if(/^PLN_[A-Za-z0-9]+$/.test(code))return code;}
  }
  return "";
}

function createContractorBilling({env=process.env,fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required.");
  let planCache={codes:null,checkedAt:0};

  async function ensurePlans(force=false){
    if(!force&&planCache.codes&&Date.now()-planCache.checkedAt<PLAN_CACHE_MS)return planCache.codes;
    const existing=await request("/plan?perPage=100",{},env,fetchImpl);
    const list=Array.isArray(existing)?existing:[];
    const codes={};
    for(const [key,spec] of Object.entries(PLAN_SPECS)){
      let plan=list.find(p=>String(p?.name||"")===spec.name&&Number(p?.amount)===spec.amount&&String(p?.interval||"").toLowerCase()===spec.interval&&String(p?.currency||"").toUpperCase()===spec.currency);
      if(!plan){
        plan=await request("/plan",{method:"POST",body:{name:spec.name,amount:spec.amount,interval:spec.interval,currency:spec.currency,description:"Contractor Clipper "+spec.plan+" "+spec.cadence+" subscription",send_invoices:true,send_sms:false}},env,fetchImpl);
      }
      const code=String(plan?.plan_code||"");
      if(!/^PLN_[A-Za-z0-9]+$/.test(code))throw new Error("Paystack did not return a valid "+spec.name+" plan code.");
      codes[key]=code;
    }
    planCache={codes,checkedAt:Date.now()};
    return codes;
  }

  async function subscriptionsForCustomer(customerCode){
    if(!/^CUS_[A-Za-z0-9]+$/.test(String(customerCode||"")))throw Object.assign(new Error("Invalid billing customer."),{statusCode:400});
    const customer=await request("/customer/"+encodeURIComponent(customerCode),{},env,fetchImpl);
    const id=Number(customer?.id);
    if(!Number.isSafeInteger(id)||id<=0)throw Object.assign(new Error("Billing customer was not found."),{statusCode:400});
    const subs=await request("/subscription?customer="+encodeURIComponent(id)+"&perPage=50",{},env,fetchImpl);
    return Array.isArray(subs)?subs:[];
  }

  async function handler(req,res,urlInput){
    const url=urlInput instanceof URL?urlInput:new URL(req.url,required(env,"PUBLIC_BASE_URL"));
    if(!url.pathname.startsWith(BASE))return false;

    if(req.method==="OPTIONS"&&url.pathname.startsWith(BASE+"/api/")){
      res.writeHead(204,{...headers("text/plain"),"access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type"});res.end();return true;
    }

    if(req.method==="GET"&&url.pathname===BASE+"/api/health"){
      const codes=await ensurePlans();
      json(res,200,{ok:true,service:"contractor-clipper-billing",provider:"paystack",mode:expectedDomain(env),plans:Object.fromEntries(Object.entries(PLAN_SPECS).map(([k,s])=>[k,{...s,code:codes[k]}]))});return true;
    }

    if(req.method==="GET"&&url.pathname===BASE+"/pricing"){
      page(res,200,"Contractor Clipper Pricing",'<h1>Contractor Clipper plans</h1><p>Professional sourcing and estimating without an expensive all-in-one platform.</p><div class="plans"><section class="plan"><h2>Free</h2><div class="price">₦0</div><p>2 active projects<br>20 clips/month<br>25 library products<br>Basic estimates & PDF</p></section><section class="plan"><h2>Pro</h2><div class="price">₦4,000/mo</div><p class="save">₦40,000/year · 2 months free</p><p>Unlimited clips/projects<br>Multi-image products<br>Product & labour libraries<br>Supplier defaults<br>Branding, templates & advanced exports</p><p><a href="'+BASE+'/billing/checkout?plan=pro&cadence=monthly">Monthly</a> · <a href="'+BASE+'/billing/checkout?plan=pro&cadence=annual">Annual</a></p></section><section class="plan"><h2>Business</h2><div class="price">₦8,500/mo</div><p class="save">₦85,000/year · 2 months free</p><p>Everything in Pro<br>Unlimited assemblies<br>Procurement tracking<br>Client acceptance receipts<br>Advanced business workflows</p><p><a href="'+BASE+'/billing/checkout?plan=business&cadence=monthly">Monthly</a> · <a href="'+BASE+'/billing/checkout?plan=business&cadence=annual">Annual</a></p></section></div>');return true;
    }

    if(req.method==="GET"&&url.pathname===BASE+"/billing/checkout"){
      const chosen=normalizeCheckout(url.searchParams.get("plan"),url.searchParams.get("cadence"));
      if(!chosen){page(res,400,"Invalid plan","<h1>Invalid plan</h1>");return true;}
      const spec=PLAN_SPECS[chosen.key];
      const display=spec.cadence==="annual"?"₦"+(spec.amount/100).toLocaleString()+"/year":"₦"+(spec.amount/100).toLocaleString()+"/month";
      page(res,200,"Contractor Clipper checkout",'<h1>Subscribe to Contractor Clipper '+htmlEscape(spec.plan==="business"?"Business":"Pro")+'</h1><p><strong>'+htmlEscape(display)+'</strong> · recurring '+htmlEscape(spec.cadence)+' billing via Paystack.</p><form method="post" action="'+BASE+'/billing/start"><input type="hidden" name="plan" value="'+chosen.plan+'"><input type="hidden" name="cadence" value="'+chosen.cadence+'"><label for="email">Billing email</label><input id="email" name="email" type="email" maxlength="254" autocomplete="email" required><button type="submit">Continue to Paystack</button></form><p class="note">Project, supplier and client quote data are not sent to Paystack. Card details are entered on Paystack.</p>');return true;
    }

    if(req.method==="POST"&&url.pathname===BASE+"/billing/start"){
      if(String(req.headers["content-type"]||"").split(";")[0].trim().toLowerCase()!=="application/x-www-form-urlencoded")throw Object.assign(new Error("Unsupported checkout request."),{statusCode:415});
      const form=await readForm(req);const chosen=normalizeCheckout(form.plan,form.cadence);if(!chosen)throw Object.assign(new Error("Choose a valid Contractor Clipper plan."),{statusCode:400});
      const email=validateEmail(form.email);const codes=await ensurePlans();const base=required(env,"PUBLIC_BASE_URL").replace(/\/$/,"");
      const checkout=await request("/transaction/initialize",{method:"POST",body:{email,plan:codes[chosen.key],callback_url:base+BASE+"/billing/success",metadata:{product:"contractor-clipper",plan:chosen.plan,cadence:chosen.cadence}}},env,fetchImpl);
      const checkoutUrl=String(checkout?.authorization_url||"");if(!/^https:\/\/checkout\.paystack\.com\//.test(checkoutUrl))throw new Error("Paystack did not return a valid checkout URL.");
      res.writeHead(302,{location:checkoutUrl,...headers("text/plain; charset=utf-8")});res.end("Redirecting to Paystack.");return true;
    }

    if(req.method==="GET"&&url.pathname===BASE+"/billing/success"){
      const reference=String(url.searchParams.get("reference")||"");
      if(!/^[A-Za-z0-9.=_-]{3,100}$/.test(reference))throw Object.assign(new Error("Invalid payment reference."),{statusCode:400});
      const transaction=await request("/transaction/verify/"+encodeURIComponent(reference),{},env,fetchImpl);
      const metadata=parseMetadata(transaction?.metadata);const chosen=normalizeCheckout(metadata.plan,metadata.cadence);
      if(metadata.product!=="contractor-clipper"||!chosen){page(res,400,"Payment unavailable","<h1>Payment unavailable</h1><p>This transaction is not a Contractor Clipper subscription.</p>");return true;}
      const spec=PLAN_SPECS[chosen.key];const codes=await ensurePlans();
      if(String(transaction?.status||"").toLowerCase()!=="success"||String(transaction?.reference||"")!==reference||String(transaction?.domain||"").toLowerCase()!==expectedDomain(env)||String(transaction?.currency||"").toUpperCase()!=="NGN"||Number(transaction?.amount)!==spec.amount||(transactionPlanCode(transaction)&&transactionPlanCode(transaction)!==codes[chosen.key])){
        page(res,400,"Payment unavailable","<h1>Payment could not be verified</h1><p>The payment details did not match the selected Contractor Clipper plan.</p>");return true;
      }
      const customerCode=String(transaction?.customer?.customer_code||"");
      const license=signLicense({customerCode},required(env,"BILLING_SIGNING_SECRET"));
      page(res,200,"Activate Contractor Clipper",'<h1>Payment complete</h1><p>Your '+htmlEscape(chosen.plan)+' subscription was confirmed. Copy this license into Contractor Clipper → Pro tools → Plan & billing.</p><textarea style="width:100%;min-height:130px">'+htmlEscape(license)+'</textarea><p class="note">Keep the license private. It identifies your subscription but contains no card details.</p>');return true;
    }

    if(req.method==="POST"&&url.pathname===BASE+"/api/entitlement"){
      const body=await readJson(req);let parsed;try{parsed=verifyLicense(body.license,required(env,"BILLING_SIGNING_SECRET"));}catch{throw Object.assign(new Error("Invalid Contractor Clipper license."),{statusCode:400});}
      const codes=await ensurePlans();json(res,200,entitlementFromSubscriptions(await subscriptionsForCustomer(parsed.customerCode),codes));return true;
    }

    if(req.method==="POST"&&url.pathname===BASE+"/api/portal"){
      const body=await readJson(req);let parsed;try{parsed=verifyLicense(body.license,required(env,"BILLING_SIGNING_SECRET"));}catch{throw Object.assign(new Error("Invalid Contractor Clipper license."),{statusCode:400});}
      const codes=await ensurePlans();const subs=await subscriptionsForCustomer(parsed.customerCode);
      const active=subs.find(s=>["active","non-renewing"].includes(String(s?.status||"").toLowerCase())&&Object.values(codes).includes(String(typeof s.plan==="string"?s.plan:s.plan?.plan_code||"")));
      if(!active)throw Object.assign(new Error("No active paid Contractor Clipper subscription was found."),{statusCode:400});
      const code=String(active.subscription_code||"");if(!/^SUB_[A-Za-z0-9]+$/.test(code))throw Object.assign(new Error("Subscription management is unavailable."),{statusCode:400});
      const management=await request("/subscription/"+encodeURIComponent(code)+"/manage/link",{},env,fetchImpl);
      const link=String(management?.link||"");if(!/^https:\/\/paystack\.com\//.test(link))throw new Error("Paystack did not return a valid subscription-management URL.");
      json(res,200,{url:link});return true;
    }

    page(res,404,"Not found","<h1>Not found</h1>");return true;
  }

  return {handler,ensurePlans};
}

module.exports={BASE,createContractorBilling};
