const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const browsers=["chrome","edge","opera","firefox","safari"];

test("cross-browser build emits all release targets",()=>{
  const source=readJson("manifest.json");
  for(const browser of browsers){
    const dir=path.join(root,"dist",browser);
    assert.ok(fs.existsSync(dir),browser+" build should exist");
    const manifest=readJson(path.join("dist",browser,"manifest.json"));
    assert.equal(manifest.version,source.version);
    assert.equal(manifest.manifest_version,3);
    assert.deepEqual(manifest.permissions,["storage"]);
    assert.deepEqual(manifest.optional_host_permissions,["https://procurasheet-billing.onrender.com/*"]);
    for(const file of ["popup.html","popup.js","index.html","styles.css","app.js","lib","assets","samples"]){
      assert.ok(fs.existsSync(path.join(dir,file)),browser+" should include "+file);
    }
    assert.ok(!fs.existsSync(path.join(dir,"billing")),browser+" package must exclude billing server code");
    assert.ok(!fs.existsSync(path.join(dir,"tests")),browser+" package must exclude tests");
  }
});

test("Chromium-family manifests preserve Chrome compatibility",()=>{
  for(const browser of ["chrome","edge","opera"]){
    const manifest=readJson(path.join("dist",browser,"manifest.json"));
    assert.equal(manifest.minimum_chrome_version,"109");
    assert.ok(!manifest.browser_specific_settings);
  }
});

test("Firefox manifest is ready for AMO signing",()=>{
  const manifest=readJson("dist/firefox/manifest.json");
  assert.ok(!("minimum_chrome_version" in manifest));
  assert.equal(manifest.browser_specific_settings.gecko.id,"procurasheet@procurasheet.onrender.com");
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required,["none"]);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.optional,["authenticationInfo"]);
});

test("Safari source manifest removes Chromium-only minimum version",()=>{
  const manifest=readJson("dist/safari/manifest.json");
  assert.ok(!("minimum_chrome_version" in manifest));
  assert.ok(!manifest.browser_specific_settings);
});
