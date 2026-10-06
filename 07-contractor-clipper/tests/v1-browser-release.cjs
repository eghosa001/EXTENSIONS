const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright-core");

const root=path.resolve(__dirname,"..");
const extensionRoot=process.env.CC_EXTENSION_DIR||root;
const artifacts=path.join(root,"qa-artifacts-v1");
const profile=path.join(root,".qa-v1-profile");
fs.rmSync(artifacts,{recursive:true,force:true});
fs.rmSync(profile,{recursive:true,force:true});
fs.mkdirSync(artifacts,{recursive:true});

function serveFixture(){
  const html=fs.readFileSync(path.join(__dirname,"fixtures","product.html"));
  const image='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#ddd"/></svg>';
  const server=http.createServer((req,res)=>{
    if(req.url==="/qa-pendant.jpg"||req.url==="/qa-pendant-2.jpg"){
      res.writeHead(200,{"content-type":"image/svg+xml"});return res.end(image);
    }
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);
  });
  return new Promise(resolve=>server.listen(8765,"127.0.0.1",()=>resolve(server)));
}

function launch(){
  return chromium.launchPersistentContext(profile,{
    headless:false,viewport:{width:1280,height:800},
    args:[`--disable-extensions-except=${extensionRoot}`,`--load-extension=${extensionRoot}`,"--no-first-run","--no-default-browser-check"]
  });
}
async function workerFor(context){
  let worker=context.serviceWorkers().find(w=>w.url().startsWith("chrome-extension://"));
  if(!worker)worker=await context.waitForEvent("serviceworker",{timeout:15000});
  return worker;
}
async function setPlan(page,plan){
  await page.evaluate(async(plan)=>{
    if(plan==="free"){
      await chrome.storage.local.remove(["cc_license_v1","cc_entitlement_v1"]);
      return;
    }
    const now=Date.now();
    await chrome.storage.local.set({
      cc_license_v1:"cc1.e30.c2ln",
      cc_entitlement_v1:{plan,status:"active",checkedAt:now,expiresAt:now+72*60*60*1000}
    });
  },plan);
}
async function waitPlan(page,plan){
  await page.waitForFunction(p=>{
    const badge=document.getElementById("planBadge");
    return badge&&badge.textContent.trim().toLowerCase()===p;
  },plan,{timeout:10000});
}

async function testManifest(context,worker){
  const state=await worker.evaluate(async()=>{
    const manifest=chrome.runtime.getManifest();
    const side=await chrome.sidePanel.getOptions({});
    const behavior=await chrome.sidePanel.getPanelBehavior();
    const billingGranted=await chrome.permissions.contains({origins:["https://procurasheet-billing.onrender.com/*"]});
    return {manifest,side,behavior,billingGranted};
  });
  assert.equal(state.manifest.version,"1.0.0");
  assert.equal(state.side.path,"popup.html");
  assert.equal(state.behavior.openPanelOnActionClick,true);
  assert.deepEqual(state.manifest.host_permissions || [],["http://127.0.0.1/*"]);
  assert.deepEqual(state.manifest.optional_host_permissions,["https://procurasheet-billing.onrender.com/*"]);
  assert.equal(state.billingGranted,false);
}

async function testFreePlan(context,id){
  const quote=await context.newPage();
  await quote.goto(`chrome-extension://${id}/quote.html`);
  const now=Date.now();
  await quote.evaluate(async(now)=>{
    await chrome.storage.local.remove(["cc_license_v1","cc_entitlement_v1"]);
    await chrome.storage.local.set({cc_projects:[
      {id:"free_1",name:"Free One",currency:"USD",createdAt:now,updatedAt:now,items:[]},
      {id:"free_2",name:"Free Two",currency:"USD",createdAt:now,updatedAt:now,items:[]}
    ]});
  },now);
  await quote.reload();
  await quote.waitForFunction(()=>document.getElementById("newProject")?.disabled===true);
  assert.equal(await quote.locator("#duplicateProject").isDisabled(),true);
  assert.equal(await quote.locator("#exportCsv").isDisabled(),true);
  assert.equal(await quote.locator("#exportExcel").isDisabled(),true);
  assert.equal(await quote.locator("#brandBusiness").isDisabled(),true);
  assert.equal(await quote.locator("#exportApproval").isHidden(),true);

  const workspace=await context.newPage();
  await workspace.goto(`chrome-extension://${id}/workspace.html`);
  await waitPlan(workspace,"free");
  assert.match(await workspace.locator("#planStatus").textContent(),/Free is active/i);
  assert.match(await workspace.locator("body").textContent(),/₦4,000\/month/);
  await workspace.close();
  await quote.close();
}

