const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {chromium}=require("playwright");

const ROOT=path.resolve(__dirname,"..");

function makeExtensionCopy(){
  const out=fs.mkdtempSync(path.join(os.tmpdir(),"procurasheet-ext-"));
  for(const item of ["manifest.json","popup.html","popup.js","index.html","styles.css","app.js","lib","assets","samples"]){
    fs.cpSync(path.join(ROOT,item),path.join(out,item),{recursive:true});
  }
  const manifestPath=path.join(out,"manifest.json");
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  manifest.name="ProcuraSheet Browser QA";
  manifest.background={service_worker:"qa-worker.js"};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(out,"qa-worker.js"),"chrome.runtime.onInstalled.addListener(()=>{});\n");
  return out;
}

function makeOversizedDeclaredXlsx(source){
  const bytes=fs.readFileSync(source);
  let changed=false;
  for(let i=0;i<=bytes.length-46;i++){
    if(bytes.readUInt32LE(i)===0x02014b50){
      bytes.writeUInt32LE(90*1024*1024,i+24);
      changed=true;
      break;
    }
  }
  assert.equal(changed,true,"fixture ZIP should contain a central-directory entry");
  const out=path.join(os.tmpdir(),"procurasheet-hostile-"+Date.now()+".xlsx");
  fs.writeFileSync(out,bytes);
  return out;
}

function makeXlsxFixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"procurasheet-xlsx-"));
  fs.mkdirSync(path.join(dir,"_rels"),{recursive:true});
  fs.mkdirSync(path.join(dir,"xl","_rels"),{recursive:true});
  fs.mkdirSync(path.join(dir,"xl","worksheets"),{recursive:true});
  fs.writeFileSync(path.join(dir,"[Content_Types].xml"),`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  fs.writeFileSync(path.join(dir,"_rels",".rels"),`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  fs.writeFileSync(path.join(dir,"xl","workbook.xml"),`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Order" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  fs.writeFileSync(path.join(dir,"xl","_rels","workbook.xml.rels"),`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  const rows=[
    ["Supplier export"],
    ["Supplier SKU","Barcode","Quantity","Cost","Tax"],
    ["SUP-X1","123456789012","2","10.50","5"],
    ["SUP-X2","4006381333931","3","9.25","5"]
  ];
  const rowXml=rows.map((row,ri)=>"<row r=\""+(ri+1)+"\">"+row.map((v,ci)=>{
    const col=String.fromCharCode(65+ci);
    return "<c r=\""+col+(ri+1)+"\" t=\"inlineStr\"><is><t>"+v+"</t></is></c>";
  }).join("")+"</row>").join("");
  fs.writeFileSync(path.join(dir,"xl","worksheets","sheet1.xml"),`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`);
  const out=path.join(os.tmpdir(),"procurasheet-fixture-"+Date.now()+".xlsx");
  execFileSync("zip",["-q","-r",out,"[Content_Types].xml","_rels","xl"],{cwd:dir});
  fs.rmSync(dir,{recursive:true,force:true});
  return out;
}

async function loadSample(page){
  await page.locator("#loadSample").click();
  await page.waitForFunction(()=>!document.getElementById("reviewCard").classList.contains("hidden"));
  await page.locator('[data-index="2"][data-field="sku"]').fill("SKU-1003");
  await page.locator('[data-index="2"][data-field="sku"]').blur();
  await page.waitForFunction(()=>!document.getElementById("downloadShopify").disabled);
}

async function exportOnce(page){
  const downloadPromise=page.waitForEvent("download");
  await page.locator("#downloadShopify").click();
  const download=await downloadPromise;
  const p=await download.path();
  const csv=fs.readFileSync(p,"utf8");
  assert.match(csv,/^SKU,Barcode,Supplier SKU,Quantity,Cost,Tax\r?\n/);
  assert.match(csv,/SKU-1003/);
  return csv;
}

(async()=>{
  const ext=makeExtensionCopy();
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),"procurasheet-profile-"));
  const xlsx=makeXlsxFixture();
  const hostileXlsx=makeOversizedDeclaredXlsx(xlsx);
  let context;
  try{
    context=await chromium.launchPersistentContext(profile,{
      channel:"chromium",headless:true,
      args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]
    });
    let [worker]=context.serviceWorkers().filter(w=>w.url().startsWith("chrome-extension://"));
    if(!worker) worker=await context.waitForEvent("serviceworker",{predicate:w=>w.url().startsWith("chrome-extension://")});
    const extensionId=worker.url().split("/")[2];
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await page.waitForSelector("#planBadge");

    assert.match(await page.locator("#planBadge").textContent(),/Free/i);
    assert.match(await page.locator("#usageText").textContent(),/0\s*\/\s*5/i);
    assert.equal(await page.locator("#catalogInput").isDisabled(),true);

    await loadSample(page);
    await exportOnce(page);
    await exportOnce(page);
    await exportOnce(page);
    await exportOnce(page);
    await exportOnce(page);
    await page.waitForFunction(()=>document.getElementById("downloadShopify").disabled);
    assert.match(await page.locator("#usageText").textContent(),/5\s*\/\s*5/i);
    assert.match(await page.locator("#exportSummary").textContent(),/limit|upgrade/i);

    await page.evaluate(async()=>{
      const now=Date.now();
      const month=new Date(now).toISOString().slice(0,7);
      await chrome.storage.local.set({
        ps_entitlement_v1:{plan:"pro",status:"active",expiresAt:now+86400000,checkedAt:now},
        ps_usage_v1:{month,conversions:99}
      });
    });
    await page.reload();
    await page.waitForSelector("#planBadge");
    assert.match(await page.locator("#planBadge").textContent(),/Pro/i);
    assert.match(await page.locator("#usageText").textContent(),/Unlimited/i);
    assert.equal(await page.locator("#catalogInput").isDisabled(),true);
    await loadSample(page);
    assert.equal(await page.locator("#downloadShopify").isDisabled(),false);

    await page.evaluate(async()=>{
      const now=Date.now();
      await chrome.storage.local.set({ps_entitlement_v1:{plan:"business",status:"active",expiresAt:now+86400000,checkedAt:now}});
    });
    await page.reload();
    await page.waitForSelector("#planBadge");
    assert.match(await page.locator("#planBadge").textContent(),/Business/i);
    assert.equal(await page.locator("#catalogInput").isDisabled(),false);

    await page.locator("#resetWorkspace").click().catch(()=>{});
    await page.locator("#fileInput").setInputFiles(xlsx);
    await page.waitForFunction(()=>!document.getElementById("reviewCard").classList.contains("hidden"));
    assert.match(await page.locator("#fileState").textContent(),/2 rows/);
    assert.equal(await page.locator("#headerRow").inputValue(),"2");

    const hostileBase64=fs.readFileSync(hostileXlsx).toString("base64");
    const hostileResult=await page.evaluate(async b64=>{
      const binary=atob(b64);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      try{
        await globalThis.SheetPO.parseXlsx(bytes.buffer);
        return "accepted";
      }catch(error){
        return String(error&&error.message||error);
      }
    },hostileBase64);
    assert.match(hostileResult,/too large|unsafe|limit/i,"XLSX with an oversized declared entry must be rejected");

    await page.setViewportSize({width:320,height:720});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    assert.equal(overflow,false,"app shell should not overflow the viewport");

    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({ok:true,extensionId,freeLimit:true,proUnlimited:true,businessCatalog:true,xlsx:true,hostileXlsxRejected:true,responsive:true},null,2));
  }finally{
    if(context) await context.close();
    fs.rmSync(ext,{recursive:true,force:true});
    fs.rmSync(profile,{recursive:true,force:true});
    fs.rmSync(xlsx,{force:true});
    fs.rmSync(hostileXlsx,{force:true});
  }
})().catch(error=>{console.error(error&&error.stack?error.stack:error);process.exitCode=1;});
