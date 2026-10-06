(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.ContractorClipperPlans=Object.assign(root.ContractorClipperPlans||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const PLAN_LIMITS=Object.freeze({
    free:Object.freeze({
      activeProjects:2,monthlyClips:20,savedSuppliers:3,libraryItems:25,laborRates:2,
      assemblies:0,quoteTemplates:1,multiImage:false,branding:false,supplierDefaults:false,
      supplierDiscounts:false,procurement:false,acceptance:false,advancedExports:false
    }),
    pro:Object.freeze({
      activeProjects:Infinity,monthlyClips:Infinity,savedSuppliers:Infinity,libraryItems:Infinity,laborRates:Infinity,
      assemblies:25,quoteTemplates:Infinity,multiImage:true,branding:true,supplierDefaults:true,
      supplierDiscounts:true,procurement:false,acceptance:false,advancedExports:true
    }),
    business:Object.freeze({
      activeProjects:Infinity,monthlyClips:Infinity,savedSuppliers:Infinity,libraryItems:Infinity,laborRates:Infinity,
      assemblies:Infinity,quoteTemplates:Infinity,multiImage:true,branding:true,supplierDefaults:true,
      supplierDiscounts:true,procurement:true,acceptance:true,advancedExports:true
    })
  });

  const PRICING=Object.freeze({
    pro:Object.freeze({monthly:4000,annual:40000}),
    business:Object.freeze({monthly:8500,annual:85000})
  });

  function validPlan(value){
    const plan=String(value||"").toLowerCase();
    return Object.prototype.hasOwnProperty.call(PLAN_LIMITS,plan)?plan:"free";
  }

  function normalizeEntitlement(raw,now){
    const source=raw&&typeof raw==="object"?raw:{};
    const current=Number.isFinite(now)?now:Date.now();
    const requested=validPlan(source.plan);
    const status=String(source.status||(requested==="free"?"free":"")).toLowerCase();
    const expiresAt=source.expiresAt==null?null:Number(source.expiresAt);
    const active=requested!=="free"&&["active","non-renewing","trialing"].includes(status)&&
      (expiresAt==null||(Number.isFinite(expiresAt)&&expiresAt>current));
    if(!active) return {plan:"free",status:"free",expiresAt:null,checkedAt:Number(source.checkedAt)||0};
    return {plan:requested,status,expiresAt:Number.isFinite(expiresAt)?expiresAt:null,checkedAt:Number(source.checkedAt)||0};
  }

  function limitsFor(plan){ return PLAN_LIMITS[validPlan(plan)]; }
  function canUse(plan,feature){ const value=limitsFor(plan)[feature]; return value===true||value===Infinity; }
  function limitFor(plan,key){ return limitsFor(plan)[key]; }

  function monthKey(now){
    const d=new Date(Number.isFinite(now)?now:Date.now());
    return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");
  }

  function normalizeUsage(raw,now){
    const month=monthKey(now);
    const source=raw&&typeof raw==="object"?raw:{};
    if(source.month!==month) return {month,clips:0};
    return {month,clips:Math.max(0,Math.floor(Number(source.clips)||0))};
  }

  function allowance(plan,key,used){
    const limit=limitFor(plan,key);
    const count=Math.max(0,Math.floor(Number(used)||0));
    return {
      allowed:!Number.isFinite(limit)||count<limit,
      limit:Number.isFinite(limit)?limit:null,
      used:count,
      remaining:Number.isFinite(limit)?Math.max(0,limit-count):null
    };
  }

  function canClip(entitlement,usage,now){
    const ent=normalizeEntitlement(entitlement,now);
    const current=normalizeUsage(usage,now);
    return {...allowance(ent.plan,"monthlyClips",current.clips),plan:ent.plan,month:current.month};
  }

  function recordClip(usage,now){
    const current=normalizeUsage(usage,now);
    return {month:current.month,clips:current.clips+1};
  }

  function planLabel(plan){
    const p=validPlan(plan);
    return p==="business"?"Business":p==="pro"?"Pro":"Free";
  }

  return {PLAN_LIMITS,PRICING,validPlan,normalizeEntitlement,limitsFor,canUse,limitFor,monthKey,normalizeUsage,allowance,canClip,recordClip,planLabel};
});
