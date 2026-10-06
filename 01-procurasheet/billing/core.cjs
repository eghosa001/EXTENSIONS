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
  const subscriptionId=String(data&&data.subscriptionId||"").trim();
  if(!/^sub_[A-Za-z0-9_]+$/.test(subscriptionId)) throw new Error("Invalid subscription id.");
  const payload=b64url(JSON.stringify({v:1,subscriptionId}));
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
  if(payload.v!==1||!/^sub_[A-Za-z0-9_]+$/.test(String(payload.subscriptionId||""))) throw new Error("Invalid license payload.");
  return {subscriptionId:String(payload.subscriptionId)};
}

function priceIds(subscription){
  const items=subscription&&subscription.items&&Array.isArray(subscription.items.data)?subscription.items.data:[];
  return items.map(item=>String(item&&item.price&&item.price.id||"")).filter(Boolean);
}

function planFromSubscription(subscription,env){
  const ids=priceIds(subscription);
  if(env&&env.STRIPE_PRICE_BUSINESS&&ids.includes(String(env.STRIPE_PRICE_BUSINESS))) return "business";
  if(env&&env.STRIPE_PRICE_PRO&&ids.includes(String(env.STRIPE_PRICE_PRO))) return "pro";
  return "free";
}

function periodEndMs(subscription){
  const direct=Number(subscription&&subscription.current_period_end);
  if(Number.isFinite(direct)&&direct>0) return direct*1000;
  const items=subscription&&subscription.items&&Array.isArray(subscription.items.data)?subscription.items.data:[];
  const values=items.map(item=>Number(item&&item.current_period_end)).filter(n=>Number.isFinite(n)&&n>0);
  return values.length?Math.max(...values)*1000:null;
}

function entitlementFromSubscription(subscription,env,now=Date.now()){
  const status=String(subscription&&subscription.status||"").toLowerCase();
  const plan=planFromSubscription(subscription,env||{});
  const paid=plan!=="free"&&["active","trialing"].includes(status);
  if(!paid) return {plan:"free",status:"free",expiresAt:null,checkedAt:now};
  return {plan,status,expiresAt:periodEndMs(subscription),checkedAt:now};
}

function normalizeCheckoutPlan(value){
  const plan=String(value||"").toLowerCase();
  return plan==="pro"||plan==="business"?plan:null;
}

module.exports={signLicense,verifyLicense,planFromSubscription,entitlementFromSubscription,normalizeCheckoutPlan};
