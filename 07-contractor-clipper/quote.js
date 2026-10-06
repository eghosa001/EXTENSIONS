const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);
let projects = [];
let currentId = "";
let brand = { business: "", email: "", phone: "", website: "", logoDataUrl: "" };
let reloadingFromStorage = false;

function esc(value) {
  return String(value || "").replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[ch]));
}

function text(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function localDateValue(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function plusDays(timestamp, days) {
  const date = new Date(Number(timestamp) || Date.now());
  date.setDate(date.getDate() + days);
  return localDateValue(date.getTime());
}

function displayDate(value) {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "";
}

function normalizeId(value, prefix) {
  const id = String(value || "");
  return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : core.makeId(prefix);
}

function quoteNumberFor(project) {
  const date = localDateValue(project.createdAt).replaceAll("-", "");
  const suffix = String(project.id || "").replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase() || "QUOTE";
  return `EST-${date}-${suffix}`;
}

function normalizeItem(raw = {}) {
  const images = (Array.isArray(raw.images) ? raw.images : [raw.image]).map(core.safeHttpUrl).filter(Boolean).slice(0, 12);
  return {
    id: normalizeId(raw.id, "item"),
    title: text(raw.title || "Untitled item", 240),
    sku: text(raw.sku, 120),
    brand: text(raw.brand, 120),
    model: text(raw.model, 120),
    description: text(raw.description, 1200),
    material: text(raw.material, 160),
    finish: text(raw.finish, 160),
    color: text(raw.color, 120),
    dimensions: text(raw.dimensions, 240),
    upc: text(raw.upc, 80),
    availability: text(raw.availability, 120),
    url: core.safeHttpUrl(raw.url),
    image: images[0] || "",
    images,
    supplier: text(raw.supplier, 120),
    room: text(raw.room, 120),
    category: text(raw.category, 120),
    cost: core.nonNegative(raw.cost),
    supplierDiscount: core.percent(raw.supplierDiscount),
    qty: Math.max(1, core.nonNegative(raw.qty, 1)),
    markup: core.nonNegative(raw.markup),
    delivery: core.nonNegative(raw.delivery),
    orderStatus: ["planned","ordered","shipped","delivered","cancelled"].includes(String(raw.orderStatus || "").toLowerCase()) ? String(raw.orderStatus).toLowerCase() : "planned",
    poRef: text(raw.poRef, 120),
    expectedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.expectedDate || "")) ? raw.expectedDate : "",
    clippedAt: core.nonNegative(raw.clippedAt, Date.now())
  };
}

function normalizeProject(raw = {}, index = 0) {
  const createdAt = core.nonNegative(raw.createdAt, Date.now()) || Date.now();
  const project = {
    id: normalizeId(raw.id, "project"),
    name: text(raw.name || `Project ${index + 1}`, 160),
    client: text(raw.client, 160),
    clientEmail: text(raw.clientEmail, 180),
    jobAddress: text(raw.jobAddress, 500),
    currency: core.currencyCode(raw.currency, "USD"),
    quoteNumber: text(raw.quoteNumber, 80),
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.validUntil || "")) ? raw.validUntil : plusDays(createdAt, 30),
    notes: text(raw.notes, 3000),
    labor: core.nonNegative(raw.labor),
    laborItems: Array.isArray(raw.laborItems) ? raw.laborItems.slice(0, 100).map((row) => ({ id: normalizeId(row?.id, "labor_item"), name: text(row?.name, 120), hours: core.nonNegative(row?.hours), rate: core.nonNegative(row?.rate) })) : [],
    acceptanceStatus: ["draft","pending","accepted","declined"].includes(String(raw.acceptanceStatus || "").toLowerCase()) ? String(raw.acceptanceStatus).toLowerCase() : "draft",
    acceptanceBy: text(raw.acceptanceBy, 160),
    acceptanceAt: text(raw.acceptanceAt, 80),
    acceptanceHash: text(raw.acceptanceHash, 160),
    taxPercent: core.nonNegative(raw.taxPercent),
    discount: core.nonNegative(raw.discount),
    createdAt,
    updatedAt: core.nonNegative(raw.updatedAt, createdAt),
    items: Array.isArray(raw.items) ? raw.items.slice(0, 2000).map(normalizeItem) : []
  };
  project.quoteNumber = project.quoteNumber || quoteNumberFor(project);
  return project;
}

function newProject(name, currency = "USD") {
  const now = Date.now();
  const project = normalizeProject({
    id: core.makeId("project"),
    name: text(name || "Untitled project", 160),
    currency,
    createdAt: now,
    updatedAt: now,
    validUntil: plusDays(now, 30),
    items: []
  });
  project.quoteNumber = quoteNumberFor(project);
  return project;
}

