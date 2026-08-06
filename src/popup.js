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
  chrome.storage.local.set({ tmdbBearerToken: "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0M2ViNjUzYTk0MTlkYmU4NWI5M2ViMmMzYmFlNmM5NiIsIm5iZiI6MTc4NTcxOTA4OS45NjYsInN1YiI6IjZhNmZlOTMxNTU1NDJkMDg4YTNjNmJlOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.f-A_ZdXVigPYJ4p3z2Qp62yQrkXqv8ScwxEP_bigKzY" });
  
  const enabled = toggle.checked;
  updateUI(enabled);
  chrome.storage.sync.set({ enabled });
});
