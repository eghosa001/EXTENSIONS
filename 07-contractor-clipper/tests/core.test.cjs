const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../lib/core.js");

test("parses common supplier prices", () => {
  assert.equal(core.parseMoney("$1,299.50"), 1299.5);
  assert.equal(core.parseMoney("€1.299,50"), 1299.5);
  assert.equal(core.parseMoney("₦25,000"), 25000);
});

test("applies markup, quantity and delivery", () => {
  const item = { cost: 100, markup: 25, qty: 4, delivery: 35 };
  assert.equal(core.sellUnit(item), 125);
  assert.equal(core.lineTotal(item), 535);
});

test("calculates quote totals", () => {
  const totals = core.quoteTotals({ items: [{ cost: 100, markup: 20, qty: 2, delivery: 20 }], labor: 50, discount: 10, taxPercent: 10 });
  assert.deepEqual(totals, { materials: 260, labor: 50, discount: 10, subtotal: 300, tax: 30, total: 330 });
});
