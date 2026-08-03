/**
 * about-builder.js
 *
 * Construit un panel "about" équivalent à ce que produisait DDG,
 * à partir de sources ouvertes et documentées :
 *  - Nominatim (OpenStreetMap) : géocodage / lieux
 *  - Wikidata : entité structurée liée (coordonnées, site officiel, etc.)
 *  - Wikipedia REST API : résumé + image
 *
 * Aucune dépendance à un moteur de recherche tiers. Query en entrée,
 * objet "about" en sortie, ou null si rien de pertinent trouvé.
 */

(function () {
  const ABOUT_BUILDER_UA =
    "about-panel-extension/1.0 (contact: local-only, personal use)";

  // --- Throttle simple pour respecter la politique d'usage de Nominatim (1 req/s) ---
  let lastNominatimCall = 0;
  async function throttleNominatim() {
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - lastNominatimCall));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCall = Date.now();
  }

  // --- Cache mémoire simple par query normalisée ---
  const aboutCache = new Map();
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

  function cacheGet(key) {
    const entry = aboutCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      aboutCache.delete(key);
      return null;
    }
    return entry.value;
  }

  function cacheSet(key, value) {
    aboutCache.set(key, { value, ts: Date.now() });
  }

  // Seuil sous lequel on considère le lieu comme trop peu notable pour un
  // panel "about" (hameaux, lieux-dits, homonymes obscurs) — ce type de
  // recherche relève plutôt d'une carte type Google Maps avec plusieurs
  // résultats/codes postaux, pas d'un panel de connaissance.
  const MIN_PLACE_IMPORTANCE = 0.25;

  function isPlaceNotable(place) {
    if (!place) return false;
    // Si `importance` est absent (rare), on ne filtre pas par précaution.
    if (typeof place.importance !== "number") return true;
    return place.importance >= MIN_PLACE_IMPORTANCE;
  }

  // --- 1. Nominatim : tente de résoudre la query comme un lieu ---
  async function fetchNominatim(query) {
    await throttleNominatim();
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        extratags: "1",
        namedetails: "1",
        limit: "1",
      });

    const res = await fetch(url, {
      headers: { "User-Agent": ABOUT_BUILDER_UA, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0];
  }

  // --- 2. Wikidata : récupère l'entité liée si Nominatim en fournit une ---
  async function fetchWikidataEntity(wikidataId) {
    if (!wikidataId) return null;
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.entities?.[wikidataId] ?? null;
  }

  function extractOfficialSite(entity) {
    // P856 = official website
    const claim = entity?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    return claim || null;
  }

  // --- 3. Wikipedia : résolution du titre exact via recherche, puis résumé ---

  // L'endpoint /page/summary/{title} attend un titre exact (avec sa
  // désambiguation éventuelle, ex: "L'Odyssée (film, 2016)"). Pour une query
  // libre ambiguë, on passe d'abord par l'endpoint de recherche pour trouver
  // le bon titre, plutôt que de deviner.
  async function resolveWikipediaTitle(query, lang = "en") {
    const url = new URL(`https://${lang}.wikipedia.org/w/rest.php/v1/search/page`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.pages?.[0]?.key || null; // "key" = titre exact utilisable tel quel
  }

  async function fetchWikipediaSummary(title, lang = "en") {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title,
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (
      data.type === "disambiguation" ||
      data.type === "https://mediawiki.org/wiki/HyperSwitch/errors/not_found"
    ) {
      return null;
    }
    return data;
  }

  /**
   * Point d'entrée principal.
   * @param {string} query - texte de la recherche
   * @param {{lang?: string}} opts
   * @returns {Promise<object|null>} objet "about" ou null
   */
  async function buildAboutPanel(query, opts = {}) {
    const lang = opts.lang || "en";
    const cacheKey = `${lang}:${query.trim().toLowerCase()}`;

    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    let place = null;
    let wikidataEntity = null;
    try {
      place = await fetchNominatim(query);
      if (!isPlaceNotable(place)) {
        place = null;
      }
    } catch (e) {
      console.warn("[about-builder] Nominatim error", e);
    }

    const wikidataId = place?.extratags?.wikidata || null;
    if (wikidataId) {
      try {
        wikidataEntity = await fetchWikidataEntity(wikidataId);
      } catch (e) {
        console.warn("[about-builder] Wikidata error", e);
      }
    }

    // Titre Wikipedia : priorité au tag wikipedia de Nominatim (format "fr:Titre"),
    // sinon on résout le titre exact via l'endpoint de recherche (gère la
    // désambiguation, ex: query "L'Odyssée film" -> "L'Odyssée (film, 2016)").
    let wikiTitle = null;
    let wikiLang = lang;
    const wikipediaTag = place?.extratags?.wikipedia;
    if (wikipediaTag && wikipediaTag.includes(":")) {
      const [tagLang, ...rest] = wikipediaTag.split(":");
      wikiLang = tagLang;
      wikiTitle = rest.join(":");
    } else {
      try {
        wikiTitle = await resolveWikipediaTitle(query, wikiLang);
      } catch (e) {
        console.warn("[about-builder] Wikipedia search error", e);
      }
      // Filet de sécurité si la recherche échoue ou ne renvoie rien.
      if (!wikiTitle) {
        wikiTitle =
          place?.namedetails?.name || place?.display_name?.split(",")[0] || query;
      }
    }

    let summary = null;
    try {
      summary = await fetchWikipediaSummary(wikiTitle, wikiLang);
    } catch (e) {
      console.warn("[about-builder] Wikipedia error", e);
    }

    if (!place && !summary) {
      cacheSet(cacheKey, null);
      return null;
    }

    const about = {
      heading: summary?.title || place?.namedetails?.name || query,
      abstract: summary?.extract || null,
      abstractSource: summary ? "Wikipedia" : null,
      abstractUrl: summary?.content_urls?.desktop?.page || null,
      image:
        summary?.thumbnail?.source || summary?.originalimage?.source || null,
      coordinates: place
        ? { lat: parseFloat(place.lat), lon: parseFloat(place.lon) }
        : summary?.coordinates
          ? { lat: summary.coordinates.lat, lon: summary.coordinates.lon }
          : null,
      officialSite: extractOfficialSite(wikidataEntity),
      wikidataId: wikidataId,
      osmType: place?.osm_type || null,
      osmId: place?.osm_id || null,
      placeType: place?.type || null,
      displayAddress: place?.display_name || null,
    };

    cacheSet(cacheKey, about);
    return about;
  }

  // Expose uniquement l'API publique, tout le reste reste privé à cette IIFE.
  self.buildAboutPanel = buildAboutPanel;
})();