async function testRichScan(context,id){
  const holder=await context.newPage();
  await holder.goto(`chrome-extension://${id}/workspace.html`);
  await setPlan(holder,"free");
  await holder.evaluate(async()=>chrome.storage.local.set({cc_projects:[{id:"scan_project",name:"Scan QA",currency:"USD",createdAt:Date.now(),updatedAt:Date.now(),items:[]}],cc_suppliers:[],cc_library:[],cc_usage_v1:{month:"",clips:0}}));
  await holder.close();

  const product=await context.newPage();
  await product.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded"});
  const liveQuote=await context.newPage();
  await liveQuote.goto(`chrome-extension://${id}/quote.html`);
  const panel=await context.newPage();
  await panel.goto(`chrome-extension://${id}/popup.html`);
  await panel.waitForSelector("#scan");
  await product.bringToFront();

  await panel.locator("#scan").click();
  await panel.waitForFunction(()=>!document.getElementById("editor").classList.contains("hidden"),null,{timeout:10000});
  assert.equal(await panel.locator("#title").inputValue(),"QA Pendant");
  assert.equal(await panel.locator("#sku").inputValue(),"QA-128");
  assert.equal(await panel.locator("#brand").inputValue(),"Northstar Lighting");
  assert.equal(await panel.locator("#model").inputValue(),"PD-900");
  assert.equal(await panel.locator("#material").inputValue(),"Brass and glass");
  assert.equal(await panel.locator("#finish").inputValue(),"Brushed");
  assert.equal(await panel.locator("#dimensions").inputValue(),"18 in x 12 in");
  assert.equal(await panel.locator("#availability").inputValue(),"In Stock");
  assert.equal(await panel.locator(".image-choice").count(),2);
  assert.equal(await panel.locator("#supplierDiscount").isDisabled(),true);

  await panel.locator("#supplier").fill("QA Lighting");
  await panel.locator("#room").fill("Kitchen");
  await panel.locator("#category").fill("Lighting");
  await panel.locator("#qty").fill("3");
  await panel.locator("#markup").fill("20");
  await panel.locator("#delivery").fill("25");

  await panel.locator("#saveLibrary").click();
  await panel.waitForFunction(()=>document.getElementById("status").textContent.includes("product library"));
  await panel.locator("#save").click();
  await panel.waitForFunction(()=>document.getElementById("status").textContent.includes("Added"));
  await liveQuote.waitForFunction(()=>document.getElementById("itemCount")?.textContent?.startsWith("1 "));

  const stored=await panel.evaluate(async()=>chrome.storage.local.get(["cc_projects","cc_library","cc_usage_v1"]));
  assert.equal(stored.cc_projects[0].items[0].brand,"Northstar Lighting");
  assert.equal(stored.cc_projects[0].items[0].images.length,1);
  assert.equal(stored.cc_projects[0].items[0].supplierDiscount,0);
  assert.equal(stored.cc_library.length,1);
  assert.equal(stored.cc_usage_v1.clips,1);

  await panel.setViewportSize({width:320,height:720});
  assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  await panel.setViewportSize({width:400,height:800});
  await panel.screenshot({path:path.join(artifacts,"side-panel-v1-400x800.png"),fullPage:false});

  await panel.close();await liveQuote.close();await product.close();
}

