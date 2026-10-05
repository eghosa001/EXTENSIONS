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
  assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  assert.match(manifest.content_security_policy.extension_pages, /object-src 'none'/);
});

test("manifest and HTML reference packaged files only", () => {
  const manifest = JSON.parse(read("manifest.json"));
  for (const file of [manifest.background.service_worker, manifest.side_panel.default_path]) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
  for (const html of ["popup.html", "quote.html"]) {
    const source = read(html);
    assert.doesNotMatch(source, /<script(?![^>]*\bsrc=)[^>]*>/i);
    for (const match of source.matchAll(/<script[^>]+src="([^"]+)"/gi)) {
      assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
    }
  }
});

test("runtime contains no remote-code or hidden network primitives", () => {
  const source = ["background.js", "popup.js", "quote.js", "lib/core.js", "lib/extractor.js"]
    .map(read).join("\n");
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(|XMLHttpRequest|WebSocket|\bfetch\s*\(/);
});

test("client print hides internal cost and markup", () => {
  const html = read("quote.html");
  const js = read("quote.js");
  assert.match(html, /<th class="no-print">Cost<\/th>/);
  assert.match(html, /<th class="no-print">Markup<\/th>/);
  assert.match(js, /<td class="no-print"><input data-field="cost"/);
  assert.match(js, /<td class="no-print"><input data-field="markup"/);
});

test("privacy and store docs describe required permissions and current version", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const privacy = read("PRIVACY.md");
  const listing = read("docs/store-listing.md");
  for (const permission of manifest.permissions) assert.ok(privacy.includes(permission), permission);
  assert.ok(listing.includes(manifest.version), manifest.version);
});
