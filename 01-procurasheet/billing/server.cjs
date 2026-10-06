const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {URL}=require("node:url");
const {signLicense,verifyLicense,entitlementFromSubscription,normalizeCheckoutPlan}=require("./core.cjs");

const STRIPE_API="https://api.stripe.com";
const BODY_LIMIT=16*1024;
const SITE_ROOT=path.resolve(__dirname,"../../site/procurasheet");
const STATIC_ROUTES=Object.freeze({
  "/":["index.html","text/html; charset=utf-8"],
  "/styles.css":["styles.css","text/css; charset=utf-8"],
  "/privacy":["privacy/index.html","text/html; charset=utf-8"],
  "/privacy/":["privacy/index.html","text/html; charset=utf-8"],
  "/support":["support/index.html","text/html; charset=utf-8"],
  "/support/":["support/index.html","text/html; charset=utf-8"]
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
  res.writeHead(status,{...baseHeaders("text/html; charset=utf-8"),"content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscape(title)+'</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#17202a}a{color:#145a3d}main{border:1px solid #dfe5e3;border-radius:16px;padding:24px}code,textarea{width:100%;box-sizing:border-box;background:#f5f7f8;border:1px solid #dfe5e3;border-radius:10px;padding:12px}textarea{min-height:120px}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.plan{border:1px solid #dfe5e3;border-radius:12px;padding:16px}@media(max-width:650px){.plans{grid-template-columns:1fr}}</style><main>'+body+'</main></html>');
}

function required(env,key){
  const value=String(env&&env[key]||"").trim();
  if(!value) throw new Error(key+" is not configured.");
  return value;
}

async function readJson(req){
  let size=0;const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>BODY_LIMIT) throw Object.assign(new Error("Request body too large."),{statusCode:413});
    chunks.push(chunk);
  }
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{
    throw Object.assign(new Error("Invalid JSON body."),{statusCode:400});
  }
}

async function stripeRequest(path,{method="GET",form}={},env,fetchImpl){
  const key=required(env,"STRIPE_SECRET_KEY");
  const options={method,headers:{authorization:"Bearer "+key}};
  if(form){
    options.headers["content-type"]="application/x-www-form-urlencoded";
    options.body=new URLSearchParams(form).toString();
  }
  const response=await fetchImpl(STRIPE_API+path,options);
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok){
    const message=payload&&payload.error&&payload.error.message?payload.error.message:"Stripe request failed.";
    const error=new Error(message);error.statusCode=502;throw error;
  }
  return payload;
}

async function fetchSubscription(subscriptionId,env,fetchImpl){
  return stripeRequest("/v1/subscriptions/"+encodeURIComponent(subscriptionId),{},env,fetchImpl);
}

function priceFor(plan,env){
  return plan==="business"?required(env,"STRIPE_PRICE_BUSINESS"):required(env,"STRIPE_PRICE_PRO");
}

async function checkout(plan,env,fetchImpl){
  const base=required(env,"PUBLIC_BASE_URL").replace(/\/$/,"");
  return stripeRequest("/v1/checkout/sessions",{
    method:"POST",
    form:{
      mode:"subscription",
      "line_items[0][price]":priceFor(plan,env),
      "line_items[0][quantity]":"1",
      allow_promotion_codes:"true",
      success_url:base+"/billing/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:base+"/pricing?canceled=1"
    }
  },env,fetchImpl);
}

async function checkoutSession(sessionId,env,fetchImpl){
  const data=await stripeRequest("/v1/checkout/sessions/"+encodeURIComponent(sessionId)+"?expand%5B%5D=subscription",{},env,fetchImpl);
  if(data.mode!=="subscription"||data.status!=="complete") throw Object.assign(new Error("Checkout is not complete."),{statusCode:400});
  if(data.subscription&&typeof data.subscription==="object") return data.subscription;
  if(typeof data.subscription==="string") return fetchSubscription(data.subscription,env,fetchImpl);
  throw Object.assign(new Error("Checkout subscription was not found."),{statusCode:400});
}

function pricingBody(){
  return '<h1>ProcuraSheet plans</h1><p>Supplier files stay on your device. Billing only verifies your subscription entitlement.</p><div class="plans"><section class="plan"><h2>Free</h2><strong>$0</strong><p>3 exports/month<br>2 saved suppliers</p></section><section class="plan"><h2>Pro</h2><strong>$9/month</strong><p>Unlimited exports<br>Unlimited supplier templates</p><p><a href="/billing/checkout?plan=pro">Choose Pro</a></p></section><section class="plan"><h2>Business</h2><strong>$19/month</strong><p>Everything in Pro<br>Catalog matching<br>Reusable supplier-SKU dictionary</p><p><a href="/billing/checkout?plan=business">Choose Business</a></p></section></div><p><a href="/privacy">Privacy</a> · <a href="/support">Support</a></p>';
}