async function seedPro(quote){
  const now=Date.now();
  await setPlan(quote,"pro");
  await quote.evaluate(async(now)=>{
    await chrome.storage.local.set({
      cc_projects:[{
        id:"pro_project",name:"Kitchen Renovation",client:"Demo Client",clientEmail:"client@example.com",jobAddress:"14 Demo Street\nSample City",
        currency:"USD",quoteNumber:"EST-PRO-001",validUntil:"2026-11-05",notes:"Materials subject to final site measurement.",
        labor:0,laborItems:[],taxPercent:10,discount:20,acceptanceStatus:"draft",createdAt:now,updatedAt:now,
        items:[{id:"pro_item",title:"Brushed Brass Pendant",sku:"QA-128",brand:"Northstar",model:"PD-900",material:"Brass",finish:"Brushed",color:"Brass",dimensions:"18 in x 12 in",upc:"",availability:"In Stock",
          url:"https://example.com/product",image:"",images:[],supplier:"Demo Lighting",room:"Kitchen",category:"Lighting",cost:100,supplierDiscount:10,qty:2,markup:20,delivery:15,orderStatus:"planned",poRef:"",expectedDate:"",clippedAt:now}]
      }],
      cc_library:[{id:"lib_1",title:"Library Pendant",sku:"LIB-1",brand:"Northstar",supplier:"Demo Lighting",currency:"USD",cost:120,images:[],createdAt:now,updatedAt:now}],
      cc_labor_rates:[{id:"rate_1",name:"Electrician",rate:50,unit:"hour",createdAt:now}],
      cc_suppliers:[{id:"supplier_1",name:"Demo Lighting",host:"example.com",defaultMarkup:25,defaultDiscount:10,defaultDelivery:15,lastUsedAt:now}],
      cc_assemblies:[],cc_quote_templates:[],
      cc_brand:{business:"Northstar Contracting",email:"quotes@example.com",phone:"+1 555 0100",website:"northstar.example",logoDataUrl:""}
    });
  },now);
}

async function testProWorkflow(context,id){
  const quote=await context.newPage();
  await quote.goto(`chrome-extension://${id}/quote.html`);
  await seedPro(quote);
  await quote.reload();
  await quote.waitForFunction(()=>document.getElementById("exportCsv")?.disabled===false);
  assert.equal(await quote.locator("#brandBusiness").isDisabled(),false);
  assert.equal(await quote.locator("#newProject").isDisabled(),false);
  assert.equal(await quote.locator("#total").textContent(),"$232.10");

  await quote.waitForFunction(()=>document.querySelectorAll("#laborRatePicker option").length>=2);
  await quote.locator("#laborRatePicker").selectOption("rate_1");
  await quote.locator("#laborHours").fill("3");
  await quote.locator("#addLaborLine").click();
  await quote.waitForFunction(()=>document.getElementById("laborTotal")?.textContent==="$150.00");
  assert.equal(await quote.locator("#total").textContent(),"$397.10");

  await quote.locator("#brandLogoInput").setInputFiles(path.join(root,"assets","icons","icon128.png"));
  await quote.waitForFunction(()=>document.getElementById("brandLogo")?.style.display==="block");

  const tools=await context.newPage();
  await tools.goto(`chrome-extension://${id}/workspace.html`);
  await waitPlan(tools,"pro");
  assert.match(await tools.locator("#libraryList").textContent(),/Library Pendant/);
  assert.match(await tools.locator("#laborList").textContent(),/Electrician/);

  await tools.locator("#assemblySource").selectOption("pro_project");
  await tools.locator("#assemblyName").fill("Pendant install package");
  await tools.locator("#saveAssembly").click();
  await tools.waitForFunction(()=>document.getElementById("assemblyList")?.textContent?.includes("Pendant install package"));

  await tools.locator("#templateSource").selectOption("pro_project");
  await tools.locator("#templateName").fill("Residential standard");
  await tools.locator("#saveTemplate").click();
  await tools.waitForFunction(()=>document.getElementById("templateList")?.textContent?.includes("Residential standard"));

  const csvPromise=quote.waitForEvent("download");
  await quote.locator("#exportCsv").click();
  const csv=await csvPromise;const csvPath=path.join(artifacts,"pro-estimate.csv");await csv.saveAs(csvPath);
  const csvText=fs.readFileSync(csvPath,"utf8");
  assert.match(csvText,/Supplier discount %/);
  assert.match(csvText,/Northstar/);
  assert.match(csvText,/Brushed/);

  const xmlPromise=quote.waitForEvent("download");
  await quote.locator("#exportExcel").click();
  const xml=await xmlPromise;const xmlPath=path.join(artifacts,"pro-estimate.xml");await xml.saveAs(xmlPath);
  assert.match(fs.readFileSync(xmlPath,"utf8"),/<Workbook/);

  const backupPromise=quote.waitForEvent("download");
  await quote.locator("#backupJson").click();
  const backup=await backupPromise;const backupPath=path.join(artifacts,"workspace-backup.json");await backup.saveAs(backupPath);
  const backupJson=JSON.parse(fs.readFileSync(backupPath,"utf8"));
  assert.equal(backupJson.data.cc_license_v1,undefined);
  assert.equal(backupJson.data.cc_entitlement_v1,undefined);
  assert.equal(backupJson.data.cc_library.length,1);
  assert.equal(backupJson.data.cc_labor_rates.length,1);

  await quote.screenshot({path:path.join(artifacts,"store-screenshot-v1-1280x800.png"),fullPage:false});
  await tools.close();await quote.close();
}

