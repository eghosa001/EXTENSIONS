const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);

function setStatus(message, state = "neutral") {
  const el = $("status");
  el.textContent = message;
  el.dataset.state = state;
}

async function getProjects() {
  const { cc_projects: projects = [] } = await chrome.storage.local.get("cc_projects");
  return Array.isArray(projects) ? projects : [];
}

async function getSuppliers() {
  const { cc_suppliers: suppliers = [] } = await chrome.storage.local.get("cc_suppliers");
  return Array.isArray(suppliers) ? suppliers : [];
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[ch]));
}

async function populateSuppliers() {
  const suppliers = await getSuppliers();
  $("supplierOptions").innerHTML = suppliers
    .filter((supplier) => supplier && supplier.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((supplier) => `<option value="${escapeHtml(supplier.name)}"></option>`)
    .join("");
}

async function rememberSupplier(name, host) {
  const cleanName = String(name || "").trim().slice(0, 120);
  if (!cleanName) return;

  const cleanHost = String(host || "").trim().toLowerCase().slice(0, 255);
  const suppliers = await getSuppliers();
  const existing = suppliers.find((supplier) =>
    String(supplier?.name || "").toLowerCase() === cleanName.toLowerCase() ||
    (cleanHost && String(supplier?.host || "").toLowerCase() === cleanHost)
  );

  if (existing) {
    existing.name = cleanName;
    if (cleanHost) existing.host = cleanHost;
    existing.lastUsedAt = Date.now();
  } else {
    suppliers.push({
      id: core.makeId("supplier"),
      name: cleanName,
      host: cleanHost,
      lastUsedAt: Date.now()
    });
  }

  await chrome.storage.local.set({ cc_suppliers: suppliers.slice(-500) });
  await populateSuppliers();
}

async function ensureProjects() {
  let projects = await getProjects();
  if (projects.length) return projects;

  const now = Date.now();
  projects = [{
    id: "inbox",
    name: "Quick Quote",
    client: "",
    currency: "USD",
    labor: 0,
    taxPercent: 0,
    discount: 0,
    createdAt: now,
    updatedAt: now,
    items: []
  }];
  await chrome.storage.local.set({ cc_projects: projects });
  return projects;
}

async function populateProjects() {
  const selected = $("project").value;
  const projects = await ensureProjects();
  $("project").innerHTML = projects
    .map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name || "Untitled project")}</option>`)
    .join("");
  if (projects.some((project) => project.id === selected)) $("project").value = selected;
}

async function scanPage() {
  const scanButton = $("scan");
  scanButton.disabled = true;
  scanButton.textContent = "Scanning…";
  setStatus("Scanning this page…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active browser tab was found.");
    if (tab.url && !/^https?:/i.test(tab.url)) {
      throw new Error("Open a normal http(s) product page first.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/extractor.js"]
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.ContractorClipperExtractor?.extract(document, location)
    });

    const data = result?.result;
    if (!data) throw new Error("No product information was found.");

    const projects = await ensureProjects();
    const selectedProject = projects.find((project) => project.id === $("project").value) || projects[0];

    $("title").value = String(data.title || "").slice(0, 240);
    $("sku").value = String(data.sku || "").slice(0, 120);
    $("cost").value = core.nonNegative(core.parseMoney(data.priceRaw)) || "";
    $("currency").value = core.currencyCode(data.currency, selectedProject?.currency || "USD");
    $("url").value = core.safeHttpUrl(data.url);
    $("image").value = core.safeHttpUrl(data.image);
    $("host").value = String(data.host || "").slice(0, 255);

    const suppliers = await getSuppliers();
    const knownSupplier = suppliers.find((supplier) =>
      String(supplier?.host || "").toLowerCase() === String(data.host || "").toLowerCase()
    );
    $("supplier").value = knownSupplier?.name || String(data.host || "").replace(/^www\./i, "").slice(0, 120);

    $("imagePreview").src = core.safeHttpUrl(data.image);
    $("imagePreview").style.visibility = data.image ? "visible" : "hidden";
    $("editor").classList.remove("hidden");
    setStatus(`Product detected on ${data.host || "this site"}. Review the fields before adding it.`, "success");
  } catch (error) {
    setStatus(`Error: ${error?.message || "Could not scan this page."}`, "error");
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "Scan current product";
  }
}

async function saveItem() {
  const saveButton = $("save");
  saveButton.disabled = true;

  try {
    const projectId = $("project").value;
    const projects = await ensureProjects();
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project) throw new Error("Project not found.");

    const title = $("title").value.trim().slice(0, 240);
    if (!title) throw new Error("Add a product name.");

    const cost = core.nonNegative(core.parseMoney($("cost").value));
    const qty = Math.max(1, core.nonNegative($("qty").value, 1));
    const markup = core.nonNegative($("markup").value);
    const delivery = core.nonNegative($("delivery").value);
    const currency = core.currencyCode($("currency").value, project.currency || "USD");

    project.currency = currency;
    project.updatedAt = Date.now();
    if (!Array.isArray(project.items)) project.items = [];
    project.items.push({
      id: core.makeId("item"),
      title,
      sku: $("sku").value.trim().slice(0, 120),
      url: core.safeHttpUrl($("url").value),
      image: core.safeHttpUrl($("image").value),
      supplier: $("supplier").value.trim().slice(0, 120),
      room: $("room").value.trim().slice(0, 120),
      category: $("category").value.trim().slice(0, 120),
      cost,
      qty,
      markup,
      delivery,
      clippedAt: Date.now()
    });

    await rememberSupplier($("supplier").value, $("host").value);
    await chrome.storage.local.set({ cc_projects: projects });
    setStatus(`Added “${title}” to ${project.name || "the quote"}.`, "success");
    saveButton.textContent = "Added ✓";
    setTimeout(() => { saveButton.textContent = "Add to quote"; }, 1200);
  } catch (error) {
    setStatus(`Error: ${error?.message || "Could not add this item."}`, "error");
  } finally {
    saveButton.disabled = false;
  }
}

$("scan").addEventListener("click", scanPage);
$("save").addEventListener("click", saveItem);
$("openQuotes").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("quote.html") }));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.cc_projects) populateProjects().catch(() => {});
  if (changes.cc_suppliers) populateSuppliers().catch(() => {});
});

populateProjects().catch(() => setStatus("Error: Could not load projects.", "error"));
populateSuppliers().catch(() => {});
