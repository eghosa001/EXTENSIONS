(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RedirectAuditCore = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  function normalizeUrl(value, base) {
    if (!value) return null;
    try {
      const url = new URL(value, base);
      if (!/^https?:$/.test(url.protocol)) return null;
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  }

  function isInternal(url, pageUrl) {
    try { return new URL(url).origin === new URL(pageUrl).origin; }
    catch { return false; }
  }

  function isInsecure(url, pageUrl) {
    try { return new URL(pageUrl).protocol === "https:" && new URL(url).protocol === "http:"; }
    catch { return false; }
  }

  function dedupeLinks(rawLinks, pageUrl, limit = 150) {
    const seen = new Set();
    const links = [];
    for (const raw of rawLinks || []) {
      const href = typeof raw === "string" ? raw : raw && raw.href;
      const url = normalizeUrl(href, pageUrl);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      links.push({
        url,
        text: typeof raw === "object" && raw ? String(raw.text || "").trim().replace(/\s+/g, " ").slice(0, 180) : "",
        internal: isInternal(url, pageUrl),
        insecure: isInsecure(url, pageUrl)
      });
      if (links.length >= limit) break;
    }
    return links;
  }

  function issueFlags(result) {
    const flags = [];
    const status = Number(result && result.status) || 0;
    const redirects = Number(result && result.redirects) || 0;
    const loop = Boolean(result && result.loop);
    const redirectLimit = Boolean(result && result.redirectLimit);

    if (loop) flags.push("loop");
    if (redirectLimit) flags.push("redirect-limit");
    if (!loop && !redirectLimit) {
      if (status >= 500) flags.push("server-error");
      else if (status === 404 || status === 410) flags.push("broken");
      else if (status >= 400) flags.push("client-error");
      else if (status === 0) flags.push("unreachable");
    }

    if (redirects > 1) flags.push("redirect-chain");
    else if (redirects === 1) flags.push("redirect");
    if (result && result.insecure) flags.push("insecure");
    if (!flags.length && status >= 200 && status < 400) flags.push("ok");
    return flags;
  }

  function severityFor(result) {
    const flags = issueFlags(result);
    if (flags.some((flag) => ["loop", "redirect-limit", "server-error", "broken", "client-error", "unreachable"].includes(flag))) return "error";
    if (flags.some((flag) => ["redirect-chain", "insecure"].includes(flag))) return "warning";
    if (flags.includes("redirect")) return "notice";
    return "ok";
  }

  function statusLabel(result) {
    if (result && result.loop) return "Loop";
    if (result && result.redirectLimit) return "8+ hops";
    const status = Number(result && result.status) || 0;
    return status ? String(status) : "Unreachable";
  }

  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function resultsToCsv(results) {
    const header = ["URL", "Status", "Final URL", "Redirects", "Internal", "Insecure", "Issues", "Link text"];
    const rows = (results || []).map((result) => [
      result.url,
      statusLabel(result),
      result.finalUrl || result.url,
      result.redirects || 0,
      result.internal ? "yes" : "no",
      result.insecure ? "yes" : "no",
      issueFlags(result).filter((flag) => flag !== "ok").join(" | "),
      result.text || ""
    ]);
    return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  }

  function summary(results) {
    return (results || []).reduce((acc, item) => {
      acc.total += 1;
      const flags = issueFlags(item);
      if (flags.some((flag) => ["broken", "client-error", "server-error", "loop", "redirect-limit", "unreachable"].includes(flag))) acc.broken += 1;
      if (flags.some((flag) => ["redirect", "redirect-chain"].includes(flag))) acc.redirects += 1;
      if (flags.includes("insecure")) acc.insecure += 1;
      if (severityFor(item) === "ok") acc.ok += 1;
      return acc;
    }, { total: 0, ok: 0, redirects: 0, broken: 0, insecure: 0 });
  }

  return { normalizeUrl, isInternal, isInsecure, dedupeLinks, issueFlags, severityFor, statusLabel, resultsToCsv, summary };
});