async function testBusinessWorkflow(context,id){
  const quote=await context.newPage();
  await quote.goto(`chrome-extension://${id}/quote.html`);
  await setPlan(quote,"business");
  await quote.reload();
  await quote.waitForFunction(()=>document.querySelector('[data-pro-field="orderStatus"]')!==null);
  assert.equal(await quote.locator("#exportApproval").isHidden(),false);

  await quote.locator('[data-pro-field="orderStatus"]').selectOption("ordered");
  await quote.locator('[data-pro-field="poRef"]').fill("PO-2026-001");
  await quote.locator('[data-pro-field="poRef"]').blur();
  await quote.locator('[data-pro-field="expectedDate"]').fill("2026-10-20");
  await quote.locator('[data-pro-field="expectedDate"]').blur();
  await quote.waitForTimeout(250);

  const stored=await quote.evaluate(async()=>chrome.storage.local.get("cc_projects"));
  assert.equal(stored.cc_projects[0].items[0].orderStatus,"ordered");
  assert.equal(stored.cc_projects[0].items[0].poRef,"PO-2026-001");
  assert.equal(stored.cc_projects[0].items[0].expectedDate,"2026-10-20");

  const approvalPromise=quote.waitForEvent("download");
  await quote.locator("#exportApproval").click();
  const approval=await approvalPromise;const approvalPath=path.join(artifacts,"client-approval.html");await approval.saveAs(approvalPath);
  const approvalHtml=fs.readFileSync(approvalPath,"utf8");
  assert.match(approvalHtml,/Accept estimate/);
  assert.match(approvalHtml,/quoteHash/);
  assert.doesNotMatch(approvalHtml,/supplierDiscount|Supplier price|Markup/);

  const project=await quote.evaluate(async()=>(await chrome.storage.local.get("cc_projects")).cc_projects[0]);
  assert.match(project.acceptanceHash,/^[a-f0-9]{64}$/);
  const receiptPath=path.join(artifacts,"accepted-response.json");
  fs.writeFileSync(receiptPath,JSON.stringify({
    product:"Contractor Clipper",version:1,projectId:project.id,quoteNumber:project.quoteNumber,projectName:project.name,client:project.client,
    decision:"accepted",name:"Demo Client",timestamp:new Date().toISOString(),quoteHash:project.acceptanceHash
  },null,2));
  quote.once("dialog",dialog=>dialog.accept());
  await quote.locator("#acceptanceInput").setInputFiles(receiptPath);
  await quote.waitForFunction(()=>document.getElementById("acceptanceSummary")?.textContent?.includes("Accepted"));
  const accepted=await quote.evaluate(async()=>(await chrome.storage.local.get("cc_projects")).cc_projects[0]);
  assert.equal(accepted.acceptanceStatus,"accepted");
  assert.equal(accepted.acceptanceBy,"Demo Client");

  await quote.emulateMedia({media:"print"});
  const printVisibility=await quote.evaluate(()=>({
    cost:getComputedStyle([...document.querySelectorAll("th")].find(th=>th.textContent.trim()==="Cost")).display,
    markup:getComputedStyle([...document.querySelectorAll("th")].find(th=>th.textContent.trim()==="Markup")).display
  }));
  assert.equal(printVisibility.cost,"none");assert.equal(printVisibility.markup,"none");
  await quote.pdf({path:path.join(artifacts,"business-client-estimate.pdf"),format:"A4",printBackground:true});
  await quote.emulateMedia({media:"screen"});

  const tools=await context.newPage();
  await tools.goto(`chrome-extension://${id}/workspace.html`);
  await waitPlan(tools,"business");
  assert.match(await tools.locator("#planStatus").textContent(),/Business is active/);
  await tools.close();await quote.close();
}

