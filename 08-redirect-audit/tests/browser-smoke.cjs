const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const PRODUCT_ROOT = path.resolve(__dirname, "..");
const PORT = 8877;
const BASE = `http://127.0.0.1:${PORT}`;

function send(req, res, status, headers = {}, body = "") {
  const bytes = Buffer.from(body);
  res.writeHead(status, { "Content-Length": bytes.length, ...headers });
  if (req.method !== "HEAD") res.end(bytes);
  else res.end();
}

function fixturePage(links) {
  return `<!doctype html><meta charset="utf-8"><title>RedirectAudit Fixtures</title>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("\n")}`;
}

function createFixtureServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, BASE);
    const p = url.pathname;
    if (p === "/matrix") return send(req, res, 200, { "Content-Type": "text/html" }, fixturePage([
      ["/ok", "OK"], ["/one", "301 to OK"], ["/two-a", "Two hop"], ["/notfound", "404"],
      ["/servererror", "500"], ["/loop-a", "Loop"], ["/head405", "HEAD 405 GET 200"], ["mailto:test@example.com", "Mail"]
    ]));
    if (p === "/close") return send(req, res, 200, { "Content-Type": "text/html" }, fixturePage([["/delay-2", "Slow"], ["/ok", "OK"]]));
    if (p === "/cancel") return send(req, res, 200, { "Content-Type": "text/html" }, fixturePage([["/delay-10", "Very slow"], ["/ok", "OK"]]));
    if (p === "/timeout") return send(req, res, 200, { "Content-Type": "text/html" }, fixturePage([["/delay-10", "Timeout"]]));
    if (p === "/ok") return send(req, res, 200, { "Content-Type": "text/plain" }, "ok");
    if (p === "/one") return send(req, res, 301, { Location: "/ok" });
    if (p === "/two-a") return send(req, res, 302, { Location: "/two-b" });
    if (p === "/two-b") return send(req, res, 301, { Location: "/ok" });
    if (p === "/notfound") return send(req, res, 404, { "Content-Type": "text/plain" }, "not found");
    if (p === "/servererror") return send(req, res, 500, { "Content-Type": "text/plain" }, "error");
    if (p === "/loop-a") return send(req, res, 302, { Location: "/loop-b" });
    if (p === "/loop-b") return send(req, res, 302, { Location: "/loop-a" });
    if (p === "/head405") {
      if (req.method === "HEAD") return send(req, res, 405, { Allow: "GET" });
      return send(req, res, 200, { "Content-Type": "text/plain" }, "get ok");
    }
    if (p === "/delay-2") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return send(req, res, 200, { "Content-Type": "text/plain" }, "slow ok");
    }
    if (p === "/delay-10") {
      await new Promise((resolve) => setTimeout(resolve, 10500));
      if (!res.destroyed) return send(req, res, 200, { "Content-Type": "text/plain" }, "too late");
      return;
    }
    return send(req, res, 404, { "Content-Type": "text/plain" }, "no");
  });
}

function makeTestExtension() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "redirectaudit-ext-"));
  for (const item of ["manifest.json", "background.js", "popup.html", "popup.css", "popup.js", "lib", "assets"]) {
    fs.cpSync(path.join(PRODUCT_ROOT, item), path.join(root, item), { recursive: true });
  }
  const manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = manifest.optional_host_permissions;
  delete manifest.optional_host_permissions;
  manifest.name = "RedirectAudit Browser Smoke";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return root;
}

async function scanState(worker) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await worker.evaluate(async () => (await chrome.storage.local.get("scanState")).scanState || null);
    } catch (error) {
      if (attempt === 1 || !String(error && error.message).includes("Service worker restarted")) throw error;
    }
  }
}

