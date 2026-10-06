const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
function pngSize(file) { const b = fs.readFileSync(path.join(root, file)); assert.equal(b.toString("hex", 0, 8), "89504e470d0a1a0a", `${file} is not PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

test("manifest is MV3 with minimal runtime permissions and optional broad host access", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "storage", "webRequest"].sort());
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
  assert.equal(manifest.host_permissions, undefined);
});
test("declared runtime files and icons exist at their declared sizes", () => {
  for (const file of [manifest.background.service_worker, manifest.action.default_popup]) assert.equal(fs.existsSync(path.join(root, file)), true, `missing ${file}`);
  for (const [size, file] of Object.entries(manifest.icons)) { assert.equal(fs.existsSync(path.join(root, file)), true, `missing ${file}`); assert.deepEqual(pngSize(file), [Number(size), Number(size)]); }
});
test("store listing and release QA documentation are included", () => {
  for (const file of ["STORE_LISTING.md", "QA_CHECKLIST.md", "PRODUCTION_AUDIT.md"]) assert.equal(fs.existsSync(path.join(root, file)), true, `missing ${file}`);
});
