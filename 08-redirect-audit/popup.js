(() => {
  "use strict";

  const core = RedirectAuditCore;
  const MAX_LINKS = 150;
  const state = { pageUrl: "", pageTitle: "", results: [], filter: "all", scope: "all", query: "", scanning: false };

  const el = {
    scanButton: document.querySelector("#scanButton"),
    pageLabel: document.querySelector("#pageLabel"),
    notice: document.querySelector("#notice"),
    totalCount: document.querySelector("#totalCount"),
    brokenCount: document.querySelector("#brokenCount"),
    redirectCount: document.querySelector("#redirectCount"),
    insecureCount: document.querySelector("#insecureCount"),
    progressWrap: document.querySelector("#progressWrap"),
    progressText: document.querySelector("#progressText"),
    progressPercent: document.querySelector("#progressPercent"),
    progressBar: document.querySelector("#progressBar"),
    searchInput: document.querySelector("#searchInput"),
    scopeSelect: document.querySelector("#scopeSelect"),
    emptyState: document.querySelector("#emptyState"),
    resultsSection: document.querySelector("#resultsSection"),
    results: document.querySelector("#results"),
    resultCountLabel: document.querySelector("#resultCountLabel"),
    copyButton: document.querySelector("#copyButton"),
    downloadButton: document.querySelector("#downloadButton"),
    scanMeta: document.querySelector("#scanMeta")
  };

  init();

  async function init() {
    bindEvents();
    await loadCurrentTab();
    await restoreLastScan();
  }

  function bindEvents() {
    el.scanButton.addEventListener("click", scanPage);
    el.searchInput.addEventListener("input", () => { state.query = el.searchInput.value.trim().toLowerCase(); renderResults(); });
    el.scopeSelect.addEventListener("change", () => { state.scope = el.scopeSelect.value; renderResults(); });
    document.querySelectorAll(".metric").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".metric").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        state.filter = button.dataset.filter || "all";
        renderResults();
      });
    });
    el.copyButton.addEventListener("click", copyCsv);
    el.downloadButton.addEventListener("click", downloadCsv);
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "SCAN_PROGRESS") return;
      updateProgress(message.completed, message.total);
    });
  }

  async function loadCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:/.test(tab.url || "")) {
      state.pageUrl = "";
      el.pageLabel.textContent = "This page cannot be scanned";
      el.scanButton.disabled = true;
      return;
    }
    state.pageUrl = tab.url;
    state.pageTitle = tab.title || "";
    el.pageLabel.textContent = safeHost(tab.url);
  }

  async function restoreLastScan() {
    const stored = await chrome.storage.local.get("lastScan");
    const last = stored.lastScan;
    if (!last || last.pageUrl !== state.pageUrl || !Array.isArray(last.results)) return;
    state.results = last.results;
    el.scanMeta.textContent = "Last scan restored";
    renderSummary();
    renderResults();
  }

  async function ensureNetworkPermission() {
    const origins = ["http://*/*", "https://*/*"];
    const has = await chrome.permissions.contains({ origins });
    if (has) return true;
    return chrome.permissions.request({ origins });
  }

  async function scanPage() {
    if (!state.pageUrl || state.scanning) return;
    hideNotice();

    const granted = await ensureNetworkPermission();
    if (!granted) {
      showNotice("RedirectAudit needs website access only to request the links you choose to scan. Permission was not granted.", true);
      return;
    }

    state.scanning = true;
    state.results = [];
    el.scanButton.disabled = true;
    el.scanButton.textContent = "Scanning…";
    el.progressWrap.classList.remove("hidden");
    el.emptyState.classList.add("hidden");
    el.resultsSection.classList.add("hidden");
    updateProgress(0, 1, "Collecting links…");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const extraction = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          pageUrl: location.href,
          pageTitle: document.title,
          links: Array.from(document.querySelectorAll("a[href]")).map((a) => ({ href: a.href, text: a.innerText || a.textContent || a.getAttribute("aria-label") || "" }))
        })
      });

      const page = extraction && extraction[0] && extraction[0].result;
      if (!page) throw new Error("Could not read links from this page.");

      state.pageUrl = page.pageUrl;
      state.pageTitle = page.pageTitle || state.pageTitle;
      el.pageLabel.textContent = safeHost(state.pageUrl);

      const links = core.dedupeLinks(page.links, state.pageUrl, MAX_LINKS - 1);
      const pageEntry = { url: core.normalizeUrl(state.pageUrl), text: "Current page", internal: true, insecure: false, page: true };
      const scanLinks = [pageEntry, ...links].filter((item) => item.url);
      updateProgress(0, scanLinks.length, `Checking ${scanLinks.length} URLs…`);

      const response = await chrome.runtime.sendMessage({
        type: "CHECK_URLS",
        payload: { scanId: `${Date.now()}`, links: scanLinks }
      });

      if (!response || !response.ok) throw new Error(response && response.error ? response.error : "Scan failed.");
      state.results = response.results || [];

      await chrome.storage.local.set({
        lastScan: { pageUrl: state.pageUrl, scannedAt: Date.now(), results: state.results }
      });

      renderSummary();
      renderResults();
      const limited = page.links.length > MAX_LINKS - 1;
      el.scanMeta.textContent = limited ? `First ${MAX_LINKS} URLs checked` : `${state.results.length} URLs checked`;
      if (limited) showNotice(`This free V1 checks the first ${MAX_LINKS} unique page URLs to stay fast.`, false);
    } catch (error) {
      showNotice(error && error.message ? error.message : "Unable to scan this page.", true);
      el.emptyState.classList.remove("hidden");
    } finally {
      state.scanning = false;
      el.scanButton.disabled = false;
      el.scanButton.textContent = "Scan again";
      el.progressWrap.classList.add("hidden");
    }
  }

  function updateProgress(completed, total, label) {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
    const percent = Math.round((safeCompleted / safeTotal) * 100);
    el.progressText.textContent = label || `Checking links… ${safeCompleted}/${safeTotal}`;
    el.progressPercent.textContent = `${percent}%`;
    el.progressBar.style.width = `${percent}%`;
  }

  function renderSummary() {
    const summary = core.summary(state.results);
    el.totalCount.textContent = summary.total;
    el.brokenCount.textContent = summary.broken;
    el.redirectCount.textContent = summary.redirects;
    el.insecureCount.textContent = summary.insecure;
  }

  function filteredResults() {
    return state.results.filter((result) => {
      const flags = core.issueFlags(result);
      if (state.filter === "broken" && !flags.some((flag) => ["broken", "client-error", "server-error", "loop", "unreachable"].includes(flag))) return false;
      if (state.filter === "redirects" && !flags.some((flag) => ["redirect", "redirect-chain"].includes(flag))) return false;
      if (state.filter === "insecure" && !flags.includes("insecure")) return false;
      if (state.scope === "internal" && !result.internal) return false;
      if (state.scope === "external" && result.internal) return false;
      if (state.query) {
        const haystack = `${result.url || ""} ${result.finalUrl || ""} ${result.text || ""}`.toLowerCase();
        if (!haystack.includes(state.query)) return false;
      }
      return true;
    });
  }

  function renderResults() {
    if (!state.results.length) return;
    const results = filteredResults();
    el.emptyState.classList.add("hidden");
    el.resultsSection.classList.remove("hidden");
    el.resultCountLabel.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
    el.results.replaceChildren(...results.map(renderResult));
    if (!results.length) {
      const blank = document.createElement("div");
      blank.className = "empty-state";
      blank.innerHTML = "<h2>No matching results</h2><p>Try another filter or search term.</p>";
      el.results.append(blank);
    }
  }

  function renderResult(result) {
    const card = document.createElement("article");
    card.className = "result";
    card.dataset.severity = core.severityFor(result);

    const status = document.createElement("div");
    status.className = "status";
    status.textContent = core.statusLabel(result);

    const main = document.createElement("div");
    main.className = "result-main";

    const link = document.createElement("a");
    link.className = "url";
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = result.url;
    link.title = result.url;
    main.append(link);

    if (result.text) {
      const linkText = document.createElement("div");
      linkText.className = "link-text";
      linkText.textContent = result.text;
      main.append(linkText);
    }

    const badges = document.createElement("div");
    badges.className = "badges";
    const flags = core.issueFlags(result);
    const labels = [];
    labels.push({ text: result.internal ? "Internal" : "External", kind: "" });
    for (const flag of flags) {
      if (flag === "ok") continue;
      labels.push({ text: prettyFlag(flag), kind: ["redirect", "redirect-chain", "insecure"].includes(flag) ? "warn" : "problem" });
    }
    if (result.durationMs) labels.push({ text: `${result.durationMs} ms`, kind: "" });
    labels.forEach((item) => {
      const badge = document.createElement("span");
      badge.className = `badge ${item.kind}`.trim();
      badge.textContent = item.text;
      badges.append(badge);
    });
    main.append(badges);

    if (result.finalUrl && result.finalUrl !== result.url) {
      const final = document.createElement("div");
      final.className = "final-url";
      final.textContent = `→ ${result.finalUrl}`;
      final.title = result.finalUrl;
      main.append(final);
    }

    card.append(status, main);
    return card;
  }

  function prettyFlag(flag) {
    const map = {
      "server-error": "Server error",
      "client-error": "Client error",
      "redirect-chain": "Redirect chain",
      "redirect": "Redirect",
      "broken": "Broken",
      "loop": "Redirect loop",
      "unreachable": "Unreachable",
      "insecure": "HTTP on HTTPS"
    };
    return map[flag] || flag;
  }

  async function copyCsv() {
    const csv = core.resultsToCsv(filteredResults());
    await navigator.clipboard.writeText(csv);
    const previous = el.copyButton.textContent;
    el.copyButton.textContent = "Copied";
    setTimeout(() => { el.copyButton.textContent = previous; }, 1200);
  }

  function downloadCsv() {
    const csv = core.resultsToCsv(filteredResults());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `redirect-audit-${safeHost(state.pageUrl).replace(/[^a-z0-9.-]+/gi, "-") || "page"}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function showNotice(message, isError) {
    el.notice.textContent = message;
    el.notice.classList.toggle("error", Boolean(isError));
    el.notice.classList.remove("hidden");
  }

  function hideNotice() {
    el.notice.classList.add("hidden");
    el.notice.classList.remove("error");
    el.notice.textContent = "";
  }

  function safeHost(url) {
    try { return new URL(url).host; } catch { return ""; }
  }
})();