function normalizeBrand(raw = {}) {
  return {
    business: text(raw.business, 160),
    email: text(raw.email, 180),
    phone: text(raw.phone, 80),
    website: text(raw.website, 180),
    logoDataUrl: core.safeImageDataUrl(raw.logoDataUrl)
  };
}

function current() {
  return projects.find((project) => project.id === currentId) || projects[0];
}

async function load({ preserveCurrent = true } = {}) {
  if (reloadingFromStorage) return;
  reloadingFromStorage = true;
  try {
    const result = await chrome.storage.local.get(["cc_projects", "cc_brand"]);
    const rawProjects = Array.isArray(result.cc_projects) ? result.cc_projects : [];
    projects = rawProjects.length ? rawProjects.slice(0, 500).map(normalizeProject) : [newProject("Quick Quote")];
    brand = normalizeBrand(result.cc_brand);
    if (!preserveCurrent || !projects.some((project) => project.id === currentId)) currentId = projects[0].id;
    renderPicker();
    render();
    if (!rawProjects.length) await chrome.storage.local.set({ cc_projects: projects });
  } finally {
    reloadingFromStorage = false;
  }
}

async function save({ touch = true } = {}) {
  const project = current();
  if (touch && project) project.updatedAt = Date.now();
  await chrome.storage.local.set({ cc_projects: projects });
}

async function saveBrand() {
  brand = normalizeBrand(brand);
  await chrome.storage.local.set({ cc_brand: brand });
}

function renderPicker() {
  $("projectPicker").innerHTML = projects.map((project) =>
    `<option value="${esc(project.id)}" ${project.id === currentId ? "selected" : ""}>${esc(project.name)}</option>`
  ).join("");
}

function render() {
  const project = current();
  if (!project) return;

  const fmt = core.currency(project.currency);
  $("projectName").value = project.name;
  $("client").value = project.client;
  $("clientEmail").value = project.clientEmail;
  $("jobAddress").value = project.jobAddress;
  $("quoteNumber").value = project.quoteNumber;
  $("validUntil").value = project.validUntil;
  $("projectCurrency").value = project.currency;
  $("notes").value = project.notes;
  $("labor").value = project.labor;
  $("discount").value = project.discount;
  $("taxPercent").value = project.taxPercent;

  $("brandBusiness").value = brand.business;
  $("brandEmail").value = brand.email;
  $("brandPhone").value = brand.phone;
  $("brandWebsite").value = brand.website;
  $("brandName").textContent = brand.business;
  $("brandContact").textContent = [brand.email, brand.phone, brand.website].filter(Boolean).join(" · ");
  $("brandLogo").src = brand.logoDataUrl;
  $("brandLogo").style.display = brand.logoDataUrl ? "block" : "none";

  $("printProjectName").textContent = project.name || "Untitled project";
  $("printClient").textContent = project.client ? `Prepared for ${project.client}` : "";
  $("printClientEmail").textContent = project.clientEmail;
  $("printJobAddress").textContent = project.jobAddress;
  $("printQuoteNumber").textContent = project.quoteNumber;
  $("issuedAt").textContent = `Issued ${displayDate(project.createdAt)}`;
  $("printValidUntil").textContent = project.validUntil ? `Valid until ${displayDate(project.validUntil)}` : "";
  $("itemCount").textContent = `${project.items.length} ${project.items.length === 1 ? "item" : "items"}`;
  $("empty").style.display = project.items.length ? "none" : "block";

  $("items").innerHTML = project.items.map((item) => {
    const imageUrl = core.safeHttpUrl(item.image);
    const sourceUrl = core.safeHttpUrl(item.url);
    const image = imageUrl ? `<img src="${esc(imageUrl)}" alt="" />` : `<span></span>`;
    const title = sourceUrl
      ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noreferrer">${esc(item.title)}</a>`
      : `<span class="item-title">${esc(item.title)}</span>`;
    const meta = [item.sku || "No SKU", item.supplier, item.room, item.category].filter(Boolean).join(" · ");
    return `<tr data-id="${esc(item.id)}">
      <td><div class="item-cell">${image}<div>${title}<small>${esc(meta)}</small></div></div></td>
      <td><input class="print-field" data-field="qty" aria-label="Quantity for ${esc(item.title)}" type="number" min="1" step="1" value="${item.qty}" /></td>
      <td class="no-print"><input data-field="cost" aria-label="Cost for ${esc(item.title)}" type="number" min="0" step="0.01" value="${item.cost}" /></td>
      <td class="no-print"><input data-field="markup" aria-label="Markup for ${esc(item.title)}" type="number" min="0" step="0.1" value="${item.markup}" /></td>
      <td><input class="print-field" data-field="delivery" aria-label="Delivery for ${esc(item.title)}" type="number" min="0" step="0.01" value="${item.delivery}" /></td>
      <td>${fmt(core.sellUnit(item))}</td>
      <td>${fmt(core.lineTotal(item))}</td>
      <td class="no-print"><button class="remove" data-remove="${esc(item.id)}" type="button">Remove</button></td>
    </tr>`;
  }).join("");

  const totals = core.quoteTotals(project);
  $("products").textContent = fmt(totals.products);
  $("deliveryTotal").textContent = fmt(totals.delivery);
  $("laborTotal").textContent = fmt(totals.labor);
  $("discountTotal").textContent = totals.discount ? `−${fmt(totals.discount)}` : fmt(0);
  $("subtotal").textContent = fmt(totals.subtotal);
  $("tax").textContent = fmt(totals.tax);
  $("total").textContent = fmt(totals.total);

  $("printNotes").textContent = project.notes;
  $("printNotesSection").classList.toggle("hidden", !project.notes);
}

