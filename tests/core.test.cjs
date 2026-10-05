const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../lib/core.js");

test("parses common supplier prices", () => {
  assert.equal(core.parseMoney("$1,299.50"), 1299.5);
  assert.equal(core.parseMoney("€1.299,50"), 1299.5);
  assert.equal(core.parseMoney("₦25,000"), 25000);
});

test("applies markup and quantity", () => {
  const item = { cost: 100, markup: 25, qty: 4 };
  assert.equal(core.sellUnit(item), 125);
  assert.equal(core.lineTotal(item), 500);
});

test("calculates quote totals", () => {
  const totals = core.quoteTotals({ items: [{ cost: 100, markup: 20, qty: 2 }], labor: 50, discount: 10, taxPercent: 10 });
  assert.deepEqual(totals, { materials: 240, labor: 50, discount: 10, subtotal: 280, tax: 28, total: 308 });
});
