const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("manifest stays least-privilege and side-panel based", () => {
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "sidePanel", "storage"].sort());
  assert.equal(manifest.host_permissions, undefined);
});

test("release UI contains required estimating controls", () => {
  const side = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const quote = fs.readFileSync(path.join(root, "quote.html"), "utf8");
  for (const id of ["supplier", "room", "category", "imageChoices", "project", "markup"]) assert.match(side, new RegExp(`id="${id}"`));
  for (const id of ["delivery", "companyLogo", "exportCsv", "exportExcel", "printQuote", "supplierManager"]) assert.match(quote, new RegExp(`id="${id}"`));
});