async function mutateProject(field, value) {
  const project = current();
  if (!project) return;

  if (["labor", "discount", "taxPercent"].includes(field)) project[field] = core.nonNegative(value);
  else if (field === "currency") project.currency = core.currencyCode(value, project.currency);
  else if (field === "validUntil") project.validUntil = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : "";
  else {
    const max = field === "notes" ? 3000 : field === "jobAddress" ? 500 : 180;
    project[field] = text(value, max);
  }

  await save();
  if (field === "name") renderPicker();
  render();
}

[
  ["projectName", "name"],
  ["client", "client"],
  ["clientEmail", "clientEmail"],
  ["jobAddress", "jobAddress"],
  ["quoteNumber", "quoteNumber"],
  ["validUntil", "validUntil"],
  ["projectCurrency", "currency"],
  ["notes", "notes"],
  ["labor", "labor"],
  ["discount", "discount"],
  ["taxPercent", "taxPercent"]
].forEach(([id, field]) => {
  $(id).addEventListener("change", (event) => mutateProject(field, event.target.value));
});

$("projectPicker").addEventListener("change", (event) => {
  currentId = event.target.value;
  render();
});

[
  ["brandBusiness", "business"],
  ["brandEmail", "email"],
  ["brandPhone", "phone"],
  ["brandWebsite", "website"]
].forEach(([id, field]) => {
  $(id).addEventListener("change", async (event) => {
    brand[field] = event.target.value;
    await saveBrand();
    render();
  });
});

$("brandLogoInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 500000) {
    alert("Use a PNG, JPEG or WebP logo smaller than 500 KB.");
    event.target.value = "";
    return;
  }

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read logo."));
      reader.readAsDataURL(file);
    });
    const safeLogo = core.safeImageDataUrl(dataUrl);
    if (!safeLogo) throw new Error("Unsupported image data.");
    brand.logoDataUrl = safeLogo;
    await saveBrand();
    render();
  } catch {
    alert("Could not save that logo. Try another PNG, JPEG or WebP image.");
  } finally {
    event.target.value = "";
  }
});

$("items").addEventListener("change", async (event) => {
  const field = event.target.dataset.field;
  if (!field) return;

  const row = event.target.closest("tr");
  const item = current()?.items.find((candidate) => candidate.id === row?.dataset.id);
  if (!item) return;

  if (field === "qty") item.qty = Math.max(1, core.nonNegative(event.target.value, 1));
  else if (["cost", "markup", "delivery"].includes(field)) item[field] = core.nonNegative(event.target.value);

  await save();
  render();
});

$("items").addEventListener("click", async (event) => {
  const id = event.target.dataset.remove;
  if (!id) return;

  const project = current();
  const item = project?.items.find((candidate) => candidate.id === id);
  if (!project || !item) return;
  if (!confirm(`Remove “${item.title}” from this estimate?`)) return;

  project.items = project.items.filter((candidate) => candidate.id !== id);
  await save();
  render();
});

$("newProject").addEventListener("click", async () => {
  const name = prompt("Project name", `Project ${projects.length + 1}`);
  if (!name?.trim()) return;

  const project = newProject(name, current()?.currency || "USD");
  projects.push(project);
  currentId = project.id;
  await save({ touch: false });
  renderPicker();
  render();
});

$("duplicateProject").addEventListener("click", async () => {
  const source = current();
  if (!source) return;

  const now = Date.now();
  const copy = normalizeProject(JSON.parse(JSON.stringify(source)));
  copy.id = core.makeId("project");
  copy.name = `${source.name || "Project"} Copy`;
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.validUntil = plusDays(now, 30);
  copy.items = copy.items.map((item) => ({ ...item, id: core.makeId("item") }));
  copy.laborItems = (copy.laborItems || []).map((row) => ({ ...row, id: core.makeId("labor_item") }));
  copy.acceptanceStatus = "draft"; copy.acceptanceBy = ""; copy.acceptanceAt = ""; copy.acceptanceHash = "";
  copy.quoteNumber = quoteNumberFor(copy);

  projects.push(copy);
  currentId = copy.id;
  await save({ touch: false });
  renderPicker();
  render();
});

