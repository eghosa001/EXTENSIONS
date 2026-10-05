const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);
let projects = [];
let settings = core.defaultSettings();
let imageCandidates = [];

function setStatus(message, kind = "info") {
  const el = $("status");
  el.textContent = message;
  el.dataset.kind = kind;
}

async function readState() {
  const stored = await chrome.storage.local.get(["cc_projects", "cc_settings"]);
  projects = Array.isArray(stored.cc_projects) && stored.cc_projects.length
    ? stored.cc_projects.map(core.normalizeProject)
    : [core.defaultProject()];
  settings = core.normalizeSettings(stored.cc_settings || {});
  await chrome.storage.local.set({ cc_projects: projects, cc_settings: settings });
}

function fillSelect(select, options, selected) {
  select.replaceChildren();
  options.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selected;
    select.appendChild(option);
  });
}

function populateProjects(selectedId) {
  const select = $("project");
  const fallback = selectedId || select.value || projects[0]?.id;
  fillSelect(select, projects.map((p) => ({ value: p.id, label: p.name })), fallback);
}

function populateSuppliers() {
  const list = $("supplierList");
  list.replaceChildren();
  settings.savedSuppliers.forEach((supplier) => {
    const option = document.createElement("option");
    option.value = supplier.name;
    option.label = supplier.host || supplier.name;
    list.appendChild(option);
  });
}

function currentProject() {
  return projects.find((p) => p.id === $("project").value) || projects[0];
}

function updatePreview() {
  const p = currentProject();
  const code = ($("currency").value || p?.currency || settings.defaultCurrency || "USD").toUpperCase().slice(0, 3);
  const item = {
    cost: core.parseMoney($("cost").value),
    qty: Math.max(0, core.toNumber($("qty").value, 1)),
    markup: core.toNumber($("markup").value, settings.defaultMarkup)
  };
  $("linePreview").textContent = core.currency(code)(core.lineTotal(item));
}

function renderImageChoices(candidates = []) {
  imageCandidates = [...new Set(candidates.filter(Boolean))].slice(0, 8);
  const wrap = $("imageChoices");
  wrap.replaceChildren();
  $("noImages").classList.toggle("hidden", imageCandidates.length > 0);
  if (!imageCandidates.length) {
    $("image").value = "";
    return;
  }
  const selected = $("image").value && imageCandidates.includes($("image").value) ? $("image").value : imageCandidates[0];
  $("image").value = selected;
  imageCandidates.forEach((src) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `image-choice${src === selected ? " selected" : ""}`;
    button.title = "Use this image";
    button.dataset.src = src;
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Product image option";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => button.remove());
    button.appendChild(img);
    wrap.appendChild(button);
  });
}

function extractCurrentProduct() {
  const clean = (value) => value === undefined || value === null ? "" : String(value).trim();
  const pick = (...values) => values.map(clean).find(Boolean) || "";
  const meta = (selector, attr = "content") => clean(document.querySelector(selector)?.getAttribute(attr));
  const text = (selector) => clean(document.querySelector(selector)?.textContent);
  const products = [];

  function visit(value) {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object") return;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.some((type) => clean(type).toLowerCase() === "product")) products.push(value);
    if (value["@graph"]) visit(value["@graph"]);
  }

  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try { visit(JSON.parse(script.textContent)); } catch (_) {}
  });

  const product = products[0] || {};
  const offers = Array.isArray(product.offers) ? product.offers : [product.offers].filter(Boolean);
  const offer = offers.find((candidate) => candidate?.price || candidate?.lowPrice) || offers[0] || {};
  const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;
  const priceNode = document.querySelector('[itemprop="price"], me