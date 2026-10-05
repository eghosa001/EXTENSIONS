const test = require("node:test");
const assert = require("node:assert/strict");
const extractor = require("../lib/extractor.js");

function node(textContent = "", attrs = {}) {
  return { textContent, getAttribute: (name) => attrs[name] || "" };
}

function doc({ title = "", nodes = {}, jsonLd = [] } = {}) {
  return {
    title,
    querySelector: (selector) => nodes[selector] || null,
    querySelectorAll: (selector) => selector === 'script[type="application/ld+json"]'
      ? jsonLd.map((value) => node(JSON.stringify(value)))
      : []
  };
}

test("prefers structured Product data", () => {
  const page = doc({
    title: "Kitchen Tile",
    nodes: { "h1": node("Kitchen Tile") },
    jsonLd: [{ "@graph": [{ "@type": "Product", name: "Kitchen Tile", sku: "KT-1", image: "/tile.jpg", offers: { price: "129.99", priceCurrency: "USD" } }] }]
  });
  assert.deepEqual(extractor.extract(page, { href: "https://supplier.test/p/1", hostname: "supplier.test" }), {
    title: "Kitchen Tile", sku: "KT-1", priceRaw: "129.99", currency: "USD",
    image: "https://supplier.test/tile.jpg", url: "https://supplier.test/p/1", host: "supplier.test"
  });
});

test("falls back to page metadata and currency symbol", () => {
  const page = doc({
    title: "Pendant Light",
    nodes: {
      "h1": node("Pendant Light"),
      'meta[property="product:price:amount"]': node("", { content: "₦25,000" }),
      'meta[property="og:image"]': node("", { content: "https://cdn.test/light.jpg" })
    }
  });
  const result = extractor.extract(page, { href: "https://shop.test/light", hostname: "shop.test" });
  assert.equal(result.currency, "NGN");
  assert.equal(result.priceRaw, "₦25,000");
  assert.equal(result.image, "https://cdn.test/light.jpg");
});
