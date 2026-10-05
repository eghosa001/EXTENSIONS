chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["cc_projects", "cc_suppliers", "cc_brand"]);
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
        taxPercent: 0,
        discount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: []
      }
    ];
  }

  if (!Array.isArray(existing.cc_suppliers)) updates.cc_suppliers = [];
  if (!existing.cc_brand || typeof existing.cc_brand !== "object") {
    updates.cc_brand = { business: "", email: "", phone: "", website: "", logoDataUrl: "" };
  }

  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}
