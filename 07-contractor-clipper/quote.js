const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);
let projects = [];
let settings = core.defaultSettings();
let currentId = "";
let saveTimer = null;

function esc(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[ch]));
}

function current() {
  return projects.find((project) => project.id === currentId) || projects[0];
}

async function persist() {
  $("saveState").textContent = "Saving…";
  await chrome.storage.local.set({ cc_projects: projects, cc_settings: settings });
  $("saveState").textContent = "Saved locally";
}

function schedulePersist() {
  clearTimeout(saveTimer);
  $("saveState").textContent = "Unsaved changes";
  saveTimer = setTimeout(() => persist().catch(() => { $("saveState").textContent = "Save failed"; }), 180);
}

async function load() {
  const stored = await chrome.storage.local.get(["cc_projects", "cc_settings"]);
  projects = Array.isArray(stored.cc_projects) && stored.cc_projects.length
    ? stored.cc_projects.map(core.normalizeProject)
    : [core.defaultProject()];
  settings = core.normalizeSettings(stored.cc_settings || {});
  currentId = projects[0].id;
  await persist();
  renderPicker();
  syncProjectInputs();
  syncSettingsInputs();
  render();
  renderSuppliers();
}

function renderPicker() {
  const picker = $("projectPicker");
  picker.replaceChildren();
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === currentId;
    picker.appendChild(option);
  });
}

function syncProjectInputs() {
  const project = current();
  if (!project) return;
  $("projectName").value = project.name || "";
  $("client").value = project.client || "";
  $("clientEmail").value = project.clientEmail || "";
  $("projectAddress").value = project.projectAddress || "";
  $("projectCurrency").value = project.currency || "USD";
  $("labor").value = project.labor || 0;
  $("delivery").value = project.delivery || 0;
  $("discount").value = project.discount || 0;
  $("taxPercent").value = project.taxPercent || 0;
}

function syncSettingsInputs() {
  $("companyName").value = settings.companyName || "";
  $("companyEmail").value = settings.companyEmail || "";
  $("companyPhone").value = settings.companyPhone || "";
  $("companyAddress").value = settings.companyAddress || "";
  $("defaultCurrency").value = settings.defaultCurrency || "USD";
  $("defaultMarkup").value = core.toNumber(settings.defaultMarkup, 20);
  $("defaultTaxPercent").value = core.toNumber(settings.defaultTaxPercent, 0);
  renderLogoPreview();
}

