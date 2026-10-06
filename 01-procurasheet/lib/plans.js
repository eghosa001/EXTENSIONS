(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.ProcuraPlans=Object.assign(root.ProcuraPlans||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const PLAN_LIMITS=Object.freeze({
    free:Object.freeze({monthlyConversions:5,savedSuppliers:2,catalogMatching:false,skuDictionary:false}),
    pro:Object.freeze({monthlyConversions:Infinity,savedSuppliers:Infinity,catalogMatching:false,skuDictionary:false}),
    business:Object.freeze({monthlyConversions:Infinity,savedSuppliers:Infinity,catalogMatching:true,skuDictionary:true})
  });

  function validPlan(value){
    const plan=String(value||"").toLowerCase();
    return Object.prototype.hasOwnProperty.call(PLAN_LIMITS,plan)?plan:"free";
  }

  function monthKey(now){
    const date=new Date(Number.isFinite(now)?now:Date.now());
    return date.getUTCFullYear()+"-"+String(date.getUTCMonth()+1).padStart(2,"0");
  }

  function normalizeUsage(raw,now){
    const month=monthKey(now);
    const source=raw&&typeof raw==="object"?raw:{};
    if(source.month!==month) return {month,conversions:0};
    const conversions=Math.max(0,Math.floor(Number(source.conversions)||0));
    return {month,conversions};
  }

  function normalizeEntitlement(raw,now){
    const source=raw&&typeof raw==="object"?raw:{};
    const current=Number.isFinite(now)?now:Date.now();
    const requested=validPlan(source.plan);
    const status=String(source.status|| (requested==="free"?"free":"")).toLowerCase();
    const expiresAt=source.expiresAt==null?null:Number(source.expiresAt);
    const paid=requested!=="free";
    const active=paid&&["active","trialing","non-renewing"].includes(status)&&
      (expiresAt==null||(Number.isFinite(expiresAt)&&expiresAt>current));
    if(!active){
      return {plan:"free",status:"free",expiresAt:null,checkedAt:Number(source.checkedAt)||0};
    }
    return {
      plan:requested,
      status,
      expiresAt:Number.isFinite(expiresAt)?expiresAt:null,
      checkedAt:Number(source.checkedAt)||0
    };
  }

  function limitsFor(plan){
    return PLAN_LIMITS[validPlan(plan)];
  }

  function canExport(entitlement,usage,now){
    const normalized=normalizeEntitlement(entitlement,now);
    const currentUsage=normalizeUsage(usage,now);
    const limit=limitsFor(normalized.plan).monthlyConversions;
    const allowed=!Number.isFinite(limit)||currentUsage.conversions<limit;
    return {
      allowed,
      plan:normalized.plan,
      used:currentUsage.conversions,
      limit:Number.isFinite(limit)?limit:null,
      remaining:Number.isFinite(limit)?Math.max(0,limit-currentUsage.conversions):null
    };
  }

  function recordConversion(usage,now){
    const current=normalizeUsage(usage,now);
    return {month:current.month,conversions:current.conversions+1};
  }

  function canSaveTemplate(plan,currentCount){
    const normalized=validPlan(plan);
    const count=Math.max(0,Math.floor(Number(currentCount)||0));
    const limit=limitsFor(normalized).savedSuppliers;
    return {
      allowed:!Number.isFinite(limit)||count<limit,
      plan:normalized,
      used:count,
      limit:Number.isFinite(limit)?limit:null,
      remaining:Number.isFinite(limit)?Math.max(0,limit-count):null
    };
  }

  function canUseFeature(plan,feature){
    const limits=limitsFor(plan);
    return Boolean(limits&&limits[feature]===true);
  }

  return {PLAN_LIMITS,validPlan,monthKey,normalizeUsage,normalizeEntitlement,limitsFor,canExport,recordConversion,canSaveTemplate,canUseFeature};
});
