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
        MOVIE_THUMB_COUNT : 8,

        osmUrlTemplate : (str, bbox, marker, theme) => {
            return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${marker}&theme=${theme}`   // &layer=mapnik
        },
        OSM_ZOOM_DELTA : 2,
        googleSearchUrlTempate : (str, query) => {
            return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        },

        // curl --header "Content-Type: application/json" --request POST --data '{"name" : "name", "description" : "thematic image research", "email": "mail@mail.com"}' https://api.openverse.org/v1/auth_tokens/register/
        openVerseRegistration : {
            // [Redacted]
            // "name":"name",
            // "msg":"Check your email for a verification link."
        },
        // curl --header "Content-Type: application/x-www-form-urlencoded" --request POST --data 'client_id=<client_id>>&client_secret=<client_secret>&grant_type=client_credentials' https://api.openverse.org/v1/auth_tokens/token/
        openVerseToken : {
            "access_token":"blGO9qXHLNIN6XbFVyDTsXPUJtV6pJ",
            "expires_in":43200,
            "token_type":"Bearer",
            "scope":"read write"
        },
        openVerseUrl : `https://api.openverse.org/v1/images?`,
        openVerseLicense : "cc0,by,by-sa",
        openVerseLimit : "10",
        openVerseMinScore : 0.25,
        IMAGES_COUNT : 4,
        MAX_IMAGES_COUNT : 16
    };

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
    async function fetchNominatim(query, lang) {
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
            headers: {
                "User-Agent": constants.ABOUT_BUILDER_UA,
                Accept: "application/json",
                "Accept-Language": lang
            },
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
            place = await fetchNominatim(query, opts.lang);
            console.log("place", place);
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
        let wikiLang = opts.lang;
        const wikipediaTag = place?.extratags?.wikipedia;
        console.log("wikipediaTag", wikipediaTag);
        if (wikipediaTag && wikipediaTag.includes(":")) {
            const [tagLang, ...rest] = wikipediaTag.split(":");
            // wikiLang = tagLang;
            wikiTitle = rest.join(":");
            console.log("wikipediaTag wikiTitle", wikiTitle);
        } else {
            try {
                wikiTitle = await resolveWikipediaTitle(query, wikiLang);
                console.log("resolved wikiTitle", wikiTitle);
            } catch (e) {
                console.warn("[about-builder] Wikipedia search error", e);
            }
            // Filet de sécurité si la recherche échoue ou ne renvoie rien.
            if (!wikiTitle) {
                console.log("from_place wikiTitle", wikiTitle);
                wikiTitle =
                    place?.namedetails?.name || place?.display_name?.split(",")[0] || query;
            }
        }

        let summary = null;
        try {
            summary = await fetchWikipediaSummary(wikiTitle, wikiLang);
        } catch (e) {
            console.warn("[about-builder] Wikipedia error", e);
            throw e;
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
    function setTmdbToken$1(token) {
        tmdbToken = token;
    }

    // Charge le token TMDB une fois au démarrage, et à chaque changement en storage.
    async function loadTmdbToken() {
      const result = await chrome.storage.local.get(constants.TMDB_TOKEN_KEY);
      setTmdbToken$1(result[constants.TMDB_TOKEN_KEY] || null);
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

    async function fetchOpenVerse(query) {
        const url = constants.openVerseUrl;
        const params = new URLSearchParams({
            q: query,
            page_size : constants.MAX_IMAGES_COUNT,
            license : constants.openVerseLicense
        });
        
        const res = await fetch(
            url + params,
            {
                headers: { 
                    "User-Agent": constants.ABOUT_BUILDER_UA,
                    Accept: "application/json",
                    Authorization: `Bearer ${constants.openVerseToken.access_token}`
                }
            }
        );
        if (!res.ok) return null;
        
        const data = await res.json();
        
        if (!Array.isArray(data.results) || data.results.length === 0)
            return null;
        console.log(data.results);

        let count = 0;
        const tagMatching = data.results.filter((item, key) => {
            if (item.fields_matched.includes("tags.name")) {
                count++;
                return item;
            }    });
        console.log(tagMatching);

        return {
            count : count,
            results : tagMatching,
            tag : query
        };
    }


    async function buildImagesPanel(query) {
        const images = await fetchOpenVerse(query);
        console.log(images);
        if (!images)
            return null

        const score = images.count / constants.MAX_IMAGES_COUNT;
        if (score < constants.openVerseMinScore) {
            return null
        }

        const result = {
            images : images.results.map(
                (i) => (
                    {
                        license: i.license,
                        author: i.creator.replace(/\s/, '&nbsp;'),
                        thumbnailUrl: i.thumbnail,
                        imageUrl : i.url
                    }
                )
            ),
            tag : images.tag
        };

        return result;
    }

    const tasks = {
        about : {
            fetcher : buildAboutPanel,
            show : 'renderAbout',
            minPopularity : -1
        },
        movie : {
            fetcher : resolveMovieEntity,
            show : 'renderMovie',
            minPopularity : -1
        },
        images : {
            fetcher : buildImagesPanel,
            show : 'renderImages',
            minPopularity : -1
        },
    };

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
     

    chrome.storage.local.set({ tmdbBearerToken: "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0M2ViNjUzYTk0MTlkYmU4NWI5M2ViMmMzYmFlNmM5NiIsIm5iZiI6MTc4NTcxOTA4OS45NjYsInN1YiI6IjZhNmZlOTMxNTU1NDJkMDg4YTNjNmJlOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.f-A_ZdXVigPYJ4p3z2Qp62yQrkXqv8ScwxEP_bigKzY" });
    const TMDB_TOKEN_KEY = "tmdbBearerToken";

    // Langue du navigateur (tag BCP-47, ex: "fr-FR", "en-US"), utilisée pour
    // Wikipedia (code court, ex: "fr") et TMDB (tag complet, ex: "fr-FR").
    // Fallback anglais si jamais indisponible.
    const uiLanguage = chrome.i18n.getUILanguage() || "en-US";
    uiLanguage.split("-")[0] || "en";

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
        let successes = 0;
        let msgs = [];
        (async () => {
          for (const name in tasks) {
            const taskDesc = tasks[name];
            try {
              const res = await taskDesc.fetcher(
                message.query,
                {
                  lang: message.lang,
                  minPopularity : taskDesc.minPopularity
                }
              );
              successes++;
              chrome.tabs.sendMessage(sender.tab.id, {
                type: "DATA_AVAILABLE",
                subType: name,
                res: res,
                query: message.query
              });
            }
            // Handles network erros, not 4xx/5xx
            catch (e) {
              msgs.push(e.msg);
            }
          }
        })();
        if (successes !== Object.keys(tasks).length) {
          chrome.tabs.sendMessage(sender.tab.id, 
            {
              type : 'API_ERROR',
              msgs : msgs
            }
          );
        }

        return true;  // keep the channel open for the async sendResponse
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

})();
//# sourceMappingURL=background.js.map
