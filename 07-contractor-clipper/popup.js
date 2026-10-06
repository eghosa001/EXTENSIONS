const core = globalThis.ContractorClipperCore;
const plansApi = globalThis.ContractorClipperPlans;
const workspace = globalThis.ContractorClipperWorkspace;
const billing = globalThis.ContractorClipperBilling;
const $ = (id) => document.getElementById(id);

let entitlement = plansApi.normalizeEntitlement({ plan: "free" });
let usage = plansApi.normalizeUsage({});
let imageOptions = [];
let selectedImage = "";

function setStatus(message, state = "neutral") {
  const el = $("status");
  el.textContent = message;
  el.dataset.state = state;
}
function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[ch]));
}
async function getProjects() {
  const { cc_projects: projects = [] } = await chrome.storage.local.get("cc_projects");
  return Array.isArray(projects) ? projects : [];
}
async function getSuppliers() {
  const { cc_suppliers: suppliers = [] } = await chrome.storage.local.get("cc_suppliers");
  return Array.isArray(suppliers) ? suppliers.map(workspace.normalizeSupplierRule) : [];
}
async function getLibrary() {
  const { cc_library: items = [] } = await chrome.storage.local.get("cc_library");
  return Array.isArray(items) ? items.map(workspace.normalizeLibraryItem) : [];
}
async function loadPlanState() {
  const stored = await chrome.storage.local.get("cc_usage_v1");
  usage = plansApi.normalizeUsage(stored.cc_usage_v1);
  entitlement = await billing.currentEntitlement();
  renderPlanState();
}
function renderPlanState() {
  $("planBadge").textContent = plansApi.planLabel(entitlement.plan).toUpperCase();
  $("planBadge").dataset.plan = entitlement.plan;
  $("supplierDiscount").disabled = !plansApi.canUse(entitlement.plan, "supplierDiscounts");
  $("supplierDiscount").title = plansApi.canUse(entitlement.plan, "supplierDiscounts") ? "" : "Supplier discount rules are included with Pro and Business.";
  const clip = plansApi.canClip(entitlement, usage);
  $("usageHint").textContent = clip.limit == null
    ? `${plansApi.planLabel(entitlement.plan)} · unlimited clips and projects.`
    : `Free usage: ${clip.used}/${clip.limit} clips this month · 2 active projects.`;
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
    const allowance = plansApi.allowance(entitlement.plan, "savedSuppliers", suppliers.length);
    if (!allowance.allowed) return;
    suppliers.push(workspace.normalizeSupplierRule({ name: cleanName, host: cleanHost }));
  }
  await chrome.storage.local.set({ cc_suppliers: suppliers.slice(-500) });
  await populateSuppliers();
}
async function populateSuppliers() {
  const suppliers = await getSuppliers();
  $("supplierOptions").innerHTML = suppliers
    .filter((supplier) => supplier.name)
    .sort((a, b) => supplierName(a).localeCompare(supplierName(b)))
    .map((supplier) => `<option value="${escapeHtml(supplier.name)}"></option>`)
    .join("");
}
function supplierName(s) { return String(s?.name || ""); }

