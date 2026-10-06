const test=require("node:test");
const assert=require("node:assert/strict");
const plans=require("../lib/plans.js");

test("launch pricing is affordable but not micro-priced",()=>{
  assert.deepEqual(plans.PRICING.pro,{monthly:4000,annual:40000});
  assert.deepEqual(plans.PRICING.business,{monthly:8500,annual:85000});
});

test("Free remains useful while Pro removes solo workflow limits",()=>{
  assert.equal(plans.limitFor("free","activeProjects"),2);
  assert.equal(plans.limitFor("free","monthlyClips"),20);
  assert.equal(plans.limitFor("free","libraryItems"),25);
  assert.equal(plans.canUse("free","branding"),false);
  assert.equal(plans.limitFor("pro","activeProjects"),Infinity);
  assert.equal(plans.canUse("pro","branding"),true);
  assert.equal(plans.canUse("pro","multiImage"),true);
  assert.equal(plans.canUse("business","procurement"),true);
  assert.equal(plans.canUse("business","acceptance"),true);
});

test("clip allowance resets monthly and paid plans remain unlimited",()=>{
  const now=Date.UTC(2026,9,6);
  const free={plan:"free"};
  const usage={month:"2026-10",clips:20};
  assert.equal(plans.canClip(free,usage,now).allowed,false);
  assert.equal(plans.canClip({plan:"pro",status:"active",expiresAt:now+1000,checkedAt:now},usage,now).allowed,true);
  assert.deepEqual(plans.normalizeUsage({month:"2026-09",clips:999},now),{month:"2026-10",clips:0});
});

test("expired paid entitlement safely falls back to Free",()=>{
  const now=1000;
  assert.equal(plans.normalizeEntitlement({plan:"business",status:"active",expiresAt:999},now).plan,"free");
  assert.equal(plans.normalizeEntitlement({plan:"business",status:"active",expiresAt:2000},now).plan,"business");
});
