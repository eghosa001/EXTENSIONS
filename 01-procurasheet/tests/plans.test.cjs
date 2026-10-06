const test = require("node:test");
const assert = require("node:assert/strict");
const plans = require("../lib/plans.js");

test("free plan allows three exports per calendar month", () => {
  const usage = { month: "2026-10", conversions: 2 };
  const entitlement = plans.normalizeEntitlement({ plan: "free" }, Date.UTC(2026, 9, 6));
  assert.equal(plans.canExport(entitlement, usage, Date.UTC(2026, 9, 6)).allowed, true);
  const after = plans.recordConversion(usage, Date.UTC(2026, 9, 6));
  assert.equal(after.conversions, 3);
  assert.equal(plans.canExport(entitlement, after, Date.UTC(2026, 9, 6)).allowed, false);
});

test("monthly usage resets automatically", () => {
  const usage = { month: "2026-09", conversions: 99 };
  const current = plans.normalizeUsage(usage, Date.UTC(2026, 9, 1));
  assert.deepEqual(current, { month: "2026-10", conversions: 0 });
});

test("free plan limits saved supplier templates to two", () => {
  assert.equal(plans.canSaveTemplate("free", 1).allowed, true);
  assert.equal(plans.canSaveTemplate("free", 2).allowed, false);
  assert.equal(plans.canSaveTemplate("pro", 100).allowed, true);
});

test("catalog matching and SKU memory require business", () => {
  assert.equal(plans.canUseFeature("free", "catalogMatching"), false);
  assert.equal(plans.canUseFeature("pro", "catalogMatching"), false);
  assert.equal(plans.canUseFeature("business", "catalogMatching"), true);
  assert.equal(plans.canUseFeature("business", "skuDictionary"), true);
});

test("expired or inactive paid entitlement falls back to free", () => {
  const now = Date.UTC(2026, 9, 6);
  assert.equal(plans.normalizeEntitlement({ plan: "pro", status: "canceled" }, now).plan, "free");
  assert.equal(plans.normalizeEntitlement({ plan: "business", status: "active", expiresAt: now - 1 }, now).plan, "free");
  assert.equal(plans.normalizeEntitlement({ plan: "pro", status: "active", expiresAt: now + 1000 }, now).plan, "pro");
});
