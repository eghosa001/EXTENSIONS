importScripts("lib/core.js");
const core = globalThis.ContractorClipperCore;

async function migrateStorage() {
  const stored = await chrome.storage.local.get(["cc_projects", "cc_settings"]);
  const projects = Array.isArray(stored.cc_projects) && stored.cc_projects.length
    ? stored.cc_projects.map(core.normalizeProject)
    : [core.defaultProject()];
  const settings = core.normalizeSettings(stored.cc_settings || {});
  await chrome.storage.local.set({ cc_projects: projects, cc_settings: settings });
}

async function enableSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  migrateStorage();
  enableSidePanel();
});
chrome.runtime.onStartup.addListener(() => {
  migrateStorage();
  enableSidePanel();
});
