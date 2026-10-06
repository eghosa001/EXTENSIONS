const test=require("node:test");
const assert=require("node:assert/strict");

function loadClient({stored={},permission=true,fetchImpl}={}){
  const plansPath=require.resolve("../lib/plans.js");
  const clientPath=require.resolve("../lib/billing-client.js");
  delete require.cache[plansPath];
  delete require.cache[clientPath];
  const plans=require("../lib/plans.js");
  globalThis.ProcuraPlans=plans;

  const state={...stored};
  globalThis.chrome={
    storage:{local:{
      get:async keys=>{
        const out={};
        for(const key of keys) if(Object.prototype.hasOwnProperty.call(state,key)) out[key]=state[key];
        return out;
      },
      set:async values=>Object.assign(state,values),
      remove:async keys=>{for(const key of keys) delete state[key];}
    }},
    permissions:{
      contains:async()=>permission,
      request:async()=>permission
    }
  };
  globalThis.fetch=fetchImpl||(async()=>({ok:true,json:async()=>({plan:"free",status:"free",expiresAt:null,checkedAt:Date.now()})}));
  const client=require("../lib/billing-client.js");
  return {client,state,plans};
}

test.afterEach(()=>{
  delete globalThis.chrome;
  delete globalThis.fetch;
  delete globalThis.ProcuraPlans;
  delete globalThis.ProcuraBilling;
});

test("cached paid entitlement is not trusted without a valid stored license",async()=>{
  const now=Date.now();
  const {client}=loadClient({stored:{
    ps_entitlement_v1:{plan:"business",status:"active",expiresAt:now+3600000,checkedAt:now}
  }});
  const state=await client.readState();
  assert.equal(state.license,"");
  assert.equal(state.entitlement.plan,"free");
  assert.equal((await client.currentEntitlement()).plan,"free");
});

test("malformed stored license cannot keep paid cache alive",async()=>{
  const now=Date.now();
  const {client}=loadClient({stored:{
    ps_license_v1:"not-a-license",
    ps_entitlement_v1:{plan:"pro",status:"active",expiresAt:now+3600000,checkedAt:now}
  }});
  const state=await client.readState();
  assert.equal(state.license,"");
  assert.equal(state.entitlement.plan,"free");
});

test("activation verifies remotely and persists the paid entitlement",async()=>{
  const now=Date.now();
  const license="ps1.payload.signature";
  let request;
  const {client,state}=loadClient({fetchImpl:async(url,options)=>{
    request={url:String(url),body:JSON.parse(options.body)};
    return {ok:true,json:async()=>({plan:"business",status:"active",expiresAt:now+3600000,checkedAt:now})};
  }});
  const entitlement=await client.activateLicense(license);
  assert.equal(entitlement.plan,"business");
  assert.equal(request.url,"https://procurasheet-billing.onrender.com/api/billing/entitlement");
  assert.equal(request.body.license,license);
  assert.equal(state.ps_license_v1,license);
  assert.equal(state.ps_entitlement_v1.plan,"business");
});

test("billing portal accepts only Paystack-hosted management links",async()=>{
  const now=Date.now();
  const license="ps1.payload.signature";
  const baseStored={
    ps_license_v1:license,
    ps_entitlement_v1:{plan:"pro",status:"active",expiresAt:now+3600000,checkedAt:now}
  };

  const bad=loadClient({stored:baseStored,fetchImpl:async()=>({ok:true,json:async()=>({url:"https://evil.example/manage"})})});
  await assert.rejects(()=>bad.client.portalUrl(),/invalid/i);

  const good=loadClient({stored:baseStored,fetchImpl:async()=>({ok:true,json:async()=>({url:"https://paystack.com/manage/subscriptions/example"})})});
  assert.equal(await good.client.portalUrl(),"https://paystack.com/manage/subscriptions/example");
});

test("checkout URL is restricted to known paid plans",()=>{
  const {client}=loadClient();
  assert.equal(client.checkoutUrl("pro"),"https://procurasheet-billing.onrender.com/billing/checkout?plan=pro");
  assert.equal(client.checkoutUrl("business"),"https://procurasheet-billing.onrender.com/billing/checkout?plan=business");
  assert.throws(()=>client.checkoutUrl("enterprise"),/invalid/i);
});
