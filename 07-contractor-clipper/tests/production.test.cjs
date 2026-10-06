const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("manifest is least-privilege MV3 and release versions match", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, pkg.version);
  assert.ok(Number(manifest.minimum_chrome_version) >= 114);
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "sidePanel", "storage"].sort());
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ["https://procurasheet-billing.onrender.com/*"]);
  assert.equal(manifest.homepage_url, "https://contractor-clipper.onrender.com/");
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.match(manifest.content_security_policy.extension_pages, /object-src 'none'/);
});

test("manifest, icons and HTML reference packaged files only", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const packaged = [
    manifest.background.service_worker,
    manifest.side_panel.default_path,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {})
  ];
  for (const file of packaged) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
  for (const size of ["16", "32", "48", "128"]) {
    assert.ok(manifest.icons?.[size]?.endsWith(".png"), `missing PNG icon ${size}`);
  }
  for (const html of ["popup.html", "quote.html", "workspace.html"]) {
    const source = read(html);
    assert.doesNotMatch(source, /<script(?![^>]*\bsrc=)[^>]*>/i);
    for (const match of source.matchAll(/<script[^>]+src="([^"]+)"/gi)) {
      assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
    }
  }
});

test("runtime contains no remote code and network is isolated to fixed billing client", () => {
  const localOnly = ["background.js", "popup.js", "quote.js", "quote-pro.js", "workspace.js", "lib/core.js", "lib/extractor.js", "lib/plans.js", "lib/workspace.js"]
    .map(read).join("\n");
  assert.doesNotMatch(localOnly, /\beval\s*\(|new\s+Function\s*\(|XMLHttpRequest|WebSocket|\bfetch\s*\(/);
  const billing = read("lib/billing-client.js");
  assert.match(billing, /const BILLING_ORIGIN="https:\/\/procurasheet-billing\.onrender\.com"/);
  assert.match(billing, /fetch\(BILLING_ORIGIN\+BASE_PATH\+path/);
  assert.doesNotMatch(billing, /\beval\s*\(|new\s+Function\s*\(|XMLHttpRequest|WebSocket/);
});

test("client print hides internal cost and markup", () => {
  const html = read("quote.html");
  const js = read("quote.js");
  assert.match(html, /<th class="no-print">Cost<\/th>/);
  assert.match(html, /<th class="no-print">Markup<\/th>/);
  assert.match(js, /<td class="no-print"><input data-field="cost"/);
  assert.match(js, /<td class="no-print"><input data-field="markup"/);
});

test("privacy and store docs describe permissions, billing boundary and current version", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const privacy = read("PRIVACY.md");
  const listing = read("docs/store-listing.md");
  for (const permission of manifest.permissions) assert.ok(privacy.includes(permission), permission);
  for (const origin of manifest.optional_host_permissions || []) assert.ok(privacy.includes(origin.replace("*","")), origin);
  assert.ok(listing.includes(manifest.version), manifest.version);
  assert.match(privacy, /workspace backups intentionally exclude/i);
  assert.match(listing, /Paystack/i);
});

test("workspace backup never exports paid license or entitlement state", () => {
  const quote = read("quote.js");
  const backupLine = quote.split("\n").find(line => line.includes('chrome.storage.local.get(["cc_projects"'));
  assert.ok(backupLine);
  assert.doesNotMatch(backupLine, /cc_license|cc_entitlement|cc_usage/);
});

test("paid feature pages are packaged and CSP-safe", () => {
  const html = read("workspace.html");
  assert.match(html, /₦4,000/);
  assert.match(html, /₦8,500/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  for (const file of ["lib/plans.js","lib/workspace.js","lib/billing-client.js","workspace.js","quote-pro.js","billing/core.cjs","billing/routes.cjs"]) {
    assert.ok(fs.existsSync(path.join(root,file)), file);
  }
});
