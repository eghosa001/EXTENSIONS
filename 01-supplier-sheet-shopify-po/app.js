const api=globalThis.SheetPO;
const $=function(id){return document.getElementById(id);};

const state={
  fileName:"",
  sheets:[],
  table:null,
  mapping:null,
  rows:[],
  catalog:null
};

function esc(value){
  return String(value==null?"":value).replace(/[&<>'"]/g,function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch];
  });
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

function resolveTemplate(template){
  const result={};
  for(const field of api.FIELDS){
    const wanted=template&&template.mappingHeaders?template.mappingHeaders[field.key]:"";
    result[field.key]=wanted?state.table.headers.findIndex(function(h){return api.cleanHeader(h)===wanted;}):-1;
  }
  return result;
}

async function parseFile(file){
  const lower=file.name.toLowerCase();
  if(lower.endsWith(".xlsx")){
    const sheets=await api.parseXlsx(await file.arrayBuffer());
    if(!sheets.length) throw new Error("No worksheets were found.");
    return sheets;
  }
  const rows=api.parseDelimited(await file.text());
  return [{name:"Imported file",rows:rows}];
}

function setSheet(index){
  const sheet=state.sheets[index];
  state.table=api.tableFromRows(sheet.rows);
  if(!state.table.headers.length||!state.table.rows.length) throw new Error("The selected sheet has no tabular data.");
  state.mapping=api.autoMap(state.table.headers);
  renderMapping();
  rebuildRows();
  $("mappingCard").classList.remove("hidden");
  $("reviewCard").classList.remove("hidden");
  $("saveTemplate").disabled=false;
}

async function handleSupplierFile(file){
  if(!file)return;
  $("fileState").textContent="Reading…";
  try{
    state.fileName=file.name;
    state.sheets=await parseFile(file);
    $("sheetChooser").innerHTML=state.sheets.map(function(s,i){return '<option value="'+i+'">'+esc(s.name)+'</option>';}).join("");
    $("sheetChooserWrap").classList.toggle("hidden",state.sheets.length<=1);
    setSheet(0);
    $("fileState").textContent=state.sheets.length>1?(state.sheets.length+" sheets"):file.name;
    const key=supplierKey();
    if(key){
      const templates=await readTemplates();
      if(templates[key]){
        state.mapping=resolveTemplate(templates[key]);
        renderMapping();
        rebuildRows(templates[key].skuMap||{});
        $("mappingState").textContent="Saved template applied";
      }
    }
  }catch(error){
    $("fileState").textContent="Could not read";
    alert(error.message||"Could not read this supplier file.");
  }
}

function renderMapping(){
  $("mappingGrid").innerHTML=api.FIELDS.map(function(field){
    const options=['<option value="-1">Not in this file</option>'].concat(
      state.table.headers.map(function(h,i){
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
  state.rows=api.validateRows(rows);
  renderRows();
}

function renderRows(){
  const checked=api.validateRows(state.rows);
  state.rows=checked;
  const blocked=checked.filter(function(r){return r.errors.length;});
  const warnings=checked.filter(function(r){return !r.errors.length&&r.warnings.length;});
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
    ?"Fix every blocked row before exporting. Shopify needs each row to have SKU or Barcode, plus a positive Quantity."
    :"";

  $("reviewBody").innerHTML=checked.map(function(row,index){
    const cls=row.errors.length?"row-error":(row.warnings.length?"row-warning":"");
    const status=row.errors.length?"blocked":(row.warnings.length?"review":"ready");
    const label=row.errors.length?"Blocked":(row.warnings.length?"Review":"Ready");
    const notes=row.errors.concat(row.warnings).join("; ");
    function input(field,value,type){
      return '<input data-index="'+index+'" data-field="'+field+'" type="'+(type||"text")+'" value="'+esc(value)+'">';
    }
    return '<tr class="'+cls+'">'+
      '<td><span class="pill '+status+'" title="'+esc(notes)+'">'+label+'</span></td>'+
      '<td>'+input("sku",row.sku)+'</td>'+
      '<td>'+input("barcode",row.barcode)+'</td>'+
      '<td>'+input("supplierSku",row.supplierSku)+'</td>'+
      '<td>'+input("quantity",row.quantity,"number")+'</td>'+
      '<td>'+input("cost",row.cost,"number")+'</td>'+
      '<td>'+input("tax",row.tax,"number")+'</td>'+
      '<td class="source-cell"><strong>Row '+row.sourceRow+'</strong><small>'+esc(notes||"No issues")+'</small></td>'+
      '</tr>';
  }).join("");
}

async function saveSupplierTemplate(){
  const key=supplierKey();
  if(!key){alert("Enter a supplier name first.");return;}
  const templates=await readTemplates();
  const previous=templates[key]||{};
  const skuMap=Object.assign({},previous.skuMap||{});
  state.rows.forEach(function(r){if(r.supplierSku&&r.sku)skuMap[r.supplierSku]=r.sku;});
  const mappingHeaders={};
  for(const field of api.FIELDS){
    const index=state.mapping[field.key];
    mappingHeaders[field.key]=index>=0?api.cleanHeader(state.table.headers[index]):"";
  }
  templates[key]={mappingHeaders:mappingHeaders,skuMap:skuMap,updatedAt:Date.now()};
  await writeTemplates(templates);
  $("mappingState").textContent="Template saved";
}

async function loadSupplierTemplate(){
  const key=supplierKey();
  if(!key){alert("Enter a supplier name first.");return;}
  const templates=await readTemplates();
  const template=templates[key];
  if(!template){alert("No saved template exists for this supplier yet.");return;}
  if(!state.table){alert("Load the supplier file first.");return;}
  state.mapping=resolveTemplate(template);
  renderMapping();
  await rebuildRows(template.skuMap||{});
  $("mappingState").textContent="Saved template applied";
}

async function handleCatalog(file){
  if(!file)return;
  $("catalogState").textContent="Reading…";
  try{
    const sheets=await parseFile(file);
    const table=api.tableFromRows(sheets[0].rows);
    state.catalog=api.catalogIndexes(table);
    const matchedFields=(state.catalog.map.sku>=0?"SKU ":"")+(state.catalog.map.barcode>=0?"Barcode":"");
    $("catalogState").textContent=(matchedFields||"No IDs")+" detected";
    $("applyCatalog").disabled=false;
  }catch(error){
    $("catalogState").textContent="Could not read";
    alert(error.message||"Could not read catalog file.");
  }
}

function applyCatalog(){
  if(!state.catalog||!state.rows.length)return;
  state.rows=api.applyCatalog(state.rows,state.catalog);
  renderRows();
}

function download(name,text){
  const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
}

async function exportShopify(){
  const checked=api.validateRows(state.rows);
  if(checked.some(function(r){return r.errors.length;})){alert("Fix blocked rows before export.");return;}
  await saveSupplierTemplate();
  const filename=(supplierKey()||"supplier").replace(/[^a-z0-9]+/g,"-")+"-shopify-po.csv";
  download(filename,api.toCsv(api.shopifyRows(checked)));
}

function exportReview(){
  const rows=[
    ["Status","Source Row","SKU","Barcode","Supplier SKU","Quantity","Cost","Tax","Issues"],
    ...state.rows.map(function(r){return [r.status,r.sourceRow,r.sku,r.barcode,r.supplierSku,r.quantity,r.cost,r.tax,r.errors.concat(r.warnings).join("; ")];})
  ];
  download("shopify-po-review.csv",api.toCsv(rows));
}

$("fileInput").addEventListener("change",function(e){handleSupplierFile(e.target.files[0]);});
$("catalogInput").addEventListener("change",function(e){handleCatalog(e.target.files[0]);});
$("sheetChooser").addEventListener("change",function(e){try{setSheet(Number(e.target.value));}catch(error){alert(error.message);}});
$("mappingGrid").addEventListener("change",function(e){
  if(!e.target.dataset.map)return;
  state.mapping[e.target.dataset.map]=Number(e.target.value);
  renderMapping();
  rebuildRows();
});
$("reviewBody").addEventListener("change",function(e){
  const index=Number(e.target.dataset.index),field=e.target.dataset.field;
  if(!Number.isInteger(index)||!field||!state.rows[index])return;
  if(["quantity","cost","tax"].includes(field)) state.rows[index][field]=e.target.value===""?"":api.numberValue(e.target.value);
  else state.rows[index][field]=String(e.target.value||"").trim();
  renderRows();
});
$("saveTemplate").addEventListener("click",saveSupplierTemplate);
$("loadTemplate").addEventListener("click",loadSupplierTemplate);
$("applyCatalog").addEventListener("click",applyCatalog);
$("downloadShopify").addEventListener("click",exportShopify);
$("downloadReview").addEventListener("click",exportReview);
$("openShopify").addEventListener("click",function(){window.open("https://admin.shopify.com/","_blank","noopener");});

const drop=$("dropzone");
["dragenter","dragover"].forEach(function(type){drop.addEventListener(type,function(e){e.preventDefault();drop.classList.add("drag");});});
["dragleave","drop"].forEach(function(type){drop.addEventListener(type,function(e){e.preventDefault();drop.classList.remove("drag");});});
drop.addEventListener("drop",function(e){handleSupplierFile(e.dataTransfer.files[0]);});