async function ensureProjects() {
  let projects = await getProjects();
  if (projects.length) return projects;
  const now = Date.now();
  projects = [{
    id: "inbox", name: "Quick Quote", client: "", clientEmail: "", jobAddress: "", currency: "USD",
    quoteNumber: "", validUntil: "", notes: "", labor: 0, laborItems: [], taxPercent: 0, discount: 0,
    acceptanceStatus: "draft", createdAt: now, updatedAt: now, items: []
  }];
  await chrome.storage.local.set({ cc_projects: projects });
  return projects;
}
async function populateProjects() {
  const selected = $("project").value;
  const projects = await ensureProjects();
  $("project").innerHTML = projects.map((project) =>
    `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name || "Untitled project")}</option>`
  ).join("");
  if (projects.some((project) => project.id === selected)) $("project").value = selected;
}
function renderImages(images) {
  imageOptions = (Array.isArray(images) ? images : []).map(core.safeHttpUrl).filter(Boolean).slice(0, 12);
  selectedImage = imageOptions[0] || "";
  $("image").value = selectedImage;
  $("imagePreview").src = selectedImage;
  $("imagePreview").style.visibility = selectedImage ? "visible" : "hidden";
  $("imageChoices").innerHTML = imageOptions.map((url, index) =>
    `<button type="button" class="image-choice${index === 0 ? " selected" : ""}" data-image-index="${index}" aria-label="Use product image ${index + 1}"><img src="${escapeHtml(url)}" alt="" /></button>`
  ).join("");
}
$("imageChoices").addEventListener("click", (event) => {
  const button = event.target.closest("[data-image-index]");
  if (!button) return;
  const index = Number(button.dataset.imageIndex);
  const url = imageOptions[index] || "";
  if (!url) return;
  selectedImage = url;
  $("image").value = url;
  $("imagePreview").src = url;
  $("imageChoices").querySelectorAll(".image-choice").forEach((el) => el.classList.toggle("selected", el === button));
});
async function applySupplierRule(host) {
  const suppliers = await getSuppliers();
  const rule = suppliers.find((supplier) => String(supplier.host || "").toLowerCase() === String(host || "").toLowerCase());
  if (!rule) return;
  $("supplier").value = rule.name || $("supplier").value;
  if (plansApi.canUse(entitlement.plan, "supplierDefaults")) {
    $("markup").value = core.nonNegative(rule.defaultMarkup) || $("markup").value;
    $("delivery").value = core.nonNegative(rule.defaultDelivery) || $("delivery").value;
    $("supplierDiscount").value = core.percent(rule.defaultDiscount) || 0;
    $("category").value = rule.defaultCategory || "";
    $("room").value = rule.defaultRoom || "";
  }
}
async function scanPage() {
  const scanButton = $("scan");
  scanButton.disabled = true;
  scanButton.textContent = "Scanning…";
  setStatus("Scanning this page…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active browser tab was found.");
    if (tab.url && !/^https?:/i.test(tab.url)) throw new Error("Open a normal http(s) product page first.");

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["lib/extractor.js"] });
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.ContractorClipperExtractor?.extract(document, location)
    });
    const data = result?.result;
    if (!data) throw new Error("No product information was found.");

    const projects = await ensureProjects();
    const selectedProject = projects.find((project) => project.id === $("project").value) || projects[0];
    const fieldValues = {
      title: data.title, sku: data.sku, brand: data.brand, model: data.model || data.mpn,
      material: data.material, finish: data.finish, color: data.color, dimensions: data.dimensions,
      upc: data.upc, availability: data.availability, description: data.description
    };
    for (const [id, value] of Object.entries(fieldValues)) $(id).value = String(value || "").slice(0, id === "description" ? 1200 : 240);

    $("cost").value = core.nonNegative(core.parseMoney(data.priceRaw)) || "";
    $("currency").value = core.currencyCode(data.currency, selectedProject?.currency || "USD");
    $("url").value = core.safeHttpUrl(data.url);
    $("host").value = String(data.host || "").slice(0, 255);
    renderImages(data.images?.length ? data.images : [data.image]);

    const suppliers = await getSuppliers();
    const known = suppliers.find((supplier) => String(supplier.host || "").toLowerCase() === String(data.host || "").toLowerCase());
    $("supplier").value = known?.name || String(data.host || "").replace(/^www\./i, "").slice(0, 120);
    await applySupplierRule(data.host);

    $("editor").classList.remove("hidden");
    setStatus(`Product detected on ${data.host || "this site"}. Review the fields before saving.`, "success");
  } catch (error) {
    setStatus(`Error: ${error?.message || "Could not scan this page."}`, "error");
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "Scan current product";
  }
}
function itemFromForm(project) {
  const title = $("title").value.trim().slice(0, 240);
  if (!title) throw new Error("Add a product name.");
  const allImages = imageOptions.map(core.safeHttpUrl).filter(Boolean);
  const images = plansApi.canUse(entitlement.plan, "multiImage") ? allImages : [selectedImage].filter(Boolean);
  return {
    id: core.makeId("item"), title, sku: $("sku").value.trim().slice(0, 120),
    brand: $("brand").value.trim().slice(0, 120), model: $("model").value.trim().slice(0, 120),
    description: $("description").value.trim().slice(0, 1200), material: $("material").value.trim().slice(0, 160),
    finish: $("finish").value.trim().slice(0, 160), color: $("color").value.trim().slice(0, 120),
    dimensions: $("dimensions").value.trim().slice(0, 240), upc: $("upc").value.trim().slice(0, 80),
    availability: $("availability").value.trim().slice(0, 120),
    url: core.safeHttpUrl($("url").value), image: selectedImage, images,
    supplier: $("supplier").value.trim().slice(0, 120), room: $("room").value.trim().slice(0, 120),
    category: $("category").value.trim().slice(0, 120),
    cost: core.nonNegative(core.parseMoney($("cost").value)),
    supplierDiscount: plansApi.canUse(entitlement.plan, "supplierDiscounts") ? core.percent($("supplierDiscount").value) : 0,
    qty: Math.max(1, core.nonNegative($("qty").value, 1)),
    markup: core.nonNegative($("markup").value),
    delivery: core.nonNegative($("delivery").value),
    orderStatus: "planned", poRef: "", expectedDate: "",
    currency: core.currencyCode($("currency").value, project?.currency || "USD"),
    clippedAt: Date.now()
  };
}
async function saveItem() {
  const saveButton = $("save");
  saveButton.disabled = true;
  try {
    const clip = plansApi.canClip(entitlement, usage);
    if (!clip.allowed) throw new Error("Free includes 20 clips per month. Upgrade to Pro for unlimited clipping.");

    const projects = await ensureProjects();
    const project = projects.find((candidate) => candidate.id === $("project").value);
    if (!project) throw new Error("Project not found.");
    const item = itemFromForm(project);
    project.currency = item.currency;
    project.updatedAt = Date.now();
    if (!Array.isArray(project.items)) project.items = [];
    project.items.push(item);

    await rememberSupplier(item.supplier, $("host").value);
    usage = plansApi.recordClip(usage);
    await chrome.storage.local.set({ cc_projects: projects, cc_usage_v1: usage });
    renderPlanState();
    setStatus(`Added “${item.title}” to ${project.name || "the quote"}.`, "success");
    saveButton.textContent = "Added ✓";
    setTimeout(() => { saveButton.textContent = "Add to quote"; }, 1200);
  } catch (error) {
    setStatus(`Error: ${error?.message || "Could not add this item."}`, "error");
  } finally { saveButton.disabled = false; }
}
async function saveLibrary() {
  const button = $("saveLibrary");
  button.disabled = true;
  try {
    const projects = await ensureProjects();
    const project = projects.find((candidate) => candidate.id === $("project").value) || projects[0];
    const item = workspace.normalizeLibraryItem(itemFromForm(project));
    const library = await getLibrary();
    const existing = library.findIndex((row) => row.url && item.url && row.url === item.url || (row.sku && item.sku && row.sku.toLowerCase() === item.sku.toLowerCase()));
    if (existing < 0) {
      const allowance = plansApi.allowance(entitlement.plan, "libraryItems", library.length);
      if (!allowance.allowed) throw new Error("Free includes 25 library products. Upgrade to Pro for an unlimited product library.");
      library.unshift(item);
    } else {
      library[existing] = { ...library[existing], ...item, id: library[existing].id, updatedAt: Date.now() };
    }
    await chrome.storage.local.set({ cc_library: library.slice(0, 5000) });
    setStatus(`Saved “${item.title}” to the product library.`, "success");
  } catch (error) {
    setStatus(`Error: ${error?.message || "Could not save to library."}`, "error");
  } finally { button.disabled = false; }
}

$("scan").addEventListener("click", scanPage);
$("save").addEventListener("click", saveItem);
$("saveLibrary").addEventListener("click", saveLibrary);
$("openQuotes").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("quote.html") }));
$("openTools").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") }));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.cc_projects) populateProjects().catch(() => {});
  if (changes.cc_suppliers) populateSuppliers().catch(() => {});
  if (changes.cc_entitlement_v1 || changes.cc_usage_v1) loadPlanState().catch(() => {});
});

Promise.all([populateProjects(), populateSuppliers(), loadPlanState()]).catch(() => setStatus("Error: Could not initialize Contractor Clipper.", "error"));
