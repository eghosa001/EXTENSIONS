const crypto=require("node:crypto");
const ENTITLEMENT_LEASE_MS=72*60*60*1000;

const PLAN_SPECS=Object.freeze({
  pro_monthly:Object.freeze({plan:"pro",cadence:"monthly",name:"Contractor Clipper Pro Monthly",amount:400000,interval:"monthly",currency:"NGN"}),
  business_monthly:Object.freeze({plan:"business",cadence:"monthly",name:"Contractor Clipper Business Monthly",amount:850000,interval:"monthly",currency:"NGN"}),
  pro_annual:Object.freeze({plan:"pro",cadence:"annual",name:"Contractor Clipper Pro Annual",amount:4000000,interval:"annually",currency:"NGN"}),
  business_annual:Object.freeze({plan:"business",cadence:"annual",name:"Contractor Clipper Business Annual",amount:8500000,interval:"annually",currency:"NGN"})
});

function requireSecret(secret){
  if(typeof secret!=="string"||secret.length<8) throw new Error("Billing signing secret is not configured.");
  return secret;
}
function b64url(value){return Buffer.from(value).toString("base64url");}
function unb64url(value){return Buffer.from(String(value||""),"base64url").toString("utf8");}

function signLicense(data,secret){
  requireSecret(secret);
  const customerCode=String(data?.customerCode||"").trim();
  if(!/^CUS_[A-Za-z0-9]+$/.test(customerCode)) throw new Error("Invalid Paystack customer code.");
  const payload=b64url(JSON.stringify({v:1,customerCode}));
  const sig=crypto.createHmac("sha256",secret).update("cc1."+payload).digest("base64url");
  return "cc1."+payload+"."+sig;
}

function verifyLicense(token,secret){
  requireSecret(secret);
  const parts=String(token||"").trim().split(".");
  if(parts.length!==3||parts[0]!=="cc1") throw new Error("Invalid license format.");
  const expected=crypto.createHmac("sha256",secret).update("cc1."+parts[1]).digest();
  let actual; try{actual=Buffer.from(parts[2],"base64url");}catch{throw new Error("Invalid license signature.");}
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected)) throw new Error("Invalid license signature.");
  let payload; try{payload=JSON.parse(unb64url(parts[1]));}catch{throw new Error("Invalid license payload.");}
  if(payload.v!==1||!/^CUS_[A-Za-z0-9]+$/.test(String(payload.customerCode||""))) throw new Error("Invalid license payload.");
  return {customerCode:String(payload.customerCode)};
}

function normalizeCheckout(plan,cadence){
  const p=String(plan||"").toLowerCase();
  const c=String(cadence||"monthly").toLowerCase();
  if(!["pro","business"].includes(p)||!["monthly","annual"].includes(c)) return null;
  return {plan:p,cadence:c,key:p+"_"+c};
}

function validateEmail(value){
  const email=String(value||"").trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid billing email.");
  return email;
}

function planCode(subscription){
  const value=subscription?.plan;
  if(typeof value==="string") return value;
  return String(value?.plan_code||"");
}

function planForCode(code,codes){
  for(const [key,value] of Object.entries(codes||{})){
    if(value===code&&PLAN_SPECS[key]) return PLAN_SPECS[key].plan;
  }
  return "free";
}

function bestSubscription(subscriptions,codes){
  const active=(Array.isArray(subscriptions)?subscriptions:[]).filter(s=>["active","non-renewing"].includes(String(s?.status||"").toLowerCase()));
  const business=active.find(s=>planForCode(planCode(s),codes)==="business");
  const pro=active.find(s=>planForCode(planCode(s),codes)==="pro");
  return business||pro||null;
}

function entitlementFromSubscriptions(subscriptions,codes,now=Date.now()){
  const sub=bestSubscription(subscriptions,codes);
  if(!sub)return {plan:"free",status:"free",expiresAt:null,checkedAt:now};
  const plan=planForCode(planCode(sub),codes);
  const status=String(sub.status||"").toLowerCase();
  return {plan,status,expiresAt:now+ENTITLEMENT_LEASE_MS,checkedAt:now};
}

module.exports={ENTITLEMENT_LEASE_MS,PLAN_SPECS,signLicense,verifyLicense,normalizeCheckout,validateEmail,planCode,planForCode,bestSubscription,entitlementFromSubscriptions};
