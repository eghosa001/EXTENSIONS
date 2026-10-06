const ccPlans = globalThis.ContractorClipperPlans;
const ccWorkspace = globalThis.ContractorClipperWorkspace;
const ccBilling = globalThis.ContractorClipperBilling;
let ccEntitlement = ccPlans.normalizeEntitlement({ plan: "free" });
let ccLaborRates = [];

function ccPlanAllows(feature) { return ccPlans.canUse(ccEntitlement.plan, feature); }
function ccPaidLabel() { return ccPlans.planLabel(ccEntitlement.plan); }
function ccEscape(value) { return esc(value); }

async function ccLoadPaidState(force = false) {
  const data = await chrome.storage.local.get(["cc_labor_rates"]);
  ccLaborRates = (Array.isArray(data.cc_labor_rates) ? data.cc_labor_rates : []).map(ccWorkspace.normalizeLaborRate);
  ccEntitlement = await ccBilling.currentEntitlement({ force });
  if (typeof render === "function") render();
}

function ccPopulateLaborRates() {
  const picker = $("laborRatePicker");
  if (!picker) return;
  picker.innerHTML = '<option value="">Custom labour</option>' + ccLaborRates.map((rate) =>
    `<option value="${ccEscape(rate.id)}">${ccEscape(rate.name)} — ${ccEscape(rate.unit)} @ ${Number(rate.rate).toFixed(2)}</option>`
  ).join("");
}

function ccRenderLabor(project) {
  ccPopulateLaborRates();
  const rows = Array.isArray(project.laborItems) ? project.laborItems : [];
  $("laborLines").innerHTML = rows.map((row) =>
    `<div class="mini-row"><span><strong>${ccEscape(row.name || "Labour")}</strong><small>${Number(row.hours || 0)} h × ${Number(row.rate || 0).toFixed(2)}</small></span><button type="button" class="remove" data-labor-remove="${ccEscape(row.id)}">Remove</button></div>`
  ).join("");
  if (rows.length) {
    $("labor").value = core.laborTotal(project);
    $("labor").disabled = true;
    $("labor").title = "Calculated from itemized labour lines.";
  } else {
    $("labor").disabled = false;
    $("labor").title = "";
  }
}

function ccRenderProcurement(project) {
  const business = ccPlanAllows("procurement");
  document.querySelectorAll("#items tr[data-id]").forEach((row) => {
    const item = project.items.find((candidate) => candidate.id === row.dataset.id);
    const cell = row.querySelector(".item-cell > div");
    if (!item || !cell) return;

    const specs = [item.brand, item.model, item.material, item.finish, item.color, item.dimensions].filter(Boolean).join(" · ");
    if (specs) {
      const spec = document.createElement("small");
      spec.className = "item-specs";
      spec.textContent = specs;
      cell.appendChild(spec);
    }
    if (item.supplierDiscount) {
      const discount = document.createElement("small");
      discount.className = "item-discount no-print";
      discount.textContent = `Supplier discount: ${item.supplierDiscount}%`;
      cell.appendChild(discount);
    }
    if (!business) return;

    const tools = document.createElement("div");
    tools.className = "procurement-tools no-print";
    tools.innerHTML = `
      <label>Status<select data-pro-field="orderStatus" aria-label="Order status for ${ccEscape(item.title)}">
        ${["planned","ordered","shipped","delivered","cancelled"].map((status) => `<option value="${status}" ${status === item.orderStatus ? "selected" : ""}>${status[0].toUpperCase()+status.slice(1)}</option>`).join("")}
      </select></label>
      <label>PO ref<input data-pro-field="poRef" maxlength="120" value="${ccEscape(item.poRef || "")}" aria-label="Purchase order reference for ${ccEscape(item.title)}" /></label>
      <label>Expected<input data-pro-field="expectedDate" type="date" value="${ccEscape(item.expectedDate || "")}" aria-label="Expected delivery for ${ccEscape(item.title)}" /></label>`;
    cell.appendChild(tools);
  });
}

function ccRenderAcceptance(project) {
  const panel = $("acceptancePanel");
  if (!panel) return;
  const business = ccPlanAllows("acceptance");
  panel.hidden = !business;
  if (!business) return;
  const status = String(project.acceptanceStatus || "draft");
  const detail = project.acceptanceBy ? ` by ${project.acceptanceBy}` : "";
  const when = project.acceptanceAt ? ` on ${new Date(project.acceptanceAt).toLocaleString()}` : "";
  $("acceptanceSummary").textContent = status === "draft" ? "No response recorded." : `${status[0].toUpperCase()+status.slice(1)}${detail}${when}.`;

  let badge = document.getElementById("printAcceptance");
  if (!badge) {
    badge = document.createElement("p");
    badge.id = "printAcceptance";
    badge.className = "acceptance-print";
    document.querySelector(".quote-meta")?.appendChild(badge);
  }
  badge.textContent = status === "accepted" ? `Client accepted${detail}${when}` : status === "declined" ? `Client declined${detail}${when}` : "";
  badge.style.display = badge.textContent ? "block" : "none";
}

