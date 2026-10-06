importScripts("lib/core.js", "lib/redirect-trace.js");

const traceApi = RedirectAuditTrace;
const MAX_REDIRECTS = 8;
const DEFAULT_TIMEOUT_MS = 9000;
const CONCURRENCY = 6;
const STORAGE_KEY = "scanState";
const EXTENSION_ORIGIN = `chrome-extension://${chrome.runtime.id}`;

const pendingByKey = new Map();
const tracesByRequestId = new Map();
let activeRun = null;
const recoveryPromise = recoverInterruptedScan();

chrome.webRequest.onBeforeRequest.addListener(handleBeforeRequest, { urls: ["<all_urls>"] });
chrome.webRequest.onBeforeRedirect.addListener(handleBeforeRedirect, { urls: ["<all_urls>"] });
chrome.webRequest.onCompleted.addListener(handleCompleted, { urls: ["<all_urls>"] });
chrome.webRequest.onErrorOccurred.addListener(handleError, { urls: ["<all_urls>"] });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "START_SCAN") {
    startScan(message.payload || {})
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Could not start scan" }));
    return true;
  }

  if (message.type === "GET_SCAN_STATE") {
    chrome.storage.local.get(STORAGE_KEY)
      .then((stored) => sendResponse({ ok: true, state: stored[STORAGE_KEY] || null }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Could not read scan state" }));
    return true;
  }

  if (message.type === "CANCEL_SCAN") {
    cancelActiveScan("cancelled")
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message || "Could not cancel scan" }));
    return true;
  }
});

function requestKey(method, url) {
  return `${String(method || "GET").toUpperCase()} ${url}`;
}

function isOwnRequest(details) {
  return typeof details.initiator === "string" && details.initiator.startsWith(EXTENSION_ORIGIN);
}

function handleBeforeRequest(details) {
  if (!isOwnRequest(details)) return;
  if (tracesByRequestId.has(details.requestId)) return;
  const key = requestKey(details.method, details.url);
  const queue = pendingByKey.get(key);
  if (!queue || !queue.length) return;
  const trace = queue.shift();
  if (!queue.length) pendingByKey.delete(key);
  trace.requestId = details.requestId;
  tracesByRequestId.set(details.requestId, trace);
}

function handleBeforeRedirect(details) {
  const trace = tracesByRequestId.get(details.requestId);
  if (!trace) return;
  const shouldAbort = traceApi.applyRedirect(trace, details);
  if (shouldAbort && trace.controller) trace.controller.abort("redirect-safety-limit");
}

function handleCompleted(details) {
  const trace = tracesByRequestId.get(details.requestId);
  if (!trace) return;
  traceApi.applyCompleted(trace, details);
  if (trace.resolveDone) trace.resolveDone();
}

function handleError(details) {
  const trace = tracesByRequestId.get(details.requestId);
  if (!trace) return;
  traceApi.applyError(trace, details);
  if (trace.resolveDone) trace.resolveDone();
}

async function recoverInterruptedScan() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const state = stored[STORAGE_KEY];
    if (!state || state.status !== "running") return;
    state.status = "interrupted";
    state.error = "The previous scan was interrupted. Run it again to refresh incomplete results.";
    state.completedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch {}
}

async function startScan(payload) {
  await recoveryPromise;
  const links = Array.isArray(payload.links) ? payload.links.filter((item) => item && /^https?:/.test(item.url || "")) : [];
  if (!payload.pageUrl || !links.length) throw new Error("No scannable links were provided.");

  await cancelActiveScan("replaced");

  const run = { id: String(payload.scanId || Date.now()), cancelled: false, controllers: new Set() };
  activeRun = run;
  const state = {
    version: 1, id: run.id, pageUrl: payload.pageUrl, pageTitle: payload.pageTitle || "",
    status: "running", startedAt: Date.now(), completedAt: null, total: links.length, completed: 0,
    results: new Array(links.length).fill(null), limited: Boolean(payload.limited), error: ""
  };
  await persistAndBroadcast(state);
  void executeScan(run, state, links);
  return publicState(state);
}

