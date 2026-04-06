const DASHBOARD_URL = "https://trading-dashboard-dpzh.vercel.app/";

const frame = document.getElementById("dashboard-frame");
const loading = document.getElementById("loading");
const btnReload = document.getElementById("btn-reload");
const btnPopout = document.getElementById("btn-popout");
const widthSelect = document.getElementById("width-select");

// Hide loading overlay once iframe loads
frame.addEventListener("load", () => {
  loading.style.display = "none";
});

// Show loading on error
frame.addEventListener("error", () => {
  loading.querySelector(".label").textContent = "Failed to load — check internet connection";
});

// Reload button
btnReload.addEventListener("click", () => {
  loading.style.display = "flex";
  loading.querySelector(".label").textContent = "Loading Trading Dashboard...";
  frame.src = DASHBOARD_URL + "?t=" + Date.now();
});

// Open in new tab
btnPopout.addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// Width selector — adjust side panel width via chrome.sidePanel API
widthSelect.addEventListener("change", () => {
  const w = parseInt(widthSelect.value);
  chrome.storage.local.set({ panelWidth: w });
  // Notify user that width change requires dragging the panel edge in Chrome
  document.title = `Trading Dashboard (${w}px)`;
});

// Restore saved width preference
chrome.storage.local.get(["panelWidth"], (result) => {
  if (result.panelWidth) {
    widthSelect.value = String(result.panelWidth);
  }
});
