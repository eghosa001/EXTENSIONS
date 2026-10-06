const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");

test("manifest is MV3 with least-privilege billing access",()=>{
  const manifest=JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.version,"1.1.0");
  assert.deepEqual(manifest.permissions,["storage"]);
  assert.deepEqual(manifest.optional_host_permissions,["https://procurasheet-billing.onrender.com/*"]);
  assert.ok(!manifest.host_permissions);
  assert.equal(manifest.content_security_policy.extension_pages,"script-src 'self'; object-src 'self'");
});

test("package and manifest versions stay aligned",()=>{
  const manifest=JSON.parse(read("manifest.json"));
  const pkg=JSON.parse(read("package.json"));
  assert.equal(pkg.version,manifest.version);
});

test("runtime contains no remote executable code primitives",()=>{
  const files=["app.js","popup.js","lib/table.js","lib/mapping.js","lib/xlsx-lite.js","lib/plans.js","lib/billing-client.js"];
  const source=files.map(read).join("\n");
  assert.doesNotMatch(source,/\beval\s*\(/);
  assert.doesNotMatch(source,/new\s+Function\s*\(/);
  assert.doesNotMatch(source,/<script[^>]+src=["']https?:/i);
});

test("billing and privacy disclosures are present",()=>{
  const privacy=read("PRIVACY.md");
  const listing=read("docs/store-listing.md");
  assert.match(privacy,/license token/i);
  assert.match(privacy,/Paystack/i);
  assert.match(listing,/optional website access/i);
  assert.match(listing,/Free/i);
  assert.match(listing,/Pro/i);
  assert.match(listing,/Business/i);
});

test("release package includes every runtime dependency",()=>{
  for(const file of ["lib/plans.js","lib/billing-client.js","billing/core.cjs","billing/server.cjs"]){
    assert.ok(fs.existsSync(path.join(root,file)),file+" should exist");
  }
});
