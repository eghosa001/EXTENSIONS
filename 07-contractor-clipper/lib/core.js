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

  function makeId(prefix = "id") {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function sellUnit(item) {
    const cost = Math.max(0, toNumber(item?.cost));
    const markup = toNumber(item?.markup);
    return Math.max(0, cost * (1 + markup / 100));
  }

  function lineTotal(item) {
    return sellUnit(item) * Math.max(0, toNumber(item?.qty, 1));
  }

  function quoteTotals(project) {
    const materials = (project?.items || []).reduce((sum, item) => sum + lineTotal(item), 0);
    const labor = Math.max(0, toNumber(project?.labor));
    const delivery = Math.max(0, toNumber(project?.delivery));
    const discount = Math.max(0, toNumber(project?.discount));
    const subtotal = Math.max(0, materials + labor + delivery - discount);
    const tax = subtotal * Math.max(0, toNumber(project?.taxPercent)) / 100;
    return { materials, labor, delivery, discount, subtotal, tax, total: subtotal + tax };
  }

  function currency(code) {
    const normalized = String(code || "USD").trim().toUpperCase().slice(0, 3) || "USD";
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: normalized }).format;
    } catch {
      return (amount) => `${normalized} ${toNumber(amount).toFixed(2)}`;
    }
  }

  function normalizeItem(item = {}) {
    return {
      id: item.id || makeId("item"),
      title: String(item.title || "Untitled product"),
      sku: String(item.sku || ""),
      supplier: String(item.supplier || item.supplierHost || ""),
      supplierHost: String(item.supplierHost || ""),
      room: String(item.room || ""),
      category: String(item.category || ""),
      notes: String(item.notes || ""),
      url: String(item.url || ""),
      image: String(item.image || ""),
      cost: Math.max(0, toNumber(item.cost)),
      qty: Math.max(0, toNumber(item.qty, 1)),
      markup: toNumber(item.markup, 0),
      clippedAt: toNumber(item.clippedAt, Date.now())
    };
  }

  function normalizeProject(project = {}) {
    return {
      id: project.id || makeId("project"),
      name: String(project.name || "Untitled project"),
      client: String(project.client || ""),
      clientEmail: String(project.clientEmail || ""),
      projectAddress: String(project.projectAddress || ""),
      currency: String(project.currency || "USD").toUpperCase().slice(0, 3),
      labor: Math.max(0, toNumber(project.labor)),
      delivery: Math.max(0, toNumber(project.delivery)),
      discount: Math.max(0, toNumber(project.discount)),
      taxPercent: Math.max(0, toNumber(project.taxPercent)),
      createdAt: toNumber(project.createdAt, Date.now()),
      updatedAt: toNumber(project.updatedAt, Date.now()),
      items: Array.isArray(project.items) ? project.items.map(normalizeItem) : []
    };
  }

  function defaultProject(overrides = {}) {
    return normalizeProject({
      id: "inbox",
      name: "Quick Quote",
      currency: "USD",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [],
      ...overrides
    });
  }

  function defaultSettings(overrides = {}) {
    return {
      companyName: "",
      companyEmail: "",
      companyPhone: "",
      companyAddress: "",
      companyLogo: "",
      defaultCurrency: "USD",
      defaultMarkup: 20,
      defaultTaxPercent: 0,
      savedSuppliers: [],
      ...overrides
    };
  }

  function normalizeSettings(settings = {}) {
    const base = defaultSettings();
    const savedSuppliers = Array.isArray(settings.savedSuppliers)
      ? settings.savedSuppliers.filter(Bolean).map((supplier) => ({
          id: String(supplier.id || makeId("supplier")),
          name: String(supplier.name || supplier.host || "Supplier"),
          host: String(supplier.host || "")
        }))
      : [];
    return {
      ...base,
      ...settings,
      defaultCurrency: String(settings.defaultCurrency || base.defaultCurrency).toUpperCase().slice(0, 3),
      defaultMarkup: toNumber(settings.defaultMarkup, base.defaultMarkup),
      defaultTaxPercent: Math.max(0, toNumber(settings.defaultTaxPercent, base.defaultTaxPercent)),
      savedSuppliers
    };
  }

  function safeFileName(value, fallback = "estimate") {
    const name = String(value || fallback).trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
    return (name || fallback).slice(0, 80).toLowerCase();
  }

  return {
    toNumber,
    parseMoney,
    makeId,
    sellUnit,
    lineTotal,
    quoteTotals,
    currency,
    normalizeItem,
    normalizeProject,
    defaultProject,
    defaultSettings,
    normalizeSettings,
    safeFileName
  };
});
