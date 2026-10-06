chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["cc_projects", "cc_suppliers", "cc_brand", "cc_library", "cc_labor_rates", "cc_assemblies", "cc_quote_templates", "cc_usage_v1"]);
  const updates = {};

  if (!Array.isArray(existing.cc_projects) || !existing.cc_projects.length) {
    updates.cc_projects = [
      {
        id: "inbox",
        name: "Quick Quote",
        client: "",
        clientEmail: "",
        jobAddress: "",
        currency: "USD",
        quoteNumber: "",
        validUntil: "",
        notes: "",
        labor: 0,
        laborItems: [],
        acceptanceStatus: "draft",
        taxPercent: 0,
        discount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: []
      }
    ];
  }

  if (!Array.isArray(existing.cc_suppliers)) updates.cc_suppliers = [];
  if (!Array.isArray(existing.cc_library)) updates.cc_library = [];
  if (!Array.isArray(existing.cc_labor_rates)) updates.cc_labor_rates = [];
  if (!Array.isArray(existing.cc_assemblies)) updates.cc_assemblies = [];
  if (!Array.isArray(existing.cc_quote_templates)) updates.cc_quote_templates = [];
  if (!existing.cc_usage_v1 || typeof existing.cc_usage_v1 !== "object") updates.cc_usage_v1 = { month: "", clips: 0 };
  if (!existing.cc_brand || typeof existing.cc_brand !== "object") {
    updates.cc_brand = { business: "", email: "", phone: "", website: "", logoDataUrl: "" };
  }

  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
