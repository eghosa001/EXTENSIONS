const test=require("node:test");
const assert=require("node:assert/strict");

test("billing license is signed and tamper-evident",()=>{
  const core=require("../billing/core.cjs");
  const token=core.signLicense({customerCode:"CUS_abc123"},"test-secret");
  assert.deepEqual(core.verifyLicense(token,"test-secret"),{customerCode:"CUS_abc123"});
  const parts=token.split(".");
  const first=parts[2][0]==="A"?"B":"A";
  const tampered=[parts[0],parts[1],first+parts[2].slice(1)].join(".");
  assert.throws(()=>core.verifyLicense(tampered,"test-secret"));
  assert.throws(()=>core.verifyLicense(token+"x","test-secret"));
});

test("active Paystack subscriptions map to the correct paid plan",()=>{
  const core=require("../billing/core.cjs");
  const env={PAYSTACK_PLAN_PRO:"PLN_pro",PAYSTACK_PLAN_BUSINESS:"PLN_business"};
  const pro=core.entitlementFromSubscription({
    status:"active",plan:{plan_code:"PLN_pro"}
  },env,123);
  assert.equal(pro.plan,"pro");
  assert.equal(pro.status,"active");
  assert.equal(pro.expiresAt,123+core.ENTITLEMENT_LEASE_MS);

  const business=core.entitlementFromSubscription({
    status:"non-renewing",plan:{plan_code:"PLN_business"}
  },env,456);
  assert.equal(business.plan,"business");
  assert.equal(business.status,"non-renewing");
  assert.equal(business.expiresAt,456+core.ENTITLEMENT_LEASE_MS);
});

test("inactive or unknown subscriptions never grant paid access",()=>{
  const core=require("../billing/core.cjs");
  const env={PAYSTACK_PLAN_PRO:"PLN_pro",PAYSTACK_PLAN_BUSINESS:"PLN_business"};
  assert.equal(core.entitlementFromSubscription({
    status:"complete",plan:{plan_code:"PLN_pro"}
  },env).plan,"free");
  assert.equal(core.entitlementFromSubscription({
    status:"active",plan:{plan_code:"PLN_unknown"}
  },env).plan,"free");
});

test("best subscription prefers active Business over Pro",()=>{
  const core=require("../billing/core.cjs");
  const env={PAYSTACK_PLAN_PRO:"PLN_pro",PAYSTACK_PLAN_BUSINESS:"PLN_business"};
  const best=core.bestSubscription([
    {status:"active",plan:{plan_code:"PLN_pro"}},
    {status:"active",plan:{plan_code:"PLN_business"}},
    {status:"complete",plan:{plan_code:"PLN_business"}}
  ],env);
  assert.equal(best.plan.plan_code,"PLN_business");
});


test("Paystack configuration preflight validates plan mode, currency, interval and amounts",async()=>{
  const {verifyPaystackConfiguration}=require("../billing/server.cjs");
  const env={
    PAYSTACK_SECRET_KEY:"sk_test_paystack",
    PAYSTACK_PLAN_PRO:"PLN_pro",
    PAYSTACK_PLAN_BUSINESS:"PLN_business"
  };
  const fakeFetch=async(url)=>{
    const u=String(url);
    if(u.endsWith("/plan/PLN_pro")) return {ok:true,json:async()=>({status:true,data:{plan_code:"PLN_pro",currency:"NGN",interval:"monthly",amount:600000,domain:"test"}})};
    if(u.endsWith("/plan/PLN_business")) return {ok:true,json:async()=>({status:true,data:{plan_code:"PLN_business",currency:"NGN",interval:"monthly",amount:1300000,domain:"test"}})};
    throw new Error("Unexpected Paystack request "+u);
  };
  const verified=await verifyPaystackConfiguration(env,fakeFetch);
  assert.equal(verified.domain,"test");
  assert.equal(verified.plans.pro.amount,600000);
  assert.equal(verified.plans.business.amount,1300000);

  const badFetch=async(url)=>{
    const u=String(url);
    if(u.endsWith("/plan/PLN_pro")) return {ok:true,json:async()=>({status:true,data:{plan_code:"PLN_pro",currency:"NGN",interval:"monthly",amount:490000,domain:"test"}})};
    return fakeFetch(url);
  };
  await assert.rejects(()=>verifyPaystackConfiguration(env,badFetch),/amount does not match/i);
});