async function executeScan(run, state, links) {
  let cursor = 0;
  async function worker() {
    while (!run.cancelled) {
      const index = cursor++;
      if (index >= links.length) return;
      const result = await checkUrl(links[index], DEFAULT_TIMEOUT_MS, run);
      if (run.cancelled) return;
      state.results[index] = result;
      state.completed += 1;
      await persistAndBroadcast(state);
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, links.length) }, worker));
    if (run.cancelled) return;
    state.status = "complete";
    state.completedAt = Date.now();
    await persistAndBroadcast(state);
  } catch (error) {
    if (run.cancelled) return;
    state.status = "error";
    state.error = error && error.message ? error.message : "The scan could not be completed.";
    state.completedAt = Date.now();
    await persistAndBroadcast(state);
  } finally {
    if (activeRun === run) activeRun = null;
  }
}

async function cancelActiveScan(status = "cancelled") {
  if (!activeRun) return null;
  const run = activeRun;
  run.cancelled = true;
  for (const controller of run.controllers) controller.abort("scan-cancelled");
  run.controllers.clear();
  activeRun = null;
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const state = stored[STORAGE_KEY];
  if (state && state.id === run.id && state.status === "running") {
    state.status = status;
    state.completedAt = Date.now();
    await persistAndBroadcast(state);
    return publicState(state);
  }
  return state ? publicState(state) : null;
}

async function probe(url, method, timeoutMs, run) {
  const controller = new AbortController();
  const trace = traceApi.createTrace(url, MAX_REDIRECTS);
  let resolveDone;
  trace.done = new Promise((resolve) => { resolveDone = resolve; });
  trace.resolveDone = resolveDone;
  trace.controller = controller;
  run.controllers.add(controller);

  const key = requestKey(method, url);
  if (!pendingByKey.has(key)) pendingByKey.set(key, []);
  pendingByKey.get(key).push(trace);

  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  let response = null;
  let thrown = null;

  try {
    response = await fetch(url, { method, redirect: "follow", cache: "no-store", credentials: "omit", signal: controller.signal });
    try { await response.body?.cancel(); } catch {}
  } catch (error) {
    thrown = error;
  } finally {
    clearTimeout(timer);
    await Promise.race([trace.done, new Promise((resolve) => setTimeout(resolve, 100))]);
    run.controllers.delete(controller);
    const queue = pendingByKey.get(key);
    if (queue) {
      const index = queue.indexOf(trace);
      if (index >= 0) queue.splice(index, 1);
      if (!queue.length) pendingByKey.delete(key);
    }
    if (trace.requestId) tracesByRequestId.delete(trace.requestId);
  }

  if (response && !trace.status) {
    trace.status = response.status;
    trace.finalUrl = response.url || trace.finalUrl;
  }

  const serialized = traceApi.serializeTrace(trace);
  if (thrown && !serialized.loop && !serialized.redirectLimit) {
    serialized.networkError = controller.signal.reason === "timeout" ? "Timed out" : (serialized.networkError || thrown.message || "Request failed");
  }
  return serialized;
}

async function checkUrl(link, timeoutMs, run) {
  const started = performance.now();
  let observation = await probe(link.url, "HEAD", timeoutMs, run);
  if (run.cancelled) return { ...link, status: 0, error: "Cancelled", durationMs: 0 };

  if (observation.status >= 400 && !observation.loop && !observation.redirectLimit) {
    observation = await probe(link.url, "GET", timeoutMs, run);
  }

  return {
    ...link,
    status: observation.status || 0,
    finalUrl: observation.finalUrl || link.url,
    redirects: observation.redirects || 0,
    chain: observation.chain || [],
    loop: Boolean(observation.loop),
    redirectLimit: Boolean(observation.redirectLimit),
    error: observation.networkError || "",
    durationMs: Math.max(0, Math.round(performance.now() - started))
  };
}

function publicState(state) {
  return { ...state, results: (state.results || []).filter(Boolean) };
}

async function persistAndBroadcast(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  chrome.runtime.sendMessage({ type: "SCAN_STATE", state: publicState(state) }).catch(() => {});
}
