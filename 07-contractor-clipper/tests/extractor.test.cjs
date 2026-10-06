const test = require("node:test");
const assert = require("node:assert/strict");
const extractor = require("../lib/extractor.js");

function node(textContent = "", attrs = {}) {
  return { textContent, getAttribute: (name) => attrs[name] || "", nextElementSibling:null };
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

test("extracts rich structured Product data and multiple images", () => {
  const page = doc({
    title: "Kitchen Tile",
    nodes: { "h1": node("Kitchen Tile") },
    jsonLd: [{ "@graph": [{ "@type": "Product", name: "Kitchen Tile", sku: "KT-1", mpn:"MP-9",
      brand:{name:"Bell Tile"}, material:"Porcelain", color:"Ivory", size:"600 x 600 mm",
      description:"Rectified porcelain floor tile.", image: ["/tile.jpg","/tile-2.jpg"],
      additionalProperty:[{name:"Finish",value:"Matt"}],
      offers: { price: "129.99", priceCurrency: "USD", availability:"https://schema.org/InStock" } }] }]
  });
  const result=extractor.extract(page, { href: "https://supplier.test/p/1", hostname: "supplier.test" });
  assert.equal(result.title,"Kitchen Tile");
  assert.equal(result.sku,"KT-1");
  assert.equal(result.brand,"Bell Tile");
  assert.equal(result.model,"MP-9");
  assert.equal(result.material,"Porcelain");
  assert.equal(result.finish,"Matt");
  assert.equal(result.color,"Ivory");
  assert.equal(result.dimensions,"600 x 600 mm");
  assert.equal(result.availability,"In Stock");
  assert.equal(result.priceRaw,"129.99");
  assert.equal(result.currency,"USD");
  assert.deepEqual(result.images,["https://supplier.test/tile.jpg","https://supplier.test/tile-2.jpg"]);
  assert.equal(result.image,result.images[0]);
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
  assert.deepEqual(result.images,["https://cdn.test/light.jpg"]);
});

test("blocks non-http extracted image and source URLs",()=>{
  const page=doc({title:"Unsafe",nodes:{"h1":node("Unsafe")},jsonLd:[{"@type":"Product",name:"Unsafe",image:"javascript:alert(1)"}]});
  const result=extractor.extract(page,{href:"chrome://settings",hostname:""});
  assert.equal(result.image,"");
  assert.equal(result.url,"");
});
