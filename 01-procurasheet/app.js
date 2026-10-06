const api=globalThis.SheetPO;
const plans=globalThis.ProcuraPlans;
const billing=globalThis.ProcuraBilling;
const settings=globalThis.ProcuraSettings;
const $=id=>document.getElementById(id);
const MAX_FILE_BYTES=25*1024*1024;
const MAX_ROWS=25000;
const MAX_BACKUP_BYTES=5*1024*1024;
const REVIEW_PAGE_SIZE=100;
const USAGE_KEY="ps_usage_v1";

const state={
  fileName:"",
  sheets:[],
  sheetIndex:0,
  headerIndex:0,
  table:null,
  mapping:null,
  rows:[],
  catalog:null,
  reviewPage:0,
  entitlement:plans.normalizeEntitlement({plan:"free"}),
  usage:plans.normalizeUsage(null)
};

function esc(value){
  return String(value==null?"":value).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function titleCase(value){
  const text=String(value||"free");
  return text.charAt(0).toUpperCase()+text.slice(1);
}

function supplierKey(){
  return ($("supplierName").value||"").trim().toLowerCase().slice(0,120);
}

function setBillingStatus(message,type){
  const node=$("billingStatus");
  node.textContent=message||"";
  node.classList.remove("error","success");
  if(type)node.classList.add(type);
}

function setSettingsStatus(message){
  $("settingsStatus").textContent=message||"Local only";
}

function openExternal(url){
  const target=String(url||"");
  if(!/^https:\/\//i.test(target)) throw new Error("Only secure HTTPS links can be opened.");
  chrome.tabs.create({url:target});
}

async function readTemplates(){
  const result=await chrome.storage.local.get("supplier_templates_v1");
  try{return settings.validateTemplates(result.supplier_templates_v1||{});}
  catch{return {};}
}

async function writeTemplates(templates){
  const safe=settings.validateTemplates(templates||{});
  await chrome.storage.local.set({supplier_templates_v1:safe});
}

async function readUsage(){
  const result=await chrome.storage.local.get(USAGE_KEY);
  state.usage=plans.normalizeUsage(result[USAGE_KEY]);
  await chrome.storage.local.set({[USAGE_KEY]:state.usage});
}

async function refreshEntitlement(force){
  state.entitlement=await billing.currentEntitlement({force:Boolean(force)});
  renderPlanUi();
  if(state.rows.length)renderRows();
}

function renderPlanUi(){
  const plan=plans.validPlan(state.entitlement.plan);
  const label=titleCase(plan);
  $("planBadge").textContent=label;
  $("planName").textContent=label;
  const exportGate=plans.canExport(state.entitlement,state.usage);
  $("usageText").textContent=exportGate.limit==null
    ?"Unlimited exports · "+label
    :exportGate.used+" / "+exportGate.limit+" exports this month";

  const paid=plan!=="free";
  $("manageBilling").classList.toggle("hidden",!paid);
  $("deactivateLicense").classList.toggle("hidden",!paid);
  $("upgradePro").classList.toggle("hidden",plan==="pro"||plan==="business");
  $("upgradeBusiness").classList.toggle("hidden",plan==="business");

  const catalogAllowed=plans.canUseFeature(plan,"catalogMatching");
  $("catalogInput").disabled=!catalogAllowed;
  $("catalogDropzone").classList.toggle("locked",!catalogAllowed);
  $("catalogHint").textContent=catalogAllowed?"CSV/XLSX · processed locally":"Upgrade to Business to enable catalog matching";
  if(!catalogAllowed){
    state.catalog=null;
    $("catalogInput").value="";
    $("applyCatalog").disabled=true;
    $("catalogState").textContent="Business plan";
  }else if(!state.catalog){
    $("catalogState").textContent="Not loaded";
  }
}

function validateFile(file){
  if(!file)throw new Error("Choose a supplier file.");
  const lower=String(file.name||"").toLowerCase();
  if(![".csv",".tsv",".txt",".xlsx"].some(ext=>lower.endsWith(ext))){
    throw new Error("Unsupported file type. Use CSV, TSV, TXT, or XLSX.");
  }
  if(file.size>MAX_FILE_BYTES)throw new Error("This file is larger than 25 MB. Split it into smaller files before importing.");
}

async function parseFile(file){
  validateFile(file);
  const lower=file.name.toLowerCase();
  let sheets;
  if(lower.endsWith(".xlsx"))sheets=await api.parseXlsx(await file.arrayBuffer());
  else sheets=[{name:"Imported file",rows:api.parseDelimited(await file.text())}];
  if(!sheets.length)throw new Error("No worksheets were found.");
  if(sheets.some(s=>s.rows.length>MAX_ROWS+50))throw new Error("This file has more than 25,000 rows. Split it into smaller orders before importing.");
  return sheets;
}

function currentSheet(){
  return state.sheets[state.sheetIndex];
}

function resolveTemplate(template){
  const result={};
  for(const field of api.FIELDS){
    const wanted=template&&template.mappingHeaders?template.mappingHeaders[field.key]:"";
    result[field.key]=wanted?state.table.headers.findIndex(h=>api.cleanHeader(h)===wanted):-1;
  }
  return result;
}

function skuDictionaryFor(template){
  return plans.canUseFeature(state.entitlement.plan,"skuDictionary")&&template&&template.skuMap?template.skuMap:{};
}

async function setSheet(index,forcedHeader){
  state.sheetIndex=Math.max(0,Number(index)||0);
  const sheet=currentSheet();
  if(!sheet)throw new Error("Worksheet not found.");
  const detected=api.detectHeaderRow(sheet.rows);
  state.headerIndex=Number.isInteger(forcedHeader)?forcedHeader:detected;
  state.headerIndex=Math.max(0,Math.min(state.headerIndex,Math.max(0,sheet.rows.length-1)));
  $("headerRow").value=state.headerIndex+1;

  state.table=api.tableFromRows(sheet.rows,state.headerIndex);
  if(!state.table.headers.length||!state.table.rows.length)throw new Error("The selected header row does not produce tabular data.");
  if(state.table.rows.length>MAX_ROWS)throw new Error("This table has more than 25,000 data rows. Split it into smaller orders before importing.");

  state.mapping=api.autoMap(state.table.headers);
  renderMapping();
  await rebuildRows();
  $("mappingCard").classList.remove("hidden");
  $("reviewCard").classList.remove("hidden");
  $("saveTemplate").disabled=false;
  await syncTemplateButtons();
  $("mappingState").textContent=detected===state.headerIndex?"Header + columns auto-detected":"Header row changed";
}

async function handleSupplierFile(file){
  if(!file)return;
  $("fileState").textContent="Reading…";
  try{
    state.fileName=file.name;
    state.sheets=await parseFile(file);
    $("sheetChooser").innerHTML=state.sheets.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join("");
    $("sheetChooserWrap").classList.remove("hidden");
    await setSheet(0);
    $("fileState").textContent=file.name+" · "+state.table.rows.length+" rows";

    const key=supplierKey();
    if(key){
      const templates=await readTemplates();
      const template=templates[key];
      if(template){
        if(Number.isInteger(template.headerIndex))await setSheet(0,template.headerIndex);
        state.mapping=resolveTemplate(template);
        renderMapping();
        await rebuildRows(skuDictionaryFor(template));
        $("mappingState").textContent="Saved supplier template applied";
      }
    }
  }catch(error){
    $("fileState").textContent="Could not read";
    alert(error.message||"Could not read this supplier file.");
  }
}

function renderMapping(){
  $("mappingGrid").innerHTML=api.FIELDS.map(field=>{
    const options=['<option value="-1">Not in this file</option>'].concat(
      state.table.headers.map((h,i)=>{
        const selected=state.mapping[field.key]===i?" selected":"";
        return '<option value="'+i+'"'+selected+'>'+esc(h)+'</option>';
      })
    ).join("");
    const sampleIndex=state.mapping[field.key];
    const sample=sampleIndex>=0&&state.table.rows[0]?state.table.rows[0].values[sampleIndex]:"";
    return '<div class="mapping-item"><label>'+esc(field.label)+(field.required?" *":"")+
      '<select data-map="'+field.key+'">'+options+'</select></label><small>Example: '+esc(sample||"—")+'</small></div>';
  }).join("");
}

async function savedSkuMap(){
  if(!plans.canUseFeature(state.entitlement.plan,"skuDictionary"))return {};
  const key=supplierKey();
  if(!key)return {};
  const templates=await readTemplates();
  return skuDictionaryFor(templates[key]);
}

async function rebuildRows(optionalMap){
  if(!state.table)return;
  const dict=optionalMap||await savedSkuMap();
  let rows=api.normalizeRows(state.table,state.mapping,dict);
  if(state.catalog&&plans.canUseFeature(state.entitlement.plan,"catalogMatching"))rows=api.applyCatalog(rows,state.catalog);
  state.rows=api.validateRows(rows,state.catalog);
  state.reviewPage=0;
  renderRows();
}

function renderRows(){
  const checked=api.validateRows(state.rows,state.catalog);
  state.rows=checked;
  const blocked=checked.filter(r=>r.errors.length);
  const warnings=checked.filter(r=>!r.errors.length&&r.warnings.length);
  const ready=checked.length-blocked.length;
  const gate=plans.canExport(state.entitlement,state.usage);

  $("validStat").textContent=ready+" ready";
  $("errorStat").textContent=blocked.length+" blocked";
  $("warningStat").textContent=warnings.length+" warnings";
  $("downloadReview").disabled=!checked.length;
  $("downloadShopify").disabled=!checked.length||blocked.length>0||!gate.allowed;

  if(blocked.length){
    $("exportSummary").textContent=blocked.length+" row"+(blocked.length===1?" is":"s are")+" blocking export.";
  }else if(!gate.allowed){
    $("exportSummary").textContent="Free monthly export limit reached. Upgrade to Pro or Business to continue.";
  }else{
    $("exportSummary").textContent=checked.length+" row"+(checked.length===1?" is":"s are")+" ready for Shopify.";
  }

  $("globalIssues").classList.toggle("hidden",blocked.length===0);
  $("globalIssues").textContent=blocked.length
    ?"Fix every blocked row before exporting. Shopify needs each line to have SKU or Barcode plus a positive Quantity."
    :"";

  const pageCount=Math.max(1,Math.ceil(checked.length/REVIEW_PAGE_SIZE));
  state.reviewPage=Math.max(0,Math.min(state.reviewPage,pageCount-1));
  const start=state.reviewPage*REVIEW_PAGE_SIZE;
  const visible=checked.slice(start,start+REVIEW_PAGE_SIZE);
  $("reviewPager").classList.toggle("hidden",checked.length<=REVIEW_PAGE_SIZE);
  $("pageInfo").textContent="Page "+(state.reviewPage+1)+" of "+pageCount+" · showing "+(checked.length?start+1:0)+"–"+Math.min(start+visible.length,checked.length)+" of "+checked.length;
  $("prevPage").disabled=state.reviewPage===0;
  $("nextPage").disabled=state.reviewPage>=pageCount-1;

  $("reviewBody").innerHTML=visible.map((row,visibleIndex)=>{
    const index=start+visibleIndex;
    const cls=row.errors.length?"row-error":(row.warnings.length?"row-warning":"");
    const status=row.errors.length?"blocked":(row.warnings.length?"review":"ready");
    const label=row.errors.length?"Blocked":(row.warnings.length?"Review":"Ready");
    const notes=row.errors.concat(row.warnings).join("; ");
    const input=(field,value,type,step)=>{
      const stepAttr=step?' step="'+step+'"':'';
      const minAttr=field==="quantity"||field==="cost"||field==="tax"?' min="0"':'';
      return '<input aria-label="'+esc(field)+' for source row '+row.sourceRow+'" data-index="'+index+'" data-field="'+field+'" type="'+(type||"text")+'"'+stepAttr+minAttr+' value="'+esc(value)+'">';
    };
    return '<tr class="'+cls+'">'+
      '<td><span class="pill '+status+'" title="'+esc(notes)+'">'+label+'</span></td>'+
      '<td>'+input("sku",row.sku)+'</td>'+
      '<td>'+input("barcode",row.barcode)+'</td>'+
      '<td>'+input("supplierSku",row.supplierSku)+'</td>'+
      '<td>'+input("quantity",row.quantity,"number","1")+'</td>'+
      '<td>'+input("cost",row.cost,"number","any")+'</td>'+
      '<td>'+input("tax",row.tax,"number","any")+'</td>'+
      '<td class="source-cell"><strong>Row '+row.sourceRow+'</strong><small>'+esc(notes||"No issues")+'</small></td>'+
      '<td><button class="row-remove quiet" type="button" data-remove-index="'+index+'" aria-label="Remove source row '+row.sourceRow+'">Remove</button></td>'+
      '</tr>';
  }).join("");
}

async function syncTemplateButtons(){
  const key=supplierKey();
  const templates=key?await readTemplates():{};
  const exists=Boolean(key&&templates[key]);
  $("deleteTemplate").disabled=!exists;
}

async function saveSupplierTemplate(options){
  const opts=options&&typeof options==="object"&&!("target" in options)?options:{};
  const silent=Boolean(opts.silent);
  const key=supplierKey();
  if(!key){
    if(!silent)alert("Enter a supplier name first.");
    return false;
  }
  if(!state.table){
    if(!silent)alert("Load the supplier file first.");
    return false;
  }

  const templates=await readTemplates();
  const previous=templates[key]||null;
  if(!previous){
    const gate=plans.canSaveTemplate(state.entitlement.plan,Object.keys(templates).length);
    if(!gate.allowed){
      const message="Free plan supports up to "+gate.limit+" saved suppliers. Upgrade to Pro or Business for unlimited templates.";
      $("mappingState").textContent="Template limit reached";
      setBillingStatus(message,"error");
      if(!silent)alert(message);
      return false;
    }
  }

  const skuMap=Object.assign({},previous&&previous.skuMap||{});
  if(plans.canUseFeature(state.entitlement.plan,"skuDictionary")){
    state.rows.forEach(r=>{if(r.supplierSku&&r.sku)skuMap[r.supplierSku]=r.sku;});
  }

  const mappingHeaders={};
  for(const field of api.FIELDS){
    const index=state.mapping[field.key];
    mappingHeaders[field.key]=index>=0?api.cleanHeader(state.table.headers[index]):"";
  }
  templates[key]={mappingHeaders,skuMap,headerIndex:state.headerIndex,updatedAt:Date.now()};
  await writeTemplates(templates);
  $("mappingState").textContent=plans.canUseFeature(state.entitlement.plan,"skuDictionary")
    ?"Supplier template + SKU dictionary saved"
    :"Supplier template saved";
  await syncTemplateButtons();
  return true;
}

async function loadSupplierTemplate(){
  const key=supplierKey();
  if(!key){alert("Enter a supplier name first.");return;}
  const templates=await readTemplates();
  const template=templates[key];
  if(!template){alert("No saved template exists for this supplier yet.");return;}
  if(!state.table){alert("Load the supplier file first.");return;}
  if(Number.isInteger(template.headerIndex))await setSheet(state.sheetIndex,template.headerIndex);
  state.mapping=resolveTemplate(template);
  renderMapping();
  await rebuildRows(skuDictionaryFor(template));
  $("mappingState").textContent="Saved supplier template applied";
}

async function deleteSupplierTemplate(){
  const key=supplierKey();
  if(!key)return;
  const templates=await readTemplates();
  if(!templates[key])return;
  if(!confirm("Delete the saved template and SKU mappings for this supplier?"))return;
  delete templates[key];
  await writeTemplates(templates);
  $("mappingState").textContent="Saved template deleted";
  await syncTemplateButtons();
}

async function handleCatalog(file){
  if(!file)return;
  if(!plans.canUseFeature(state.entitlement.plan,"catalogMatching")){
    $("catalogState").textContent="Business plan";
    setBillingStatus("Catalog matching is available on the Business plan.","error");
    $("catalogInput").value="";
    return;
  }
  $("catalogState").textContent="Reading…";
  try{
    const sheets=await parseFile(file);
    const header=api.detectHeaderRow(sheets[0].rows);
    const table=api.tableFromRows(sheets[0].rows,header);
    state.catalog=api.catalogIndexes(table);
    const matchedFields=(state.catalog.map.sku>=0?"SKU ":"")+(state.catalog.map.barcode>=0?"Barcode":"");
    if(state.catalog.map.sku<0)throw new Error("No Shopify/Variant SKU column was detected in the catalog export.");
    $("catalogState").textContent=(matchedFields.trim()||"No IDs")+" detected";
    $("applyCatalog").disabled=false;
  }catch(error){
    state.catalog=null;
    $("catalogState").textContent="Could not read";
    $("applyCatalog").disabled=true;
    alert(error.message||"Could not read catalog file.");
  }
}

function applyCatalog(){
  if(!plans.canUseFeature(state.entitlement.plan,"catalogMatching")){
    setBillingStatus("Catalog matching requires the Business plan.","error");
    return;
  }
  if(!state.catalog||!state.rows.length)return;
  state.rows=api.applyCatalog(state.rows,state.catalog);
  renderRows();
  $("catalogState").textContent="Catalog matches applied";
}

function downloadBlob(name,content,type){
  const url=URL.createObjectURL(new Blob([content],{type:type||"text/plain;charset=utf-8"}));
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function exportShopify(){
  const checked=api.validateRows(state.rows,state.catalog);
  if(checked.some(r=>r.errors.length)){alert("Fix blocked rows before export.");return;}
  const gate=plans.canExport(state.entitlement,state.usage);
  if(!gate.allowed){
    setBillingStatus("Free monthly export limit reached. Upgrade to Pro or Business for unlimited exports.","error");
    renderRows();
    return;
  }
  const warnings=checked.reduce((sum,row)=>sum+row.warnings.length,0);
  if(warnings>0&&!confirm(warnings+" warning"+(warnings===1?" remains":"s remain")+". Export anyway?"))return;

  if(supplierKey())await saveSupplierTemplate({silent:true});
  const base=(supplierKey()||"supplier").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"supplier";
  downloadBlob(base+"-shopify-po.csv",api.toCsv(api.shopifyRows(checked)),"text/csv;charset=utf-8");

  state.usage=plans.recordConversion(state.usage);
  await chrome.storage.local.set({[USAGE_KEY]:state.usage});
  renderPlanUi();
  renderRows();
}

function exportReview(){
  const rows=[
    ["Status","Source Row","SKU","Barcode","Supplier SKU","Quantity","Cost","Tax","Issues"],
    ...state.rows.map(r=>[r.status,r.sourceRow,r.sku,r.barcode,r.supplierSku,r.quantity,r.cost,r.tax,r.errors.concat(r.warnings).join("; ")])
  ];
  downloadBlob("shopify-po-review.csv",api.toCsv(rows),"text/csv;charset=utf-8");
}

async function backupSettings(){
  try{
    const templates=await readTemplates();
    const backup=settings.createBackup(templates);
    downloadBlob("procurasheet-settings-backup.json",JSON.stringify(backup,null,2),"application/json;charset=utf-8");
    setSettingsStatus(Object.keys(templates).length+" supplier template"+(Object.keys(templates).length===1?"":"s")+" backed up");
  }catch(error){
    setSettingsStatus("Backup failed");
    alert(error.message||"Could not create settings backup.");
  }
}

async function restoreSettings(file){
  if(!file)return;
  try{
    if(file.size>MAX_BACKUP_BYTES)throw new Error("Backup file is larger than 5 MB.");
    const payload=JSON.parse(await file.text());
    const templates=settings.validateBackup(payload);
    const restoredCount=Object.keys(templates).length;
    const templateLimit=plans.limitsFor(state.entitlement.plan).savedSuppliers;
    if(Number.isFinite(templateLimit)&&restoredCount>templateLimit){
      throw new Error("Your "+titleCase(state.entitlement.plan)+" plan can restore up to "+templateLimit+" supplier templates. Upgrade to Pro or Business to restore this backup.");
    }
    if(!confirm("Replace your current supplier templates with this backup?"))return;
    await writeTemplates(templates);
    setSettingsStatus(Object.keys(templates).length+" supplier template"+(Object.keys(templates).length===1?"":"s")+" restored");
    await syncTemplateButtons();
  }catch(error){
    setSettingsStatus("Restore failed");
    alert(error.message||"Could not restore this backup.");
  }finally{
    $("restoreSettingsInput").value="";
  }
}

async function loadSample(){
  try{
    $("supplierName").value="Demo Supplier";
    const response=await fetch(chrome.runtime.getURL("samples/supplier-example.csv"));
    if(!response.ok)throw new Error("Sample file unavailable.");
    const text=await response.text();
    const file=new File([text],"supplier-example.csv",{type:"text/csv"});
    await handleSupplierFile(file);
  }catch{
    alert("Could not load the sample file.");
  }
}

function resetWorkspace(){
  state.fileName="";
  state.sheets=[];
  state.sheetIndex=0;
  state.headerIndex=0;
  state.table=null;
  state.mapping=null;
  state.rows=[];
  state.catalog=null;
  state.reviewPage=0;
  $("fileInput").value="";
  $("catalogInput").value="";
  $("fileState").textContent="No file";
  $("sheetChooserWrap").classList.add("hidden");
  $("mappingCard").classList.add("hidden");
  $("reviewCard").classList.add("hidden");
  $("saveTemplate").disabled=true;
  renderPlanUi();
  syncTemplateButtons();
}

async function activateLicense(){
  const button=$("activateLicense");
  button.disabled=true;
  setBillingStatus("Verifying license…");
  try{
    state.entitlement=await billing.activateLicense($("licenseInput").value);
    $("licenseInput").value="";
    setBillingStatus(titleCase(state.entitlement.plan)+" activated on this device.","success");
    renderPlanUi();
    if(state.table)await rebuildRows();
  }catch(error){
    setBillingStatus(error.message||"License activation failed.","error");
  }finally{
    button.disabled=false;
  }
}

async function manageBilling(){
  const button=$("manageBilling");
  button.disabled=true;
  setBillingStatus("Opening secure billing portal…");
  try{
    openExternal(await billing.portalUrl());
    setBillingStatus("Billing portal opened in a new tab.","success");
  }catch(error){
    setBillingStatus(error.message||"Could not open billing portal.","error");
  }finally{
    button.disabled=false;
  }
}

async function deactivateLicense(){
  if(!confirm("Deactivate this ProcuraSheet paid license on this device? Your subscription itself will not be canceled."))return;
  state.entitlement=await billing.deactivate();
  setBillingStatus("Paid license removed from this device.","success");
  renderPlanUi();
  if(state.table)await rebuildRows();
}

async function initializeApp(){
  await readUsage();
  state.entitlement=await billing.currentEntitlement();
  renderPlanUi();
  await syncTemplateButtons();
}

$("fileInput").addEventListener("change",e=>handleSupplierFile(e.target.files[0]));
$("catalogInput").addEventListener("change",e=>handleCatalog(e.target.files[0]));
$("sheetChooser").addEventListener("change",async e=>{try{await setSheet(Number(e.target.value));}catch(error){alert(error.message);}});
$("headerRow").addEventListener("change",async e=>{
  try{await setSheet(state.sheetIndex,Math.max(0,Number(e.target.value||1)-1));}
  catch(error){alert(error.message);}
});
$("mappingGrid").addEventListener("change",e=>{
  if(!e.target.dataset.map)return;
  state.mapping[e.target.dataset.map]=Number(e.target.value);
  renderMapping();
  rebuildRows();
});
$("reviewBody").addEventListener("click",e=>{
  const raw=e.target.dataset.removeIndex;
  if(raw===undefined)return;
  const index=Number(raw);
  if(!Number.isInteger(index)||!state.rows[index])return;
  state.rows.splice(index,1);
  renderRows();
});
$("reviewBody").addEventListener("change",e=>{
  const index=Number(e.target.dataset.index),field=e.target.dataset.field;
  if(!Number.isInteger(index)||!field||!state.rows[index])return;
  if(["quantity","cost","tax"].includes(field))state.rows[index][field]=e.target.value===""?"":api.numberValue(e.target.value);
  else state.rows[index][field]=String(e.target.value||"").trim();
  renderRows();
});
$("supplierName").addEventListener("change",syncTemplateButtons);
$("saveTemplate").addEventListener("click",()=>saveSupplierTemplate());
$("loadTemplate").addEventListener("click",loadSupplierTemplate);
$("deleteTemplate").addEventListener("click",deleteSupplierTemplate);
$("applyCatalog").addEventListener("click",applyCatalog);
$("downloadShopify").addEventListener("click",exportShopify);
$("downloadReview").addEventListener("click",exportReview);
$("resetWorkspace").addEventListener("click",resetWorkspace);
$("prevPage").addEventListener("click",()=>{if(state.reviewPage>0){state.reviewPage--;renderRows();}});
$("nextPage").addEventListener("click",()=>{const pages=Math.ceil(state.rows.length/REVIEW_PAGE_SIZE);if(state.reviewPage<pages-1){state.reviewPage++;renderRows();}});
$("loadSample").addEventListener("click",loadSample);
$("openShopify").addEventListener("click",()=>openExternal("https://admin.shopify.com/"));
$("upgradePro").addEventListener("click",()=>openExternal(billing.checkoutUrl("pro")));
$("upgradeBusiness").addEventListener("click",()=>openExternal(billing.checkoutUrl("business")));
$("activateLicense").addEventListener("click",activateLicense);
$("manageBilling").addEventListener("click",manageBilling);
$("deactivateLicense").addEventListener("click",deactivateLicense);
$("backupSettings").addEventListener("click",backupSettings);
$("restoreSettingsInput").addEventListener("change",e=>restoreSettings(e.target.files[0]));

const drop=$("dropzone");
["dragenter","dragover"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add("drag");}));
["dragleave","drop"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove("drag");}));
drop.addEventListener("drop",e=>handleSupplierFile(e.dataTransfer.files[0]));

initializeApp().catch(error=>{
  setBillingStatus("Could not initialize plan status. Free features remain available.","error");
  console.error(error);
});
