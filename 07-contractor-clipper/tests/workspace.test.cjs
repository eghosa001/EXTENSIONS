const test=require("node:test");
const assert=require("node:assert/strict");
global.ContractorClipperCore=require("../lib/core.js");
const ws=require("../lib/workspace.js");

test("supplier defaults and supplier discounts affect sell price safely",()=>{
  const item=ws.applySupplierDefaults({cost:100,markup:0,delivery:0,supplierDiscount:0},{defaultMarkup:25,defaultDelivery:10,defaultDiscount:10,defaultCategory:"Lighting",defaultRoom:"Kitchen"});
  assert.equal(item.markup,25);
  assert.equal(item.delivery,10);
  assert.equal(item.supplierDiscount,10);
  assert.equal(item.category,"Lighting");
  assert.equal(item.room,"Kitchen");
  assert.equal(ws.effectiveCost(item),90);
  assert.equal(ws.sellUnit(item),112.5);
});

test("itemized labour is used in quote totals",()=>{
  const totals=ws.quoteTotals({items:[{cost:100,supplierDiscount:10,markup:20,qty:2,delivery:15}],laborItems:[{hours:3,rate:50}],discount:20,taxPercent:10});
  assert.equal(totals.products,216);
  assert.equal(totals.delivery,15);
  assert.equal(totals.labor,150);
  assert.equal(totals.subtotal,361);
  assert.equal(totals.tax,36.1);
  assert.equal(totals.total,397.1);
});

test("library normalization blocks unsafe URLs and caps images",()=>{
  const item=ws.normalizeLibraryItem({title:"Lamp",url:"javascript:alert(1)",images:["https://a.test/1.jpg","javascript:x"],supplierDiscount:200});
  assert.equal(item.url,"");
  assert.deepEqual(item.images,["https://a.test/1.jpg"]);
  assert.equal(item.supplierDiscount,100);
});

test("client response must belong to current project",()=>{
  const project={id:"p1",quoteNumber:"EST-1",name:"Kitchen",client:"Ada"};
  const receipt=ws.makeAcceptanceReceipt(project,"accepted","Ada",0);
  assert.equal(receipt.decision,"accepted");
  assert.equal(ws.validAcceptanceReceipt(receipt,project),true);
  assert.equal(ws.validAcceptanceReceipt({...receipt,projectId:"other"},project),false);
});
