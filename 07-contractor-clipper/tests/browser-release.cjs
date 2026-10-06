const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const extensionRoot = process.env.CC_EXTENSION_DIR || root;
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
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
}

async function testSidePanelAndScan(context, worker, extensionId) {
  const manifestState = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const options = await chrome.sidePanel.getOptions({});
    const behavior = await chrome.sidePanel.getPanelBehavior();
    return {
      sidePanelPath: manifest.side_panel?.default_path,
      optionsPath: options.path,
      openPanelOnActionClick: behavior.openPanelOnActionClick,
      permissions: manifest.permissions || [],
      hostPermissions: manifest.host_permissions || []
    };
  });
  assert.equal(manifestState.sidePanelPath, "popup.html");
  assert.equal(manifestState.optionsPath, "popup.html");
  assert.equal(manifestState.openPanelOnActionClick, true);
  assert.ok(manifestState.permissions.includes("activeTab"));
  assert.ok(manifestState.permissions.includes("scripting"));

  const productPage = await context.newPage();
  await productPage.goto("http://127.0.0.1:8765/", { waitUntil: "domcontentloaded" });

  const liveQuote = await context.newPage();
  await liveQuote.goto(`chrome-extension://${extensionId}/quote.html`);
  await liveQuote.waitForSelector("#itemCount");

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/popup.html`);
  await panel.waitForSelector("#scan");
  await productPage.bringToFront();

  await panel.evaluate(() => document.getElementById("scan").click());
  await panel.waitForFunction(() => !document.getElementById("editor").classList.contains("hidden"), null, { timeout: 10000 });

  assert.equal(await panel.locator("#title").inputValue(), "QA Pendant");
  assert.equal(await panel.locator("#sku").inputValue(), "QA-128");
  assert.equal(await panel.locator("#cost").inputValue(), "128.4");
  assert.equal(await panel.locator("#currency").inputValue(), "USD");

  await panel.locator("#supplier").fill("QA Lighting Supply");
  await panel.locator("#room").fill("Kitchen");
  await panel.locator("#category").fill("Lighting");
  await panel.locator("#qty").fill("3");
  await panel.locator("#markup").fill("20");
  await panel.locator("#delivery").fill("25");
  await panel.evaluate(() => document.getElementById("save").click());
  await panel.waitForFunction(() => document.getElementById("status").textContent.includes("Added"));

  const saved = await panel.evaluate(async () => (await chrome.storage.local.get("cc_projects")).cc_projects);
  assert.equal(saved[0].items.length, 1);
  assert.equal(saved[0].items[0].title, "QA Pendant");
  assert.equal(saved[0].items[0].qty, 3);
  assert.equal(saved[0].items[0].supplier, "QA Lighting Supply");

  const suppliers = await panel.evaluate(async () => (await chrome.storage.local.get("cc_suppliers")).cc_suppliers);
  assert.equal(suppliers[0].name, "QA Lighting Supply");
  await liveQuote.waitForFunction(() => document.getElementById("itemCount")?.textContent?.startsWith("1 "));

  await panel.locator("#scan").click();
  await panel.waitForFunction(() => document.getElementById("supplier")?.value === "QA Lighting Supply");

  await panel.setViewportSize({ width: 320, height: 720 });
  await panel.locator("#scan").focus();
  assert.equal(await panel.evaluate(() => document.activeElement?.id), "scan");
  const overflow = await panel.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false);
  await panel.setViewportSize({ width: 400, height: 800 });
  await panel.screenshot({ path: path.join(artifacts, "side-panel-qa-400x800.png"), fullPage: false });

  await panel.close();
  await liveQuote.close();
  await productPage.close();
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
  await quote.waitForFunction(() => document.getElementById("projectName")?.value === "Kitchen Renovation");

  assert.equal(await quote.locator("#total").textContent(), "$953.53");
  assert.equal(await quote.locator("#printQuoteNumber").textContent(), "EST-QA-001");
  assert.equal(await quote.locator("#printClient").textContent(), "Prepared for Demo Client");
  assert.equal(await quote.locator("#printClientEmail").textContent(), "client@example.com");
  assert.match(await quote.locator("#printJobAddress").textContent(), /14 Demo Street/);
  assert.match(await quote.locator("#printValidUntil").textContent(), /Valid until/);
  assert.match(await quote.locator("#printNotes").textContent(), /Materials subject/);

  await quote.locator("#brandLogoInput").setInputFiles(path.join(root, "assets", "icons", "icon128.png"));
  await quote.waitForFunction(() => document.getElementById("brandLogo")?.style.display === "block");
  assert.ok((await quote.locator("#brandLogo").getAttribute("src"))?.startsWith("data:image/png;base64,"));

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

  await quote.locator("#projectName").fill("Changed After Backup");
  await quote.locator("#projectName").blur();
  await quote.waitForFunction(() => document.getElementById("printProjectName")?.textContent === "Changed After Backup");
  quote.once("dialog", (dialog) => dialog.accept());
  await quote.locator("#importBackupInput").setInputFiles(backupPath);
  await quote.waitForFunction(() => document.getElementById("projectName")?.value === "Kitchen Renovation");

  quote.once("dialog", (dialog) => dialog.accept("Bathroom Refresh"));
  await quote.locator("#newProject").click();
  await quote.waitForFunction(() => document.getElementById("projectName")?.value === "Bathroom Refresh");
  const projectCountAfterCreate = await quote.locator("#projectPicker option").count();
  assert.equal(projectCountAfterCreate, 2);

  await quote.locator("#duplicateProject").click();
  await quote.waitForFunction(() => document.getElementById("projectName")?.value === "Bathroom Refresh Copy");
  assert.equal(await quote.locator("#projectPicker option").count(), 3);

  quote.once("dialog", (dialog) => dialog.accept());
  await quote.locator("#deleteProject").click();
  await quote.waitForFunction(() => document.querySelectorAll("#projectPicker option").length === 2);

  await quote.locator("#projectPicker").selectOption("qa_project");
  await quote.waitForFunction(() => document.getElementById("projectName")?.value === "Kitchen Renovation");

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
    ["Lamps Plus", "https://www.lampsplus.com/p/1-light-matte-black-and-plating-brass-pendant-lamp-with-textured-glass__8733j/"],
    ["Rejuvenation", "https://www.rejuvenation.com/products/hood-classic-pendant-012/"],
    ["Pottery Barn", "https://www.potterybarn.com/products/carter-pendant-mp/"],
    ["West Elm", "https://www.westelm.com/products/5642305/"]
  ];
  const results = [];

  for (const [supplier, url] of candidates) {
    const page = await context.newPage();
    try {
      await page.addInitScript({ content: extractor });
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1800);
      const data = await page.evaluate(() => globalThis.ContractorClipperExtractor?.extract(document, location));
      const status = response?.status();
      const title = String(data?.title || "").trim();
      const statusOk = Number.isInteger(status) && status >= 200 && status < 400;
      const titleOk = Boolean(
        title &&
        title !== "Untitled product" &&
        !/error page|access denied|forbidden|www\./i.test(title)
      );
      const productSignal = Boolean(
        String(data?.sku || "").trim() ||
        String(data?.priceRaw || "").trim()
      );
      const ok = Boolean(
        statusOk &&
        titleOk &&
        productSignal &&
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
  assert.ok(passingDomains.size >= 3, `only ${passingDomains.size} genuine real supplier product domains passed extraction smoke QA`);
}

async function main() {
  const server = await serveFixture();
  let context;
  try {
    context = await launch();
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    fs.writeFileSync(path.join(artifacts, "extension-id.txt"), extensionId);

    await testSidePanelAndScan(context, worker, extensionId);
    await testWorkspace(context, extensionId);
    await testRealSupplierExtraction(context);

    await context.close();
    context = await launch();
    const worker2 = await extensionWorker(context);
    const extensionId2 = new URL(worker2.url()).host;
    const quote = await context.newPage();
    await quote.goto(`chrome-extension://${extensionId2}/quote.html`);
    await quote.waitForFunction(() => document.getElementById("projectName")?.value === "Kitchen Renovation");
    assert.equal(await quote.locator("#projectName").inputValue(), "Kitchen Renovation");
    fs.writeFileSync(path.join(artifacts, "browser-qa-result.txt"),
      "PASS\nLoaded unpacked extension in Chromium\nSide panel registration validated\nScan/Add flow validated in localhost-only QA copy\nExports opened and validated\nPrint privacy validated\nStorage persisted across browser relaunch\n");
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