test("transaction verification accepts object/string metadata and rejects mismatched payment details",()=>{
  const {parseMetadata,validateSuccessfulTransaction,expectedPaystackDomain}=require("../billing/server.cjs");
  const env={
    PAYSTACK_SECRET_KEY:"sk_live_example",
    PAYSTACK_PLAN_PRO:"PLN_pro",
    PAYSTACK_PLAN_BUSINESS:"PLN_business"
  };
  assert.equal(expectedPaystackDomain(env),"live");
  assert.deepEqual(parseMetadata('{"product":"procurasheet","plan":"pro"}'),{product:"procurasheet",plan:"pro"});
  assert.deepEqual(parseMetadata({product:"procurasheet",plan:"business"}),{product:"procurasheet",plan:"business"});
  assert.deepEqual(parseMetadata("not-json"),{});

  const tx={
    domain:"live",status:"success",reference:"ref_ok",amount:600000,currency:"NGN",
    plan:{plan_code:"PLN_pro"}
  };
  assert.doesNotThrow(()=>validateSuccessfulTransaction(tx,"pro","ref_ok",env));
  assert.throws(()=>validateSuccessfulTransaction({...tx,amount:1300000},"pro","ref_ok",env),/amount/i);
  assert.throws(()=>validateSuccessfulTransaction({...tx,currency:"USD"},"pro","ref_ok",env),/currency/i);
  assert.throws(()=>validateSuccessfulTransaction({...tx,domain:"test"},"pro","ref_ok",env),/environment/i);
  assert.throws(()=>validateSuccessfulTransaction({...tx,reference:"other"},"pro","ref_ok",env),/reference/i);
  assert.throws(()=>validateSuccessfulTransaction({...tx,plan:{plan_code:"PLN_business"}},"pro","ref_ok",env),/plan/i);
});