$("deleteProject").addEventListener("click", async () => {
  if (projects.length <= 1) {
    alert("Keep at least one project in the workspace.");
    return;
  }

  const target = current();
  if (!target || !confirm(`Delete “${target.name}”? This cannot be undone.`)) return;

  projects = projects.filter((project) => project.id !== target.id);
  currentId = projects[0].id;
  await save({ touch: false });
  renderPicker();
  render();
});

function exportRows() {
  const project = current();
  const rows = [["Product", "SKU", "Brand", "Model", "Material", "Finish", "Colour", "Dimensions", "UPC / GTIN", "Availability", "Supplier", "Room / area", "Category", "Quantity", "Supplier price", "Supplier discount %", "Effective cost", "Markup %", "Delivery", "Sell/unit", "Line total", "Order status", "PO ref", "Expected date", "Source URL"]];
  project.items.forEach((item) => rows.push([
    item.title, item.sku, item.brand, item.model, item.material, item.finish, item.color, item.dimensions, item.upc, item.availability,
    item.supplier, item.room, item.category, item.qty, item.cost, item.supplierDiscount, core.effectiveCost(item), item.markup,
    item.delivery, core.sellUnit(item), core.lineTotal(item), item.orderStatus, item.poRef, item.expectedDate, item.url
  ]));
  return rows;
}

function downloadBlob(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("exportCsv").addEventListener("click", () => {
  const project = current();
  downloadBlob(core.csv(exportRows()), "text/csv;charset=utf-8", `${core.safeFilename(project.name)}.csv`);
});

$("exportExcel").addEventListener("click", () => {
  const project = current();
  const workbook = core.spreadsheetXml(exportRows(), project.name);
  downloadBlob(workbook, "application/vnd.ms-excel;charset=utf-8", `${core.safeFilename(project.name)}.xml`);
});

$("backupJson").addEventListener("click", async () => {
  const data = await chrome.storage.local.get(["cc_projects", "cc_suppliers", "cc_brand", "cc_library", "cc_labor_rates", "cc_assemblies", "cc_quote_templates"]);
  const payload = {
    schemaVersion: 1,
    product: "Contractor Clipper",
    exportedAt: new Date().toISOString(),
    data
  };
  downloadBlob(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", `contractor-clipper-backup-${localDateValue(Date.now())}.json`);
});

$("importBackup").addEventListener("click", () => $("importBackupInput").click());

$("importBackupInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 5000000) return alert("Backup is too large. Maximum size is 5 MB.");

  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.data || parsed;
    if (!Array.isArray(data?.cc_projects) || !data.cc_projects.length) throw new Error("No projects were found in this backup.");
    if (!confirm("Restore this backup? Current Contractor Clipper projects, suppliers and branding will be replaced.")) return;

    const restoredProjects = data.cc_projects.slice(0, 500).map(normalizeProject);
    const restoredSuppliers = Array.isArray(data.cc_suppliers)
      ? data.cc_suppliers.slice(0, 500).map((supplier) => ({
          id: normalizeId(supplier?.id, "supplier"),
          name: text(supplier?.name, 120),
          host: text(supplier?.host, 255).toLowerCase(),
          lastUsedAt: core.nonNegative(supplier?.lastUsedAt)
        })).filter((supplier) => supplier.name)
      : [];
    const restoredBrand = normalizeBrand(data.cc_brand);

    await chrome.storage.local.set({
      cc_projects: restoredProjects,
      cc_suppliers: restoredSuppliers,
      cc_brand: restoredBrand,
      cc_library: Array.isArray(data.cc_library) ? data.cc_library.slice(0, 5000) : [],
      cc_labor_rates: Array.isArray(data.cc_labor_rates) ? data.cc_labor_rates.slice(0, 1000) : [],
      cc_assemblies: Array.isArray(data.cc_assemblies) ? data.cc_assemblies.slice(0, 1000) : [],
      cc_quote_templates: Array.isArray(data.cc_quote_templates) ? data.cc_quote_templates.slice(0, 1000) : []
    });
    currentId = restoredProjects[0].id;
    await load({ preserveCurrent: true });
    alert("Backup restored.");
  } catch (error) {
    alert(`Could not restore backup: ${error?.message || "Invalid backup file."}`);
  }
});

$("printQuote").addEventListener("click", () => {
  document.activeElement?.blur();
  setTimeout(() => window.print(), 0);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || reloadingFromStorage) return;
  if (changes.cc_projects || changes.cc_brand) load({ preserveCurrent: true }).catch(() => {});
});

load({ preserveCurrent: false }).catch(() => alert("Could not load Contractor Clipper data."));
