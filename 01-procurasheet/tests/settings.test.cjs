const test=require("node:test");
const assert=require("node:assert/strict");
const settings=require("../lib/settings.js");

test("settings backup round-trips supplier templates",()=>{
  const templates={"acme wholesale":{mappingHeaders:{sku:"sku",quantity:"qty"},skuMap:{"SUP-1":"SHOP-1"},headerIndex:2,updatedAt:1}};
  const backup=settings.createBackup(templates,123);
  assert.equal(backup.product,"ProcuraSheet");
  assert.equal(backup.schemaVersion,1);
  assert.deepEqual(settings.validateBackup(backup),templates);
});

test("settings restore rejects wrong products and oversized template sets",()=>{
  assert.throws(()=>settings.validateBackup({product:"Other",schemaVersion:1,templates:{}}),/ProcuraSheet/);
  const templates={};
  for(let i=0;i<501;i++) templates["supplier-"+i]={mappingHeaders:{},skuMap:{},headerIndex:0};
  assert.throws(()=>settings.validateBackup({product:"ProcuraSheet",schemaVersion:1,templates}),/too many/i);
});

test("settings restore strips prototype-pollution keys",()=>{
  const payload=JSON.parse('{"product":"ProcuraSheet","schemaVersion":1,"templates":{"safe":{"mappingHeaders":{"sku":"sku"},"skuMap":{"__proto__":"BAD","SUP":"SHOP"},"headerIndex":0}}}');
  const restored=settings.validateBackup(payload);
  assert.equal(restored.safe.skuMap.SUP,"SHOP");
  assert.equal(Object.prototype.BAD,undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(restored.safe.skuMap,"__proto__"),false);
});
