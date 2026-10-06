(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RedirectAuditCore = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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
    try {
      return new URL(url).origin === new URL(pageUrl).origin;
    } catch {
      return false;
    }
  }

  function isInsecure(url, pageUrl) {
    try {
      return new URL(pageUrl).protocol === "https:" && new URL(url).protocol === "http:";
    } catch {
      return false;
    }
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
        text: typeof raw === "object" && raw ? String(raw.text || "").trim().slice(0, 160) : "",
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

    if (result && result.loop) flags.push("loop");
    if (status >= 500) flags.push("server-error");
    else if (status === 404 || status === 410) flags.push("broken");
    else if (status >= 400) flags.push("client-error");
    else if (status === 0) flags.push("unreachable");

    if (redirects > 1) flags.push("redirect-chain");
    else if (redirects === 1) flags.push("redirect");

    if (result && result.insecure) flags.push("insecure");
    if (!flags.length && status >= 200 && status < 400) flags.push("ok");
    return flags;
  }

  function severityFor(result) {
    const flags = issueFlags(result);
    if (flags.some((flag) => ["loop", "server-error", "broken", "client-error", "unreachable"].includes(flag))) return "error";
    if (flags.some((flag) => ["redirect-chain", "insecure"].includes(flag))) return "warning";
    if (flags.includes("redirect")) return "notice";
    return "ok";
  }

  function statusLabel(result) {
    if (result && result.loop) return "Redirect loop";
    const status = Number(result && result.status) || 0;
    if (!status) return "Unreachable";
    return String(status);
  }

  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function resultsToCsv(results) {
    const header = [
      "URL",
      "Status",
      "Final URL",
      "Redirects",
      "Internal",
      "Insecure",
      "Issues",
      "Link text"
    ];
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
    const items = results || [];
    return items.reduce((acc, item) => {
      acc.total += 1;
      const flags = issueFlags(item);
      if (flags.includes("broken") || flags.includes("client-error") || flags.includes("server-error") || flags.includes("loop") || flags.includes("unreachable")) acc.broken += 1;
      if (flags.includes("redirect") || flags.includes("redirect-chain")) acc.redirects += 1;
      if (flags.includes("insecure")) acc.insecure += 1;
      if (severityFor(item) === "ok") acc.ok += 1;
      return acc;
    }, { total: 0, ok: 0, redirects: 0, broken: 0, insecure: 0 });
  }

  return {
    REDIRECT_STATUSES,
    normalizeUrl,
    isInternal,
    isInsecure,
    dedupeLinks,
    issueFlags,
    severityFor,
    statusLabel,
    resultsToCsv,
    summary
  };
});
