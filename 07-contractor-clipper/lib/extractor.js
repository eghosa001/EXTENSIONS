(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ContractorClipperExtractor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SYMBOL_CURRENCY = [
    [/A\$/i, "AUD"], [/C\$/i, "CAD"], [/R\$/i, "BRL"], [/₦/, "NGN"], [/₹/, "INR"],
    [/£/, "GBP"], [/€/, "EUR"], [/₩/, "KRW"], [/₽/, "RUB"], [/¥/, "JPY"], [/\$/, "USD"]
  ];

  function pick(...values) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== ""); }
  function text(doc, selector) { return doc.querySelector(selector)?.textContent?.trim() || ""; }
  function attr(doc, selector, name = "content") { return doc.querySelector(selector)?.getAttribute?.(name)?.trim() || ""; }
  function clean(value, max = 1200) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max); }

  function inferCurrency(value, fallback = "") {
    const raw = String(value || "");
    for (const [pattern, code] of SYMBOL_CURRENCY) if (pattern.test(raw)) return code;
    return String(fallback || "").toUpperCase().slice(0, 3);
  }

  function resolveHttpUrl(value, base) {
    if (!value) return "";
    try {
      const url = new URL(String(value), String(base || ""));
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function collectProducts(doc) {
    const found = [];
    const seen = new Set();
    const visit = (value) => {
      if (!value) return;
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      if (types.some((type) => String(type || "").toLowerCase() === "product")) found.push(value);
      Object.values(value).forEach(visit);
    };
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try { visit(JSON.parse(script.textContent || "")); } catch (_) {}
    });
    return found;
  }

  function offerFrom(product) {
    const offers = product?.offers;
    if (Array.isArray(offers)) return offers.find((offer) => offer?.price || offer?.lowPrice || offer?.highPrice) || offers[0] || {};
    return offers || {};
  }

  function brandFrom(product) {
    const brand = product?.brand;
    if (typeof brand === "string") return brand;
    if (Array.isArray(brand)) return brand.map((v) => typeof v === "string" ? v : v?.name).filter(Boolean).join(", ");
    return brand?.name || "";
  }

  function imagesFromProduct(product) {
    const out = [];
    const add = (value) => {
      if (!value) return;
      if (Array.isArray(value)) return value.forEach(add);
      if (typeof value === "string") return out.push(value);
      if (typeof value === "object") add(value.url || value.contentUrl || value.thumbnailUrl);
    };
    add(product?.image);
    return out;
  }

  function additionalProperties(product) {
    const map = {};
    const list = Array.isArray(product?.additionalProperty) ? product.additionalProperty : product?.additionalProperty ? [product.additionalProperty] : [];
    for (const row of list) {
      const key = clean(row?.name || row?.propertyID, 80).toLowerCase();
      const value = clean(row?.value || row?.description, 240);
      if (key && value) map[key] = value;
    }
    return map;
  }

  function chooseProduct(products, pageName) {
    if (!products.length) return {};
    const needle = clean(pageName).toLowerCase();
    if (!needle) return products[0];
    return products.map((product, index) => {
      const name = clean(product?.name).toLowerCase();
      let score = 0;
      if (name && needle === name) score += 6;
      else if (name && (needle.includes(name) || name.includes(needle))) score += 3;
      if (product?.offers) score += 2;
      if (product?.sku || product?.mpn || product?.gtin13 || product?.gtin12) score += 1;
      return { product, index, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index)[0].product;
  }

  function specByLabel(doc, labels) {
    const wanted = labels.map((x) => x.toLowerCase());
    const pairs = [];
    doc.querySelectorAll("tr").forEach((row) => {
      const cells = [...row.querySelectorAll("th,td")].map((el) => clean(el.textContent, 300));
      if (cells.length >= 2) pairs.push([cells[0], cells.slice(1).join(" ")]);
    });
    doc.querySelectorAll("dt").forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (dd) pairs.push([clean(dt.textContent, 120), clean(dd.textContent, 300)]);
    });
    for (const [label, value] of pairs) {
      const l = label.toLowerCase().replace(/[:\s]+$/g, "");
      if (wanted.some((w) => l === w || l.includes(w))) return value;
    }
    return "";
  }

  function collectImages(doc, product, baseUrl) {
    const candidates = [...imagesFromProduct(product)];
    for (const selector of [
      'meta[property="og:image"]','meta[name="twitter:image"]','link[rel="image_src"]',
      'main img[src]','article img[src]','[data-product-gallery] img[src]','[class*="product"] img[src]'
    ]) {
      doc.querySelectorAll(selector).forEach((el) => {
        const raw = el.getAttribute?.("content") || el.getAttribute?.("href") || el.getAttribute?.("src") || el.getAttribute?.("data-src");
        if (raw) candidates.push(raw);
        const srcset = el.getAttribute?.("srcset");
        if (srcset) srcset.split(",").forEach((part) => candidates.push(part.trim().split(/\s+/)[0]));
      });
    }
    const seen = new Set();
    return candidates.map((url) => resolveHttpUrl(url, baseUrl)).filter((url) => {
      if (!url || seen.has(url) || /(?:logo|icon|sprite|avatar)/i.test(url)) return false;
      seen.add(url); return true;
    }).slice(0, 12);
  }

  function availabilityText(value) {
    const raw = clean(value, 160);
    if (!raw) return "";
    const match = raw.match(/(?:InStock|OutOfStock|PreOrder|BackOrder|LimitedAvailability|Discontinued)$/i);
    return match ? match[0].replace(/([a-z])([A-Z])/g, "$1 $2") : raw;
  }

  function extract(doc, locationLike) {
    const pageName = pick(text(doc, "h1"), attr(doc, 'meta[property="og:title"]'), doc.title) || "";
    const product = chooseProduct(collectProducts(doc), pageName);
    const offer = offerFrom(product);
    const props = additionalProperties(product);

    const priceRaw = pick(
      offer.price, offer.lowPrice, offer.highPrice,
      attr(doc, 'meta[property="product:price:amount"]'), attr(doc, '[itemprop="price"]'),
      text(doc, '[itemprop="price"]'), attr(doc, "[data-product-price]", "data-product-price"),
      attr(doc, "[data-price]", "data-price"), text(doc, "[data-product-price]"),
      text(doc, "[data-price]"), text(doc, '[class*="price"]')
    ) || "";

    const structuredCurrency = pick(
      offer.priceCurrency, attr(doc, 'meta[property="product:price:currency"]'),
      attr(doc, '[itemprop="priceCurrency"]'), text(doc, '[itemprop="priceCurrency"]')
    ) || "";

    const baseUrl = locationLike?.href || "";
    const images = collectImages(doc, product, baseUrl);
    const sku = pick(product.sku, product.mpn, product.productID, product.gtin13, product.gtin12, product.gtin,
      attr(doc, 'meta[property="product:retailer_item_id"]'), text(doc, '[itemprop="sku"]')) || "";

    const material = pick(product.material, props.material, props.materials, specByLabel(doc, ["material","materials","construction"])) || "";
    const finish = pick(props.finish, props["finish type"], specByLabel(doc, ["finish","finish type","surface finish"])) || "";
    const color = pick(product.color, props.color, props.colour, specByLabel(doc, ["color","colour"])) || "";
    const dimensions = pick(product.size, props.dimensions, props.dimension, props.size,
      specByLabel(doc, ["dimensions","dimension","size","product dimensions","overall dimensions"])) || "";

    return {
      title: clean(pick(product.name, attr(doc, 'meta[property="og:title"]'), text(doc, "h1"), doc.title) || "Untitled product", 240),
      sku: clean(sku, 120),
      mpn: clean(product.mpn || specByLabel(doc, ["mpn","manufacturer part number"]), 120),
      upc: clean(pick(product.gtin13, product.gtin12, product.gtin, props.upc, specByLabel(doc, ["upc","gtin","barcode"])), 80),
      brand: clean(pick(brandFrom(product), attr(doc, 'meta[property="product:brand"]'), text(doc, '[itemprop="brand"]'), specByLabel(doc, ["brand","manufacturer"])), 120),
      model: clean(pick(product.model, props.model, props["model number"], specByLabel(doc, ["model","model number"])), 120),
      description: clean(pick(product.description, attr(doc, 'meta[name="description"]'), attr(doc, 'meta[property="og:description"]')), 1200),
      material: clean(material, 160), finish: clean(finish, 160), color: clean(color, 120), dimensions: clean(dimensions, 240),
      availability: availabilityText(pick(offer.availability, attr(doc, 'meta[property="product:availability"]'), text(doc, '[itemprop="availability"]'))),
      priceRaw,
      currency: String(structuredCurrency || inferCurrency(priceRaw, "")).toUpperCase().slice(0, 3),
      images, image: images[0] || "",
      url: resolveHttpUrl(baseUrl, baseUrl),
      host: locationLike?.hostname || ""
    };
  }

  return { extract, inferCurrency, resolveHttpUrl, collectProducts, specByLabel };
});
