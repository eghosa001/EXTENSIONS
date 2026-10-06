(() => {
  "use strict";
  const core = RedirectAuditCore;
  const MAX_LINKS = 150;
  const state = { pageUrl: "", pageTitle: "", results: [], filter: "all", scope: "all", query: "", scanStatus: "idle" };
  const el = Object.fromEntries(["scanButton","pageLabel","notice","totalCount","brokenCount","redirectCount","insecureCount","progressWrap","progressText","progressPercent","progressBar","searchInput","scopeSelect","emptyState","resultsSection","results","resultCountLabel","copyButton","downloadButton","scanMeta"].map((id) => [id, document.querySelector(`#${id}`)]));

  init();
  async function init() { bindEvents(); await loadCurrentTab(); await restoreScanState(); }

  function bindEvents() {
    el.scanButton.addEventListener("click", () => state.scanStatus === "running" ? cancelScan() : scanPage());
    el.searchInput.addEventListener("input", () => { state.query = el.searchInput.value.trim().toLowerCase(); renderResults(); });
    el.scopeSelect.addEventListener("change", () => { state.scope = el.scopeSelect.value; renderResults(); });
    document.querySelectorAll(".metric").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".metric").forEach((item) => item.classList.remove("active"));
      button.classList.add("active"); state.filter = button.dataset.filter || "all"; renderResults();
    }));
    el.copyButton.addEventListener("click", copyCsv); el.downloadButton.addEventListener("click", downloadCsv);
    chrome.runtime.onMessage.addListener((message) => { if (message && message.type === "SCAN_STATE" && message.state) applyScanState(message.state); });
  }

  async function loadCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https?:/.test(tab.url || "")) { state.pageUrl = ""; el.pageLabel.textContent = "This page cannot be scanned"; el.scanButton.disabled = true; return; }
    state.pageUrl = tab.url; state.pageTitle = tab.title || ""; el.pageLabel.textContent = safeHost(tab.url);
  }

  async function restoreScanState() {
    const response = await chrome.runtime.sendMessage({ type: "GET_SCAN_STATE" }).catch(() => null);
    if (response && response.ok && response.state && response.state.pageUrl === state.pageUrl) applyScanState(response.state);
  }

  function requestNetworkPermission() {
    return chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] });
  }

  async function scanPage() {
    if (!state.pageUrl || state.scanStatus === "running") return;
    hideNotice();
    const granted = await requestNetworkPermission();
    if (!granted) { showNotice("Website access is required only to request the links you explicitly scan. Permission was not granted.", true); return; }
    setRunningUi(0, 1, "Collecting links…");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a normal web page before scanning.");
      const extraction = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ pageUrl: location.href, pageTitle: document.title, links: Array.from(document.querySelectorAll("a[href]")).map((a) => ({ href: a.href, text: a.innerText || a.textContent || a.getAttribute("aria-label") || "" })) })
      });
      const page = extraction && extraction[0] && extraction[0].result;
      if (!page) throw new Error("Could not read links from this page.");
      state.pageUrl = page.pageUrl; state.pageTitle = page.pageTitle || state.pageTitle; el.pageLabel.textContent = safeHost(state.pageUrl);
      const links = core.dedupeLinks(page.links, state.pageUrl, MAX_LINKS);
      const limited = links.length >= MAX_LINKS;
      const scanLinks = [{ url: core.normalizeUrl(state.pageUrl), text: "Current page", internal: true, insecure: false, page: true }, ...links.slice(0, MAX_LINKS - 1)].filter((item) => item.url);
      const response = await chrome.runtime.sendMessage({ type: "START_SCAN", payload: { scanId: `${Date.now()}`, pageUrl: state.pageUrl, pageTitle: state.pageTitle, links: scanLinks, limited } });
      if (!response || !response.ok) throw new Error(response && response.error ? response.error : "Could not start scan.");
      applyScanState(response.state);
    } catch (error) {
      state.scanStatus = "idle"; updateScanButton(); el.progressWrap.classList.add("hidden");
      showNotice(error && error.message ? error.message : "Unable to scan this page.", true);
    }
  }

  async function cancelScan() {
    el.scanButton.disabled = true;
    const response = await chrome.runtime.sendMessage({ type: "CANCEL_SCAN" }).catch(() => null);
    el.scanButton.disabled = false;
    if (response && response.ok && response.state) applyScanState(response.state);
  }

  function applyScanState(scan) {
    if (!scan || scan.pageUrl !== state.pageUrl) return;
    state.scanStatus = scan.status || "idle"; state.results = Array.isArray(scan.results) ? scan.results : [];
    renderSummary(); renderResults(); updateScanButton();
    if (scan.status === "running") {
      setRunningUi(scan.completed || 0, scan.total || 1); el.scanMeta.textContent = `${scan.completed || 0}/${scan.total || 0} checked`;
    } else {
      el.progressWrap.classList.add("hidden");
      if (scan.status === "complete") {
        el.scanMeta.textContent = scan.limited ? `First ${scan.total} URLs checked` : `${scan.total || state.results.length} URLs checked`;
        if (scan.limited) showNotice(`This release checks up to ${MAX_LINKS} URLs per page to stay fast and predictable.`, false); else hideNotice();
      } else if (scan.status === "cancelled") { el.scanMeta.textContent = `${scan.completed || state.results.length}/${scan.total || 0} checked`; showNotice("Scan cancelled. Completed results are still available.", false); }
      else if (scan.status === "interrupted") showNotice(scan.error || "The previous scan was interrupted. Run it again to refresh the results.", true);
      else if (scan.status === "error") showNotice(scan.error || "The scan could not be completed.", true);
    }
  }

  function setRunningUi(completed, total, label) { state.scanStatus = "running"; updateScanButton(); el.emptyState.classList.add("hidden"); el.progressWrap.classList.remove("hidden"); updateProgress(completed, total, label); }
  function updateScanButton() { const running = state.scanStatus === "running"; el.scanButton.textContent = running ? "Cancel" : (state.results.length ? "Scan again" : "Scan page"); el.scanButton.classList.toggle("cancel", running); el.scanButton.disabled = !state.pageUrl; }
  function updateProgress(completed, total, label) { const safeTotal = Math.max(1, Number(total) || 1); const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0)); const percent = Math.round((safeCompleted / safeTotal) * 100); el.progressText.textContent = label || `Checking links… ${safeCompleted}/${safeTotal}`; el.progressPercent.textContent = `${percent}%`; el.progressBar.style.width = `${percent}%`; }
  function renderSummary() { const summary = core.summary(state.results); el.totalCount.textContent = summary.total; el.brokenCount.textContent = summary.broken; el.redirectCount.textContent = summary.redirects; el.insecureCount.textContent = summary.insecure; }

  function filteredResults() {
    return state.results.filter((result) => {
      const flags = core.issueFlags(result);
      if (state.filter === "broken" && !flags.some((flag) => ["broken","client-error","server-error","loop","redirect-limit","unreachable"].includes(flag))) return false;
      if (state.filter === "redirects" && !flags.some((flag) => ["redirect","redirect-chain"].includes(flag))) return false;
      if (state.filter === "insecure" && !flags.includes("insecure")) return false;
      if (state.scope === "internal" && !result.internal) return false; if (state.scope === "external" && result.internal) return false;
      if (state.query && !`${result.url || ""} ${result.finalUrl || ""} ${result.text || ""}`.toLowerCase().includes(state.query)) return false;
      return true;
    });
  }

  function renderResults() {
    if (!state.results.length) { el.resultsSection.classList.add("hidden"); if (state.scanStatus !== "running") el.emptyState.classList.remove("hidden"); return; }
    const results = filteredResults(); el.emptyState.classList.add("hidden"); el.resultsSection.classList.remove("hidden"); el.resultCountLabel.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
    el.results.replaceChildren(...results.map(renderResult));
    if (!results.length) { const blank = document.createElement("div"); blank.className = "empty-state"; const title = document.createElement("h2"); title.textContent = "No matching results"; const body = document.createElement("p"); body.textContent = "Try another filter or search term."; blank.append(title, body); el.results.append(blank); }
  }

  function renderResult(result) {
    const card = document.createElement("article"); card.className = "result"; card.dataset.severity = core.severityFor(result);
    const status = document.createElement("div"); status.className = "status"; status.textContent = core.statusLabel(result);
    const main = document.createElement("div"); main.className = "result-main";
    const link = document.createElement("a"); link.className = "url"; link.href = result.url; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = result.url; link.title = result.url; main.append(link);
    if (result.text) { const linkText = document.createElement("div"); linkText.className = "link-text"; linkText.textContent = result.text; main.append(linkText); }
    const badges = document.createElement("div"); badges.className = "badges"; const labels = [{ text: result.internal ? "Internal" : "External", kind: "" }];
    for (const flag of core.issueFlags(result)) { if (flag === "ok") continue; labels.push({ text: prettyFlag(flag), kind: ["redirect","redirect-chain","insecure"].includes(flag) ? "warn" : "problem" }); }
    if (Number.isFinite(result.durationMs)) labels.push({ text: `${result.durationMs} ms`, kind: "" });
    for (const item of labels) { const badge = document.createElement("span"); badge.className = `badge ${item.kind}`.trim(); badge.textContent = item.text; badges.append(badge); }
    main.append(badges);
    if (result.finalUrl && result.finalUrl !== result.url) { const final = document.createElement("div"); final.className = "final-url"; final.textContent = `→ ${result.finalUrl}`; final.title = result.finalUrl; main.append(final); }
    card.append(status, main); return card;
  }

  function prettyFlag(flag) { return ({ "server-error":"Server error","client-error":"Client error","redirect-chain":"Redirect chain","redirect":"Redirect","redirect-limit":"Too many redirects","broken":"Broken","loop":"Redirect loop","unreachable":"Unreachable","insecure":"HTTP on HTTPS" })[flag] || flag; }
  async function copyCsv() { try { await navigator.clipboard.writeText(core.resultsToCsv(filteredResults())); const previous = el.copyButton.textContent; el.copyButton.textContent = "Copied"; setTimeout(() => { el.copyButton.textContent = previous; }, 1200); } catch { showNotice("Could not copy the report. Use Download instead.", true); } }
  function downloadCsv() { const csv = core.resultsToCsv(filteredResults()); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `redirect-audit-${safeHost(state.pageUrl).replace(/[^a-z0-9.-]+/gi, "-") || "page"}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
  function showNotice(message, isError) { el.notice.textContent = message; el.notice.classList.toggle("error", Boolean(isError)); el.notice.classList.remove("hidden"); }
  function hideNotice() { el.notice.classList.add("hidden"); el.notice.classList.remove("error"); el.notice.textContent = ""; }
  function safeHost(url) { try { return new URL(url).host; } catch { return ""; } }
})();
