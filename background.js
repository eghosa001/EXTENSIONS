chrome.runtime.onInstalled.addListener(async () => {
  const { cc_projects: projects } = await chrome.storage.local.get("cc_projects");
  if (Array.isArray(projects) && projects.length) return;

  await chrome.storage.local.set({
    cc_projects: [
      {
        id: "inbox",
        name: "Quick Quote",
        client: "",
        currency: "USD",
        labor: 0,
        taxPercent: 0,
        discount: 0,
        createdAt: Date.now(),
        items: []
      }
    ]
  });
});