function createServer({env=process.env,fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=="function") throw new Error("A fetch implementation is required.");
  return http.createServer(async(req,res)=>{
    try{
      const origin=required(env,"PUBLIC_BASE_URL");
      const url=new URL(req.url,origin);

      if(req.method==="OPTIONS"&&url.pathname.startsWith("/api/")){
        res.writeHead(204,{...baseHeaders("text/plain"),"access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type"});
        return res.end();
      }
      if(req.method==="GET"&&url.pathname==="/api/health") return json(res,200,{ok:true,service:"procurasheet-billing"});
      if(req.method==="GET"&&serveStatic(res,url.pathname)) return;
      if(req.method==="GET"&&url.pathname==="/pricing") return page(res,200,"ProcuraSheet Pricing",pricingBody());

      if(req.method==="GET"&&url.pathname==="/billing/checkout"){
        const plan=normalizeCheckoutPlan(url.searchParams.get("plan"));
        if(!plan) return page(res,400,"Invalid plan","<h1>Invalid plan</h1><p>Choose Pro or Business.</p>");
        const session=await checkout(plan,env,fetchImpl);
        if(!session.url) throw new Error("Stripe did not return a checkout URL.");
        res.writeHead(302,{location:session.url,...baseHeaders("text/plain; charset=utf-8")});
        return res.end("Redirecting to secure checkout.");
      }

      if(req.method==="GET"&&url.pathname==="/billing/success"){
        const sessionId=String(url.searchParams.get("session_id")||"");
        if(!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return page(res,400,"Missing checkout session","<h1>Checkout session missing</h1>");
        const subscription=await checkoutSession(sessionId,env,fetchImpl);
        const entitlement=entitlementFromSubscription(subscription,env);
        if(entitlement.plan==="free") return page(res,400,"Subscription unavailable","<h1>Subscription unavailable</h1><p>Your payment did not produce an active ProcuraSheet plan.</p>");
        const license=signLicense({subscriptionId:subscription.id},required(env,"BILLING_SIGNING_SECRET"));
        return page(res,200,"Activate ProcuraSheet",'<h1>Payment complete</h1><p>Your '+htmlEscape(entitlement.plan)+' plan is active. Copy this license into ProcuraSheet → Plan & billing → Activate license.</p><textarea readonly>'+htmlEscape(license)+'</textarea><p>Keep the license private. It does not contain payment-card information.</p>');
      }

      if(req.method==="POST"&&url.pathname==="/api/billing/entitlement"){
        const body=await readJson(req);
        const parsed=verifyLicense(body.license,required(env,"BILLING_SIGNING_SECRET"));
        const subscription=await fetchSubscription(parsed.subscriptionId,env,fetchImpl);
        return json(res,200,entitlementFromSubscription(subscription,env));
      }

      if(req.method==="POST"&&url.pathname==="/api/billing/portal"){
        const body=await readJson(req);
        const parsed=verifyLicense(body.license,required(env,"BILLING_SIGNING_SECRET"));
        const subscription=await fetchSubscription(parsed.subscriptionId,env,fetchImpl);
        const customer=typeof subscription.customer==="string"?subscription.customer:subscription.customer&&subscription.customer.id;
        if(!customer) throw Object.assign(new Error("Stripe customer was not found."),{statusCode:400});
        const base=required(env,"PUBLIC_BASE_URL").replace(/\/$/,"");
        const portal=await stripeRequest("/v1/billing_portal/sessions",{method:"POST",form:{customer,return_url:base+"/pricing"}},env,fetchImpl);
        return json(res,200,{url:portal.url});
      }

      if(req.method==="GET"&&url.pathname==="/privacy"){
        return page(res,200,"ProcuraSheet Privacy",'<h1>Privacy</h1><p>Supplier spreadsheets, catalog exports, mappings, and purchase-order rows are processed locally in the browser and are not sent to the billing service.</p><p>For paid plans, ProcuraSheet sends only your locally stored license token to this service to verify subscription status with Stripe. Card details are entered directly on Stripe-hosted checkout and are never handled by the extension.</p>');
      }
      if(req.method==="GET"&&url.pathname==="/support"){
        return page(res,200,"ProcuraSheet Support",'<h1>Support</h1><p>For product support, use the project issue tracker linked from the Chrome Web Store listing.</p>');
      }
      return page(res,404,"Not found","<h1>Not found</h1>");
    }catch(error){
      const status=Number(error&&error.statusCode)||500;
      if(req.url&&req.url.startsWith("/api/")) return json(res,status,{error:status>=500?"Billing service error.":String(error.message||"Request failed.")});
      return page(res,status,"Billing error","<h1>Billing error</h1><p>"+htmlEscape(status>=500?"The billing service could not complete this request.":error.message)+"</p>");
    }
  });
}

if(require.main===module){
  const port=Math.max(1,Number(process.env.PORT)||3000);
  createServer().listen(port,"0.0.0.0",()=>console.log("ProcuraSheet billing listening on "+port));
}

module.exports={createServer};
