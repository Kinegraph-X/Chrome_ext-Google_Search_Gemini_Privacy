// background.js — Block AI Overview
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

/**
 * Additional feature
 *
 * - Écoute les messages du content script (query détectée sur Google)
 * - Appelle about-builder.js pour construire le panel
 * - Pousse le résultat au side panel ouvert
 */

import * as about from "./getAbout.js"
import * as movie from "./getMovie.js"

chrome.storage.local.set({ tmdbBearerToken: "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0M2ViNjUzYTk0MTlkYmU4NWI5M2ViMmMzYmFlNmM5NiIsIm5iZiI6MTc4NTcxOTA4OS45NjYsInN1YiI6IjZhNmZlOTMxNTU1NDJkMDg4YTNjNmJlOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.f-A_ZdXVigPYJ4p3z2Qp62yQrkXqv8ScwxEP_bigKzY" });

const STORAGE_KEY = "aboutPanelEnabled";
const TMDB_TOKEN_KEY = "tmdbBearerToken";

// Langue du navigateur (tag BCP-47, ex: "fr-FR", "en-US"), utilisée pour
// Wikipedia (code court, ex: "fr") et TMDB (tag complet, ex: "fr-FR").
// Fallback anglais si jamais indisponible.
const uiLanguage = chrome.i18n.getUILanguage() || "en-US";
const wikipediaLang = uiLanguage.split("-")[0] || "en";
const tmdbLang = uiLanguage;

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

// Session rules (and webNavigation listeners) don't automatically clean up
// when the service worker restarts — only the in-memory armedTabId/
// armedNavListener do, since those are plain JS variables. If the worker
// dies (MV3 workers are killed after ~30s idle) while a strip-on-next-search
// rule is armed, the rule stays active in the browser indefinitely: nothing
// in memory remembers it exists to disarm it later, and no navigation on
// the (now-forgotten) armed tab is being listened for anymore either. Found
// by testing: a stray rule 9001 was still live across multiple reloads,
// silently stripping udm=14 from unrelated tabs.
//
// Fix: clear any leftover STRIP_SESSION_RULE_ID on every worker startup,
// before anything else. There's no way to "resume" an old arm correctly
// (we don't know which tab it was for, or whether that tab still exists),
// so starting clean is the only sound option.
chrome.declarativeNetRequest
  .updateSessionRules({ removeRuleIds: [STRIP_SESSION_RULE_ID] })
  .catch(() => {});

chrome.storage.sync.get({ enabled: true }, (data) => {
  enabled = data.enabled;
  applyRulesetState();
  updateIcon();
});



chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[TMDB_TOKEN_KEY]) {
    setTmdbToken(changes[TMDB_TOKEN_KEY].newValue || null);
	return;
  }
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
    // Re-enabling cancels any pending arm — no reason to strip udm from a
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("receive message", message)
  if (message && message.type === "blockAi:disable") {
    chrome.storage.sync.set(
      {
        enabled: false
      }, 
      () => {
        sendResponse({ ok: true });
      }
    );
    return true; // keep the channel open for the async sendResponse
  }
  else if (message.type === "SEARCH_QUERY_DETECTED") {
    (async () => {
      const [aboutResult, movieResult] = await Promise.allSettled([
        about.buildAboutPanel(
          message.query,
          {
            lang: message.lang
          }
        ),
        movie.resolveMovieEntity(
          message.query,
          {
            lang: message.lang,
            minPopularity : - 1
          }
        )
      ]);

      const aboutData = aboutResult.status === "fulfilled" ? aboutResult.value : null;
      if (aboutResult.status === "rejected") {
        console.error("[content-script] buildAboutPanel failed", aboutResult.reason);
        return;
      }

      const movieData = movieResult.status === "fulfilled" ? movieResult.value : null;
      if (movieResult.status === "rejected") {
        console.error("[content-script] resolveMovieEntity failed", movieResult.reason);
        return;
      }

      const error = chrome.runtime.lastError;
      if (error)
        console.log('runtime lastError', error.message)

      sendResponse(
        {
          type: "DATA_AVAILABLE",
          about : aboutData,
          movie : movieData
        }
      );
      // chrome.tabs.sendMessage(
      //   sender.tab.id,
      //   {
      //     type: "DATA_AVAILABLE",
      //     about : aboutData,
      //     movie : movieData
      //   }
      // );
      // chrome.runtime.sendMessage(
      //   {
      //     type: "DATA_AVAILABLE",
      //     about : aboutData,
      //     movie : movieData
      //   }
      // );
    })()

    return true;
  }
  return false;
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

function armStripOnNextSearch(tabId) {
  // Only one armed tab at a time — if disabling happens again before the
  // previous arm fired, replace it rather than stacking listeners/rules.
  disarmStripOnNextSearch();
  armedTabId = tabId;

  // Arm the session rule immediately: DNR will apply it to whatever /search
  // request on this tab comes first that still carries udm=14 specifically.
  //
  // IMPORTANT: the condition below must only match udm=14, not "/search"
  // in general. An earlier version used urlFilter: "/search" with no udm
  // check, which matched *any* first search on the armed tab — including a
  // legitimate click on Images (udm=2) or Videos (udm=39), stripping their
  // udm too and leaving the request looking like a bare /search, which the
  // (still-enabled-at-that-moment-in-some-race, or otherwise stale) static
  // redirect rule would then re-fill with udm=14 — silently bouncing an
  // Images click over to Web. The regexFilter here scopes the rule to only
  // the case we actually want to handle: a stale udm=14 left over on this
  // tab from before disabling.
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
            regexFilter: "[?&]udm=14(&|$)",
            requestDomains: GOOGLE_SEARCH_DOMAINS,
            tabIds: [tabId],
            resourceTypes: ["main_frame"]
          }
        }
      ]
    })
    .catch(() => {});

  // Watch this tab's navigations to know when to disarm. The addListener
  // filter below restricts which navigations even reach the callback (only
  // Google hosts, only /search) — this is enforced natively by Chrome, not
  // just as a courtesy check, so a navigation to some unrelated site won't
  // trigger this callback at all, and can never be affected by the session
  // rule (which is separately scoped to the same domains via requestDomains
  // above — belt and suspenders, since the rule and the listener filter are
  // two independent mechanisms and either one alone could have a gap).
  //
  // Two ways to reach the callback, both listed explicitly for clarity even
  // though both currently disarm: (a) this navigation *is* the Google
  // /search the rule was armed for — job done, disarm; (b) in principle the
  // filter should mean only (a) can happen, but we keep an explicit check
  // here rather than assume the filter is airtight, since a navigation that
  // slips through unmatched should still disarm rather than leave a stale
  // per-tab rule and listener hanging around indefinitely.
  const googleSearchFilter = {
    url: GOOGLE_SEARCH_DOMAINS.map((d) => ({ hostSuffix: d, pathContains: "/search" }))
  };

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

  chrome.webNavigation.onBeforeNavigate.addListener(armedNavListener, googleSearchFilter);
}
