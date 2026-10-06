const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {URL}=require("node:url");
const {signLicense,verifyLicense,entitlementFromSubscription,bestSubscription,normalizeCheckoutPlan,validateEmail}=require("./core.cjs");
const {createContractorBilling}=require("../../07-contractor-clipper/billing/routes.cjs");

const PAYSTACK_API="https://api.paystack.co";
const PAYSTACK_TIMEOUT_MS=12000;
const BODY_LIMIT=16*1024;
const EXPECTED_PAYSTACK_PLANS=Object.freeze({
  pro:{envKey:"PAYSTACK_PLAN_PRO",amount:600000},
  business:{envKey:"PAYSTACK_PLAN_BUSINESS",amount:1300000}
});
const SITE_ROOT=path.resolve(__dirname,"../../site/procurasheet");
const STATIC_ROUTES=Object.freeze({
  "/":["index.html","text/html; charset=utf-8"],
  "/styles.css":["styles.css","text/css; charset=utf-8"],
  "/privacy":["privacy/index.html","text/html; charset=utf-8"],
  "/privacy/":["privacy/index.html","text/html; charset=utf-8"],
  "/support":["support/index.html","text/html; charset=utf-8"],
  "/support/":["support/index.html","text/html; charset=utf-8"],
  "/terms":["terms/index.html","text/html; charset=utf-8"],
  "/terms/":["terms/index.html","text/html; charset=utf-8"]
});

