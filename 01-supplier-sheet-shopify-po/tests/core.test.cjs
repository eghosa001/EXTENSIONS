const test=require("node:test");
const assert=require("node:assert/strict");
const table=require("../lib/table.js");
const mapping=require("../lib/mapping.js");

test("parses quoted supplier CSV",()=>{
  const rows=table.parseDelimited('SKU,Description,Qty,Cost\nABC-1,"Large, blue",4,12.50\n');
  assert.deepEqual(rows[1],["ABC-1","Large, blue","4","12.50"]);
});

test("finds a header row below supplier metadata",()=>{
  const rows=[
    ["ACME WHOLESALE PRICE LIST"],
    ["Generated","2026-10-05"],
    ["Item Number","UPC","Order Qty","Net Cost","VAT"],
    ["SUP-1","123456789012","4","12.50","5"]
  ];
  assert.equal(mapping.detectHeaderRow(rows),2);
});

test("auto maps common supplier columns",()=>{
  const map=mapping.autoMap(["Item Number","UPC","Order Qty","Net Cost","VAT"]);
  assert.deepEqual([map.supplierSku,map.barcode,map.quantity,map.cost,map.tax],[0,1,2,3,4]);
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
