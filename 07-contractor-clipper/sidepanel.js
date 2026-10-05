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
  const priceNode = document.querySelector('[itemprop="price"], meta[property="product:price:amount"], [data-product-price], [class*="price" i]');
  const priceRaw = pick(
    offer.price,
    offer.lowPrice,
    meta('meta[property="product:price:amount"]'),
    document.querySelector('[itemprop="price"]')?.getAttribute("content"),
    priceNode?.getAttribute?.("data-product-price"),
    priceNode?.textContent
  );
  const currency = pick(offer.priceCurrency, meta('meta[property="product:price:currency"]'));
  const candidates = [];
  const addImage = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(addImage);
    if (typeof value === "object") return addImage(value.url || value.contentUrl);
    try {
      const url = new URL(String(value), location.href);
      if (/^https?:$/.test(url.protocol) && !candidates.includes(url.href)) candidates.push(url.href);
    } catch (_) {}
  };
  addImage(product.image);
  addImage(meta('meta[property="og:image"]'));
  addImage(meta('meta[name="twitter:image"]'));
  [...document.images]
    .filter((img) => (img.naturalWidth || img.width) >= 120 && (img.naturalHeight || img.height) >= 120)
    .slice(0, 24)
    .forEach((img) => addImage(img.currentSrc || img.src));

  return {
    title: pick(product.name, meta('meta[property="og:title"]'), text("h1"), document.title) || "Untitled product",
    sku: pick(product.sku, product.mpn, product.productID, meta('meta[property="product:retailer_item_id"]'), text('[itemprop="sku"]')),
    priceRaw,
    currency,
    supplier: pick(brand, meta('meta[property="og:site_name"]'), location.hostname.replace(/^www\./, "")),
    supplierHost: location.hostname.replace(/^www\./, ""),
    images: candidates.slice(0, 8),
    url: location.href,
    host: location.hostname.replace(/^www\./, "")
  };
}

async function scanPage() {
  $("scan").disabled = true;
  $("rescan").disabled = true;
  setStatus("Scanning this product page…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || "")) throw new Error("Open a normal supplier product page, then scan again.");
    const [execution] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractCurrentProduct });
    const data = execution?.result;
    if (!data) throw new Error("No product information could be read from this page.");
    const savedSupplier = settings.savedSuppliers.find((supplier) => supplier.host === data.supplierHost);
    const project = currentProject() || projects[0];
    $("title").value = data.title || "";
    $("sku").value = data.sku || "";
    $("supplier").value = savedSupplier?.name || data.supplier || data.host || "";
    $("supplierHost").value = data.supplierHost || data.host || "";
    $("cost").value = core.parseMoney(data.priceRaw) || "";
    $("currency").value = (data.currency || project?.currency || settings.defaultCurrency || "USD").toUpperCase().slice(0, 3);
    $("qty").value = 1;
    $("markup").value = core.toNumber(settings.defaultMarkup, 20);
    $("room").value = "";
    $("category").value = "";
    $("notes").value = "";
    $("url").value = data.url || tab.url || "";
    $("image").value = data.images?.[0] || "";
    renderImageChoices(data.images || []);
    $("editor").classList.remove("hidden");
    updatePreview();
    setStatus(`Captured from ${data.host}. Check the details and add it to a project.`, "success");
  } catch (error) {
    setStatus(error?.message || "Could not scan this page.", "error");
  } finally {
    $("scan").disabled = false;
    $("rescan").disabled = false;
  }
}

async function createProject() {
  const name = prompt("Project name", `Project ${projects.length + 1}`);
  if (!name?.trim()) return;
  const project = core.defaultProject({
    id: core.makeId("project"),
    name: name.trim(),
    currency: ($("currency").value || settings.defaultCurrency || "USD").toUpperCase().slice(0, 3),
    taxPercent: settings.defaultTaxPercent,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  projects.push(project);
  await chrome.storage.local.set({ cc_projects: projects });
  populateProjects(project.id);
  updatePreview();
}

async function saveItem() {
  const project = currentProject();
  if (!project) return setStatus("Create a project before saving this item.", "error");
  const title = $("title").value.trim();
  if (!title) return setStatus("Product name is required.", "error");
  const currency = ($("currency").value || project.currency || settings.defaultCurrency || "USD").trim().toUpperCase().slice(0, 3);
  if (currency.length !== 3) return setStatus("Use a 3-letter currency code such as USD, GBP or NGN.", "error");
  const item = core.normalizeItem({
    id: core.makeId("item"),
    title,
    sku: $("sku").value.trim(),
    supplier: $("supplier").value.trim(),
    supplierHost: $("supplierHost").value.trim(),
    room: $("room").value.trim(),
    category: $("category").value.trim(),
    notes: $("notes").value.trim(),
    cost: core.parseMoney($("cost").value),
    qty: Math.max(0, core.toNumber($("qty").value, 1)),
    markup: core.toNumber($("markup").value, settings.defaultMarkup),
    url: $("url").value,
    image: $("image").value,
    clippedAt: Date.now()
  });
  project.currency = currency;
  project.updatedAt = Date.now();
  project.items.push(item);

  const host = item.supplierHost;
  const supplierName = item.supplier;
  if (host && supplierName && !settings.savedSuppliers.some((supplier) => supplier.host === host)) {
    settings.savedSuppliers.push({ id: core.makeId("supplier"), name: supplierName, host });
  }

  $("save").disabled = true;
  try {
    await chrome.storage.local.set({ cc_projects: projects, cc_settings: settings });
    populateSuppliers();
    setStatus(`Added “${title}” to ${project.name}.`, "success");
    $("save").textContent = "Added ✓";
    setTimeout(() => { $("save").textContent = "Add to estimate"; $("save").disabled = false; }, 850);
  } catch (error) {
    $("save").disabled = false;
    setStatus(error?.message || "Could not save this item.", "error");
  }
}

$("scan").addEventListener("click", scanPage);
$("rescan").addEventListener("click", scanPage);
$("save").addEventListener("click", saveItem);
$("newProject").addEventListener("click", createProject);
$("openWorkspace").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("quote.html") }));
$("project").addEventListener("change", updatePreview);
["cost", "qty", "markup", "currency"].forEach((id) => $(id).addEventListener("input", updatePreview));
$("imageChoices").addEventListener("click", (event) => {
  const button = event.target.closest(".image-choice");
  if (!button) return;
  $("image").value = button.dataset.src || "";
  $("imageChoices").querySelectorAll(".image-choice").forEach((node) => node.classList.toggle("selected", node === button));
});

readState().then(() => {
  populateProjects();
  populateSuppliers();
  $("markup").value = core.toNumber(settings.defaultMarkup, 20);
}).catch((error) => setStatus(error?.message || "Could not load saved projects.", "error"));