function htmlEscape(value){
  return String(value==null?"":value).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function baseHeaders(contentType){
  return {
    "content-type":contentType,
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    "permissions-policy":"camera=(), microphone=(), geolocation=()"
  };
}

function serveStatic(res,pathname){
  const route=STATIC_ROUTES[pathname];
  if(!route)return false;
  const full=path.join(SITE_ROOT,route[0]);
  try{
    const body=fs.readFileSync(full);
    res.writeHead(200,{...baseHeaders(route[1]),"content-length":body.length});
    res.end(body);
    return true;
  }catch{
    return false;
  }
}

function json(res,status,payload){
  res.writeHead(status,{...baseHeaders("application/json; charset=utf-8"),"access-control-allow-origin":"*"});
  res.end(JSON.stringify(payload));
}

function page(res,status,title,body){
  res.writeHead(status,{
    ...baseHeaders("text/html; charset=utf-8"),
    "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  });
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscape(title)+'</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#17202a;background:#f6f8f7}a{color:#145a3d}main{background:#fff;border:1px solid #dfe5e3;border-radius:16px;padding:24px}label{display:block;font-weight:700;margin:18px 0 6px}input{width:100%;box-sizing:border-box;border:1px solid #cfd8d4;border-radius:10px;padding:11px}button{margin-top:12px;border:0;border-radius:10px;background:#153e2d;color:#fff;padding:11px 15px;font-weight:750;cursor:pointer}textarea{width:100%;box-sizing:border-box;min-height:120px;background:#f5f7f8;border:1px solid #dfe5e3;border-radius:10px;padding:12px}.note{font-size:12px;color:#66736e}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.plan{border:1px solid #dfe5e3;border-radius:12px;padding:16px}@media(max-width:650px){.plans{grid-template-columns:1fr}}</style><main>'+body+'</main></html>');
}

function required(env,key){
  const value=String(env&&env[key]||"").trim();
  if(!value) throw new Error(key+" is not configured.");
  return value;
}

function badRequest(message){
  return Object.assign(new Error(message),{statusCode:400});
}

function verifiedClientLicense(value,env){
  try{return verifyLicense(value,required(env,"BILLING_SIGNING_SECRET"));}
  catch{throw badRequest("Invalid ProcuraSheet license.");}
}

async function readBody(req){
  let size=0;
  const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>BODY_LIMIT) throw Object.assign(new Error("Request body too large."),{statusCode:413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req){
  const raw=await readBody(req);
  if(!raw)return {};
  try{return JSON.parse(raw);}catch{
    throw Object.assign(new Error("Invalid JSON body."),{statusCode:400});
  }
}

async function readForm(req){
  const raw=await readBody(req);
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

function planCodeFor(plan,env){
  if(plan==="business")return required(env,"PAYSTACK_PLAN_BUSINESS");
  if(plan==="pro")return required(env,"PAYSTACK_PLAN_PRO");
  throw Object.assign(new Error("Invalid ProcuraSheet plan."),{statusCode:400});
}

function expectedPaystackDomain(env){
  const secret=required(env,"PAYSTACK_SECRET_KEY");
  if(secret.startsWith("sk_live_"))return "live";
  if(secret.startsWith("sk_test_"))return "test";
  throw new Error("PAYSTACK_SECRET_KEY has an invalid format.");
}

function expectedPlan(plan){
  const config=EXPECTED_PAYSTACK_PLANS[plan];
  if(!config) throw Object.assign(new Error("Invalid ProcuraSheet plan."),{statusCode:400});
  return config;
}

function parseMetadata(value){
  if(value&&typeof value==="object"&&!Array.isArray(value))return value;
  if(typeof value!=="string"||!value.trim())return {};
  try{
    const parsed=JSON.parse(value);
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};
  }catch{return {};}
}

function transactionPlanCode(transaction){
  for(const value of [transaction&&transaction.plan,transaction&&transaction.plan_object]){
    if(typeof value==="string"&&/^PLN_[A-Za-z0-9]+$/.test(value))return value;
    if(value&&typeof value==="object"){
      const code=String(value.plan_code||"");
      if(/^PLN_[A-Za-z0-9]+$/.test(code))return code;
    }
  }
  return "";
}

function validateSuccessfulTransaction(transaction,purchasedPlan,reference,env){
  if(String(transaction&&transaction.status||"").toLowerCase()!=="success") throw Object.assign(new Error("Payment is not complete."),{statusCode:400});
  if(String(transaction&&transaction.reference||"")!==String(reference||"")) throw Object.assign(new Error("Payment reference did not match."),{statusCode:400});
  const expected=expectedPlan(purchasedPlan);
  if(String(transaction&&transaction.domain||"").toLowerCase()!==expectedPaystackDomain(env)) throw Object.assign(new Error("Payment environment did not match."),{statusCode:400});
  if(String(transaction&&transaction.currency||"").toUpperCase()!=="NGN") throw Object.assign(new Error("Payment currency did not match."),{statusCode:400});
  if(Number(transaction&&transaction.amount)!==expected.amount) throw Object.assign(new Error("Payment amount did not match the selected plan."),{statusCode:400});
  const actualPlanCode=transactionPlanCode(transaction);
  if(actualPlanCode&&actualPlanCode!==planCodeFor(purchasedPlan,env)) throw Object.assign(new Error("Payment plan did not match the selected plan."),{statusCode:400});
}

async function paystackRequest(endpoint,{method="GET",body}={},env,fetchImpl){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),PAYSTACK_TIMEOUT_MS);
  const options={
    method,
    signal:controller.signal,
    headers:{
      authorization:"Bearer "+required(env,"PAYSTACK_SECRET_KEY"),
      accept:"application/json"
    }
  };
  if(body!==undefined){
    options.headers["content-type"]="application/json";
    options.body=JSON.stringify(body);
  }
  try{
    const response=await fetchImpl(PAYSTACK_API+endpoint,options);
    let payload={};
    try{payload=await response.json();}catch{}
    if(!response.ok||payload.status===false){
      const error=new Error(String(payload.message||"Paystack request failed."));
      error.statusCode=response.status>=400&&response.status<500?400:502;
      throw error;
    }
    return payload.data;
  }catch(error){
    if(error&&error.name==="AbortError"){
      const timeout=new Error("Paystack request timed out.");
      timeout.statusCode=502;
      throw timeout;
    }
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

async function verifyPaystackConfiguration(env,fetchImpl){
  const expectedDomain=expectedPaystackDomain(env);
  const domains=new Set();
  const plans={};
  for(const [name,expected] of Object.entries(EXPECTED_PAYSTACK_PLANS)){
    const code=required(env,expected.envKey);
    const plan=await paystackRequest("/plan/"+encodeURIComponent(code),{},env,fetchImpl);
    if(String(plan&&plan.plan_code||"")!==code) throw new Error("Paystack "+name+" plan code did not match.");
    if(String(plan&&plan.currency||"").toUpperCase()!=="NGN") throw new Error("Paystack "+name+" plan must use NGN.");
    if(String(plan&&plan.interval||"").toLowerCase()!=="monthly") throw new Error("Paystack "+name+" plan must bill monthly.");
    if(Number(plan&&plan.amount)!==expected.amount) throw new Error("Paystack "+name+" plan amount does not match ProcuraSheet pricing.");
    const domain=String(plan&&plan.domain||"").toLowerCase();
    if(domain) domains.add(domain);
    if(domain&&domain!==expectedDomain) throw new Error("Paystack "+name+" plan is not in "+expectedDomain+" mode.");
    plans[name]={code,currency:"NGN",interval:"monthly",amount:expected.amount,domain:domain||null};
  }
  if(domains.size>1) throw new Error("Paystack plans are not in the same environment.");
  return {domain:[...domains][0]||expectedDomain,plans};
}

async function initializeCheckout(plan,email,env,fetchImpl){
  const base=required(env,"PUBLIC_BASE_URL").replace(/\/$/,"");
  let billingEmail;
  try{billingEmail=validateEmail(email);}
  catch(error){throw badRequest(error.message||"Enter a valid billing email.");}
  return paystackRequest("/transaction/initialize",{
    method:"POST",
    body:{
      email:billingEmail,
      plan:planCodeFor(plan,env),
      callback_url:base+"/billing/success",
      metadata:{product:"procurasheet",plan}
    }
  },env,fetchImpl);
}

async function verifyTransaction(reference,env,fetchImpl){
  if(!/^[A-Za-z0-9.=_-]{3,100}$/.test(String(reference||""))) throw Object.assign(new Error("Invalid payment reference."),{statusCode:400});
  return paystackRequest("/transaction/verify/"+encodeURIComponent(reference),{},env,fetchImpl);
}

async function subscriptionsForCustomer(customerCode,env,fetchImpl){
  if(!/^CUS_[A-Za-z0-9]+$/.test(String(customerCode||""))) throw Object.assign(new Error("Invalid billing customer."),{statusCode:400});
  const customer=await paystackRequest("/customer/"+encodeURIComponent(customerCode),{},env,fetchImpl);
  const id=Number(customer&&customer.id);
  if(!Number.isSafeInteger(id)||id<=0) throw Object.assign(new Error("Billing customer was not found."),{statusCode:400});
  const subscriptions=await paystackRequest("/subscription?customer="+encodeURIComponent(id)+"&perPage=50",{},env,fetchImpl);
  return Array.isArray(subscriptions)?subscriptions:[];
}

async function currentSubscription(customerCode,env,fetchImpl){
  return bestSubscription(await subscriptionsForCustomer(customerCode,env,fetchImpl),env);
}

function checkoutForm(plan){
  const label=plan==="business"?"Business":"Pro";
  const usd=plan==="business"?"≈$9.80":"≈$4.50";
  const ngn=plan==="business"?"₦13,000":"₦6,000";
  return '<h1>Subscribe to ProcuraSheet '+label+'</h1><p><strong>'+usd+'/month</strong> <span class="note">(approximate USD equivalent)</span></p><p><strong>Billed as '+ngn+'/month in NGN by Paystack</strong> · recurring monthly until canceled.</p><p>Enter the email you want associated with your subscription. You will continue to Paystack for secure checkout.</p><form method="post" action="/billing/start"><input type="hidden" name="plan" value="'+htmlEscape(plan)+'"><label for="email">Billing email</label><input id="email" name="email" type="email" maxlength="254" autocomplete="email" required><button type="submit">Continue to Paystack</button></form><p class="note">Supplier spreadsheets and purchase-order rows are not sent to Paystack. Payment details are entered on Paystack.</p>';
}

function pricingBody(){
  return '<h1>ProcuraSheet plans</h1><p>Supplier files stay on your device. Paystack is used only for recurring billing and subscription verification.</p><div class="plans"><section class="plan"><h2>Free</h2><strong>$0</strong><p>5 exports/month<br>2 saved suppliers</p></section><section class="plan"><h2>Pro</h2><strong>≈$4.50/month</strong><p class="note">Billed as ₦6,000/month in NGN.</p><p>Unlimited exports<br>Unlimited supplier templates</p><p><a href="/billing/checkout?plan=pro">Choose Pro</a></p></section><section class="plan"><h2>Business</h2><strong>≈$9.80/month</strong><p class="note">Billed as ₦13,000/month in NGN.</p><p>Everything in Pro<br>Catalog matching<br>Reusable supplier-SKU dictionary</p><p><a href="/billing/checkout?plan=business">Choose Business</a></p></section></div><p><a href="/privacy">Privacy</a> · <a href="/support">Support</a> · <a href="/terms/">Subscription terms</a></p>';
}

function createServer({env=process.env,fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=="function") throw new Error("A fetch implementation is required.");
  const contractorBilling=createContractorBilling({env,fetchImpl});
  return http.createServer(async(req,res)=>{
    try{
      const origin=required(env,"PUBLIC_BASE_URL");
      const url=new URL(req.url,origin);

      if(url.pathname.startsWith("/contractor-clipper")){
        const handled=await contractorBilling.handler(req,res,url);
        if(handled)return;
      }

      if(req.method==="OPTIONS"&&url.pathname.startsWith("/api/")){
        res.writeHead(204,{...baseHeaders("text/plain"),"access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type"});
        return res.end();
      }

      if(req.method==="GET"&&url.pathname==="/api/health") return json(res,200,{ok:true,service:"procurasheet-billing",provider:"paystack"});
      if(req.method==="GET"&&serveStatic(res,url.pathname)) return;
      if(req.method==="GET"&&url.pathname==="/pricing") return page(res,200,"ProcuraSheet Pricing",pricingBody());

      if(req.method==="GET"&&url.pathname==="/billing/checkout"){
        const plan=normalizeCheckoutPlan(url.searchParams.get("plan"));
        if(!plan)return page(res,400,"Invalid plan","<h1>Invalid plan</h1><p>Choose Pro or Business.</p>");
        return page(res,200,"ProcuraSheet "+plan+" checkout",checkoutForm(plan));
      }

      if(req.method==="POST"&&url.pathname==="/billing/start"){
        const type=String(req.headers["content-type"]||"").split(";")[0].trim().toLowerCase();
        if(type!=="application/x-www-form-urlencoded") throw Object.assign(new Error("Unsupported checkout request."),{statusCode:415});
        const form=await readForm(req);
        const plan=normalizeCheckoutPlan(form.plan);
        if(!plan) throw Object.assign(new Error("Choose a valid ProcuraSheet plan."),{statusCode:400});
        const checkout=await initializeCheckout(plan,form.email,env,fetchImpl);
        const checkoutUrl=String(checkout&&checkout.authorization_url||"");
        if(!/^https:\/\/checkout\.paystack\.com\//.test(checkoutUrl)) throw new Error("Paystack did not return a valid checkout URL.");
        res.writeHead(302,{location:checkoutUrl,...baseHeaders("text/plain; charset=utf-8")});
        return res.end("Redirecting to Paystack.");
      }

      if(req.method==="GET"&&url.pathname==="/billing/success"){
        const reference=String(url.searchParams.get("reference")||"");
        const transaction=await verifyTransaction(reference,env,fetchImpl);
        const metadata=parseMetadata(transaction&&transaction.metadata);
        const purchasedPlan=normalizeCheckoutPlan(metadata.plan);
        if(metadata.product!=="procurasheet"||!purchasedPlan) return page(res,400,"Payment unavailable","<h1>Payment unavailable</h1><p>This transaction is not a ProcuraSheet subscription checkout.</p>");
        try{validateSuccessfulTransaction(transaction,purchasedPlan,reference,env);}
        catch(error){return page(res,400,"Payment unavailable","<h1>Payment unavailable</h1><p>"+htmlEscape(error.message)+"</p>");}
        const customerCode=String(transaction&&transaction.customer&&transaction.customer.customer_code||"");
        const license=signLicense({customerCode},required(env,"BILLING_SIGNING_SECRET"));
        return page(res,200,"Activate ProcuraSheet",'<h1>Payment complete</h1><p>Your '+htmlEscape(purchasedPlan)+' subscription payment was confirmed by Paystack. Copy this license into ProcuraSheet → Plan & billing → Activate license.</p><textarea readonly>'+htmlEscape(license)+'</textarea><p class="note">If activation is attempted immediately and Paystack is still creating the subscription, retry after a short moment. Keep this license private.</p>');
      }

      if(req.method==="POST"&&url.pathname==="/api/billing/entitlement"){
        const body=await readJson(req);
        const parsed=verifiedClientLicense(body.license,env);
        const subscription=await currentSubscription(parsed.customerCode,env,fetchImpl);
        return json(res,200,entitlementFromSubscription(subscription,env));
      }

      if(req.method==="POST"&&url.pathname==="/api/billing/portal"){
        const body=await readJson(req);
        const parsed=verifiedClientLicense(body.license,env);
        const subscription=await currentSubscription(parsed.customerCode,env,fetchImpl);
        if(!subscription) throw Object.assign(new Error("No active paid subscription was found."),{statusCode:400});
        const code=String(subscription.subscription_code||"");
        if(!/^SUB_[A-Za-z0-9]+$/.test(code)) throw Object.assign(new Error("Subscription management is unavailable."),{statusCode:400});
        const management=await paystackRequest("/subscription/"+encodeURIComponent(code)+"/manage/link",{},env,fetchImpl);
        const link=String(management&&management.link||"");
        if(!/^https:\/\/paystack\.com\//.test(link)) throw new Error("Paystack did not return a valid subscription-management URL.");
        return json(res,200,{url:link});
      }

      return page(res,404,"Not found","<h1>Not found</h1>");
    }catch(error){
      const status=Number(error&&error.statusCode)||500;
      if(req.url&&(req.url.startsWith("/api/")||req.url.startsWith("/contractor-clipper/api/"))) return json(res,status,{error:status>=500?"Billing service error.":String(error.message||"Request failed.")});
      return page(res,status,"Billing error","<h1>Billing error</h1><p>"+htmlEscape(status>=500?"The billing service could not complete this request.":error.message)+"</p>");
    }
  });
}

if(require.main===module){
  (async()=>{
    const verified=await verifyPaystackConfiguration(process.env,globalThis.fetch);
    console.log("Paystack billing configuration verified in "+verified.domain+" mode: ProcuraSheet Pro ₦6,000/month, Business ₦13,000/month.");
    try{
      const contractor=createContractorBilling({env:process.env,fetchImpl:globalThis.fetch});
      const codes=await contractor.ensurePlans();
      console.log("Contractor Clipper Paystack plans ready: "+Object.entries(codes).map(([key,code])=>key+"="+code).join(", "));
    }catch(error){
      console.error("Contractor Clipper plan bootstrap failed without stopping ProcuraSheet billing: "+String(error&&error.message||error));
    }
    const port=Math.max(1,Number(process.env.PORT)||3000);
    createServer().listen(port,"0.0.0.0",()=>console.log("ProcuraSheet billing listening on "+port));
  })().catch(error=>{
    console.error("Paystack billing configuration check failed: "+String(error&&error.message||error));
    process.exitCode=1;
  });
}

module.exports={createServer,verifyPaystackConfiguration,parseMetadata,validateSuccessfulTransaction,expectedPaystackDomain};
