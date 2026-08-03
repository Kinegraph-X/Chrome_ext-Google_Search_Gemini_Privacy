/**
 * content-script.js
 * Chargé sur https://www.google.com/search*
 *
 * Rôle unique : lire le paramètre `q` de l'URL et le transmettre
 * au service worker. Ne modifie jamais le DOM de la page.
 */

(function () {
	console.log("content script")
  function getSearchQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get("q");
  }

  function sendQuery(query) {
	  console.log(query)
    if (!query) return;
    chrome.runtime.sendMessage({
      type: "SEARCH_QUERY_DETECTED",
      query,
      url: window.location.href,
    });
  }

  // Envoi initial au chargement de la page de résultats
  sendQuery(getSearchQuery());

  // Google est une SPA partielle : certaines navigations (suggestions,
  // filtres) changent l'URL sans recharger la page. On observe l'historique.
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sendQuery(getSearchQuery());
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
