const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../lib/core.js");

test("parses common supplier prices", () => {
  assert.equal(core.parseMoney("$1,299.50"), 1299.5);
  assert.equal(core.parseMoney("€1.299,50"), 1299.5);
  assert.equal(core.parseMoney("₦25,000"), 25000);
});

test("calculates markup, delivery, discount and tax", () => {
  const totals = core.quoteTotals({ items: [{ cost: 100, markup: 20, qty: 2 }], labor: 50, delivery: 20, discount: 10, taxPercent: 10 });
  assert.deepEqual(totals, { materials: 240, labor: 50, delivery: 20, discount: 10, subtotal: 300, tax: 30, total: 330 });
});

test("migrates old projects without losing items", () => {
  const project = core.normalizeProject({ id: "old", name: "Old quote", currency: "ngn", items: [{ title: "Tile", cost: 12, qty: 2, markup: 25 }] });
  assert.equal(project.currency, "NGN");
  assert.equal(project.delivery, 0);
  assert.equal(project.items[0].title, "Tile");
  assert.equal(core.lineTotal(project.items[0]), 30);
});