test("billing HTTP service uses Paystack checkout and entitlement verification",async(t)=>{
  const {createServer}=require("../billing/server.cjs");
  const core=require("../billing/core.cjs");
  const env={
    PAYSTACK_SECRET_KEY:"sk_test_paystack",
    PAYSTACK_PLAN_PRO:"PLN_pro",
    PAYSTACK_PLAN_BUSINESS:"PLN_business",
    BILLING_SIGNING_SECRET:"signing-secret",
    PUBLIC_BASE_URL:"https://procurasheet.example"
  };
  const calls=[];
  const fakeFetch=async(url,options={})=>{
    const u=String(url);
    calls.push({u,method:options.method||"GET",body:options.body||""});
    if(u.endsWith("/transaction/initialize")&&options.method==="POST"){
      const body=JSON.parse(options.body);
      assert.equal(body.email,"buyer@example.com");
      assert.ok(["PLN_pro","PLN_business"].includes(body.plan));
      assert.equal(body.amount,body.plan==="PLN_pro"?600000:1300000);
      assert.equal(body.callback_url,"https://procurasheet.example/billing/success");
      assert.equal(body.metadata.product,"procurasheet");
      assert.ok(["pro","business"].includes(body.metadata.plan));
      return {ok:true,json:async()=>({status:true,data:{
        authorization_url:"https://checkout.paystack.com/test",
        access_code:"access",
        reference:"ref_123"
      }})};
    }
    if(u.endsWith("/transaction/verify/ref_123")){
      return {ok:true,json:async()=>({status:true,data:{
        domain:"test",
        status:"success",
        reference:"ref_123",
        amount:600000,
        currency:"NGN",
        customer:{id:17,customer_code:"CUS_abc123",email:"buyer@example.com"},
        plan:{plan_code:"PLN_pro"},
        metadata:{product:"procurasheet",plan:"pro"}
      }})};
    }
    if(u.endsWith("/customer/CUS_abc123")){
      return {ok:true,json:async()=>({status:true,data:{id:17,customer_code:"CUS_abc123"}})};
    }
    if(u.includes("/subscription?customer=17")){
      return {ok:true,json:async()=>({status:true,data:[
        {status:"active",subscription_code:"SUB_pro123",plan:{plan_code:"PLN_pro"}}
      ]})};
    }
    if(u.endsWith("/subscription/SUB_pro123/manage/link")){
      return {ok:true,json:async()=>({status:true,data:{link:"https://paystack.com/manage/subscriptions/test"}})};
    }
    throw new Error("Unexpected Paystack request "+u);
  };
  const server=createServer({env,fetchImpl:fakeFetch});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;

  const home=await fetch("http://127.0.0.1:"+port+"/");
  assert.equal(home.status,200);
  assert.match(await home.text(),/ProcuraSheet/);

  const checkout=await fetch("http://127.0.0.1:"+port+"/billing/checkout?plan=pro");
  assert.equal(checkout.status,200);
  const checkoutHtml=await checkout.text();
  assert.match(checkoutHtml,/email/i);
  assert.match(checkoutHtml,/≈\$4\.50\/month/);
  assert.match(checkoutHtml,/₦6,000\/month/);

  const businessCheckout=await fetch("http://127.0.0.1:"+port+"/billing/checkout?plan=business");
  assert.equal(businessCheckout.status,200);
  const businessCheckoutHtml=await businessCheckout.text();
  assert.match(businessCheckoutHtml,/≈\$9\.80\/month/);
  assert.match(businessCheckoutHtml,/₦13,000\/month/);

  const start=await fetch("http://127.0.0.1:"+port+"/billing/start",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:"plan=pro&email=buyer%40example.com",
    redirect:"manual"
  });
  assert.equal(start.status,303);
  assert.equal(start.headers.get("location"),"https://checkout.paystack.com/test");

  const businessStart=await fetch("http://127.0.0.1:"+port+"/billing/start",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:"plan=business&email=buyer%40example.com",
    redirect:"manual"
  });
  assert.equal(businessStart.status,303);
  assert.equal(businessStart.headers.get("location"),"https://checkout.paystack.com/test");

  const success=await fetch("http://127.0.0.1:"+port+"/billing/success?reference=ref_123");
  assert.equal(success.status,200);
  const successHtml=await success.text();
  assert.match(successHtml,/Payment complete/i);
  const license=(successHtml.match(/ps1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)||[])[0];
  assert.ok(license);
  assert.deepEqual(core.verifyLicense(license,"signing-secret"),{customerCode:"CUS_abc123"});

  const entitlement=await fetch("http://127.0.0.1:"+port+"/api/billing/entitlement",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({license})
  });
  assert.equal(entitlement.status,200);
  assert.equal((await entitlement.json()).plan,"pro");

  const portal=await fetch("http://127.0.0.1:"+port+"/api/billing/portal",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({license})
  });
  assert.equal(portal.status,200);
  assert.equal((await portal.json()).url,"https://paystack.com/manage/subscriptions/test");

  const invalidEmail=await fetch("http://127.0.0.1:"+port+"/billing/start",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:"plan=pro&email=not-an-email",
    redirect:"manual"
  });
  assert.equal(invalidEmail.status,400);
  assert.match(await invalidEmail.text(),/valid billing email/i);

  const invalidLicense=await fetch("http://127.0.0.1:"+port+"/api/billing/entitlement",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({license:"not-a-license"})
  });
  assert.equal(invalidLicense.status,400);
  assert.match((await invalidLicense.json()).error,/invalid ProcuraSheet license/i);

  assert.ok(calls.some(call=>call.u.includes("api.paystack.co")));
});
