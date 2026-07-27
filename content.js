// content.js — Block AI Overview
// author: aliggator.developper
// Runs on every Google search page. Intercepts clicks on the "All" tab link
// (or any link that would take the user from a udm=14 page back to the
// AI-Overview-enabled view) and shows a confirmation modal first.

(function () {
  if (window.__blockAiOverviewInstalled) return;
  window.__blockAiOverviewInstalled = true;

  const GOOGLE_HOSTS = new Set([
    "www.google.com", "www.google.co.uk", "www.google.ca", "www.google.com.au",
    "www.google.de", "www.google.fr", "www.google.es", "www.google.it",
    "www.google.co.jp", "www.google.co.in", "www.google.com.br", "www.google.com.mx",
    "www.google.nl", "www.google.pl", "www.google.se", "www.google.ch",
    "www.google.at", "www.google.be", "www.google.pt", "www.google.co.nz",
    "www.google.co.kr", "www.google.ru", "www.google.com.ar", "www.google.com.co",
    "www.google.com.tw", "www.google.com.hk", "www.google.com.sg", "www.google.co.za",
    "www.google.com.ng", "www.google.com.ph"
  ]);

  function currentUdm() {
    try {
      return new URL(window.location.href).searchParams.get("udm");
    } catch {
      return null;
    }
  }

  // Click handler in capture phase so we run before Google's own handlers.
  document.addEventListener("click", (e) => {
    // Only handle plain left clicks (no modifier — Cmd/Ctrl-click should still
    // work to open in a new tab without prompting).
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // Walk up to find an <a> ancestor.
    let el = e.target;
    while (el && el !== document.body && el.tagName !== "A") {
      el = el.parentElement;
    }
    if (!el || el.tagName !== "A" || !el.href) return;

    let target;
    try {
      target = new URL(el.href);
    } catch {
      return;
    }
    if (!GOOGLE_HOSTS.has(target.hostname)) return;
    if (target.pathname !== "/search") return;

    const targetUdm = target.searchParams.get("udm");

    // We only intercept if the target has NO udm (the "All" tab) AND the
    // current page has udm=14 (we're currently in Web mode). Other tab clicks
    // have their own udm values and pass through unchanged.
    if (targetUdm !== null) return;
    if (currentUdm() !== "14") return;

    // Stop the navigation.
    e.preventDefault();
    e.stopImmediatePropagation();

    showModal(target.href);
  }, true);

  function showModal(allTabUrl) {
    if (document.getElementById("__block-ai-overview-modal__")) return;

    const overlay = document.createElement("div");
    overlay.id = "__block-ai-overview-modal__";
    overlay.style.cssText = [
      "position: fixed",
      "inset: 0",
      "background: rgba(26, 23, 16, 0.72)",
      "z-index: 2147483647",
      "display: flex",
      "align-items: center",
      "justify-content: center",
      'font-family: Georgia, "Times New Roman", serif',
      "-webkit-font-smoothing: antialiased"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "background: #1a1710",
      "color: #e8dcc4",
      "border: 2px solid #3a2f1f",
      "border-radius: 14px",
      "padding: 28px 28px 22px",
      "width: 380px",
      "max-width: calc(100vw - 40px)",
      "box-shadow: 0 20px 60px rgba(0,0,0,0.5)",
      "text-align: center"
    ].join(";");

    card.innerHTML = `
      <div style="margin-bottom: 18px; display: flex; justify-content: center;">
        <svg width="64" height="64" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="128" height="128" rx="22" fill="#e8dcc4"/>
          <g transform="translate(64, 68)">
            <rect x="-44" y="-40" width="88" height="76" rx="11" fill="#1a1710" stroke="#1a1710" stroke-width="2"/>
            <line x1="0" y1="-40" x2="0" y2="-54" stroke="#1a1710" stroke-width="3" stroke-linecap="round"/>
            <circle cx="0" cy="-58" r="5" fill="#c9534a" stroke="#1a1710" stroke-width="1.5"/>
            <circle cx="-44" cy="-20" r="3" fill="#1a1710"/>
            <circle cx="44" cy="-20" r="3" fill="#1a1710"/>
            <circle cx="-44" cy="16" r="3" fill="#1a1710"/>
            <circle cx="44" cy="16" r="3" fill="#1a1710"/>
            <circle cx="-17" cy="-10" r="8" fill="#e8dcc4"/>
            <circle cx="17" cy="-10" r="8" fill="#e8dcc4"/>
            <circle cx="-15" cy="-12" r="3" fill="#1a1710"/>
            <circle cx="19" cy="-12" r="3" fill="#1a1710"/>
            <rect x="-17" y="11" width="34" height="13" rx="1.5" fill="#e8dcc4"/>
            <line x1="-8" y1="11" x2="-8" y2="24" stroke="#1a1710" stroke-width="1.5"/>
            <line x1="0" y1="11" x2="0" y2="24" stroke="#1a1710" stroke-width="1.5"/>
            <line x1="8" y1="11" x2="8" y2="24" stroke="#1a1710" stroke-width="1.5"/>
            <line x1="-58" y1="-58" x2="58" y2="48" stroke="#c9534a" stroke-width="9" stroke-linecap="round"/>
            <line x1="58" y1="-58" x2="-58" y2="48" stroke="#c9534a" stroke-width="9" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
      <div style="font-size: 19px; font-weight: 500; margin-bottom: 10px; color: #e8dcc4;">
        Allow the AI Overview back in?
      </div>
      <div style="font-size: 13px; line-height: 1.55; color: #a89878; margin-bottom: 22px; font-style: italic;">
        The "All" tab includes AI-generated summaries. Continuing will turn off
        Block AI Overview for all future searches until you toggle it back on.
      </div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="__bao-no" style="font-family: Georgia, serif; font-size: 14px; padding: 10px 18px; border-radius: 22px; border: 1.5px solid #3a2f1f; cursor: pointer; background: #2a2418; color: #e8dcc4;">
          Stay in Web mode
        </button>
        <button id="__bao-yes" style="font-family: Georgia, serif; font-size: 14px; padding: 10px 18px; border-radius: 22px; border: 1.5px solid #3a2f1f; cursor: pointer; background: #c9534a; color: #f5ead2;">
          Allow AI Overviews
        </button>
      </div>
    `;

    overlay.appendChild(card);

    function dismiss() {
      overlay.remove();
      document.removeEventListener("keydown", escHandler);
    }

    function escHandler(e) {
      if (e.key === "Escape") dismiss();
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismiss();
    });

    document.documentElement.appendChild(overlay);
    document.addEventListener("keydown", escHandler);

    document.getElementById("__bao-no").addEventListener("click", dismiss);
    document.getElementById("__bao-yes").addEventListener("click", () => {
      dismiss();
      // Tell the background to disable the extension, then navigate.
      try {
        chrome.runtime.sendMessage({ type: "blockAi:disable" }, () => {
          // Navigate after the disable has been acknowledged.
          window.location.href = allTabUrl;
        });
      } catch {
        // If sendMessage fails (e.g. extension reloaded), just navigate.
        window.location.href = allTabUrl;
      }
    });
  }
})();
