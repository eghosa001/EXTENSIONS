const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");

test("manifest is MV3 with least-privilege billing access",()=>{
  const manifest=JSON.parse(read("manifest.json"));
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.version,"1.1.3");
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

test("extension pricing is USD-first",()=>{
  const html=read("index.html");
  assert.match(html,/id="upgradePro"[^>]*>Pro · ≈\$4\.50\/month<\/button>/);
  assert.match(html,/id="upgradeBusiness"[^>]*>Business · ≈\$9\.80\/month<\/button>/);
  assert.doesNotMatch(html,/₦6,000\/month|₦13,000\/month/);
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


test("popup has a fixed readable width contract",()=>{
  const html=read("popup.html");
  const css=read("styles.css");
  assert.match(html,/class="popup-root"/);
  assert.match(css,/\.popup-root\{width:380px;min-width:380px;max-width:380px/);
  assert.match(css,/\.popup-root \.popup-body\{width:380px;min-width:380px;max-width:380px/);
  assert.doesNotMatch(css,/\.popup-body\{width:100vw\}/);
});


test("v1.1.3 release version is consistent across all public and release-facing surfaces",()=>{
  const manifest=JSON.parse(read("manifest.json"));
  const pkg=JSON.parse(read("package.json"));
  const version=manifest.version;
  assert.equal(version,"1.1.3");
  assert.equal(pkg.version,version);

  const localSurfaces=[
    ["README.md","Version "+version],
    ["PLAN.md","Current release: v"+version],
    ["PRIVACY.md","Version "+version],
    ["docs/privacy.html","Version "+version],
    ["docs/billing-deployment.md","ProcuraSheet v"+version],
    ["docs/release-checklist.md","v"+version],
    ["docs/store-listing.md","v"+version],
    ["popup.html","v"+version],
    ["index.html","v"+version]
  ];
  for(const [file,needle] of localSurfaces){
    assert.ok(read(file).includes(needle),file+" must reflect "+version);
  }

  const siteRoot=path.resolve(root,"..","site","procurasheet");
  for(const file of ["index.html","privacy/index.html","support/index.html","terms/index.html"]){
    const source=fs.readFileSync(path.join(siteRoot,file),"utf8");
    assert.ok(source.includes("v"+version),file+" public site must reflect "+version);
    assert.doesNotMatch(source,/Version 1\.1\.1|v1\.1\.1/);
  }

  const stale=[
    ["README.md",/Version 1\.1\.0/],
    ["PRIVACY.md",/Version 1\.1\.1/],
    ["docs/privacy.html",/Version 1\.0\.0|Version 1\.1\.1/],
    ["docs/store-listing.md",/v1\.1(?!\.2)/],
    ["docs/release-checklist.md",/v1\.1(?!\.2)/]
  ];
  for(const [file,pattern] of stale) assert.doesNotMatch(read(file),pattern,file+" contains a stale version reference");
});
