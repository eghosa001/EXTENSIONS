const core=globalThis.ContractorClipperCore;
const plansApi=globalThis.ContractorClipperPlans;
const workspace=globalThis.ContractorClipperWorkspace;
const billing=globalThis.ContractorClipperBilling;
const $=(id)=>document.getElementById(id);
let entitlement=plansApi.normalizeEntitlement({plan:"free"});
let projects=[],library=[],laborRates=[],suppliers=[],assemblies=[],templates=[];

function esc(value){return String(value||"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));}
function currentProject(id){return projects.find(p=>p.id===id);}
function setBillingMessage(message,error=false){$("billingMessage").textContent=message;$("billingMessage").style.color=error?"#9b2c25":"";}
function daysBetween(start,end){const a=new Date(start),b=new Date(end);return Math.max(1,Math.round((b-a)/86400000)||30);}
function futureDate(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}

async function loadData(){
  const stored=await chrome.storage.local.get(["cc_projects","cc_library","cc_labor_rates","cc_suppliers","cc_assemblies","cc_quote_templates"]);
  projects=Array.isArray(stored.cc_projects)?stored.cc_projects:[];
  library=(Array.isArray(stored.cc_library)?stored.cc_library:[]).map(workspace.normalizeLibraryItem);
  laborRates=(Array.isArray(stored.cc_labor_rates)?stored.cc_labor_rates:[]).map(workspace.normalizeLaborRate);
  suppliers=(Array.isArray(stored.cc_suppliers)?stored.cc_suppliers:[]).map(workspace.normalizeSupplierRule);
  assemblies=(Array.isArray(stored.cc_assemblies)?stored.cc_assemblies:[]).map(workspace.normalizeAssembly);
  templates=(Array.isArray(stored.cc_quote_templates)?stored.cc_quote_templates:[]).map(workspace.normalizeQuoteTemplate);
  renderProjects();renderLibrary();renderLabor();renderSuppliers();renderAssemblies();renderTemplates();
}
function renderProjects(){
  const options=projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name||"Untitled project")}</option>`).join("");
  for(const id of ["libraryProject","assemblySource","assemblyTarget","templateSource","templateTarget"]) $(id).innerHTML=options;
}
async function refreshPlan(force=false){
  try{entitlement=await billing.currentEntitlement({force});renderPlan();}
  catch(error){setBillingMessage(error.message||"Could not refresh billing.",true);}
}
function renderPlan(){
  const label=plansApi.planLabel(entitlement.plan);
  $("planBadge").textContent=label.toUpperCase();$("planBadge").dataset.plan=entitlement.plan;
  $("planTitle").textContent=label+" plan";
  $("planStatus").textContent=entitlement.plan==="free"
    ?"Free is active. Upgrade only when the paid workflow saves enough time to justify it."
    :`${label} is active on this browser. Subscription status is rechecked securely with Paystack.`;
}
function renderLibrary(){
  const q=String($("librarySearch").value||"").trim().toLowerCase();
  const filtered=library.filter(i=>!q||[i.title,i.sku,i.brand,i.supplier,i.category].some(v=>String(v||"").toLowerCase().includes(q)));
  $("libraryEmpty").hidden=filtered.length>0;
  $("libraryList").innerHTML=filtered.map(item=>`<article class="card">
    <div class="meta">${esc(item.supplier||item.brand||"Product")}</div>
    <h3>${esc(item.title||"Untitled product")}</h3>
    <p>${esc([item.sku&&"SKU "+item.sku,item.material,item.finish,item.dimensions].filter(Boolean).join(" · "))}</p>
    <p><strong>${esc(item.currency)} ${Number(item.cost||0).toFixed(2)}</strong>${item.supplierDiscount?` · ${item.supplierDiscount}% supplier discount`:""}</p>
    <div class="card-actions"><button class="primary" data-library-add="${esc(item.id)}">Add to project</button><button class="danger" data-library-delete="${esc(item.id)}">Delete</button></div>
  </article>`).join("");
}
$("librarySearch").addEventListener("input",renderLibrary);
$("libraryList").addEventListener("click",async(event)=>{
  const add=event.target.closest("[data-library-add]"),del=event.target.closest("[data-library-delete]");
  if(add){
    const item=library.find(i=>i.id===add.dataset.libraryAdd);const project=currentProject($("libraryProject").value);
    if(!item||!project)return;if(!Array.isArray(project.items))project.items=[];
    project.items.push({...item,id:core.makeId("item"),qty:1,clippedAt:Date.now(),orderStatus:"planned",poRef:"",expectedDate:""});
    project.updatedAt=Date.now();await chrome.storage.local.set({cc_projects:projects});alert("Product added to "+(project.name||"project")+".");
  }
  if(del){library=library.filter(i=>i.id!==del.dataset.libraryDelete);await chrome.storage.local.set({cc_library:library});renderLibrary();}
});

function renderLabor(){
  $("laborList").innerHTML=laborRates.map(rate=>`<article class="card"><h3>${esc(rate.name)}</h3><p>${Number(rate.rate).toFixed(2)} per ${esc(rate.unit)}</p><div class="card-actions"><button class="danger" data-labor-delete="${esc(rate.id)}">Delete</button></div></article>`).join("");
}
$("laborForm").addEventListener("submit",async(event)=>{
  event.preventDefault();
  const allowance=plansApi.allowance(entitlement.plan,"laborRates",laborRates.length);
  if(!allowance.allowed)return alert("Free includes 2 saved labour rates. Upgrade to Pro for unlimited rates.");
  const rate=workspace.normalizeLaborRate({name:$("laborName").value,rate:$("laborRate").value,unit:$("laborUnit").value});
  if(!rate.name)return;
  laborRates.unshift(rate);await chrome.storage.local.set({cc_labor_rates:laborRates});event.target.reset();$("laborUnit").value="hour";renderLabor();
});
$("laborList").addEventListener("click",async(event)=>{
  const b=event.target.closest("[data-labor-delete]");if(!b)return;
  laborRates=laborRates.filter(r=>r.id!==b.dataset.laborDelete);await chrome.storage.local.set({cc_labor_rates:laborRates});renderLabor();
});

function renderSuppliers(){
  $("supplierList").innerHTML=suppliers.map(s=>`<article class="card"><div class="meta">${esc(s.host||"Any host")}</div><h3>${esc(s.name)}</h3><p>Markup ${s.defaultMarkup||0}% · Discount ${s.defaultDiscount||0}% · Delivery ${Number(s.defaultDelivery||0).toFixed(2)}</p><p>${esc([s.defaultCategory,s.defaultRoom].filter(Boolean).join(" · "))}</p><div class="card-actions"><button class="secondary" data-supplier-edit="${esc(s.id)}">Edit</button><button class="danger" data-supplier-delete="${esc(s.id)}">Delete</button></div></article>`).join("");
}
$("supplierForm").addEventListener("submit",async(event)=>{
  event.preventDefault();
  const draft=workspace.normalizeSupplierRule({name:$("supplierName").value,host:$("supplierHost").value,defaultMarkup:$("supplierMarkup").value,defaultDiscount:$("supplierDiscount").value,defaultDelivery:$("supplierDelivery").value,defaultCategory:$("supplierCategory").value,defaultRoom:$("supplierRoom").value});
  if(!draft.name)return;
  const existing=suppliers.findIndex(s=>(draft.host&&s.host===draft.host)||s.name.toLowerCase()===draft.name.toLowerCase());
  if(existing<0&&!plansApi.canUse(entitlement.plan,"supplierDefaults")&&suppliers.length>=plansApi.limitFor(entitlement.plan,"savedSuppliers"))return alert("Upgrade to Pro for unlimited suppliers and automatic defaults.");
  if(existing>=0)draft.id=suppliers[existing].id;
  if(existing>=0)suppliers[existing]=draft;else suppliers.unshift(draft);
  await chrome.storage.local.set({cc_suppliers:suppliers});event.target.reset();renderSuppliers();
});
$("supplierList").addEventListener("click",async(event)=>{
  const edit=event.target.closest("[data-supplier-edit]"),del=event.target.closest("[data-supplier-delete]");
  if(edit){const s=suppliers.find(x=>x.id===edit.dataset.supplierEdit);if(!s)return;$("supplierName").value=s.name;$("supplierHost").value=s.host;$("supplierMarkup").value=s.defaultMarkup;$("supplierDiscount").value=s.defaultDiscount;$("supplierDelivery").value=s.defaultDelivery;$("supplierCategory").value=s.defaultCategory;$("supplierRoom").value=s.defaultRoom;location.hash="#suppliers";}
  if(del){suppliers=suppliers.filter(s=>s.id!==del.dataset.supplierDelete);await chrome.storage.local.set({cc_suppliers:suppliers});renderSuppliers();}
});

function renderAssemblies(){
  $("assemblyList").innerHTML=assemblies.map(a=>`<article class="card"><h3>${esc(a.name)}</h3><p>${a.items.length} product lines · ${a.laborItems.length} labour lines</p><div class="card-actions"><button class="primary" data-assembly-add="${esc(a.id)}">Insert into project</button><button class="danger" data-assembly-delete="${esc(a.id)}">Delete</button></div></article>`).join("");
}
$("saveAssembly").addEventListener("click",async()=>{
  if(!plansApi.allowance(entitlement.plan,"assemblies",assemblies.length).allowed)return alert("Assemblies are a Pro feature. Upgrade to save reusable scopes.");
  const source=currentProject($("assemblySource").value);const name=$("assemblyName").value.trim();
  if(!source||!name)return alert("Choose a project and enter an assembly name.");
  const assembly=workspace.normalizeAssembly({name,items:source.items||[],laborItems:source.laborItems||[]});
  assemblies.unshift(assembly);await chrome.storage.local.set({cc_assemblies:assemblies});$("assemblyName").value="";renderAssemblies();
});
$("assemblyList").addEventListener("click",async(event)=>{
  const add=event.target.closest("[data-assembly-add]"),del=event.target.closest("[data-assembly-delete]");
  if(add){const a=assemblies.find(x=>x.id===add.dataset.assemblyAdd);const p=currentProject($("assemblyTarget").value);if(!a||!p)return;if(!Array.isArray(p.items))p.items=[];if(!Array.isArray(p.laborItems))p.laborItems=[];p.items.push(...a.items.map(i=>({...i,id:core.makeId("item"),clippedAt:Date.now()})));p.laborItems.push(...a.laborItems.map(l=>({...l,id:core.makeId("labor_item")})));p.updatedAt=Date.now();await chrome.storage.local.set({cc_projects:projects});alert("Assembly inserted into "+(p.name||"project")+".");}
  if(del){assemblies=assemblies.filter(a=>a.id!==del.dataset.assemblyDelete);await chrome.storage.local.set({cc_assemblies:assemblies});renderAssemblies();}
});

function renderTemplates(){
  $("templateList").innerHTML=templates.map(t=>`<article class="card"><h3>${esc(t.name)}</h3><p>Tax ${t.taxPercent}% · ${t.validityDays} day validity</p><p>${esc(t.notes.slice(0,140))}</p><div class="card-actions"><button class="primary" data-template-apply="${esc(t.id)}">Apply to project</button><button class="danger" data-template-delete="${esc(t.id)}">Delete</button></div></article>`).join("");
}
$("saveTemplate").addEventListener("click",async()=>{
  const allowance=plansApi.allowance(entitlement.plan,"quoteTemplates",templates.length);if(!allowance.allowed)return alert("Free includes one quote template. Upgrade to Pro for unlimited templates.");
  const p=currentProject($("templateSource").value),name=$("templateName").value.trim();if(!p||!name)return alert("Choose a project and enter a template name.");
  const validityDays=p.validUntil?daysBetween(new Date(),p.validUntil):30;
  templates.unshift(workspace.normalizeQuoteTemplate({name,taxPercent:p.taxPercent,notes:p.notes,validityDays}));
  await chrome.storage.local.set({cc_quote_templates:templates});$("templateName").value="";renderTemplates();
});
$("templateList").addEventListener("click",async(event)=>{
  const apply=event.target.closest("[data-template-apply]"),del=event.target.closest("[data-template-delete]");
  if(apply){const t=templates.find(x=>x.id===apply.dataset.templateApply);const p=currentProject($("templateTarget").value);if(!t||!p)return;p.taxPercent=t.taxPercent;p.notes=t.notes;p.validUntil=futureDate(t.validityDays);p.updatedAt=Date.now();await chrome.storage.local.set({cc_projects:projects});alert("Template applied to "+(p.name||"project")+".");}
  if(del){templates=templates.filter(t=>t.id!==del.dataset.templateDelete);await chrome.storage.local.set({cc_quote_templates:templates});renderTemplates();}
});

document.querySelectorAll("[data-checkout]").forEach(button=>button.addEventListener("click",()=>{
  const [plan,cadence]=button.dataset.checkout.split(":");chrome.tabs.create({url:billing.checkoutUrl(plan,cadence)});
}));
$("activateLicense").addEventListener("click",async()=>{
  try{setBillingMessage("Verifying subscription…");entitlement=await billing.activateLicense($("license").value);renderPlan();setBillingMessage(plansApi.planLabel(entitlement.plan)+" activated.");}
  catch(error){setBillingMessage(error.message||"Activation failed.",true);}
});
$("refreshPlan").addEventListener("click",()=>refreshPlan(true));
$("manageBilling").addEventListener("click",async()=>{try{chrome.tabs.create({url:await billing.portalUrl()});}catch(error){setBillingMessage(error.message||"Could not open billing.",true);}});
$("deactivateLicense").addEventListener("click",async()=>{entitlement=await billing.deactivate();$("license").value="";renderPlan();setBillingMessage("Paid license removed from this browser.");});
$("openQuotes").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("quote.html")}));

chrome.storage.onChanged.addListener((changes,area)=>{if(area!=="local")return;if(changes.cc_projects||changes.cc_library||changes.cc_labor_rates||changes.cc_suppliers||changes.cc_assemblies||changes.cc_quote_templates)loadData().catch(()=>{});if(changes.cc_entitlement_v1)refreshPlan(false).catch(()=>{});});
Promise.all([loadData(),refreshPlan(false)]).catch(error=>setBillingMessage(error.message||"Could not initialize Pro tools.",true));
