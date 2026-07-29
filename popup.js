const toggle = document.getElementById("toggle");
const toggleArea = document.getElementById("toggle-area");
const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
const logoImg = document.getElementById("logo-img");

function updateUI(enabled) {
  toggle.checked = enabled;
  toggleArea.classList.toggle("active", enabled);
  status.classList.toggle("active", enabled);
  statusText.textContent = enabled ? "AI overviews blocked" : "Inactive";

  // Same on/off icon set as the toolbar icon (background.js), same
  // "-off" suffix convention — swap the popup logo to match.
  logoImg.src = enabled ? "icons/icon48.png" : "icons/icon48-off.png";
}

chrome.storage.sync.get({ enabled: true }, (data) => {
  updateUI(data.enabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  updateUI(enabled);
  chrome.storage.sync.set({ enabled });
});
