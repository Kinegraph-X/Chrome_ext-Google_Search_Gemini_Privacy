(function () {
    'use strict';

    const constants = {
        GGOGLE_RESPONSIVE_BREAKPOINT : 1164,

        ABOUT_BUILDER_UA : "about-panel-extension/1.0 (contact: local-only, personal use)",
        nominatimUrl : "https://nominatim.openstreetmap.org/search?",
        nominatimFormat : 'jsonv2',
        nominatimAdressDetails : '1',
        nominatimExtraTags : '1',
        nominatimNameDetails : '1',
        nominatimLimit : '1',

        ABOUT_CACHE_TTL_MS : 10 * 60 * 1000, // 10 min
        MIN_PLACE_IMPORTANCE : 0.25,

        wikidataTemplate : (str, wikidataId) => {
            return `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
        },

        wikipedia : "Wikipedia",
        wikipediaTitleTemplate : (str, lang) => {
            return `https://${lang}.wikipedia.org/w/rest.php/v1/search/page`
        },
        wikipediaLimit : "1",

        wikipediaSummaryTemplate : (str, lang, title) => {
            return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
        },
        wikipediaSummaryNotFound : 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found',

        MOVIE_CACHE_TTL_MS : 10 * 60 * 1000, // 10 min

        TMDB_TOKEN_KEY : "tmdbBearerToken",
        TMDB_BASE : "https://api.themoviedb.org/3",
        TMDB_IMAGE_BASE : "https://image.tmdb.org/t/p",
        // Mots parasites fréquents dans une recherche ("X film", "movie X") qui
        // n'apportent rien à TMDB et peuvent faire tomber le bon résultat en
        // 2e position. On ne les strip que pour les appels TMDB
        // Nominatim/Wikipedia n'ont pas ce problème.
        TMDB_NOISE_WORDS : /\b(film|movie|casting|cast)\b/gi,
        TMDB_MIN_POPULARITY : 5,
        MOVIE_THUMB_COUNT : 12,

        osmUrlTemplate : (str, bbox, marker) => {
            return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${marker}&layer=mapnik`
        },
        googleSearchUrlTempate : (str, query) => {
            return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
    };

    const sheet = new CSSStyleSheet();sheet.replaceSync(":root {\r\n  --panel-width: 421px;\r\n  --gsgp-text: #202124;\r\n  --gsgp-text-muted: #5f6368;\r\n  --gsgp-bg: #ffffff;\r\n  --gsgp-border: #e8eaed;\r\n  --gsgp-accent: #1a73e8;\r\n  --gsgp-accent-text: #ffffff;\r\n  --gsgp-card-bg: #f1f3f4;\r\n}\r\n\r\n@media (prefers-color-scheme: dark) {\r\n  :root {\r\n    --gsgp-text: #e8eaed;\r\n    --gsgp-text-muted: #9aa0a6;\r\n    --gsgp-bg: #22242a;\r\n    --gsgp-border: #3c4043;\r\n    --gsgp-accent: #8ab4f8;\r\n    --gsgp-accent-text: #202124;\r\n    --gsgp-card-bg: #303134;\r\n  }\r\n}\r\n\r\n.gsgp-root {\r\n  display : block;\r\n  font-family: -apple-system, system-ui, sans-serif;\r\n  min-width : var(--panel-width);\r\n  margin: 0;\r\n  padding: 16px;\r\n  color: var(--gsgp-text);\r\n  background: var(--gsgp-bg);\r\n  box-sizing: border-box;\r\n}\r\n\r\n.gsgp-root *,\r\n.gsgp-root *::before,\r\n.gsgp-root *::after {\r\n  box-sizing: inherit;\r\n}\r\n\r\n#search #gsgpPanel {\r\n  width : 260px;\r\n}\r\n\r\n.gsgp-empty {\r\n  color: var(--gsgp-text-muted);\r\n  font-size: 12px;\r\n}\r\n\r\n#gsgpPageTitle {\r\n  color : var(--gsgp-text-muted);\r\n  font-size : 13px;\r\n  margin-bottom : 21px;\r\n}\r\n\r\n.gsgp-heading {\r\n  font-size: 18px;\r\n  font-weight: 600;\r\n  margin: 0 0 8px;\r\n}\r\n\r\n.gsgp-image {\r\n  display: none;\r\n  width: 100%;\r\n  max-height: 260px;\r\n  object-fit: contain;\r\n  background: var(--gsgp-card-bg);\r\n  border-radius: 8px;\r\n  margin-bottom: 12px;\r\n}\r\n\r\n.gsgp-abstract {\r\n  font-size: 14px;\r\n  line-height: 1.5;\r\n}\r\n\r\n.gsgp-map {\r\n  width: 100%;\r\n  height: 220px;\r\n  border: 0;\r\n  border-radius: 8px;\r\n  display: none;\r\n  margin-bottom: 12px;\r\n}\r\n\r\n.gsgp-link-row {\r\n  margin: 8px 0px 16px 0px;\r\n}\r\n\r\n.gsgp-btn-link {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  padding: 8px 14px;\r\n  background: var(--gsgp-accent);\r\n  color: var(--gsgp-accent-text);\r\n  border-radius: 999px;\r\n  text-decoration: none;\r\n  font-size: 13px;\r\n  font-weight: 500;\r\n  transition: opacity 0.15s ease;\r\n}\r\n\r\n.gsgp-btn-link:hover {\r\n  opacity: 0.85;\r\n}\r\n\r\n.gsgp-source {\r\n  font-size: 11px;\r\n  color: var(--gsgp-text-muted);\r\n  margin-top: 16px;\r\n}\r\n\r\n.gsgp-movie-panel {\r\n  padding-bottom : 21px;\r\n}\r\n\r\n.gsgp-movie-heading {\r\n  font-size: 16px;\r\n  margin: 0 0 10px;\r\n}\r\n\r\n.gsgp-cast-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(4, 1fr);\r\n  gap: 12px;\r\n}\r\n\r\n.gsgp-person-card {\r\n  text-align: center;\r\n  font-size: 12px;\r\n  display: block;\r\n  color: inherit;\r\n  text-decoration: none;\r\n  max-width: 131px;\r\n  border-radius: 8px;\r\n  padding: 4px;\r\n  transition: background 0.15s ease;\r\n}\r\n\r\na.gsgp-person-card:hover {\r\n  background: var(--gsgp-card-bg);\r\n  cursor: pointer;\r\n}\r\n\r\n.gsgp-more-btn {\r\n  grid-column: 1 / -1;\r\n  padding: 8px;\r\n  background: transparent;\r\n  border: 1px solid var(--gsgp-border);\r\n  border-radius: 8px;\r\n  color: var(--gsgp-text);\r\n  font-size: 12px;\r\n  font-weight: 500;\r\n  cursor: pointer;\r\n  transition: background 0.15s ease;\r\n}\r\n\r\n.gsgp-more-btn:hover {\r\n  background: var(--gsgp-card-bg);\r\n}\r\n\r\n.gsgp-person-img {\r\n  display: block;\r\n  width: 100%;\r\n  aspect-ratio: 13 / 16;\r\n  border-radius: 6px;\r\n  object-fit: cover;\r\n  background: var(--gsgp-card-bg);\r\n  margin: 0 auto 6px;\r\n}\r\n\r\n.gsgp-person-img-placeholder {\r\n  background-image: linear-gradient(\r\n    135deg,\r\n    var(--gsgp-card-bg) 0%,\r\n    var(--gsgp-border) 50%,\r\n    var(--gsgp-card-bg) 100%\r\n  );\r\n  background-position: center;\r\n  background-repeat: no-repeat;\r\n  background-size: 100% 100%;\r\n}\r\n\r\n.gsgp-person-name {\r\n  font-weight: 600;\r\n}\r\n\r\n.gsgp-person-subtitle {\r\n  color: var(--gsgp-text);\r\n  opacity: 0.75;\r\n}");

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

    function aboutCacheSet(key, value) {
        aboutCache.set(key, { value, ts: Date.now() });
    }

    function aboutCacheGet(key) {
        const entry = aboutCache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > constants.ABOUT_CACHE_TTL_MS) {
            aboutCache.delete(key);
            return null;
        }
        return entry.value;
    }

    // Seuil sous lequel on considère le lieu comme trop peu notable pour un
    // panel "about" (hameaux, lieux-dits, homonymes obscurs) — ce type de
    // recherche relève plutôt d'une carte type Google Maps avec plusieurs
    // résultats/codes postaux, pas d'un panel de connaissance.
    function isPlaceNotable(place) {
        if (!place) return false;
        // Si `importance` est absent (rare), on ne filtre pas par précaution.
        if (typeof place.importance !== "number") return true;
        
        return place.importance >= constants.MIN_PLACE_IMPORTANCE;
    }

    // --- 1. Nominatim : tente de résoudre la query comme un lieu ---
    async function fetchNominatim(query) {
        await throttleNominatim();
        const params = new URLSearchParams({
            q: query,
            format: constants.nominatimFormat,
            addressdetails: constants.nominatimAdressDetails,
            extratags: constants.nominatimExtraTags,
            namedetails: constants.nominatimNameDetails,
            limit: constants.nominatimLimit,
        });
        
        const url = constants.nominatimUrl + params.toString();
        const res = await fetch(url, {
            headers: { "User-Agent": constants.ABOUT_BUILDER_UA, Accept: "application/json" },
        });
        
        if (!res.ok) return null;

        const data = await res.json();
        
        if (!Array.isArray(data) || data.length === 0)
            return null;
        return data[0];
    }

    // --- 2. Wikidata : récupère l'entité liée si Nominatim en fournit une ---
    async function fetchWikidataEntity(wikidataId) {
        if (!wikidataId) return null;
        const url = constants.wikidataTemplate`${wikidataId}`;
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
        const url = new URL(constants.wikipediaTitleTemplate`${lang}`);
        url.searchParams.set("q", query);
        url.searchParams.set("limit", constants.wikipediaLimit);

        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.pages?.[0]?.key || null; // "key" = titre exact utilisable tel quel
    }

    async function fetchWikipediaSummary(title, lang = "en") {
        const url = constants.wikipediaSummaryTemplate`${lang}${title}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return null;
        const data = await res.json();
        if (
            data.type === "disambiguation" ||
            data.type === constants.wikipediaSummaryNotFound
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

        const cached = aboutCacheGet(cacheKey);
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
            aboutCacheSet(cacheKey, null);
            return null;
        }

        const about = {
            heading: summary?.title || place?.namedetails?.name || query,
            abstract: summary?.extract || null,
            abstractSource: summary ? constants.wikipedia : null,
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

        aboutCacheSet(cacheKey, about);
        return about;
    }

    let tmdbToken = null;
    // --- Cache mémoire, même logique que about-builder.js ---
    const movieCache = new Map();

    /** À appeler une fois au démarrage du service worker, après lecture du storage. */
    function setTmdbToken(token) {
        tmdbToken = token;
    }

    // Charge le token TMDB une fois au démarrage, et à chaque changement en storage.
    async function loadTmdbToken() {
      const result = await chrome.storage.local.get(constants.TMDB_TOKEN_KEY);
      setTmdbToken(result[constants.TMDB_TOKEN_KEY] || null);
    }
    loadTmdbToken();

    function tmdbHeaders() {
        if (!tmdbToken) {
            throw new Error(
                "[movie-builder] TMDB token not configured. Call setTmdbToken().",
            );
        }
        return {
            Authorization: `Bearer ${tmdbToken}`,
            Accept: "application/json",
        };
    }

    function imageUrl(path, size = "w185") {
        return path ? `${constants.TMDB_IMAGE_BASE}/${size}${path}` : null;
    }

    function cleanQueryForTmdb$1(query) {
        return query.replace(constants.TMDB_NOISE_WORD, " ").replace(/\s+/g, " ").trim() || query;
    }

    function tmdbCacheGet(key) {
        const entry = movieCache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > constants.MOVIE_CACHE_TTL_MS) {
            movieCache.delete(key);
            return null;
        }
        return entry.value;
    }
    function tmdbCacheSet(key, value) {
        movieCache.set(key, { value, ts: Date.now() });
    }

    async function tmdbGet(path, params = {}) {
        const url = new URL(`${constants.TMDB_BASE}${path}`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const res = await fetch(url, { headers: tmdbHeaders() });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`[movie-builder] TMDB ${res.status} on ${path}: ${body}`);
        }
        return res.json();
    }

    /**
     * Casting d'un film. Soit à partir d'un titre à rechercher, soit d'un
     * match TMDB déjà résolu ailleurs (évite une recherche redondante et la
     * race condition qui en découle — voir resolveMovieEntity).
     * @returns {Promise<object|null>} { movie: {...}, cast: [...], crew: [...] }
     */
    async function buildMovieCastPanel(titleOrMatch, opts = {}) {
        const lang = opts.lang || "en-US";
        let match;

        if (typeof titleOrMatch === "object" && titleOrMatch !== null) {
            match = titleOrMatch;
        }
        else if (titleOrMatch !== null) {
            const title = titleOrMatch;
            const cacheKey = `cast:${lang}:${title.trim().toLowerCase()}`;
            const cached = tmdbCacheGet(cacheKey);
            
            if (cached) return cached;

            const search = await tmdbGet("/search/movie", {
                query: cleanQueryForTmdb(title),
                language: lang,
            });
            match = search.results?.[0];
            if (!match) {
                tmdbCacheSet(cacheKey, null);
                return null;
            }
        }
        else {
            return null;
        }

        const cacheKey = `cast:${lang}:id:${match.id}`;
        const cached = tmdbCacheGet(cacheKey);
        
        if (cached) return cached;

        const credits = await tmdbGet(`/movie/${match.id}/credits`, {
            language: lang,
        });

        const result = {
            movie: {
                id: match.id,
                title: match.title,
                releaseDate: match.release_date || null,
                poster: imageUrl(match.poster_path, "w342"),
                overview: match.overview || null,
            },
            cast: (credits.cast || []).slice(0, 12).map(
                (p) => (
                    {
                        id: p.id,
                        name: p.name,
                        character: p.character,
                        profile: imageUrl(p.profile_path),
                    }
                )
            ),
            directors: (credits.crew || [])
                .filter((p) => p.job === "Director")
                .map((p) => (
                    {
                        id: p.id,
                        name: p.name,
                        profile: imageUrl(p.profile_path),
                    }
                )),
        };

        tmdbCacheSet(cacheKey, result);
        return result;
    }

    /**
     * Filmographie d'une personne. Soit à partir d'un nom à rechercher, soit
     * d'un match TMDB déjà résolu ailleurs (même logique anti-race-condition
     * que buildMovieCastPanel).
     * @returns {Promise<object|null>} { person: {...}, filmography: [...] }
     */
    async function buildFilmographyPanel(nameOrMatch, opts = {}) {
        const lang = opts.lang || "en-US";
        let match;

        if (typeof nameOrMatch === "object" && nameOrMatch !== null) {
            match = nameOrMatch;
        }
        else {
            const name = nameOrMatch;

            const cacheKey = `filmo:${lang}:${name.trim().toLowerCase()}`;
            
            const cached = tmdbCacheGet(cacheKey);
            if (cached) return cached;

            const search = await tmdbGet(
                "/search/person",
                {
                    query: cleanQueryForTmdb(name),
                    language: lang,
                }
            );
            match = search.results?.[0];
            if (!match) {
                tmdbCacheSet(cacheKey, null);
                return null;
            }
        }

        const cacheKey = `filmo:${lang}:id:${match.id}`;
        
        const cached = tmdbCacheGet(cacheKey);
        if (cached) return cached;

        const credits = await tmdbGet(
            `/person/${match.id}/combined_credits`,
            {
                language: lang,
            }
        );

        // Un même film peut apparaître plusieurs fois en crew (ex: réalisateur + scénariste).
        // On regroupe par id de titre et on garde le(s) rôle(s).
        const byTitle = new Map();

        const addEntry = (entry, role) => {
            const key = `${entry.media_type}:${entry.id}`;
            if (!byTitle.has(key)) {
                byTitle.set(
                    key,
                    {
                        id: entry.id,
                        mediaType: entry.media_type, // "movie" | "tv"
                        title: entry.title || entry.name,
                        releaseDate: entry.release_date || entry.first_air_date || null,
                        poster: imageUrl(entry.poster_path, "w185"),
                        roles: new Set(),
                    }
                );
            }
            byTitle.get(key).roles.add(role);
        };

        (credits.cast || []).forEach((e) =>
            addEntry(e, e.character ? `Acteur (${e.character})` : "Acteur"),
        );
        (credits.crew || []).forEach((e) => addEntry(e, e.job || "Équipe"));

        const filmography = Array.from(byTitle.values())
            .map((e) => ({ ...e, roles: Array.from(e.roles) }))
            .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));

        const result = {
            person: {
                id: match.id,
                name: match.name,
                knownFor: match.known_for_department || null,
                profile: imageUrl(match.profile_path, "w342"),
            },
            filmography,
        };

        tmdbCacheSet(cacheKey, result);
        return result;
    }

    /**
     * Tente de résoudre une query à la fois comme film et comme personne,
     * en parallèle, et retourne le meilleur match (comme le fait vraisemblablement
     * Google en interne). Seuil de popularité pour éviter les faux positifs
     * sur des homonymes obscurs.
     *
     * @returns {Promise<{type: "movie"|"person", data: object}|null>}
     */
    async function resolveMovieEntity(query, opts = {}) {
        const lang = opts.lang || "en-US";
        const minPopularity = opts.minPopularity ?? constants.TMDB_MIN_POPULARITY;
        const cleaned = cleanQueryForTmdb$1(query);
        
        const [movieSearch, personSearch] = await Promise.allSettled([
            tmdbGet("/search/movie", { query: cleaned, language: lang }),
            tmdbGet("/search/person", { query: cleaned, language: lang }),
        ]);
        
        const bestMovie =
            movieSearch.status === "fulfilled"
                ? movieSearch.value.total_results > 0
                    ? movieSearch.value.results?.[0]
                    : null
                : null;
        const bestPerson =
            personSearch.status === "fulfilled"
                ? personSearch.value.total_results > 0
                    ? personSearch.value.results?.[0]
                    : null
                : null;

        const movieScore = bestMovie?.popularity ?? -1;
        const personScore = bestPerson?.popularity ?? -1;
        
        if (movieScore < minPopularity && personScore < minPopularity) {
            return null;
        }

        // On repasse directement le match déjà obtenu ci-dessus, plutôt que de
        // laisser buildMovieCastPanel/buildFilmographyPanel relancer une
        // recherche — évite une race condition où la 2e recherche renvoie un
        // résultat différent (ou rien) et fait disparaître le casting.
        if (movieScore >= personScore) {
            const data = await buildMovieCastPanel(bestMovie, opts);
            return data ? { type: "movie", data } : null;
        }
        else {
            const data = await buildFilmographyPanel(bestPerson, opts);
            return data ? { type: "person", data } : null;
        }
    }

    const fragment = document.createDocumentFragment();

    // --- Root ---
    const rootEl = document.createElement("div");
    rootEl.className = "gsgp-root";
    rootEl.id = "gsgpRoot";

    // --- Empty ---
    const emptyEl = document.createElement("div");
    emptyEl.className = "gsgp-empty";
    emptyEl.id = "gsgpEmpty";


    // --- Title ---
    const titleEl = document.createElement("div");
    titleEl.id = "gsgpPageTitle";
    titleEl.style.display = "block";

    const containerEl = document.createElement("div");
    containerEl.id = "gsgpContainer";
    containerEl.style.display = "block";

    // --- Main panel ---
    const panelEl = document.createElement("div");
    panelEl.id = "gsgpPanel";
    panelEl.style.display = "none";

    const headingEl = document.createElement("h1");
    headingEl.className = "gsgp-heading";
    headingEl.id = "gsgpHeading";

    const imageEl = document.createElement("img");
    imageEl.className = "gsgp-image";
    imageEl.id = "gsgpImage";
    imageEl.alt = "";

    const abstractEl = document.createElement("div");
    abstractEl.className = "gsgp-abstract";
    abstractEl.id = "gsgpAbstract";

    // --- Official site ---
    const officialSiteRow = document.createElement("div");
    officialSiteRow.className = "gsgp-link-row";
    officialSiteRow.id = "gsgpOfficialSiteRow";
    officialSiteRow.style.display = "none";

    const officialSiteLink = document.createElement("a");
    officialSiteLink.className = "gsgp-btn-link";
    officialSiteLink.id = "gsgpOfficialSiteLink";
    officialSiteLink.target = "_blank";
    officialSiteLink.rel = "noopener";
    officialSiteLink.append("🔗 ");

    const officialSiteLabel = document.createElement("span");
    officialSiteLabel.id = "gsgpOfficialSiteLabel";

    officialSiteLink.appendChild(officialSiteLabel);
    officialSiteRow.appendChild(officialSiteLink);


    // --- Abstract URL ---
    const abstractUrlRow = document.createElement("div");
    abstractUrlRow.className = "gsgp-link-row";
    abstractUrlRow.id = "gsgpAbstractUrlRow";
    abstractUrlRow.style.display = "none";

    const abstractUrlLink = document.createElement("a");
    abstractUrlLink.className = "gsgp-btn-link";
    abstractUrlLink.id = "gsgpAbstractUrlLink";
    abstractUrlLink.target = "_blank";
    abstractUrlLink.rel = "noopener";
    abstractUrlLink.append("📖 ");

    const abstractUrlLabel = document.createElement("span");
    abstractUrlLabel.id = "gsgpAbstractUrlLabel";

    abstractUrlLink.appendChild(abstractUrlLabel);
    abstractUrlRow.appendChild(abstractUrlLink);

    // --- Map OSM ---
    const mapEl = document.createElement("iframe");
    mapEl.className = "gsgp-map";
    mapEl.id = "gsgpMap";
    mapEl.loading = "lazy";

    // --- Source ---
    const sourceLine = document.createElement("div");
    sourceLine.className = "gsgp-source";
    sourceLine.id = "gsgpSourceLine";


    // --- About Panel ---
    panelEl.append(
      headingEl,
      imageEl,
      abstractEl,
      officialSiteRow,
      abstractUrlRow,
      mapEl,
      sourceLine
    );


    // --- Movie panel ---
    const moviePanelEl = document.createElement("div");
    moviePanelEl.className = "gsgp-movie-panel";
    moviePanelEl.id = "gsgpMoviePanel";
    moviePanelEl.style.display = "none";

    const movieHeadingEl = document.createElement("h2");
    movieHeadingEl.className = "gsgp-movie-heading";
    movieHeadingEl.id = "gsgpMovieHeading";

    const movieCastGridEl = document.createElement("div");
    movieCastGridEl.className = "gsgp-cast-grid";
    movieCastGridEl.id = "gsgpMovieCastGrid";

    const movieSourceLine = document.createElement("div");
    movieSourceLine.className = "gsgp-source";
    movieSourceLine.id = "gsgpMovieSourceLine";



    moviePanelEl.append(
      movieHeadingEl,
      movieCastGridEl,
      movieSourceLine
    );

    containerEl.append(
      emptyEl,
      panelEl,
      moviePanelEl
    );

    rootEl.append(
      titleEl,
      containerEl
    );

    // --- Final Fragment ---
    fragment.append(
      rootEl
    );

    // --- Initial texts ---
    titleEl.textContent = chrome.i18n.getMessage("appName");
    officialSiteLabel.textContent = chrome.i18n.getMessage("sidePanelOfficialSite");
    abstractUrlLabel.textContent = chrome.i18n.getMessage("sidePanelWikipediaLink");
    movieSourceLine.textContent = chrome.i18n.getMessage("sidePanelSourceTmdb");

    function buildOsmEmbedUrl(lat, lon, zoomDelta = 0.02) {
        const bbox = [lon - zoomDelta, lat - zoomDelta, lon + zoomDelta, lat + zoomDelta].join(",");
        const marker = `${lat},${lon}`;
        return constants.osmUrlTemplate`${bbox}${marker}`;
    }

    function buildGoogleSearchUrl(query) {
        return constants.googleSearchUrlTempate`${query}`
    }

    function render(about, query) {
      titleEl.style.display = "block";

      if (!about) {
        return false;
      }

      emptyEl.style.display = "none";
      panelEl.style.display = "block";

      headingEl.textContent = about.heading || query;

      if (about.image) {
        imageEl.src = about.image;
        imageEl.style.display = "block";
      } else {
        imageEl.style.display = "none";
      }

      abstractEl.textContent = about.abstract || "";

      if (about.coordinates) {
        mapEl.src = buildOsmEmbedUrl(about.coordinates.lat, about.coordinates.lon);
        mapEl.style.display = "block";
      } else {
        mapEl.style.display = "none";
      }

      if (about.officialSite) {
        officialSiteRow.style.display = "block";
        officialSiteLink.href = about.officialSite;
      } else {
        officialSiteRow.style.display = "none";
      }

      if (about.abstractUrl) {
        abstractUrlRow.style.display = "block";
        abstractUrlLink.href = about.abstractUrl;
      } else {
        abstractUrlRow.style.display = "none";
      }

      sourceLine.textContent = about.abstractSource
        ? chrome.i18n.getMessage("sidePanelSourceWithName", [about.abstractSource])
        : chrome.i18n.getMessage("sidePanelSourceOsmOnly");

      return true;
    }

    function personCard(name, subtitle, imgSrc, searchQuery) {
      const card = document.createElement(searchQuery ? "a" : "div");
      card.className = "gsgp-person-card";

      if (searchQuery) {
        card.href = buildGoogleSearchUrl(searchQuery);
        card.target = "_blank";
        card.rel = "noopener";
      }

      const img = document.createElement("img");
      img.className = "gsgp-person-img";
      if (imgSrc) {
        img.src = imgSrc;
        card.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "gsgp-person-img gsgp-person-img-placeholder";
        card.appendChild(placeholder);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "gsgp-person-name";
      nameEl.textContent = name;
      card.appendChild(nameEl);

      const subtitleEl = document.createElement("div");
      subtitleEl.className = "gsgp-person-subtitle";
      subtitleEl.textContent = subtitle || "";
      card.appendChild(subtitleEl);

      return card;
    }

    function renderCastGrid(container, cardConfigs) {
      container.innerHTML = "";

      const visibleConfigs = cardConfigs.slice(0, constants.MOVIE_THUMB_COUNT);
      const restConfigs = cardConfigs.slice(constants.MOVIE_THUMB_COUNT);

      visibleConfigs.forEach((cfg) => container.appendChild(personCard(...cfg)));

      if (restConfigs.length === 0) return;

      const moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "gsgp-more-btn";
      moreBtn.textContent = chrome.i18n.getMessage("sidePanelShowMore", [String(restConfigs.length)]);
      moreBtn.addEventListener("click", () => {
        restConfigs.forEach((cfg) => {
            container.insertBefore(
                personCard(...cfg),
                moreBtn
            );
        });
        moreBtn.remove();
      });
      container.appendChild(moreBtn);
    }

    function renderMovie(movie) {
      if (!movie) {
        moviePanelEl.style.display = "none";
        return false;
      }
      moviePanelEl.style.display = "block";

      if (movie.type === "movie") {
        const { movie: m, cast, directors } = movie.data;
        movieHeadingEl.textContent = chrome.i18n.getMessage("sidePanelCastHeading", [m.title]);
        const directorRole = chrome.i18n.getMessage("sidePanelDirectorRole");
        const configs = [
          ...directors.map((d) => [d.name, directorRole, d.profile, d.name]),
          ...cast.map((c) => [c.name, c.character, c.profile, c.name]),
        ];
        renderCastGrid(movieCastGridEl, configs);
      }
      else if (movie.type === "person") {
        const { person, filmography } = movie.data;
        movieHeadingEl.textContent = chrome.i18n.getMessage("sidePanelFilmographyHeading", [person.name]);
        const configs = filmography.map((f) => {
          const label = `${f.title}${f.releaseDate ? " (" + f.releaseDate.slice(0, 4) + ")" : ""}`;
          return [label, f.roles.join(", "), f.poster, f.title];
        });
        renderCastGrid(movieCastGridEl, configs);
      }

      return true;
    }

    /**
     * content-script.js
     * Chargé sur https://www.google.com/search*
     *
     * Rôle unique : lire le paramètre `q` de l'URL et le transmettre
     * au service worker. Ne modifie jamais le DOM de la page.
     */


    const uiLanguage = chrome.i18n.getUILanguage() || "en-US";
    const wikipediaLang = uiLanguage.split("-")[0] || "en";

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
        buildAboutPanel(
          query,
          {
            lang: wikipediaLang
          }
        ),
        resolveMovieEntity(
          query,
          {
            lang: wikipediaLang,
            minPopularity : -1
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
      document.adoptedStyleSheets.push(sheet);

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
      const hasMovie = renderMovie(movieData);

      if (!hasAbout && !hasMovie) {
        setEmptyState();
        return;
      }

      setSuccessState();

      // --- Movie infos are in-between Google results ---
      if (hasMovie) {
        const title = titleEl.cloneNode(true);
        moviePanelEl.prepend(title);

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
    });

    document.addEventListener("DOMContentLoaded", init, { once: true });

})();
//# sourceMappingURL=content-script.js.map
