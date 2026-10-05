const api=globalThis.SheetPO;
const $=id=>document.getElementById(id);
const MAX_FILE_BYTES=25*1024*1024;
const MAX_ROWS=25000;
const REVIEW_PAGE_SIZE=100;

const state={
  fileName:"",
  sheets:[],
  sheetIndex:0,
  headerIndex:0,
  table:null,
  mapping:null,
  rows:[],
  catalog:null,
  reviewPage:0
};

function esc(value){
  return String(value==null?"":value).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function supplierKey(){
  return ($("supplierName").value||"").trim().toLowerCase();
}

async function readTemplates(){
  const result=await chrome.storage.local.get("supplier_templates_v1");
  return result.supplier_templates_v1||{};
}

async function writeTemplates(templates){
  await chrome.storage.local.set({supplier_templates_v1:templates});
}

function validateFile(file){
  if(!file) throw new Error("Choose a supplier file.");
  const lower=String(file.name||"").toLowerCase();
  if(![".csv",".tsv",".txt",".xlsx"].some(ext=>lower.endsWith(ext))){
    throw new Error("Unsupported file type. Use CSV, TSV, TXT, or XLSX.");
  }
  if(file.size>MAX_FILE_BYTES) throw new Error("This file is larger than 25 MB. Split it into smaller files before importing.");
}

async function parseFile(file){
  validateFile(file);
  const lower=file.name.toLowerCase();
  let sheets;
  if(lower.endsWith(".xlsx")) sheets=await api.parseXlsx(await file.arrayBuffer());
  else sheets=[{name:"Imported file",rows:api.parseDelimited(await file.text())}];
  if(!sheets.length) throw new Error("No worksheets were found.");
  if(sheets.some(s=>s.rows.length>MAX_ROWS+50)) throw new Error("This file has more than 25,000 rows. Split it into smaller orders before importing.");
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

function setSheet(index,forcedHeader){
  state.sheetIndex=Math.max(0,Number(index)||0);
  const sheet=currentSheet();
  if(!sheet) throw new Error("Worksheet not found.");
  const detected=api.detectHeaderRow(sheet.rows);
  state.headerIndex=Number.isInteger(forcedHeader)?forcedHeader:detected;
  state.headerIndex=Math.max(0,Math.min(state.headerIndex,Math.max(0,sheet.rows.length-1)));
  $("headerRow").value=state.headerIndex+1;

  state.table=api.tableFromRows(sheet.rows,state.headerIndex);
  if(!state.table.headers.length||!state.table.rows.length) throw new Error("The selected header row does not produce tabular data.");

  state.mapping=api.autoMap(state.table.headers);
  renderMapping();
  rebuildRows();
  $("mappingCard").classList.remove("hidden");
  $("reviewCard").classList.remove("hidden");
  $("saveTemplate").disabled=false;
  syncTemplateButtons();
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
    setSheet(0);
    $("fileState").textContent=file.name+" · "+state.table.rows.length+" rows";

    const key=supplierKey();
    if(key){
      const templates=await readTemplates();
      if(templates[key]){
        if(Number.isInteger(templates[key].headerIndex)) setSheet(0,templates[key].headerIndex);
        state.mapping=resolveTemplate(templates[key]);
        renderMapping();
        await rebuildRows(templates[key].skuMap||{});
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
  const key=supplierKey();
  if(!key)return {};
  const templates=await readTemplates();
  return templates[key]&&templates[key].skuMap?templates[key].skuMap:{};
}

async function rebuildRows(optionalMap){
  if(!state.table)return;
  const dict=optionalMap||await savedSkuMap();
  let rows=api.normalizeRows(state.table,state.mapping,dict);
  if(state.catalog) rows=api.applyCatalog(rows,state.catalog);
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

  $("validStat").textContent=ready+" ready";
  $("errorStat").textContent=blocked.length+" blocked";
  $("warningStat").textContent=warnings.length+" warnings";
  $("downloadReview").disabled=!checked.length;
  $("downloadShopify").disabled=!checked.length||blocked.length>0;
  $("exportSummary").textContent=blocked.length
    ? blocked.length+" row"+(blocked.length===1?" is":"s are")+" blocking export."
    : checked.length+" row"+(checked.length===1?" is":"s are")+" ready for Shopify.";

  $("globalIssues").classList.toggle("hidden",blocked.length===0);
  $("globalIssues").textContent=blocked.length
    ?"Fix every blocked row before exporting. Shopify needs each line to have SKU or Barcode plus a positive Quantity."
    :"";

  const pageCount=Math.max(1,Math.ceil(checked.length/REVIEW_PAGE_SIZE));
  state.reviewPage=Math.max(0,Math.min(state.reviewPage,pageCount-1));
  const start=state.reviewPage*REVIEW_PAGE_SIZE;
  const visible=checked.slice(start,start+REVIEW_PAGE_SIZE);
  $("reviewPager").classList.toggle("hidden",checked.length<=REVIEW_PAGE_SIZE);
  $("pageInfo").textContent="Page "+(state.reviewPage+1)+" of "+pageCount+" · showing "+(start+1)+"–"+Math.min(start+visible.length,checked.length)+" of "+checked.length;
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

async function saveSupplierTemplate(){
  const key=supplierKey();
  if(!key){alert("Enter a supplier name first.");return;}
  if(!state.table){alert("Load the supplier file first.");return;}
  const templates=await readTemplates();
  const previous=templates[key]||{};
  const skuMap=Object.assign({},previous.skuMap||{});
  state.rows.forEach(r=>{if(r.supplierSku&&r.sku)skuMap[r.supplierSku]=r.sku;});
  const mappingHeaders={};
  for(const field of api.FIELDS){
    const index=state.mapping[field.key];
    mappingHeaders[field.key]=index>=0?api.cleanHeader(state.table.headers[index]):"";
  }
  templates[key]={mappingHeaders,skuMap,headerIndex:state.headerIndex,updatedAt:Date.now()};
  await writeTemplates(templates);
  $("mappingState").textContent="Supplier template saved";
  await syncTemplateButtons();
}

async function loadSupplierTemplate(){
  const key=supplierKey();
  if(!key){alert("Enter a supplier name first.");return;}
  const templates=await readTemplates();
  const template=templates[key];
  if(!template){alert("No saved template exists for this supplier yet.");return;}
  if(!state.table){alert("Load the supplier file first.");return;}
  if(Number.isInteger(template.headerIndex)) setSheet(state.sheetIndex,template.headerIndex);
  state.mapping=resolveTemplate(template);
  renderMapping();
  await rebuildRows(template.skuMap||{});
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
  $("catalogState").textContent="Reading…";
  try{
    const sheets=await parseFile(file);
    const header=api.detectHeaderRow(sheets[0].rows);
    const table=api.tableFromRows(sheets[0].rows,header);
    state.catalog=api.catalogIndexes(table);
    const matchedFields=(state.catalog.map.sku>=0?"SKU ":"")+(state.catalog.map.barcode>=0?"Barcode":"");
    if(state.catalog.map.sku<0) throw new Error("No Shopify/Variant SKU column was detected in the catalog export.");
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
  if(!state.catalog||!state.rows.length)return;
  state.rows=api.applyCatalog(state.rows,state.catalog);
  renderRows();
  $("catalogState").textContent="Catalog matches applied";
}

function download(name,text){
  const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function exportShopify(){
  const checked=api.validateRows(state.rows,state.catalog);
  if(checked.some(r=>r.errors.length)){alert("Fix blocked rows before export.");return;}
  const warnings=checked.reduce((sum,row)=>sum+row.warnings.length,0);
  if(warnings>0&&!confirm(warnings+" warning"+(warnings===1?" remains":"s remain")+". Export anyway?")) return;
  if(supplierKey()) await saveSupplierTemplate();
  const base=(supplierKey()||"supplier").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"supplier";
  download(base+"-shopify-po.csv",api.toCsv(api.shopifyRows(checked)));
}

function exportReview(){
  const rows=[
    ["Status","Source Row","SKU","Barcode","Supplier SKU","Quantity","Cost","Tax","Issues"],
    ...state.rows.map(r=>[r.status,r.sourceRow,r.sku,r.barcode,r.supplierSku,r.quantity,r.cost,r.tax,r.errors.concat(r.warnings).join("; ")])
  ];
  download("shopify-po-review.csv",api.toCsv(rows));
}

async function loadSample(){
  try{
    $("supplierName").value="Demo Supplier";
    const response=await fetch(chrome.runtime.getURL("samples/supplier-example.csv"));
    const text=await response.text();
    const file=new File([text],"supplier-example.csv",{type:"text/csv"});
    await handleSupplierFile(file);
  }catch(error){
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
  $("catalogState").textContent="Not loaded";
  $("sheetChooserWrap").classList.add("hidden");
  $("mappingCard").classList.add("hidden");
  $("reviewCard").classList.add("hidden");
  $("applyCatalog").disabled=true;
  $("saveTemplate").disabled=true;
  syncTemplateButtons();
}

$("fileInput").addEventListener("change",e=>handleSupplierFile(e.target.files[0]));
$("catalogInput").addEventListener("change",e=>handleCatalog(e.target.files[0]));
$("sheetChooser").addEventListener("change",e=>{try{setSheet(Number(e.target.value));}catch(error){alert(error.message);}});
$("headerRow").addEventListener("change",e=>{
  try{
    const index=Math.max(0,Number(e.target.value||1)-1);
    setSheet(state.sheetIndex,index);
  }catch(error){alert(error.message);}
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
  if(["quantity","cost","tax"].includes(field)) state.rows[index][field]=e.target.value===""?"":api.numberValue(e.target.value);
  else state.rows[index][field]=String(e.target.value||"").trim();
  renderRows();
});
$("supplierName").addEventListener("change",syncTemplateButtons);
$("saveTemplate").addEventListener("click",saveSupplierTemplate);
$("loadTemplate").addEventListener("click",loadSupplierTemplate);
$("deleteTemplate").addEventListener("click",deleteSupplierTemplate);
$("applyCatalog").addEventListener("click",applyCatalog);
$("downloadShopify").addEventListener("click",exportShopify);
$("downloadReview").addEventListener("click",exportReview);
$("resetWorkspace").addEventListener("click",resetWorkspace);
$("prevPage").addEventListener("click",()=>{if(state.reviewPage>0){state.reviewPage--;renderRows();}});
$("nextPage").addEventListener("click",()=>{const pages=Math.ceil(state.rows.length/REVIEW_PAGE_SIZE);if(state.reviewPage<pages-1){state.reviewPage++;renderRows();}});
$("loadSample").addEventListener("click",loadSample);
$("openShopify").addEventListener("click",()=>window.open("https://admin.shopify.com/","_blank","noopener"));

const drop=$("dropzone");
["dragenter","dragover"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add("drag");}));
["dragleave","drop"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove("drag");}));
drop.addEventListener("drop",e=>handleSupplierFile(e.dataTransfer.files[0]));

syncTemplateButtons();
