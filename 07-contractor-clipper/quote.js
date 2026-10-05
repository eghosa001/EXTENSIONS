const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);
let projects = [];
let currentId = "";
let brand = { business: "", email: "", phone: "", website: "", logoDataUrl: "" };

function esc(value) {
  return String(value || "").replace(/[&<>'\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[ch]));
}

async function load() {
  const result = await chrome.storage.local.get(["cc_projects", "cc_brand"]);
  projects = Array.isArray(result.cc_projects) ? result.cc_projects : [];
  brand = result.cc_brand && typeof result.cc_brand === "object" ? { ...brand, ...result.cc_brand } : brand;
  if (!projects.length) {
    projects = [{ id: "inbox", name: "Quick Quote", client: "", currency: "USD", labor: 0, taxPercent: 0, discount: 0, createdAt: Date.now(), items: [] }];
    await save();
  }
  currentId = currentId || projects[0].id;
  renderPicker();
  render();
}

function current() { return projects.find((p) => p.id === currentId) || projects[0]; }
async function save() { await chrome.storage.local.set({ cc_projects: projects }); }
async function saveBrand() { await chrome.storage.local.set({ cc_brand: brand }); }

function renderPicker() {
  $("projectPicker").innerHTML = projects.map((p) => `<option value="${p.id}" ${p.id === currentId ? "selected" : ""}>${esc(p.name)}</option>`).join("");
}

function render() {
  const p = current();
  if (!p) return;
  const fmt = core.currency(p.currency || "USD");
  $("projectName").value = p.name || "";
  $("client").value = p.client || "";
  $("projectCurrency").value = p.currency || "USD";
  $("brandBusiness").value = brand.business || "";
  $("brandEmail").value = brand.email || "";
  $("brandPhone").value = brand.phone || "";
  $("brandWebsite").value = brand.website || "";
  $("brandName").textContent = brand.business || "";
  $("brandContact").textContent = [brand.email, brand.phone, brand.website].filter(Boolean).join(" · ");
  $("brandLogo").src = brand.logoDataUrl || "";
  $("brandLogo").style.display = brand.logoDataUrl ? "block" : "none";
  $("labor").value = p.labor || 0;
  $("discount").value = p.discount || 0;
  $("taxPercent").value = p.taxPercent || 0;
  $("printProjectName").textContent = p.name || "Untitled project";
  $("printClient").textContent = p.client ? `Prepared for ${p.client}` : "";
  $("itemCount").textContent = `${p.items.length} ${p.items.length === 1 ? "item" : "items"}`;
  $("updatedAt").textContent = `Updated ${new Date().toLocaleDateString()}`;
  $("empty").style.display = p.items.length ? "none" : "block";

  $("items").innerHTML = p.items.map((item) => {
    const image = item.image ? `<img src="${esc(item.image)}" alt="" />` : `<span></span>`;
    const sell = core.sellUnit(item);
    return `<tr data-id="${item.id}">
      <td><div class="item-cell">${image}<div><a href="${esc(item.url || "#")}" target="_blank" rel="noreferrer">${esc(item.title)}</a><small>${esc([item.sku || "No SKU", item.supplier, item.room, item.category].filter(Boolean).join(" · "))}</small></div></div></td>
      <td><input data-field="qty" type="number" min="0" step="1" value="${core.toNumber(item.qty, 1)}" /></td>
      <td><input data-field="cost" type="number" min="0" step="0.01" value="${core.toNumber(item.cost)}" /></td>
      <td><input data-field="markup" type="number" step="0.1" value="${core.toNumber(item.markup)}" /></td>
      <td><input data-field="delivery" type="number" min="0" step="0.01" value="${core.toNumber(item.delivery)}" /></td>
      <td>${fmt(sell)}</td><td>${fmt(core.lineTotal(item))}</td>
      <td class="no-print"><button class="remove" data-remove="${item.id}" title="Remove">Remove</button></td>
    </tr>`;
  }).join("");

  const totals = core.quoteTotals(p);
  $("materials").textContent = fmt(totals.materials);
  $("laborTotal").textContent = fmt(totals.labor);
  $("discountTotal").textContent = totals.discount ? `−${fmt(totals.discount)}` : fmt(0);
  $("subtotal").textContent = fmt(totals.subtotal);
  $("tax").textContent = fmt(totals.tax);
  $("total").textContent = fmt(totals.total);
}

async function mutateProject(field, value) {
  const p = current();
  p[field] = value;
  await save();
  if (field === "name") renderPicker();
  render();
}

$("projectPicker").addEventListener("change", (e) => { currentId = e.target.value; render(); });
$("projectName").addEventListener("change", (e) => mutateProject("name", e.target.value.trim() || "Untitled project"));
$("client").addEventListener("change", (e) => mutateProject("client", e.target.value.trim()));
$("projectCurrency").addEventListener("change", (e) => mutateProject("currency", (e.target.value || "USD").toUpperCase().slice(0, 3)));
$("labor").addEventListener("change", (e) => mutateProject("labor", core.toNumber(e.target.value)));
$("discount").addEventListener("change", (e) => mutateProject("discount", core.toNumber(e.target.value)));
$("taxPercent").addEventListener("change", (e) => mutateProject("taxPercent", core.toNumber(e.target.value)));

[
  ["brandBusiness", "business"],
  ["brandEmail", "email"],
  ["brandPhone", "phone"],
  ["brandWebsite", "website"]
].forEach(([id, field]) => {
  $(id).addEventListener("change", async (e) => {
    brand[field] = e.target.value.trim();
    await saveBrand();
    render();
  });
});

$("brandLogoInput").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 500000) {
    alert("Use a logo smaller than 500 KB.");
    e.target.value = "";
    return;
  }
  try {
    const logoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read logo."));
      reader.readAsDataURL(file);
    });
    brand.logoDataUrl = logoDataUrl;
    await saveBrand();
    render();
  } catch {
    alert("Could not save that logo. Try a PNG, JPEG or WebP image.");
  }
});

