const toggle = document.getElementById("toggle");
const toggleArea = document.getElementById("toggle-area");
const status = document.getElementById("status");
const x1 = document.getElementById("x1");
const x2 = document.getElementById("x2");
const antenna = document.getElementById("antenna");

function updateUI(enabled) {
  toggle.checked = enabled;
  toggleArea.classList.toggle("active", enabled);
  status.classList.toggle("active", enabled);
  status.innerHTML = enabled
    ? '<span class="dot"></span> AI overviews blocked'
    : '<span class="dot"></span> Inactive';
  // Hide the red X over the robot when inactive, and dim the antenna light.
  const display = enabled ? "" : "none";
  x1.style.display = display;
  x2.style.display = display;
  antenna.setAttribute("fill", enabled ? "#c9534a" : "#7a6f5a");
}

chrome.storage.sync.get({ enabled: true }, (data) => {
  updateUI(data.enabled);
});

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  updateUI(enabled);
  chrome.storage.sync.set({ enabled });
});
