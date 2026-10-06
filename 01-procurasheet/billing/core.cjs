const crypto=require("node:crypto");

function b64url(value){
  return Buffer.from(value).toString("base64url");
}

function unb64url(value){
  return Buffer.from(String(value||""),"base64url").toString("utf8");
}

function requireSecret(secret){
  if(typeof secret!=="string"||secret.length<8) throw new Error("Billing signing secret is not configured.");
  return secret;
}

function signLicense(data,secret){
  requireSecret(secret);
  const customerCode=String(data&&data.customerCode||"").trim();
  if(!/^CUS_[A-Za-z0-9]+$/.test(customerCode)) throw new Error("Invalid Paystack customer code.");
  const payload=b64url(JSON.stringify({v:2,customerCode}));
  const signature=crypto.createHmac("sha256",secret).update("ps1."+payload).digest("base64url");
  return "ps1."+payload+"."+signature;
}

function verifyLicense(token,secret){
  requireSecret(secret);
  const parts=String(token||"").trim().split(".");
  if(parts.length!==3||parts[0]!=="ps1") throw new Error("Invalid license format.");
  const expected=crypto.createHmac("sha256",secret).update("ps1."+parts[1]).digest();
  let actual;
  try{actual=Buffer.from(parts[2],"base64url");}catch{throw new Error("Invalid license signature.");}
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected)) throw new Error("Invalid license signature.");
  let payload;
  try{payload=JSON.parse(unb64url(parts[1]));}catch{throw new Error("Invalid license payload.");}
  if(payload.v!==2||!/^CUS_[A-Za-z0-9]+$/.test(String(payload.customerCode||""))) throw new Error("Invalid license payload.");
  return {customerCode:String(payload.customerCode)};
}

function planCode(subscription){
  const plan=subscription&&subscription.plan;
  if(typeof plan==="string") return plan;
  return String(plan&&plan.plan_code||"");
}

function planFromSubscription(subscription,env){
  const code=planCode(subscription);
  if(env&&env.PAYSTACK_PLAN_BUSINESS&&code===String(env.PAYSTACK_PLAN_BUSINESS)) return "business";
  if(env&&env.PAYSTACK_PLAN_PRO&&code===String(env.PAYSTACK_PLAN_PRO)) return "pro";
  return "free";
}

function entitlementFromSubscription(subscription,env,now=Date.now()){
  const status=String(subscription&&subscription.status||"").toLowerCase();
  const plan=planFromSubscription(subscription,env||{});
  const paid=plan!=="free"&&["active","non-renewing"].includes(status);
  if(!paid) return {plan:"free",status:"free",expiresAt:null,checkedAt:now};
  return {plan,status,expiresAt:null,checkedAt:now};
}

function bestSubscription(subscriptions,env){
  const list=Array.isArray(subscriptions)?subscriptions:[];
  const active=list.filter(item=>["active","non-renewing"].includes(String(item&&item.status||"").toLowerCase()));
  const business=active.find(item=>planFromSubscription(item,env)==="business");
  if(business)return business;
  const pro=active.find(item=>planFromSubscription(item,env)==="pro");
  return pro||null;
}

function normalizeCheckoutPlan(value){
  const plan=String(value||"").toLowerCase();
  return plan==="pro"||plan==="business"?plan:null;
}

function validateEmail(value){
  const email=String(value||"").trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid billing email.");
  return email;
}

module.exports={signLicense,verifyLicense,planCode,planFromSubscription,entitlementFromSubscription,bestSubscription,normalizeCheckoutPlan,validateEmail};
