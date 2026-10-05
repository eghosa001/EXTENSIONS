const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);
let projects = [];
let currentId = "";

function esc(value) {
  return String(value || "").replace(/[&<>'\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[ch]));
}

async function load() {
  const result = await chrome.storage.local.get("cc_projects");
  projects = Array.isArray(result.cc_projects) ? result.cc_projects : [];
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
      <td><div class="item-cell">${image}<div><a href="${esc(item.url || "#")}" target="_blank" rel="noreferrer">${esc(item.title)}</a><small>${esc(item.sku || "No SKU")}</small></div></div></td>
      <td><input data-field="qty" type="number" min="0" step="1" value="${core.toNumber(item.qty, 1)}" /></td>
      <td><input data-field="cost" type="number" min="0" step="0.01" value="${core.toNumber(item.cost)}" /></td>
      <td><input data-field="markup" type="number" step="0.1" value="${core.toNumber(item.markup)}" /></td>
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

$("printQuote").addEventListener("click", () => window.print());
$("exportCsv").addEventListener("click", () => {
  const p = current();
  const rows = [["Product", "SKU", "Quantity", "Unit cost", "Markup %", "Sell/unit", "Line total", "Source URL"]];
  p.items.forEach((item) => rows.push([item.title, item.sku, item.qty, item.cost, item.markup, core.sellUnit(item), core.lineTotal(item), item.url]));
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(p.name || "quote").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

load();
