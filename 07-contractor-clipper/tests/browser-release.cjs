const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "qa-artifacts");
const profile = path.join(root, ".qa-chrome-profile");
fs.rmSync(artifacts, { recursive: true, force: true });
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(artifacts, { recursive: true });

function serveFixture() {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "product.html"));
  const server = http.createServer((req, res) => {
    if (req.url === "/qa-pendant.jpg") {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#ddd"/></svg>');
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(8765, "127.0.0.1", () => resolve(server)));
}

async function extensionWorker(context) {
  let worker = context.serviceWorkers().find((w) => w.url().startsWith("chrome-extension://"));
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  assert.match(worker.url(), /^chrome-extension:\/\//);
  return worker;
}

function launch() {
  return chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
}

async function testActionAndActiveTab(context, worker) {
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });
  await page.bringToFront();

  execFileSync("bash", ["-lc", "xdotool search --name 'QA Pendant' windowactivate --sync key ctrl+shift+y"], {
    stdio: "inherit"
  });
  await page.waitForTimeout(1200);

  const injectedTitle = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.title
    });
    return result[0]?.result;
  });
  assert.equal(injectedTitle, "QA Pendant | Test Supplier");

  const browser = context.browser();
  const cdp = await browser.newBrowserCDPSession();
  const targets = await cdp.send("Target.getTargets");
  const sidePanel = targets.targetInfos.find((target) =>
    target.url.includes("chrome-extension://") && target.url.endsWith("/popup.html")
  );
  assert.ok(sidePanel, "toolbar/keyboard action did not open the side-panel page");

  await page.close();
}

async function testWorkspace(context, extensionId) {
  const quote = await context.newPage();
  await quote.goto(`chrome-extension://${extensionId}/quote.html`);
  await quote.evaluate(async () => {
    const now = Date.now();
    await chrome.storage.local.set({
      cc_projects: [{
        id: "qa_project",
        name: "Kitchen Renovation",
        client: "Demo Client",
        clientEmail: "client@example.com",
        jobAddress: "14 Demo Street\nSample City",
        currency: "USD",
        quoteNumber: "EST-QA-001",
        validUntil: "2026-11-05",
        notes: "Materials subject to final site measurement.\nEstimate valid for 30 days.",
        labor: 250,
        taxPercent: 7.5,
        discount: 50,
        createdAt: now,
        updatedAt: now,
        items: [{
          id: "qa_item",
          title: "Brushed Brass Pendant Light",
          sku: "QA-128",
          url: "https://example.com/product",
          image: "",
          supplier: "Demo Lighting",
          room: "Kitchen",
          category: "Lighting",
          cost: 128.4,
          qty: 4,
          markup: 25,
          delivery: 45,
          clippedAt: now
        }]
      }],
      cc_suppliers: [{ id: "supplier_qa", name: "Demo Lighting", host: "example.com", lastUsedAt: now }],
      cc_brand: {
        business: "Northstar Contracting",
        email: "quotes@example.com",
        phone: "+1 555 0100",
        website: "northstar.example",
        logoDataUrl: ""
      }
    });
  });
  await quote.reload();
  await quote.waitForSelector('text=Kitchen Renovation');

  assert.equal(await quote.locator("#total").textContent(), "$1,176.90");
  assert.equal(await quote.locator("#printQuoteNumber").textContent(), "EST-QA-001");

  await quote.screenshot({
    path: path.join(artifacts, "store-screenshot-quote-1280x800.png"),
    fullPage: false
  });

  const csvPromise = quote.waitForEvent("download");
  await quote.locator("#exportCsv").click();
  const csvDownload = await csvPromise;
  const csvPath = path.join(artifacts, "qa-estimate.csv");
  await csvDownload.saveAs(csvPath);
  assert.match(fs.readFileSync(csvPath, "utf8"), /Brushed Brass Pendant Light/);

  const xmlPromise = quote.waitForEvent("download");
  await quote.locator("#exportExcel").click();
  const xmlDownload = await xmlPromise;
  const xmlPath = path.join(artifacts, "qa-estimate.xml");
  await xmlDownload.saveAs(xmlPath);
  const xml = fs.readFileSync(xmlPath, "utf8");
  assert.match(xml, /<Workbook/);
  assert.match(xml, /Brushed Brass Pendant Light/);

  const backupPromise = quote.waitForEvent("download");
  await quote.locator("#backupJson").click();
  const backup = await backupPromise;
  const backupPath = path.join(artifacts, "contractor-clipper-backup.json");
  await backup.saveAs(backupPath);
  const backupJson = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  assert.equal(backupJson.product, "Contractor Clipper");
  assert.equal(backupJson.data.cc_projects[0].name, "Kitchen Renovation");

  await quote.emulateMedia({ media: "print" });
  const printVisibility = await quote.evaluate(() => ({
    cost: getComputedStyle([...document.querySelectorAll("th")].find((th) => th.textContent.trim() === "Cost")).display,
    markup: getComputedStyle([...document.querySelectorAll("th")].find((th) => th.textContent.trim() === "Markup")).display
  }));
  assert.equal(printVisibility.cost, "none");
  assert.equal(printVisibility.markup, "none");

  await quote.pdf({
    path: path.join(artifacts, "qa-client-estimate.pdf"),
    format: "A4",
    printBackground: true
  });
  assert.ok(fs.statSync(path.join(artifacts, "qa-client-estimate.pdf")).size > 1000);
  await quote.emulateMedia({ media: "screen" });

  await quote.close();
}

