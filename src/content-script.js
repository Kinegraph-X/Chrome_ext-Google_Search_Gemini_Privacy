/**
 * content-script.js
 * Chargé sur https://www.google.com/search*
 *
 * Rôle unique : lire le paramètre `q` de l'URL et le transmettre
 * au service worker. Ne modifie jamais le DOM de la page.
 */

import constants from "src/constants.js"
import styles from 'src/page_style.css' assert { type: 'css'};
import {
  fragment,
  containerEl,
  flexBlockEl,
  rootEl,
  titleEl,
  emptyEl,
  panelEl,
  moviePanelEl,
  imagesPanelEl,
  movieHeadingEl
} from "src/inpageBlock.js"
import tasks from "src/tasks.js"
// import {
//   renderAbout,
//   renderMovie,
//   renderImages
// } from "src/buildAboutPanel.js"

import * as renderers from "src/buildAboutPanel.js"

const uiLanguage = chrome.i18n.getUILanguage() || "en-US";
const wikipediaLang = uiLanguage.split("-")[0] || "en";
const tmdbLang = uiLanguage;
let theme;
const darkModeMql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
if (darkModeMql && darkModeMql.matches) {
  theme = 'dark'
} else {
  theme = 'light'
}

let rsoBlock;
let centerCol;
let initialized = false;
let resizeListenerInstalled = false;
const pendingTasks = [];
const maxMatches = Object.keys(tasks).length;
let matchCount = 0;
let requestCount = 0;
let lastUrl = window.location.href;

function getSearchQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q");
}

chrome.runtime.onMessage.addListener((response) => {
  const error = chrome.runtime.lastError;
  if (error) {
    console.log('runtime lastError', error.message)
    return;
  }
  if (response.type === "DATA_AVAILABLE") {
    // handle race condition when request succeeds besore DmContenLoaded
    const task = () => {
      setSearchingState();
      showData(
        response.subType,
        response.res,
        response.query
      );
    }
    console.log(initialized, response, task)
    if (initialized)
      task();
    else
      pendingTasks.push(task);
  }
  else if (response.type === "API_ERROR") {
    response.msgs.forEach((msg) => {
      console.error(msg);
    });
  }
})

async function sendQuery(query) {
  if (!query) return;
  chrome.runtime.sendMessage(
    {
      type: "SEARCH_QUERY_DETECTED",
      query : query,
      lang : wikipediaLang,
      url: window.location.href,
    }
  );

  return true;
}



function onLayoutChange(e) {
  if (!e.matches) {
    rsoBlock.prepend(
      rootEl
    );
  }
  else {
    centerCol.append(
      rootEl
    );
  }
}


function setSearchingState() {
  titleEl.textContent = chrome.i18n.getMessage("appName");
  emptyEl.textContent = chrome.i18n.getMessage("searching");
}

function setEmptyState() {
  titleEl.textContent = chrome.i18n.getMessage("appName");
  emptyEl.textContent = chrome.i18n.getMessage("sidePanelEmpty");
  panelEl.style.display = "none";
}

function setSuccessState() {
  titleEl.textContent = chrome.i18n.getMessage("sidePanelTitleSuccess");
}

async function init() {
  // navigation from BackForwardCache
  if (document.getElementById("gsgpRoot")) {
      return;
  }

  // Google is a partial SPA : some navigations (suggestions,
  // filters) change the URL swithout reloading the page.
  // Let's observe the history
  const observer = new MutationObserver((mutationList) => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sendQuery(getSearchQuery());
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // --- Inject extension stylesheet  ---
  document.adoptedStyleSheets.push(styles)

  // --- Initial state ---
  if (window.innerWidth <= constants.GGOGLE_RESPONSIVE_BREAKPOINT) {
    rsoBlock.prepend(fragment);
  }
  else {
    centerCol.append(fragment);
  }
  setSearchingState();

  const query = getSearchQuery();
  if (!query) {
    return;
  }

  if (!(await sendQuery(query))) {
    // What to log here ?
    return;
  }

  // --- Responsiveness ---
  // resizeListenerInstalled Handles potential inconsistancy related to BFCache
  if (!resizeListenerInstalled) {
    const mq = window.matchMedia(`(min-width: ${constants.GGOGLE_RESPONSIVE_BREAKPOINT}px)`);
    mq.addEventListener("change", onLayoutChange);
    resizeListenerInstalled = true;
  }
}



function showData(subType, payload, query) {
  console.log(self)
  console.log(tasks[subType].show)
  const result = renderers[tasks[subType].show](payload, query, theme);
  if (hasNoResults(result))
    return;
  
  handlePageStructure(subType)
  setSuccessState();
}

function handlePageStructure(taskName) {
  // --- Movie infos are in-between Google results ---
  if (taskName === 'movie') {
    const title = titleEl.cloneNode(true);
    moviePanelEl.prepend(title)

    // containerEl.style.display = "flex";
    // containerEl.style.flexFlow = "row";
    rsoBlock
      .querySelector(":scope > :nth-child(3)")
      .after(
        moviePanelEl
      );
  }
  else if (taskName === 'images') {
    const title = titleEl.cloneNode(true);
    imagesPanelEl.prepend(title)

    rsoBlock
      .querySelector(":scope > :nth-child(6)")
      .after(
        imagesPanelEl
      );
  }
}

function hasNoResults(isResult) {
  if (isResult)
    matchCount++
  requestCount++
  if (
    requestCount === maxMatches &&
    matchCount === 0
  )
    setEmptyState();
}

window.addEventListener("pageshow", (e) => {
  if (e.persisted === true) init();
})

document.addEventListener("DOMContentLoaded", () => {
    initialized = true;
    rsoBlock = document.querySelector("#rso");
    centerCol = document.querySelector("#rcnt"); 
    init();
    pendingTasks.forEach((task) => {
      task();
    })
  },
  { once: true }
);