$("items").addEventListener("change", async (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const row = e.target.closest("tr");
  const item = current().items.find((x) => x.id === row?.dataset.id);
  if (!item) return;
  item[field] = field === "qty" ? Math.max(0, core.toNumber(e.target.value)) : core.toNumber(e.target.value);
  await save();
  render();
});

$("items").addEventListener("click", async (e) => {
  const id = e.target.dataset.remove;
  if (!id) return;
  current().items = current().items.filter((x) => x.id !== id);
  await save();
  render();
});

$("newProject").addEventListener("click", async () => {
  const name = prompt("Project name", `Project ${projects.length + 1}`);
  if (!name) return;
  const project = { id: core.makeId("project"), name: name.trim(), client: "", currency: current()?.currency || "USD", labor: 0, taxPercent: 0, discount: 0, createdAt: Date.now(), items: [] };
  projects.push(project);
  currentId = project.id;
  await save();
  renderPicker();
  render();
});

$("duplicateProject").addEventListener("click", async () => {
  const source = current();
  if (!source) return;
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = core.makeId("project");
  copy.name = `${source.name || "Project"} Copy`;
  copy.createdAt = Date.now();
  projects.push(copy);
  currentId = copy.id;
  await save();
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
  await save();
  renderPicker();
  render();
});

$("printQuote").addEventListener("click", () => window.print());
function exportRows() {
  const p = current();
  const rows = [["Product", "SKU", "Supplier", "Room / area", "Category", "Quantity", "Unit cost", "Markup %", "Delivery", "Sell/unit", "Line total", "Source URL"]];
  p.items.forEach((item) => rows.push([
    item.title, item.sku, item.supplier, item.room, item.category, item.qty, item.cost,
    item.markup, item.delivery || 0, core.sellUnit(item), core.lineTotal(item), item.url
  ]));
  return rows;
}

$("exportCsv").addEventListener("click", () => {
  const p = current();
  const rows = exportRows();
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(p.name || "quote").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("exportExcel").addEventListener("click", () => {
  const p = current();
  const rows = exportRows();
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${rows.map((row) =>
    `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`
  ).join("")}</table></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(p.name || "quote").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xls`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

load();
