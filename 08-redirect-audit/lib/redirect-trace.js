(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RedirectAuditTrace = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  function createTrace(initialUrl, maxRedirects = 8) {
    return { initialUrl, maxRedirects, requestId: null, chain: [], seen: new Set([initialUrl]), loop: false, redirectLimit: false, status: 0, finalUrl: initialUrl, networkError: "" };
  }
  function applyRedirect(trace, event) {
    const source = event.url || trace.finalUrl;
    const target = event.redirectUrl || source;
    trace.chain.push({ url: source, status: Number(event.statusCode) || 0, target });
    trace.status = Number(event.statusCode) || trace.status;
    trace.finalUrl = target;
    if (trace.seen.has(target)) trace.loop = true;
    trace.seen.add(target);
    if (trace.chain.length >= trace.maxRedirects && !trace.loop) trace.redirectLimit = true;
    return trace.loop || trace.redirectLimit;
  }
  function applyCompleted(trace, event) { trace.status = Number(event.statusCode) || trace.status; trace.finalUrl = event.url || trace.finalUrl; }
  function applyError(trace, event) { trace.networkError = event.error || "Network error"; trace.finalUrl = event.url || trace.finalUrl; }
  function serializeTrace(trace) { return { chain: trace.chain.slice(), redirects: trace.chain.length, loop: trace.loop, redirectLimit: trace.redirectLimit, status: trace.status, finalUrl: trace.finalUrl, networkError: trace.networkError }; }
  return { createTrace, applyRedirect, applyCompleted, applyError, serializeTrace };
});