async function testPersistence(context,id){
  const quote=await context.newPage();
  await quote.goto(`chrome-extension://${id}/quote.html`);
  await quote.waitForFunction(()=>document.getElementById("projectName")?.value==="Kitchen Renovation");
  const data=await quote.evaluate(async()=>chrome.storage.local.get(["cc_projects","cc_assemblies","cc_quote_templates"]));
  assert.equal(data.cc_projects[0].acceptanceStatus,"accepted");
  assert.equal(data.cc_projects[0].items[0].poRef,"PO-2026-001");
  assert.equal(data.cc_projects[0].laborItems.length,1);
  assert.equal(data.cc_assemblies.length,1);
  assert.equal(data.cc_quote_templates.length,1);
  await quote.close();
}

async function testRealSuppliers(context){
  const extractor=fs.readFileSync(path.join(root,"lib","extractor.js"),"utf8");
  const candidates=[
    ["IKEA","https://www.ikea.com/us/en/p/lampan-table-lamp-white-20055421/"],
    ["Floor & Decor","https://www.flooranddecor.com/ceramic-tile/zellige-oat-ceramic-tile-101130060.html"],
    ["Lamps Plus","https://www.lampsplus.com/p/1-light-matte-black-and-plating-brass-pendant-lamp-with-textured-glass__8733j/"],
    ["Rejuvenation","https://www.rejuvenation.com/products/hood-classic-pendant-012/"],
    ["Pottery Barn","https://www.potterybarn.com/products/carter-pendant-mp/"],
    ["West Elm","https://www.westelm.com/products/5642305/"]
  ];
  const results=[];
  for(const [supplier,url] of candidates){
    const page=await context.newPage();
    try{
      await page.addInitScript({content:extractor});
      const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForTimeout(1800);
      const data=await page.evaluate(()=>globalThis.ContractorClipperExtractor?.extract(document,location));
      const status=response?.status();const title=String(data?.title||"").trim();
      const ok=Boolean(status>=200&&status<400&&title&&title!=="Untitled product"&&!/error page|access denied|forbidden|www\./i.test(title)&&(String(data?.sku||"").trim()||String(data?.priceRaw||"").trim())&&data?.url?.startsWith("http"));
      results.push({supplier,url,status,ok,data});
    }catch(error){results.push({supplier,url,ok:false,error:String(error?.message||error)});}
    finally{await page.close();}
  }
  fs.writeFileSync(path.join(artifacts,"real-supplier-extraction-v1.json"),JSON.stringify(results,null,2));
  const domains=new Set(results.filter(r=>r.ok).map(r=>new URL(r.url).hostname));
  assert.ok(domains.size>=3,`only ${domains.size} genuine supplier domains passed v1 extraction QA`);
}

async function main(){
  const server=await serveFixture();let context;
  try{
    context=await launch();const worker=await workerFor(context);const id=new URL(worker.url()).host;
    fs.writeFileSync(path.join(artifacts,"extension-id.txt"),id);
    await testManifest(context,worker);
    await testFreePlan(context,id);
    await testRichScan(context,id);
    await testProWorkflow(context,id);
    await testBusinessWorkflow(context,id);
    await testRealSuppliers(context);
    await context.close();

    context=await launch();const worker2=await workerFor(context);const id2=new URL(worker2.url()).host;
    await testPersistence(context,id2);
    fs.writeFileSync(path.join(artifacts,"v1-browser-qa-result.txt"),
      "PASS\nMV3 + least privilege verified\nFree limits verified\nRich scan and multi-image extraction verified\nPro libraries/labour/branding/exports verified\nBusiness procurement and client approval verified\nWorkspace backup excludes license\nPrint privacy verified\nReal supplier extraction passed on at least 3 domains\nPersistence across browser relaunch verified\n");
  }finally{if(context)await context.close().catch(()=>{});server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