async function waitForState(worker, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await scanState(worker);
    if (state && predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for scan state");
}

async function openPopupForFixture(context, extensionId, fixturePageObject) {
  const popup = await context.newPage();
  const errors = [];
  popup.on("pageerror", (error) => errors.push(String(error)));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(async (fixtureUrl) => {
    const tabs = await chrome.tabs.query({});
    const target = tabs.find((tab) => tab.url === fixtureUrl);
    if (!target) throw new Error(`Fixture tab not found: ${fixtureUrl}`);
    await chrome.tabs.update(target.id, { active: true });
  }, fixturePageObject.url());
  await popup.reload();
  await popup.waitForFunction(() => document.querySelector("#scanButton") && !document.querySelector("#scanButton").disabled);
  return { popup, errors };
}

async function startPopupScan(popup) {
  await popup.evaluate(() => document.querySelector("#scanButton").click());
}

function byPath(state, pathname) {
  return state.results.find((item) => {
    try { return new URL(item.url).pathname === pathname; } catch { return false; }
  });
}

(async () => {
  const server = createFixtureServer();
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const extensionPath = makeTestExtension();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "redirectaudit-profile-"));
  let context;

  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });

    let [worker] = context.serviceWorkers().filter((candidate) => candidate.url().startsWith("chrome-extension://"));
    if (!worker) worker = await context.waitForEvent("serviceworker", { predicate: (candidate) => candidate.url().startsWith("chrome-extension://") });
    const extensionId = worker.url().split("/")[2];
    assert.ok(extensionId, "extension service worker did not provide an extension id");

    const fixture = await context.newPage();
    await fixture.goto(`${BASE}/matrix`);

    const matrix = await openPopupForFixture(context, extensionId, fixture);
    await startPopupScan(matrix.popup);
    const matrixState = await waitForState(worker, (s) => s.status === "complete", 20000);

    assert.equal(matrixState.total, 8, "matrix should scan current page plus seven HTTP links");
    assert.equal(matrixState.results.length, 8);
    assert.equal(byPath(matrixState, "/ok").status, 200);
    assert.equal(byPath(matrixState, "/one").redirects, 1);
    assert.deepEqual(byPath(matrixState, "/one").chain.map((step) => step.status), [301]);
    assert.equal(byPath(matrixState, "/two-a").redirects, 2);
    assert.deepEqual(byPath(matrixState, "/two-a").chain.map((step) => step.status), [302, 301]);
    assert.equal(byPath(matrixState, "/notfound").status, 404);
    assert.equal(byPath(matrixState, "/servererror").status, 500);
    assert.equal(byPath(matrixState, "/loop-a").loop, true);
    assert.equal(byPath(matrixState, "/head405").status, 200, "GET fallback should recover from HEAD 405");

    await matrix.popup.bringToFront();
    await matrix.popup.waitForFunction(() => document.querySelector("#totalCount").textContent === "8");
    assert.equal(await matrix.popup.locator("#brokenCount").textContent(), "3");
    assert.equal(await matrix.popup.locator("#redirectCount").textContent(), "3");
    await matrix.popup.locator('[data-filter="redirects"]').click();
    assert.equal(await matrix.popup.locator(".result").count(), 3);

    const downloadPromise = matrix.popup.waitForEvent("download");
    await matrix.popup.locator("#downloadButton").click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const csv = fs.readFileSync(downloadPath, "utf8");
    assert.match(csv, /Redirect chain|redirect-chain/i);
    assert.match(csv, /\/two-a/);
    assert.deepEqual(matrix.errors, []);
    await matrix.popup.close();

    await fixture.goto(`${BASE}/close`);
    const closeCase = await openPopupForFixture(context, extensionId, fixture);
    await startPopupScan(closeCase.popup);
    await waitForState(worker, (s) => s.status === "running" && s.total === 3);
    await closeCase.popup.close();
    const closedComplete = await waitForState(worker, (s) => s.status === "complete", 8000);
    assert.equal(closedComplete.results.length, 3, "scan should complete after popup closes");

    const restored = await openPopupForFixture(context, extensionId, fixture);
    await restored.popup.bringToFront();
    await restored.popup.waitForFunction(() => document.querySelector("#totalCount").textContent === "3");
    assert.match(await restored.popup.locator("#scanMeta").textContent(), /3 URLs checked/);
    assert.deepEqual(restored.errors, []);
    await restored.popup.close();

    await fixture.goto(`${BASE}/cancel`);
    const cancelCase = await openPopupForFixture(context, extensionId, fixture);
    await startPopupScan(cancelCase.popup);
    await waitForState(worker, (s) => s.status === "running" && s.completed >= 2, 5000);
    await cancelCase.popup.evaluate(() => document.querySelector("#scanButton").click());
    const cancelled = await waitForState(worker, (s) => s.status === "cancelled", 5000);
    assert.ok(cancelled.completed >= 1 && cancelled.completed < cancelled.total);
    await cancelCase.popup.bringToFront();
    await cancelCase.popup.waitForFunction(() => document.querySelector("#notice").textContent.includes("cancelled"));
    assert.deepEqual(cancelCase.errors, []);
    await cancelCase.popup.close();

    await fixture.goto(`${BASE}/timeout`);
    const timeoutCase = await openPopupForFixture(context, extensionId, fixture);
    await startPopupScan(timeoutCase.popup);
    const timeoutState = await waitForState(worker, (s) => s.status === "complete", 15000);
    const timedOut = byPath(timeoutState, "/delay-10");
    assert.equal(timedOut.status, 0);
    assert.equal(timedOut.error, "Timed out");
    assert.deepEqual(timeoutCase.errors, []);
    await timeoutCase.popup.close();

    console.log(JSON.stringify({
      ok: true,
      extensionId,
      matrix: {
        total: matrixState.total,
        redirects: matrixState.results.filter((r) => r.redirects > 0).length,
        broken: matrixState.results.filter((r) => [404, 500].includes(r.status) || r.loop).length
      },
      popupCloseRecovery: true,
      cancellation: true,
      timeout: true,
      csvExport: true
    }, null, 2));
  } finally {
    if (context) await context.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(extensionPath, { recursive: true, force: true });
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
