/**
 * content-script.js
 * Chargé sur https://www.google.com/search*
 *
 * Rôle unique : lire le paramètre `q` de l'URL et le transmettre
 * au service worker. Ne modifie jamais le DOM de la page.
 */

import constants from "./constants.js"
import styles from './page_style.css' assert { type: 'css'};
import * as about from "./getAbout.js"
import * as movie from "./getMovie.js"
import {
  fragment,
  containerEl,
  rootEl,
  titleEl,
  emptyEl,
  panelEl,
  moviePanelEl,
  movieHeadingEl
} from "./inpageBlock.js"
import {render, renderMovie} from "./buildAboutPanel.js"

const uiLanguage = chrome.i18n.getUILanguage() || "en-US";
const wikipediaLang = uiLanguage.split("-")[0] || "en";
const tmdbLang = uiLanguage;

let aboutData;
let movieData;

let lastUrl = window.location.href;

function getSearchQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q");
}

async function sendQuery(query) {
  if (!query) return;
  const [aboutResult, movieResult] = await Promise.allSettled([
    about.buildAboutPanel(
      query,
      {
        lang: wikipediaLang
      }
    ),
    movie.resolveMovieEntity(
      query,
      {
        lang: wikipediaLang,
        minPopularity : - 1
      }
    )
  ]);

  aboutData = aboutResult.status === "fulfilled" ? aboutResult.value : null;
  if (aboutResult.status === "rejected") {
    console.error("[content-script] buildAboutPanel failed", aboutResult.reason);
    return;
  }

  movieData = movieResult.status === "fulfilled" ? movieResult.value : null;
  if (movieResult.status === "rejected") {
    console.error("[content-script] resolveMovieEntity failed", movieResult.reason);
    return;
  }

  return true;
}

function onLayoutChange(rsoBlock, centerCol, rootEl, e) {
  if (!e.matches) {
    rsoBlock.prepend(rootEl);
  }
  else {
    centerCol.append(rootEl);
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

let resizeListenerInstalled = false;

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

  const centerCol = document.querySelector("#rcnt"); 
  const rsoBlock = document.querySelector("#rso");
  
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
    console.error("API failure: see above");
    return;
  }

  const hasAbout = render(aboutData, query);
  const hasMovie = renderMovie(movieData, query);

  if (!hasAbout && !hasMovie) {
    setEmptyState();
    return;
  }

  setSuccessState();

  // --- Movie infos are in-between Google results ---
  if (hasMovie) {
    const title = titleEl.cloneNode(true);
    moviePanelEl.prepend(title)

    containerEl.style.display = "flex";
    containerEl.style.flexFlow = "row";

    rsoBlock
      .querySelector(":scope > :nth-child(3)")
      .after(
        moviePanelEl
      );
  }

  // --- Responsiveness ---
  if (!resizeListenerInstalled) {
    const mq = window.matchMedia(`(min-width: ${constants.GGOGLE_RESPONSIVE_BREAKPOINT}px)`);
    mq.addEventListener("change", onLayoutChange.bind(null, rsoBlock, centerCol, rootEl));
    resizeListenerInstalled = true;
  }
}

window.addEventListener("pageshow", (e) => {
  if (e.persisted === true) init();
})

document.addEventListener("DOMContentLoaded", init, { once: true });