function ccRenderPlanControls(project) {
  const projectAllowance = ccPlans.allowance(ccEntitlement.plan, "activeProjects", projects.length);
  $("newProject").disabled = !projectAllowance.allowed;
  $("duplicateProject").disabled = !projectAllowance.allowed;
  $("exportCsv").disabled = !ccPlanAllows("advancedExports");
  $("exportExcel").disabled = !ccPlanAllows("advancedExports");

  for (const id of ["brandBusiness","brandEmail","brandPhone","brandWebsite","brandLogoInput","removeBrandLogo"]) {
    const el = $(id); if (el) el.disabled = !ccPlanAllows("branding");
  }
  $("brandingGate").textContent = ccPlanAllows("branding")
    ? `${ccPaidLabel()} branding is active.`
    : "Custom quote branding is included with Pro and Business.";
  if (!ccPlanAllows("branding")) {
    $("brandName").textContent = "";
    $("brandContact").textContent = "";
    $("brandLogo").style.display = "none";
  }

  document.querySelectorAll(".business-only").forEach((el) => { el.hidden = !ccPlanAllows("acceptance"); });
  ccRenderLabor(project);
  ccRenderProcurement(project);
  ccRenderAcceptance(project);
}

const ccBaseRender = render;
render = function contractorClipperPaidRender() {
  ccBaseRender();
  const project = current();
  if (project) ccRenderPlanControls(project);
};

$("openTools").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("workspace.html") }));

$("removeBrandLogo").addEventListener("click", async () => {
  if (!ccPlanAllows("branding")) return alert("Upgrade to Pro to use custom quote branding.");
  if (!brand.logoDataUrl) return;
  if (!confirm("Remove the saved quote logo?")) return;
  brand.logoDataUrl = "";
  await saveBrand();
  render();
});

$("laborRatePicker").addEventListener("change", () => {
  const rate = ccLaborRates.find((candidate) => candidate.id === $("laborRatePicker").value);
  $("laborRateValue").value = rate ? rate.rate : "";
});

$("addLaborLine").addEventListener("click", async () => {
  const project = current();
  if (!project) return;
  const rate = ccLaborRates.find((candidate) => candidate.id === $("laborRatePicker").value);
  const hours = core.nonNegative($("laborHours").value);
  const amount = core.nonNegative($("laborRateValue").value);
  if (!hours || !amount) return alert("Enter labour hours and a rate.");
  const name = rate?.name || prompt("Labour description", "Labour");
  if (!name?.trim()) return;
  if (!Array.isArray(project.laborItems)) project.laborItems = [];
  project.laborItems.push({ id: core.makeId("labor_item"), name: text(name,120), hours, rate: amount });
  project.labor = 0;
  await save();
  render();
});

$("laborLines").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-labor-remove]");
  if (!button) return;
  const project = current();
  if (!project) return;
  project.laborItems = (project.laborItems || []).filter((row) => row.id !== button.dataset.laborRemove);
  await save();
  render();
});

$("items").addEventListener("change", async (event) => {
  const field = event.target.dataset.proField;
  if (!field) return;
  if (!ccPlanAllows("procurement")) return;
  const row = event.target.closest("tr");
  const item = current()?.items.find((candidate) => candidate.id === row?.dataset.id);
  if (!item) return;
  if (field === "orderStatus") item.orderStatus = ccWorkspace.normalizeOrderStatus(event.target.value);
  if (field === "poRef") item.poRef = text(event.target.value, 120);
  if (field === "expectedDate") item.expectedDate = /^\d{4}-\d{2}-\d{2}$/.test(event.target.value) ? event.target.value : "";
  await save();
  render();
});

async function ccSha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ccApprovalSnapshot(project) {
  const totals = core.quoteTotals(project);
  return {
    projectId: project.id, quoteNumber: project.quoteNumber, projectName: project.name, client: project.client,
    validUntil: project.validUntil, currency: project.currency,
    items: project.items.map((item) => ({
      title: item.title, sku: item.sku, qty: item.qty, sellUnit: core.sellUnit(item), delivery: item.delivery, total: core.lineTotal(item)
    })),
    labor: totals.labor, discount: totals.discount, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
    notes: project.notes
  };
}

