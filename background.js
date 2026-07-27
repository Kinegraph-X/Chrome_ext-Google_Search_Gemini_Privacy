// background.js — Block AI Overview
// author: E_B_U_n19
// author: Claude Sonnet 5
// Enables/disables a static declarativeNetRequest ruleset that redirects
// fresh /search navigations (with no udm param) to udm=14, which suppresses
// Google's AI Overview. Tabs that already loaded a Gemini response are left
// alone — toggling the extension only affects future navigations, since DNR
// only intercepts requests before they reach the network, not pages already
// rendered in a tab.
//
// The "All" tab click confirmation modal lives in content.js and runs in the
// page itself, where it can preventDefault the click before navigation starts.
// This file only handles the ruleset toggle, icon/badge state, and the
// active-tab strip-on-next-search feature described below.
//
// A note on rules.json: rule 1 (allow, matches URLs that already have a udm
// param) always wins over rule 2 (redirect, adds udm=14) regardless of their
// "priority" values. DNR resolves matches by action-type precedence first
// (allow > block > redirect) and only falls back to "priority" to break ties
// within the same action type. The "priority" values in rules.json are kept
// for readability only — they are not what decides the outcome here.
// A regexFilter negative-lookahead approach ("match /search NOT followed by
// udm=") was considered and rejected: DNR's regexFilter uses RE2, which does
// not support lookahead/lookbehind by design (no linear-time algorithm
// exists for it). The two-rule allow/redirect split is the standard DNR
// workaround for "match A unless B" conditions.
// Docs: https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#matching-algorithm
//
// Disabling the extension deliberately does NOT touch any already-open tab —
// a tab that already rendered a Gemini response keeps it. This is a design
// choice: dormant tabs stay in whatever state they were loaded in.
//
// Exception: the *active* tab at the moment of disabling gets a one-shot
// session rule that strips udm from its very next /search request on Google
// — whether that next request is a plain reload or a brand new query typed
// by the user. Either way it's the same intent: the first Google search on
// this tab after disabling should visibly confirm "yes, it's off" without
// force-refreshing anything or affecting other tabs.
//
// This rule is armed immediately when disabling (no need to wait for a
// specific navigation type — DNR will just apply it to whatever /search
// request comes first on that tab). webNavigation.onBeforeNavigate is only
// used to know *when* to disarm it: once after it has fired for a Google
// /search on the armed tab (one-shot, mission accomplished), or immediately
// if the user navigates that tab away from Google before searching again
// (arming a search-specific override no longer makes sense once the user
// has left Google on that tab).
//
// tabIds-scoped conditions only exist for session-scoped rules
// (updateSessionRules), not dynamic rules — confirmed against the official
// RuleCondition reference — hence the use of session rules here
// specifically. DNR has no built-in "one-shot" rule concept, so the
// add/remove lifecycle of that session rule is managed by hand.

const RULESET_ID = "block_ai_overview_ruleset";
const STRIP_SESSION_RULE_ID = 9001;
const GOOGLE_SEARCH_DOMAINS = [
  "google.com", "google.co.uk", "google.ca", "google.com.au", "google.de",
  "google.fr", "google.es", "google.it", "google.co.jp", "google.co.in",
  "google.com.br", "google.com.mx", "google.nl", "google.pl", "google.se",
  "google.ch", "google.at", "google.be", "google.pt", "google.co.nz",
  "google.co.kr", "google.ru", "google.com.ar", "google.com.co",
  "google.com.tw", "google.com.hk", "google.com.sg", "google.co.za",
  "google.com.ng", "google.com.ph"
];

let enabled = true;
let armedTabId = null;
let armedNavListener = null;

chrome.storage.sync.get({ enabled: true }, (data) => {
  enabled = data.enabled;
  applyRulesetState();
  updateIcon();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || changes.enabled === undefined) return;

  enabled = changes.enabled.newValue;
  applyRulesetState();
  updateIcon();

  if (!enabled) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.id !== undefined) armStripOnNextSearch(tab.id);
    });
  } else {
    // Re-enabling cancels any pending arm : no reason to strip udm from a
    // tab once the extension is back on.
    disarmStripOnNextSearch();
  }
});

function applyRulesetState() {
  const update = enabled
    ? { enableRulesetIds: [RULESET_ID] }
    : { disableRulesetIds: [RULESET_ID] };
  chrome.declarativeNetRequest.updateEnabledRulesets(update).catch(() => {});
}

function updateIcon() {
  const suffix = enabled ? "" : "-off";
  chrome.action.setIcon({
    path: {
      16: `icons/icon16${suffix}.png`,
      32: `icons/icon32${suffix}.png`,
      48: `icons/icon48${suffix}.png`,
      128: `icons/icon128${suffix}.png`
    }
  }).catch(() => {});
}

// The content script asks us to disable the extension when the user clicks
// "Allow AI Overviews" in the modal. Just flip the toggle; storage.onChanged
// above takes care of everything else (ruleset, icon, arming the strip).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "blockAi:disable") {
    chrome.storage.sync.set({ enabled: false }, () => {
      sendResponse({ ok: true });
    });
    return true; // keep the channel open for the async sendResponse
  }
});

// --- Active-tab strip-on-next-search ---

function disarmStripOnNextSearch() {
  if (armedNavListener) {
    chrome.webNavigation.onBeforeNavigate.removeListener(armedNavListener);
    armedNavListener = null;
  }
  armedTabId = null;
  chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [STRIP_SESSION_RULE_ID] })
    .catch(() => {});
}

// Watch this tab's navigations to know when to disarm. The SessionRule
// restricts which navigations event reach the callback (only
// Google hosts, only /search). This is enforced by Chrome,
// so a navigation to some unrelated site won't trigger the rewriting,
// scoped to the same domains via requestDomains
function armStripOnNextSearch(tabId) {
  // Only one armed tab at a time — if disabling happens again before the
  // previous arm fired, replace it rather than stacking listeners/rules.
  disarmStripOnNextSearch();
  armedTabId = tabId;

  // Arm the session rule immediately: DNR will apply it to whatever /search
  // request on this tab comes first (reload or new query, doesn't matter).
  chrome.declarativeNetRequest
    .updateSessionRules({
      removeRuleIds: [STRIP_SESSION_RULE_ID],
      addRules: [
        {
          id: STRIP_SESSION_RULE_ID,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { transform: { queryTransform: { removeParams: ["udm"] } } }
          },
          condition: {
            urlFilter: "/search",
            requestDomains: GOOGLE_SEARCH_DOMAINS,
            tabIds: [tabId],
            resourceTypes: ["main_frame"]
          }
        }
      ]
    })
    .catch(() => {});

  armedNavListener = (details) => {
    if (details.tabId !== armedTabId) return;
    if (details.frameId !== 0) return; // main frame only

    // The addListener filter above already restricts calls to this callback
    // to Google-hosted /search navigations, so in practice this is always
    // the search the rule was armed for. This check is a defensive
    // fallback, not a live branch: if it were ever false (filter bug,
    // Chrome behavior change, etc.) we still disarm rather than silently
    // trust the filter and risk leaving a stale per-tab rule behind.
    disarmStripOnNextSearch();
  };

  chrome.webNavigation.onBeforeNavigate.addListener(armedNavListener);
}
