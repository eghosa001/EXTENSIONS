(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ContractorClipperCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

  function sellUnit(item) {
    const cost = Math.max(0, toNumber(item.cost));
    const markup = toNumber(item.markup);
    return cost * (1 + markup / 100);
  }

  function lineTotal(item) {
    const products = sellUnit(item) * Math.max(0, toNumber(item.qty, 1));
    const delivery = Math.max(0, toNumber(item.delivery));
    return products + delivery;
  }

  function quoteTotals(project) {
    const materials = (project.items || []).reduce((sum, item) => sum + lineTotal(item), 0);
    const labor = Math.max(0, toNumber(project.labor));
    const discount = Math.max(0, toNumber(project.discount));
    const subtotal = Math.max(0, materials + labor - discount);
    const tax = subtotal * Math.max(0, toNumber(project.taxPercent)) / 100;
    return { materials, labor, discount, subtotal, tax, total: subtotal + tax };
  }

  function currency(value) {
    const code = String(value || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format;
    } catch {
      return (amount) => `${code} ${toNumber(amount).toFixed(2)}`;
    }
  }

  function makeId(prefix = "id") {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  return { toNumber, parseMoney, sellUnit, lineTotal, quoteTotals, currency, makeId };
});