function ccApprovalHtml(snapshot, hash) {
  const data = JSON.stringify({ snapshot, hash }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ccEscape(snapshot.quoteNumber)} approval</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#182027}header{border-bottom:1px solid #ddd;padding-bottom:16px}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;padding:9px;border-bottom:1px solid #eee}th{font-size:12px;text-transform:uppercase}.total{font-size:22px;font-weight:800;text-align:right}.actions{display:flex;gap:10px;margin-top:28px}button{border:0;border-radius:10px;padding:12px 18px;font-weight:750;cursor:pointer}.accept{background:#166534;color:#fff}.decline{background:#fee2e2;color:#991b1b}.note{font-size:12px;color:#68727e}.status{margin-top:15px;font-weight:700}</style>
  <header><small>CONTRACTOR CLIPPER ESTIMATE</small><h1>${ccEscape(snapshot.projectName)}</h1><p>${ccEscape(snapshot.quoteNumber)} · ${ccEscape(snapshot.client||"Client")}</p></header>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Delivery</th><th>Total</th></tr></thead><tbody>
  ${snapshot.items.map(i=>`<tr><td>${ccEscape(i.title)}</td><td>${i.qty}</td><td>${ccEscape(snapshot.currency)} ${Number(i.sellUnit).toFixed(2)}</td><td>${ccEscape(snapshot.currency)} ${Number(i.delivery).toFixed(2)}</td><td>${ccEscape(snapshot.currency)} ${Number(i.total).toFixed(2)}</td></tr>`).join("")}
  </tbody></table><p class="total">Total: ${ccEscape(snapshot.currency)} ${Number(snapshot.total).toFixed(2)}</p><p>${ccEscape(snapshot.notes||"")}</p>
  <div class="actions"><button class="accept" onclick="respond('accepted')">Accept estimate</button><button class="decline" onclick="respond('declined')">Decline estimate</button></div>
  <p id="status" class="status"></p><p class="note">This offline response file records the decision, name, quote identity, timestamp and quote fingerprint. Send the downloaded response JSON back to the contractor. It is not a cryptographic e-signature service.</p>
  <script>const packageData=${data};function respond(decision){const name=prompt('Your name');if(!name)return;const receipt={product:'Contractor Clipper',version:1,projectId:packageData.snapshot.projectId,quoteNumber:packageData.snapshot.quoteNumber,projectName:packageData.snapshot.projectName,client:packageData.snapshot.client,decision,name:name.slice(0,240),timestamp:new Date().toISOString(),quoteHash:packageData.hash};const blob=new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(packageData.snapshot.quoteNumber||'estimate')+'-'+decision+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);document.getElementById('status').textContent='Response recorded: '+decision+'. Send the downloaded response file back to the contractor.'}</script></html>`;
}

$("exportApproval").addEventListener("click", async () => {
  if (!ccPlanAllows("acceptance")) return alert("Client approval packages are included with Business.");
  const project = current();
  if (!project) return;
  const snapshot = ccApprovalSnapshot(project);
  const serialized = JSON.stringify(snapshot);
  const hash = await ccSha256(serialized);
  project.acceptanceHash = hash;
  project.acceptanceStatus = "pending";
  project.acceptanceBy = "";
  project.acceptanceAt = "";
  await save();
  downloadBlob(ccApprovalHtml(snapshot, hash), "text/html;charset=utf-8", `${core.safeFilename(project.quoteNumber || project.name)}-client-approval.html`);
  render();
});

$("importAcceptance").addEventListener("click", () => {
  if (!ccPlanAllows("acceptance")) return alert("Client response tracking is included with Business.");
  $("acceptanceInput").click();
});

$("acceptanceInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0]; event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 100000) throw new Error("Response file is too large.");
    const receipt = JSON.parse(await file.text());
    const project = current();
    if (!project || !ccWorkspace.validAcceptanceReceipt(receipt, project)) throw new Error("This response does not belong to the current estimate.");
    if (!project.acceptanceHash || receipt.quoteHash !== project.acceptanceHash) throw new Error("The response does not match the exported quote fingerprint.");
    project.acceptanceStatus = receipt.decision;
    project.acceptanceBy = text(receipt.name,160);
    project.acceptanceAt = receipt.timestamp;
    await save();
    render();
    alert(`Client response recorded: ${receipt.decision}.`);
  } catch (error) { alert(error?.message || "Could not import client response."); }
});

const ccOriginalItemsListenerRender = render;
ccLoadPaidState(false).catch(() => render());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.cc_labor_rates) {
    ccLaborRates = (Array.isArray(changes.cc_labor_rates.newValue) ? changes.cc_labor_rates.newValue : []).map(ccWorkspace.normalizeLaborRate);
    render();
  }
  if (changes.cc_entitlement_v1) ccLoadPaidState(false).catch(() => {});
});
