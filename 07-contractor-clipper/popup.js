const core = globalThis.ContractorClipperCore;
const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.style.color = isError ? "#b42318" : "";
}

async function getProjects() {
  const { cc_projects: projects = [] } = await chrome.storage.local.get("cc_projects");
  return projects;
}

async function ensureProjects() {
  let projects = await getProjects();
  if (projects.length) return projects;
  projects = [{ id: "inbox", name: "Quick Quote", client: "", currency: "USD", labor: 0, taxPercent: 0, discount: 0, createdAt: Date.now(), items: [] }];
  await chrome.storage.local.set({ cc_projects: projects });
  return projects;
}

async function populateProjects() {
  const projects = await ensureProjects();
  $("project").innerHTML = projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[ch]));
}

function extractCurrentProduct() {
  const pick = (...values) => values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
  const meta = (selector, attr = "content") => document.querySelector(selector)?.getAttribute(attr)?.trim();
  const text = (selector) => document.querySelector(selector)?.textContent?.trim();

  function allJsonLdProducts() {
    const found = [];
    const visit = (value) => {
      if (!value) return;
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== "object") return;
      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      if (types.some((t) => String(t).toLowerCase() === "product")) found.push(value);
      if (value["@graph"]) visit(value["@graph"]);
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try { visit(JSON.parse(script.textContent)); } catch (_) {}
    });
    return found;
  }

  function offerFrom(product) {
    const offers = product?.offers;
    if (Array.isArray(offers)) return offers.find((o) => o?.price || o?.lowPrice) || offers[0] || {};
    return offers || {};
  }

  function imageFrom(product) {
    const image = product?.image;
    if (typeof image === "string") return image;
    if (Array.isArray(image)) {
      const first = image[0];
      return typeof first === "string" ? first : first?.url;
    }
    return image?.url;
  }

  const product = allJsonLdProducts()[0] || {};
  const offer = offerFrom(product);
  const priceNode = document.querySelector('[itemprop="price"], meta[property="product:price:amount"], [data-product-price], [class*="price"]');
  const priceRaw = pick(
    offer.price,
    offer.lowPrice,
    meta('meta[property="product:price:amount"]'),
    document.querySelector('[itemprop="price"]')?.getAttribute("content"),
    priceNode?.getAttribute?.("data-product-price"),
    priceNode?.textContent
  );

  const image = pick(
    imageFrom(product),
    meta('meta[property="og:image"]'),
    meta('meta[name="twitter:image"]'),
    document.querySelector('main img[src], article img[src], img[src]')?.src
  );

  return {
    title: pick(product.name, meta('meta[property="og:title"]'), text("h1"), document.title) || "Untitled product",
    sku: pick(product.sku, product.mpn, product.productID, meta('meta[property="product:retailer_item_id"]'), text('[itemprop="sku"]')) || "",
    priceRaw: priceRaw || "",
    currency: pick(offer.priceCurrency, meta('meta[property="product:price:currency"]')) || "",
    image: image || "",
    url: location.href,
    host: location.hostname
  };
}

async function scanPage() {
  setStatus("Scanning this page…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a normal product webpage first.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractCurrentProduct });
    const data = result?.result;
    if (!data) throw new Error("No product information was found.");

    $("title").value = data.title || "";
    $("sku").value = data.sku || "";
    $("cost").value = core.parseMoney(data.priceRaw) || "";
    $("currency").value = (data.currency || "USD").toUpperCase().slice(0, 3);
    $("url").value = data.url || "";
    $("image").value = data.image || "";
    $("imagePreview").src = data.image || "";
    $("imagePreview").style.visibility = data.image ? "visible" : "hidden";
    $("editor").classList.remove("hidden");
    setStatus(`Product detected on ${data.host}. Review it, then add it to a quote.`);
  } catch (error) {
    setStatus(error.message || "Could not scan this page.", true);
  }
}

async function saveItem() {
  const projectId = $("project").value;
  const projects = await ensureProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return setStatus("Project not found.", true);

  const title = $("title").value.trim();
  const cost = core.parseMoney($("cost").value);
  if (!title) return setStatus("Add a product name.", true);

  project.currency = ($("currency").value || project.currency || "USD").toUpperCase().slice(0, 3);
  project.items.push({
    id: core.makeId("item"),
    title,
    sku: $("sku").value.trim(),
    url: $("url").value,
    image: $("image").value,
    cost,
    qty: Math.max(1, core.toNumber($("qty").value, 1)),
    markup: core.toNumber($("markup").value, 20),
    clippedAt: Date.now()
  });

  await chrome.storage.local.set({ cc_projects: projects });
  setStatus(`Added “${title}” to ${project.name}.`);
  $("save").textContent = "Added ✓";
  setTimeout(() => { $("save").textContent = "Add to quote"; }, 1200);
}

$("scan").addEventListener("click", scanPage);
$("save").addEventListener("click", saveItem);
$("openQuotes").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("quote.html") }));
populateProjects();
