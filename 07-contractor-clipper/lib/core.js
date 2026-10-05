(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ContractorClipperCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function nonNegative(value, fallback = 0) {
    return Math.max(0, toNumber(value, fallback));
  }

  function parseMoney(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (!value) return 0;

    let s = String(value).trim().replace(/[^0-9,.-]/g, "");
    if (!s) return 0;

    const comma = s.lastIndexOf(",");
    const dot = s.lastIndexOf(".");

    if (comma > -1 && dot > -1) {
      if (comma > dot) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (comma > -1) {
      const decimals = s.length - comma - 1;
      s = decimals === 2 ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function currencyCode(value, fallback = "USD") {
    const code = String(value || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : String(fallback || "USD").toUpperCase();
  }

  function safeHttpUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value));
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function safeImageDataUrl(value) {
    const data = String(value || "");
    return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(data) ? data : "";
  }

  function sellUnit(item) {
    const cost = nonNegative(item?.cost);
    const markup = nonNegative(item?.markup);
    return cost * (1 + markup / 100);
  }

  function productTotal(item) {
    return sellUnit(item) * Math.max(1, nonNegative(item?.qty, 1));
  }

  function lineTotal(item) {
    return productTotal(item) + nonNegative(item?.delivery);
  }

  function quoteTotals(project) {
    const items = Array.isArray(project?.items) ? project.items : [];
    const products = items.reduce((sum, item) => sum + productTotal(item), 0);
    const delivery = items.reduce((sum, item) => sum + nonNegative(item?.delivery), 0);
    const materials = products + delivery;
    const labor = nonNegative(project?.labor);
    const discount = nonNegative(project?.discount);
    const subtotal = Math.max(0, materials + labor - discount);
    const taxPercent = nonNegative(project?.taxPercent);
    const tax = subtotal * taxPercent / 100;
    return { products, delivery, materials, labor, discount, subtotal, tax, total: subtotal + tax };
  }

  function currency(value) {
    const code = currencyCode(value);
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format;
    } catch {
      return (amount) => `${code} ${toNumber(amount).toFixed(2)}`;
    }
  }

  function safeFilename(value, fallback = "quote") {
    const cleaned = String(value || "")
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return cleaned || fallback;
  }

  function csv(rows) {
    return rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  function escapeXml(value) {
    return String(value ?? "").replace(/[<>&'"]/g, (char) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
    }[char]));
  }

  function spreadsheetXml(rows, sheetName = "Quote") {
    const safeSheet = escapeXml(String(sheetName || "Quote").slice(0, 31));
    const body = rows.map((row) => `<Row>${row.map((value) => {
      const isNumber = typeof value === "number" && Number.isFinite(value);
      return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`;
    }).join("")}</Row>`).join("");
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${safeSheet}"><Table>${body}</Table></Worksheet></Workbook>`;
  }

  function makeId(prefix = "id") {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  return {
    toNumber, nonNegative, parseMoney, currencyCode, safeHttpUrl, safeImageDataUrl,
    sellUnit, productTotal, lineTotal, quoteTotals, currency, safeFilename, csv,
    spreadsheetXml, makeId
  };
});
