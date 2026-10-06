(function(root,factory){
  const api=factory(root.ProcuraPlans);
  if(typeof module==="object"&&module.exports) module.exports=api;
  root.ProcuraBilling=Object.assign(root.ProcuraBilling||{},api);
})(typeof globalThis!=="undefined"?globalThis:this,function(plans){
  const BILLING_ORIGIN="https://procurasheet.onrender.com";
  const BILLING_PATTERN=BILLING_ORIGIN+"/*";
  const LICENSE_KEY="ps_license_v1";
  const ENTITLEMENT_KEY="ps_entitlement_v1";
  const REFRESH_MS=24*60*60*1000;

  function normalizeLicense(value){
    const token=String(value||"").trim();
    if(!token) throw new Error("Enter your ProcuraSheet license.");
    if(token.length>4096||!/^ps1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error("This license format is invalid.");
    return token;
  }

  async function readState(){
    const stored=await chrome.storage.local.get([LICENSE_KEY,ENTITLEMENT_KEY]);
    const entitlement=plans.normalizeEntitlement(stored[ENTITLEMENT_KEY]||{plan:"free"});
    return {license:String(stored[LICENSE_KEY]||""),entitlement};
  }

  async function permissionGranted(){
    if(!chrome.permissions||!chrome.permissions.contains) return false;
    return chrome.permissions.contains({origins:[BILLING_PATTERN]});
  }

  async function ensurePermission(){
    if(await permissionGranted()) return true;
    if(!chrome.permissions||!chrome.permissions.request) return false;
    return chrome.permissions.request({origins:[BILLING_PATTERN]});
  }

  async function post(path,payload){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(BILLING_ORIGIN+path,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(payload),
        signal:controller.signal,
        credentials:"omit",
        cache:"no-store",
        redirect:"error"
      });
      let data={};
      try{data=await response.json();}catch{}
      if(!response.ok) throw new Error(data.error||"Billing service request failed.");
      return data;
    }catch(error){
      if(error&&error.name==="AbortError") throw new Error("Billing verification timed out. Check your connection and try again.");
      throw error;
    }finally{clearTimeout(timer);}
  }

  async function activateLicense(value){
    const license=normalizeLicense(value);
    if(!(await ensurePermission())) throw new Error("Website access is required only to verify your paid ProcuraSheet license.");
    const response=await post("/api/billing/entitlement",{license});
    const entitlement=plans.normalizeEntitlement(response);
    if(entitlement.plan==="free") throw new Error("This subscription is not currently active.");
    await chrome.storage.local.set({[LICENSE_KEY]:license,[ENTITLEMENT_KEY]:entitlement});
    return entitlement;
  }

  async function currentEntitlement(options){
    const force=Boolean(options&&options.force);
    const state=await readState();
    if(!state.license) return state.entitlement;
    const age=Date.now()-(Number(state.entitlement.checkedAt)||0);
    if(!force&&age<REFRESH_MS) return state.entitlement;
    if(!(await permissionGranted())) return state.entitlement;
    try{
      const response=await post("/api/billing/entitlement",{license:state.license});
      const entitlement=plans.normalizeEntitlement(response);
      await chrome.storage.local.set({[ENTITLEMENT_KEY]:entitlement});
      return entitlement;
    }catch{
      return state.entitlement;
    }
  }

  async function portalUrl(){
    const state=await readState();
    if(!state.license) throw new Error("Activate a paid license first.");
    if(!(await ensurePermission())) throw new Error("Website access is required to open your billing portal.");
    const response=await post("/api/billing/portal",{license:state.license});
    if(!/^https:\/\/[^\s]+$/.test(String(response.url||""))) throw new Error("Billing portal URL was invalid.");
    return response.url;
  }

  async function deactivate(){
    await chrome.storage.local.remove([LICENSE_KEY,ENTITLEMENT_KEY]);
    return plans.normalizeEntitlement({plan:"free"});
  }

  function checkoutUrl(plan){
    const normalized=String(plan||"").toLowerCase();
    if(!["pro","business"].includes(normalized)) throw new Error("Invalid ProcuraSheet plan.");
    return BILLING_ORIGIN+"/billing/checkout?plan="+encodeURIComponent(normalized);
  }

  return {BILLING_ORIGIN,BILLING_PATTERN,LICENSE_KEY,ENTITLEMENT_KEY,normalizeLicense,readState,permissionGranted,ensurePermission,activateLicense,currentEntitlement,portalUrl,deactivate,checkoutUrl};
});
