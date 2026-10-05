(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ContractorClipperExtractor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SYMBOL_CURRENCY = [
    [/A\$/i, "AUD"],
    [/C\$/i, "CAD"],
    [/R\$/i, "BRL"],
    [/₦/, "NGN"],
    [/₹/, "INR"],
    [/£/, "GBP"],
    [/€/, "EUR"],
    [/₩/, "KRW"],
    [/₽/, "RUB"],
    [/¥/, "JPY"],
    [/\$/, "USD"]
  ];

  function pick(...values) {
    return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  }

  function text(doc, selector) {
    return doc.querySelector(selector)?.textContent?.trim() || "";
  }

  function attr(doc, selector, name = "content") {
    return doc.querySelector(selector)?.getAttribute?.(name)?.trim() || "";
  }

  function inferCurrency(value, fallback = "") {
    const raw = String(value || "");
    for (const [pattern, code] of SYMBOL_CURRENCY) {
      if (pattern.test(raw)) return code;
    }
    return String(fallback || "").toUpperCase().slice(0, 3);
  }

  function resolveHttpUrl(value, base) {
    if (!value) return "";
    try {
      const url = new URL(String(value), String(base || ""));
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function collectProducts(doc) {
    const found = [];
    const visit = (value) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value !== "object") return;
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
    if (Array.isArray(offers)) {
      return offers.find((offer) => offer?.price || offer?.lowPrice || offer?.highPrice) || offers[0] || {};
    }
    return offers || {};
  }

  function imageFrom(product) {
    const image = product?.image;
    if (typeof image === "string") return image;
    if (Array.isArray(image)) {
      const first = image[0];
      return typeof first === "string" ? first : first?.url || first?.contentUrl || "";
    }
    return image?.url || image?.contentUrl || "";
  }

  function chooseProduct(products, pageName) {
    if (!products.length) return {};
    const needle = String(pageName || "").trim().toLowerCase();
    if (!needle) return products[0];
    return products
      .map((product, index) => {
        const name = String(product?.name || "").trim().toLowerCase();
        let score = 0;
        if (name && needle === name) score += 5;
        else if (name && (needle.includes(name) || name.includes(needle))) score += 3;
        if (product?.offers) score += 1;
        if (product?.sku || product?.mpn) score += 1;
        return { product, index, score };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)[0].product;
  }

  function extract(doc, locationLike) {
    const pageName = pick(text(doc, "h1"), attr(doc, 'meta[property="og:title"]'), doc.title) || "";
    const product = chooseProduct(collectProducts(doc), pageName);
    const offer = offerFrom(product);

    const priceRaw = pick(
      offer.price,
      offer.lowPrice,
      offer.highPrice,
      attr(doc, 'meta[property="product:price:amount"]'),
      attr(doc, '[itemprop="price"]'),
      text(doc, '[itemprop="price"]'),
      attr(doc, "[data-product-price]", "data-product-price"),
      attr(doc, "[data-price]", "data-price"),
      text(doc, "[data-product-price]"),
      text(doc, "[data-price]"),
      text(doc, '[class*="price"]')
    ) || "";

    const structuredCurrency = pick(
      offer.priceCurrency,
      attr(doc, 'meta[property="product:price:currency"]'),
      attr(doc, '[itemprop="priceCurrency"]'),
      text(doc, '[itemprop="priceCurrency"]')
    ) || "";

    const baseUrl = locationLike?.href || "";
    const image = resolveHttpUrl(pick(
      imageFrom(product),
      attr(doc, 'meta[property="og:image"]'),
      attr(doc, 'meta[name="twitter:image"]'),
      doc.querySelector("main img[src], article img[src], img[src]")?.getAttribute?.("src")
    ), baseUrl);

    return {
      title: pick(product.name, attr(doc, 'meta[property="og:title"]'), text(doc, "h1"), doc.title) || "Untitled product",
      sku: pick(
        product.sku,
        product.mpn,
        product.productID,
        attr(doc, 'meta[property="product:retailer_item_id"]'),
        text(doc, '[itemprop="sku"]')
      ) || "",
      priceRaw,
      currency: String(structuredCurrency || inferCurrency(priceRaw, "")).toUpperCase().slice(0, 3),
      image,
      url: resolveHttpUrl(baseUrl, baseUrl),
      host: locationLike?.hostname || ""
    };
  }

  return { extract, inferCurrency, resolveHttpUrl };
});