function estimateCode(project) {
  const stamp = new Date(project.createdAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(project.id || "quote").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `CC-${stamp}-${suffix || "QUOTE"}`;
}

function renderPrintBrand() {
  const project = current();
  const companyName = settings.companyName.trim() || "Contractor Clipper estimate";
  $("printCompanyName").textContent = companyName;
  const companyMeta = [settings.companyAddress, settings.companyEmail, settings.companyPhone].filter(Boolean).join("\n");
  $("printCompanyMeta").textContent = companyMeta;
  $("footerCompany").textContent = settings.companyName || "";
  $("estimateNumber").textContent = project ? estimateCode(project) : "";
  $("printLogo").classList.toggle("hidden", !settings.companyLogo);
  if (settings.companyLogo) $("printLogo").src = settings.companyLogo;
}

function renderRows() {
  const project = current();
  if (!project) return;
  const fmt = core.currency(project.currency);
  $("items").innerHTML = project.items.map((item) => {
    const image = item.image
      ? `<img src="${esc(item.image)}" alt="" referrerpolicy="no-referrer" />`
      : `<span class="placeholder"></span>`;
    const source = item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a>` : `<strong>${esc(item.title)}</strong>`;
    const detail = [item.sku ? `SKU ${item.sku}` : "", item.notes || ""].filter(Boolean).join(" • ");
    return `<tr data-id="${esc(item.id)}">
      <td><div class="item-cell">${image}<div>${source}<small>${esc(detail)}</small></div></div></td>
      <td><div class="room-stack"><input data-field="room" value="${esc(item.room)}" placeholder="Room" /><input data-field="category" value="${esc(item.category)}" placeholder="Category" /></div></td>
      <td>${esc(item.supplier || item.supplierHost || "—")}</td>
      <td><input data-field="qty" type="number" min="0" step="1" value="${core.toNumber(item.qty, 1)}" /></td>
      <td><input data-field="cost" type="number" min="0" step="0.01" value="${core.toNumber(item.cost)}" /></td>
      <td><input data-field="markup" type="number" step="0.1" value="${core.toNumber(item.markup)}" /></td>
      <td>${fmt(core.sellUnit(item))}</td>
      <td>${fmt(core.lineTotal(item))}</td>
      <td class="no-print"><button class="remove" data-remove="${esc(item.id)}" type="button">Remove</button></td>
    </tr>`;
  }).join("");
  $("empty").classList.toggle("hidden", project.items.length > 0);
}

function renderTotals() {
  const project = current();
  if (!project) return;
  const fmt = core.currency(project.currency || "USD");
  const totals = core.quoteTotals(project);
  $("materials").textContent = fmt(totals.materials);
  $("laborTotal").textContent = fmt(totals.labor);
  $("deliveryTotal").textContent = fmt(totals.delivery);
  $("discountTotal").textContent = totals.discount ? `−${fmt(totals.discount)}` : fmt(0);
  $("subtotal").textContent = fmt(totals.subtotal);
  $("tax").textContent = fmt(totals.tax);
  $("total").textContent = fmt(totals.total);
}

function renderHeader() {
  const project = current();
  if (!project) return;
  $("printProjectName").textContent = project.name || "Untitled project";
  const clientParts = [];
  if (project.client) clientParts.push(`Prepared for ${project.client}`);
  if (project.clientEmail) clientParts.push(project.clientEmail);
  $("printClient").textContent = clientParts.join(" • ");
  $("printProjectAddress").textContent = project.projectAddress || "";
  $("itemCount").textContent = `${project.items.length} ${project.items.length === 1 ? "item" : "items"}`;
  $("updatedAt").textContent = `Updated ${new Date(project.updatedAt || Date.now()).toLocaleDateString()}`;
}

function render() {
  renderPrintBrand();
  renderHeader();
  renderRows();
  renderTotals();
}

function touchProject() {
  const project = current();
  if (project) project.updatedAt = Date.now();
}

function setProjectField(field, value, { renderAll = false } = {}) {
  const project = current();
  if (!project) return;
  project[field] = value;
  touchProject();
  if (field === "name") renderPicker();
  if (renderAll) render();
  else {
    renderHeader();
    renderTotals();
  }
  schedulePersist();
}

function renderLogoPreview() {
  const hasLogo = Boolean(settings.companyLogo);
  $("logoPreviewRow").classList.toggle("hidden", !hasLogo);
  if (hasLogo) $("logoPreview").src = settings.companyLogo;
}

function renderSuppliers() {
  const wrap = $("supplierManager");
  wrap.replaceChildren();
  $("supplierEmpty").classList.toggle("hidden", settings.savedSuppliers.length > 0);
  settings.savedSuppliers.forEach((supplier) => {
    const row = document.createElement("div");
    row.className = "supplier-row";
    row.dataset.id = supplier.id;
    const input = document.createElement("input");
    input.value = supplier.name;
    input.dataset.supplierName = supplier.id;
    input.setAttribute("aria-label", `Name for ${supplier.host || "supplier"}`);
    const host = document.createElement("small");
    host.textContent = supplier.host || "Saved supplier";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button danger-text";
    remove.dataset.removeSupplier = supplier.id;
    remove.textContent = "Remove";
    row.append(input, host, remove);
    wrap.appendChild(row);
  });
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadBlob(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
  const project = current();
  const totals = core.quoteTotals(project);
  const rows = [
    ["Project", project.name],
    ["Client", project.client],
    ["Currency", project.currency],
    [],
    ["Product", "SKU", "Supplier", "Room", "Category", "Quantity", "Unit cost", "Markup %", "Sell/unit", "Line total", "Source URL"]
  ];
  project.items.forEach((item) => rows.push([
    item.title, item.sku, item.supplier || item.supplierHost, item.room, item.category, item.qty, item.cost, item.markup,
    core.sellUnit(item), core.lineTotal(item), item.url
  ]));
  rows.push([], ["Materials", totals.materials], ["Labour", totals.labor], ["Delivery", totals.delivery], ["Discount", totals.discount], ["Tax", totals.tax], ["Total", totals.total]);
  downloadBlob(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`, "text/csv;charset=utf-8", `${core.safeFileName(project.name)}.csv`);
}

function exportExcel() {
  const project = current();
  const totals = core.quoteTotals(project);
  const rows = project.items.map((item) => `<tr><td>${esc(item.title)}</td><td>${esc(item.sku)}</td><td>${esc(item.supplier || item.supplierHost)}</td><td>${esc(item.room)}</td><td>${esc(item.category)}</td><td>${item.qty}</td><td>${item.cost}</td><td>${item.markup}</td><td>${core.sellUnit(item)}</td><td>${core.lineTotal(item)}</td><td>${esc(item.url)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><tr><th colspan="11">${esc(project.name)}</th></tr><tr><td colspan="11">Client: ${esc(project.client)} | Currency: ${esc(project.currency)}</td></tr><tr><th>Product</th><th>SKU</th><th>Supplier</th><th>Room</th><th>Category</th><th>Qty</th><th>Unit cost</th><th>Markup %</th><th>Sell/unit</th><th>Line total</th><th>Source URL</th></tr>${rows}<tr><td colspan="9"></td><th>Total</th><td>${totals.total}</td></tr></table></body></html>`;
  downloadBlob(`\uFEFF${html}`, "application/vnd.ms-excel;charset=utf-8", `${core.safeFileName(project.name)}.xls`);
}

$("projectPicker").addEventListener("change", (event) => {
  currentId = event.target.value;
  syncProjectInputs();
  render();
});

$("projectName").addEventListener("input", (event) => setProjectField("name", event.target.value || "Untitled project"));
$("client").addEventListener("input", (event) => setProjectField("client", event.target.value));
$("clientEmail").addEventListener("input", (event) => setProjectField("clientEmail", event.target.value));
$("projectAddress").addEventListener("input", (event) => setProjectField("projectAddress", event.target.value));
$("projectCurrency").addEventListener("change", (event) => {
  const code = (event.target.value || "USD").trim().toUpperCase().slice(0, 3);
  event.target.value = code;
  setProjectField("currency", code, { renderAll: true });
});
[["labor", "labor"], ["delivery", "delivery"], ["discount", "discount"], ["taxPercent", "taxPercent"]].forEach(([id, field]) => {
  $(id).addEventListener("input", (event) => setProjectField(field, Math.max(0, core.toNumber(event.target.value))));
});

$("items").addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const row = event.target.closest("tr");
  const item = current()?.items.find((candidate) => candidate.id === row?.dataset.id);
  if (!item) return;
  if (["qty", "cost", "markup"].includes(field)) item[field] = field === "qty" || field === "cost" ? Math.max(0, core.toNumber(event.target.value)) : core.toNumber(event.target.value);
  else item[field] = event.target.value;
  touchProject();
  renderTotals();
  schedulePersist();
});

$("items").addEventListener("change", (event) => {
  if (["qty", "cost", "markup"].includes(event.target.dataset.field)) renderRows();
});

$("items").addEventListener("click", (event) => {
  const id = event.target.dataset.remove;
  if (!id) return;
  const project = current();
  project.items = project.items.filter((item) => item.id !== id);
  touchProject();
  render();
  schedulePersist();
});

$("newProject").addEventListener("click", () => {
  const name = prompt("Project name", `Project ${projects.length + 1}`);
  if (!name?.trim()) return;
  const project = core.defaultProject({
    id: core.makeId("project"),
    name: name.trim(),
    currency: settings.defaultCurrency,
    taxPercent: settings.defaultTaxPercent,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  projects.push(project);
  currentId = project.id;
  renderPicker();
  syncProjectInputs();
  render();
  schedulePersist();
});

$("duplicateProject").addEventListener("click", () => {
  const source = current();
  const copy = core.normalizeProject({
    ...source,
    id: core.makeId("project"),
    name: `${source.name} copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: source.items.map((item) => ({ ...item, id: core.makeId("item"), clippedAt: Date.now() }))
  });
  projects.push(copy);
  currentId = copy.id;
  renderPicker();
  syncProjectInputs();
  render();
  schedulePersist();
});

$("deleteProject").addEventListener("click", () => {
  const project = current();
  if (!project || !confirm(`Delete “${project.name}”? This cannot be undone.`)) return;
  projects = projects.filter((candidate) => candidate.id !== project.id);
  if (!projects.length) projects = [core.defaultProject({ currency: settings.defaultCurrency, taxPercent: settings.defaultTaxPercent })];
  currentId = projects[0].id;
  renderPicker();
  syncProjectInputs();
  render();
  schedulePersist();
});

const settingTextFields = ["companyName", "companyEmail", "companyPhone", "companyAddress"];
settingTextFields.forEach((id) => {
  $(id).addEventListener("input", (event) => {
    settings[id] = event.target.value;
    renderPrintBrand();
    schedulePersist();
  });
});
$("defaultCurrency").addEventListener("change", (event) => { settings.defaultCurrency = (event.target.value || "USD").trim().toUpperCase().slice(0, 3); event.target.value = settings.defaultCurrency; schedulePersist(); });
$("defaultMarkup").addEventListener("input", (event) => { settings.defaultMarkup = core.toNumber(event.target.value, 20); schedulePersist(); });
$("defaultTaxPercent").addEventListener("input", (event) => { settings.defaultTaxPercent = Math.max(0, core.toNumber(event.target.value)); schedulePersist(); });

$("companyLogo").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 800000) {
    alert("Use a PNG, JPEG or WebP logo smaller than 800 KB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    settings.companyLogo = String(reader.result || "");
    renderLogoPreview();
    renderPrintBrand();
    schedulePersist();
  };
  reader.readAsDataURL(file);
});

$("removeLogo").addEventListener("click", () => {
  settings.companyLogo = "";
  $("companyLogo").value = "";
  renderLogoPreview();
  renderPrintBrand();
  schedulePersist();
});

$("supplierManager").addEventListener("input", (event) => {
  const id = event.target.dataset.supplierName;
  if (!id) return;
  const supplier = settings.savedSuppliers.find((candidate) => candidate.id === id);
  if (!supplier) return;
  supplier.name = event.target.value;
  schedulePersist();
});
$("supplierManager").addEventListener("click", (event) => {
  const id = event.target.dataset.removeSupplier;
  if (!id) return;
  settings.savedSuppliers = settings.savedSuppliers.filter((supplier) => supplier.id !== id);
  renderSuppliers();
  schedulePersist();
});

$("exportCsv").addEventListener("click", exportCsv);
$("exportExcel").addEventListener("click", exportExcel);
$("printQuote").addEventListener("click", () => window.print());

load().catch((error) => {
  console.error(error);
  $("saveState").textContent = "Could not load data";
});
