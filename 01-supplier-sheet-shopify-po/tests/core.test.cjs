const test=require("node:test");
const assert=require("node:assert/strict");
const table=require("../lib/table.js");
const mapping=require("../lib/mapping.js");

test("parses quoted supplier CSV",()=>{
  const rows=table.parseDelimited('SKU,Description,Qty,Cost\nABC-1,"Large, blue",4,12.50\n');
  assert.deepEqual(rows[1],["ABC-1","Large, blue","4","12.50"]);
});

test("auto maps common supplier columns",()=>{
  const map=mapping.autoMap(["Item Number","UPC","Order Qty","Net Cost","VAT"]);
  assert.equal(map.supplierSku,0);
  assert.equal(map.barcode,1);
  assert.equal(map.quantity,2);
  assert.equal(map.cost,3);
  assert.equal(map.tax,4);
});

test("blocks rows Shopify cannot import safely",()=>{
  const checked=mapping.validateRows([
    {sourceRow:2,sku:"",barcode:"",supplierSku:"SUP-1",quantity:5,cost:2,tax:""},
    {sourceRow:3,sku:"A-1",barcode:"",supplierSku:"SUP-2",quantity:0,cost:2,tax:""}
  ]);
  assert.equal(checked[0].status,"blocked");
  assert.equal(checked[1].status,"blocked");
});

test("emits Shopify PO headers exactly",()=>{
  const rows=mapping.shopifyRows([{sku:"A",barcode:"123",supplierSku:"S",quantity:3,cost:4.5,tax:5}]);
  assert.deepEqual(rows[0],["SKU","Barcode","Supplier SKU","Quantity","Cost","Tax"]);
});
