const test = require("node:test");
const assert = require("node:assert/strict");
const traceApi = require("../lib/redirect-trace.js");

test("records an exact multi-hop redirect chain", () => {
  const trace = traceApi.createTrace("https://a.test/start", 8);
  assert.equal(traceApi.applyRedirect(trace, { url: "https://a.test/start", statusCode: 301, redirectUrl: "https://a.test/one" }), false);
  assert.equal(traceApi.applyRedirect(trace, { url: "https://a.test/one", statusCode: 302, redirectUrl: "https://a.test/final" }), false);
  traceApi.applyCompleted(trace, { url: "https://a.test/final", statusCode: 200 });
  const out = traceApi.serializeTrace(trace);
  assert.equal(out.redirects, 2); assert.equal(out.status, 200); assert.equal(out.finalUrl, "https://a.test/final");
  assert.deepEqual(out.chain.map((step) => step.status), [301, 302]);
});
test("detects a redirect loop immediately", () => {
  const trace = traceApi.createTrace("https://a.test/a", 8);
  traceApi.applyRedirect(trace, { url: "https://a.test/a", statusCode: 302, redirectUrl: "https://a.test/b" });
  assert.equal(traceApi.applyRedirect(trace, { url: "https://a.test/b", statusCode: 302, redirectUrl: "https://a.test/a" }), true);
  assert.equal(trace.loop, true); assert.equal(trace.redirectLimit, false);
});
test("enforces the redirect hop safety limit", () => {
  const trace = traceApi.createTrace("https://a.test/0", 3);
  traceApi.applyRedirect(trace, { url: "https://a.test/0", statusCode: 301, redirectUrl: "https://a.test/1" });
  traceApi.applyRedirect(trace, { url: "https://a.test/1", statusCode: 301, redirectUrl: "https://a.test/2" });
  assert.equal(traceApi.applyRedirect(trace, { url: "https://a.test/2", statusCode: 301, redirectUrl: "https://a.test/3" }), true);
  assert.equal(trace.redirectLimit, true);
});
