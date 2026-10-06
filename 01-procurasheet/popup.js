const plans=globalThis.ProcuraPlans;
document.getElementById("openApp").addEventListener("click",()=>{
  chrome.tabs.create({url:chrome.runtime.getURL("index.html")});
});
chrome.storage.local.get("ps_entitlement_v1").then(result=>{
  const entitlement=plans.normalizeEntitlement(result.ps_entitlement_v1||{plan:"free"});
  const plan=plans.validPlan(entitlement.plan);
  document.getElementById("popupPlan").textContent=plan.charAt(0).toUpperCase()+plan.slice(1);
}).catch(()=>{});
