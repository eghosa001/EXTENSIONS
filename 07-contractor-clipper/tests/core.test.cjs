const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../lib/core.js");

test("parses supplier money formats", () => {
  assert.equal(core.parseMoney("$1,299.50"), 1299.5);
  assert.equal(core.parseMoney("€1.299,50"), 1299.5);
  assert.equal(core.parseMoney("₦25,000"), 25000);
});

test("normalizes unsafe quote inputs", () => {
  assert.equal(core.sellUnit({ cost: 100, markup: -50 }), 100);
  assert.equal(core.lineTotal({ cost: 100, markup: 25, qty: 4, delivery: -10 }), 500);
  assert.equal(core.currencyCode("usd"), "USD");
  assert.equal(core.currencyCode("US$"), "USD");
});

test("separates product and delivery totals", () => {
  const totals = core.quoteTotals({
    items: [{ cost: 100, markup: 20, qty: 2, delivery: 20 }],
    labor: 50,
    discount: 10,
    taxPercent: 10
  });
  assert.deepEqual(totals, {
    products: 240, delivery: 20, materials: 260, labor: 50,
    discount: 10, subtotal: 300, tax: 30, total: 330
  });
});

test("blocks unsafe URLs and creates real SpreadsheetML", () => {
  assert.equal(core.safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(core.safeHttpUrl("https://example.com/a"), "https://example.com/a");
  const xml = core.spreadsheetXml([["Item", "Total"], ["Tile", 125]], "Quote");
  assert.match(xml, /<Workbook/);
  assert.match(xml, /ss:Type="Number">125/);
});
