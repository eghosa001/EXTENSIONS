const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const core=require("../billing/core.cjs");
const {createContractorBilling}=require("../billing/routes.cjs");

test("Contractor Clipper license is signed and tamper-evident",()=>{
  const token=core.signLicense({customerCode:"CUS_abc123"},"signing-secret");
  assert.match(token,/^cc1\./);
  assert.deepEqual(core.verifyLicense(token,"signing-secret"),{customerCode:"CUS_abc123"});
  assert.throws(()=>core.verifyLicense(token+"x","signing-secret"));
});

test("monthly and annual Paystack plan specs match launch pricing",()=>{
  assert.deepEqual(Object.fromEntries(Object.entries(core.PLAN_SPECS).map(([k,v])=>[k,[v.amount,v.interval]])),{
    pro_monthly:[400000,"monthly"],business_monthly:[850000,"monthly"],pro_annual:[4000000,"annually"],business_annual:[8500000,"annually"]
  });
});

test("active Business wins over Pro across monthly or annual subscriptions",()=>{
  const codes={pro_monthly:"PLN_pm",business_monthly:"PLN_bm",pro_annual:"PLN_pa",business_annual:"PLN_ba"};
  const entitlement=core.entitlementFromSubscriptions([
    {status:"active",plan:{plan_code:"PLN_pa"}},
    {status:"active",plan:{plan_code:"PLN_bm"}}
  ],codes,100);
  assert.equal(entitlement.plan,"business");
  assert.equal(entitlement.expiresAt,100+core.ENTITLEMENT_LEASE_MS);
});

test("billing service creates missing exact plans and serves checkout",async(t)=>{
  const env={PAYSTACK_SECRET_KEY:"sk_test_example",BILLING_SIGNING_SECRET:"signing-secret",PUBLIC_BASE_URL:"https://billing.example"};
  const created=[];
  const fakeFetch=async(url,options={})=>{
    const u=String(url);
    if(u.includes("/plan?perPage=100")) return {ok:true,json:async()=>({status:true,data:[]})};
    if(u.endsWith("/plan")&&options.method==="POST"){
      const body=JSON.parse(options.body);created.push(body);
      return {ok:true,json:async()=>({status:true,data:{...body,plan_code:"PLN_"+created.length,domain:"test"}})};
    }
    if(u.endsWith("/transaction/initialize")){
      const body=JSON.parse(options.body);
      assert.equal(body.plan,"PLN_1");
      assert.equal(body.metadata.product,"contractor-clipper");
      assert.equal(body.metadata.plan,"pro");
      assert.equal(body.metadata.cadence,"monthly");
      return {ok:true,json:async()=>({status:true,data:{authorization_url:"https://checkout.paystack.com/cc-test"}})};
    }
    throw new Error("Unexpected request "+u);
  };
  const billing=createContractorBilling({env,fetchImpl:fakeFetch});
  const codes=await billing.ensurePlans();
  assert.equal(Object.keys(codes).length,4);
  assert.deepEqual(created.map(p=>p.amount),[400000,850000,4000000,8500000]);

  const server=http.createServer(async(req,res)=>{
    try{await billing.handler(req,res,new URL(req.url,"https://billing.example"));}
    catch(error){res.writeHead(error.statusCode||500,{"content-type":"application/json"});res.end(JSON.stringify({error:error.message}));}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const pricing=await fetch("http://127.0.0.1:"+port+"/contractor-clipper/pricing");
  assert.equal(pricing.status,200);
  assert.match(await pricing.text(),/₦4,000\/mo/);
  const checkout=await fetch("http://127.0.0.1:"+port+"/contractor-clipper/billing/start",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"plan=pro&cadence=monthly&email=buyer%40example.com",redirect:"manual"});
  assert.equal(checkout.status,302);
  assert.equal(checkout.headers.get("location"),"https://checkout.paystack.com/cc-test");
});