async function testRealSupplierExtraction(context) {
  const extractor = fs.readFileSync(path.join(root, "lib", "extractor.js"), "utf8");
  const candidates = [
    ["IKEA", "https://www.ikea.com/us/en/p/lampan-table-lamp-white-20055421/"],
    ["Floor & Decor", "https://www.flooranddecor.com/ceramic-tile/zellige-oat-ceramic-tile-101130060.html"],
    ["Ace Hardware", "https://www.acehardware.com/p/9086402"],
    ["Home Depot", "https://www.homedepot.com/b/Lighting-Pendant-Lights/Hampton-Bay/Hardwired/N-5yc1vZc7nuZp4Z1z1x4ku"],
    ["Wayfair", "https://www.wayfair.com/keyword.php?filters=masterClID~6087&keyword=spiral+led+pendant+light+fixture"]
  ];
  const results = [];

  for (const [supplier, url] of candidates) {
    const page = await context.newPage();
    try {
      await page.addInitScript({ content: extractor });
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1800);
      const data = await page.evaluate(() => globalThis.ContractorClipperExtractor?.extract(document, location));
      const ok = Boolean(
        response &&
        response.status() < 500 &&
        data?.title &&
        data.title !== "Untitled product" &&
        data?.url?.startsWith("http")
      );
      results.push({ supplier, url, status: response?.status(), ok, data });
    } catch (error) {
      results.push({ supplier, url, ok: false, error: String(error?.message || error) });
    } finally {
      await page.close();
    }
  }

  fs.writeFileSync(path.join(artifacts, "real-supplier-extraction.json"), JSON.stringify(results, null, 2));
  const passingDomains = new Set(results.filter((result) => result.ok).map((result) => new URL(result.url).hostname));
  assert.ok(passingDomains.size >= 3, `only ${passingDomains.size} real supplier domains passed extraction smoke QA`);
}

async function main() {
  const server = await serveFixture();
  let context;
  try {
    context = await launch();
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    fs.writeFileSync(path.join(artifacts, "extension-id.txt"), extensionId);

    await testActionAndActiveTab(context, worker);
    await testWorkspace(context, extensionId);
    await testRealSupplierExtraction(context);

    await context.close();
    context = await launch();
    const worker2 = await extensionWorker(context);
    const extensionId2 = new URL(worker2.url()).host;
    const quote = await context.newPage();
    await quote.goto(`chrome-extension://${extensionId2}/quote.html`);
    await quote.waitForSelector('text=Kitchen Renovation');
    assert.equal(await quote.locator("#projectName").inputValue(), "Kitchen Renovation");
    fs.writeFileSync(path.join(artifacts, "browser-qa-result.txt"),
      "PASS\nLoaded unpacked extension\nAction shortcut granted activeTab\nSide panel target opened\nExports opened and validated\nPrint privacy validated\nStorage persisted across browser relaunch\n");
    await quote.close();
  } finally {
    if (context) await context.close().catch(() => {});
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
