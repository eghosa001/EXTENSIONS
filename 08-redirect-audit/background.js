importScripts("lib/core.js");

const { REDIRECT_STATUSES } = RedirectAuditCore;
const MAX_REDIRECTS = 8;
const DEFAULT_TIMEOUT_MS = 9000;
const CONCURRENCY = 6;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "CHECK_URLS") {
    checkBatch(message.payload || {})
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || "Scan failed" }));
    return true;
  }
});

async function probe(url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined
    });
    const result = {
      status: response.status,
      url: response.url || url,
      location: response.headers.get("location") || "",
      redirected: response.redirected,
      type: response.type
    };
    try { await response.body?.cancel(); } catch {}
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function probeWithFallback(url, timeoutMs) {
  let head;
  try {
    head = await probe(url, "HEAD", timeoutMs);
  } catch (error) {
    if (error && error.name === "AbortError") throw error;
  }

  if (head && ![400, 403, 405, 501].includes(head.status) && head.status !== 0) return head;

  try {
    return await probe(url, "GET", timeoutMs);
  } catch (error) {
    if (head) return head;
    throw error;
  }
}

async function probeFollowing(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if ([400, 403, 405, 501].includes(response.status)) {
      try { await response.body?.cancel(); } catch {}
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
        headers: { Range: "bytes=0-0" }
      });
    }
    const result = { status: response.status, finalUrl: response.url || url, redirected: response.redirected };
    try { await response.body?.cancel(); } catch {}
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(link, timeoutMs) {
  const started = performance.now();
  const visited = new Set();
  const chain = [];
  let current = link.url;
  let loop = false;
  let status = 0;
  let finalUrl = current;
  let error = "";

  try {
    for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
      if (visited.has(current)) {
        loop = true;
        break;
      }
      visited.add(current);

      const step = await probeWithFallback(current, timeoutMs);

      if (step.status === 0) {
        const followed = await probeFollowing(current, timeoutMs);
        status = followed.status;
        finalUrl = followed.finalUrl;
        if (followed.redirected && finalUrl !== current) {
          chain.push({ url: current, status: 0, target: finalUrl });
        }
        break;
      }

      status = step.status;
      finalUrl = current;

      if (REDIRECT_STATUSES.has(step.status) && step.location) {
        const next = new URL(step.location, current).href;
        chain.push({ url: current, status: step.status, target: next });
        current = next;
        finalUrl = next;
        continue;
      }

      break;
    }

    if (chain.length > MAX_REDIRECTS) loop = true;
  } catch (caught) {
    error = caught && caught.name === "AbortError" ? "Timed out" : (caught && caught.message) || "Request failed";
  }

  return {
    ...link,
    status,
    finalUrl,
    redirects: chain.length,
    chain,
    loop,
    error,
    durationMs: Math.max(0, Math.round(performance.now() - started))
  };
}

async function checkBatch(payload) {
  const links = Array.isArray(payload.links) ? payload.links : [];
  const scanId = String(payload.scanId || "scan");
  const timeoutMs = Math.min(20000, Math.max(3000, Number(payload.timeoutMs) || DEFAULT_TIMEOUT_MS));
  const results = new Array(links.length);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= links.length) return;
      results[index] = await checkUrl(links[index], timeoutMs);
      completed += 1;
      chrome.runtime.sendMessage({ type: "SCAN_PROGRESS", scanId, completed, total: links.length }).catch(() => {});
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, links.length || 1) }, worker));
  return { ok: true, results };
}
