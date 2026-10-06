const test=require("node:test");
const assert=require("node:assert/strict");

test("billing license is signed and tamper-evident",()=>{
  const core=require("../billing/core.cjs");
  const token=core.signLicense({subscriptionId:"sub_123"},"test-secret");
  assert.deepEqual(core.verifyLicense(token,"test-secret"),{subscriptionId:"sub_123"});
  const parts=token.split(".");
  const first=parts[2][0]==="A"?"B":"A";
  const tampered=[parts[0],parts[1],first+parts[2].slice(1)].join(".");
  assert.throws(()=>core.verifyLicense(tampered,"test-secret"));
  assert.throws(()=>core.verifyLicense(token+"x","test-secret"));
});

test("active Stripe subscriptions map to the correct paid plan",()=>{
  const core=require("../billing/core.cjs");
  const env={STRIPE_PRICE_PRO:"price_pro",STRIPE_PRICE_BUSINESS:"price_business"};
  const pro=core.entitlementFromSubscription({
    status:"active",current_period_end:1793923200,
    items:{data:[{price:{id:"price_pro"}}]}
  },env);
  assert.equal(pro.plan,"pro");
  assert.equal(pro.status,"active");
  assert.equal(pro.expiresAt,1793923200000);

  const business=core.entitlementFromSubscription({
    status:"trialing",current_period_end:1793923200,
    items:{data:[{price:{id:"price_business"}}]}
  },env);
  assert.equal(business.plan,"business");
});

test("inactive or unknown subscriptions never grant paid access",()=>{
  const core=require("../billing/core.cjs");
  const env={STRIPE_PRICE_PRO:"price_pro",STRIPE_PRICE_BUSINESS:"price_business"};
  assert.equal(core.entitlementFromSubscription({
    status:"canceled",current_period_end:1793923200,items:{data:[{price:{id:"price_pro"}}]}
  },env).plan,"free");
  assert.equal(core.entitlementFromSubscription({
    status:"active",current_period_end:1793923200,items:{data:[{price:{id:"price_unknown"}}]}
  },env).plan,"free");
});

test("billing HTTP service creates checkout and verifies entitlements",async(t)=>{
  const {createServer}=require("../billing/server.cjs");
  const core=require("../billing/core.cjs");
  const env={
    STRIPE_SECRET_KEY:"sk_test",
    STRIPE_PRICE_PRO:"price_pro",
    STRIPE_PRICE_BUSINESS:"price_business",
    BILLING_SIGNING_SECRET:"signing-secret",
    PUBLIC_BASE_URL:"https://procurasheet.example"
  };
  const fakeFetch=async(url,options={})=>{
    const u=String(url);
    if(u.endsWith("/v1/checkout/sessions")&&options.method==="POST"){
      return {ok:true,json:async()=>({url:"https://checkout.stripe.test/session"})};
    }
    if(u.includes("/v1/subscriptions/sub_123")){
      return {ok:true,json:async()=>({
        id:"sub_123",customer:"cus_123",status:"active",current_period_end:1793923200,
        items:{data:[{price:{id:"price_pro"}}]}
      })};
    }
    if(u.endsWith("/v1/billing_portal/sessions")){
      return {ok:true,json:async()=>({url:"https://billing.stripe.test/portal"})};
    }
    throw new Error("Unexpected Stripe request "+u);
  };
  const server=createServer({env,fetchImpl:fakeFetch});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;

  const home=await fetch("http://127.0.0.1:"+port+"/");
  assert.equal(home.status,200);
  assert.match(await home.text(),/ProcuraSheet/);

  const pricing=await fetch("http://127.0.0.1:"+port+"/pricing");
  assert.equal(pricing.status,200);
  assert.match(await pricing.text(),/Pro/);

  const checkout=await fetch("http://127.0.0.1:"+port+"/billing/checkout?plan=pro",{redirect:"manual"});
  assert.equal(checkout.status,302);
  assert.equal(checkout.headers.get("location"),"https://checkout.stripe.test/session");

  const token=core.signLicense({subscriptionId:"sub_123"},"signing-secret");
  const entitlement=await fetch("http://127.0.0.1:"+port+"/api/billing/entitlement",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({license:token})
  });
  assert.equal(entitlement.status,200);
  assert.equal((await entitlement.json()).plan,"pro");

  const portal=await fetch("http://127.0.0.1:"+port+"/api/billing/portal",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({license:token})
  });
  assert.equal(portal.status,200);
  assert.equal((await portal.json()).url,"https://billing.stripe.test/portal");
});
