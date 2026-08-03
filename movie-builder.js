/**
 * movie-builder.js
 *
 * Reproduit les panels "casting" et "filmographie" via l'API publique TMDB.
 * Authentification : API Read Access Token (JWT), envoyé en header
 * Authorization: Bearer <token> — jamais en query string.
 *
 * Le token est à définir via chrome.storage (voir setTmdbToken) plutôt
 * que codé en dur ici.
 */

(function () {
  const TMDB_BASE = "https://api.themoviedb.org/3";
  const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

  let tmdbToken = null;

  /** À appeler une fois au démarrage du service worker, après lecture du storage. */
  function setTmdbToken(token) {
    tmdbToken = token;
  }

  function tmdbHeaders() {
    if (!tmdbToken) {
      throw new Error(
        "[movie-builder] TMDB token non configuré. Appeler setTmdbToken().",
      );
    }
    return {
      Authorization: `Bearer ${tmdbToken}`,
      Accept: "application/json",
    };
  }

  async function tmdbGet(path, params = {}) {
    const url = new URL(`${TMDB_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: tmdbHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`[movie-builder] TMDB ${res.status} on ${path}: ${body}`);
    }
    return res.json();
  }

  function imageUrl(path, size = "w185") {
    return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
  }

  // Mots parasites fréquents dans une recherche ("X film", "movie X") qui
  // n'apportent rien à TMDB et peuvent faire tomber le bon résultat en
  // 2e position. On ne les strip que pour les appels TMDB — Nominatim/
  // Wikipedia n'ont pas ce problème.
  const NOISE_WORDS = /\b(film|movie)\b/gi;

  function cleanQueryForTmdb(query) {
    return query.replace(NOISE_WORDS, " ").replace(/\s+/g, " ").trim() || query;
  }

  // --- Cache mémoire, même logique que about-builder.js ---
  const movieCache = new Map();
  const CACHE_TTL_MS = 10 * 60 * 1000;

  function cacheGet(key) {
    const entry = movieCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      movieCache.delete(key);
      return null;
    }
    return entry.value;
  }
  function cacheSet(key, value) {
    movieCache.set(key, { value, ts: Date.now() });
  }

  /**
   * Casting d'un film. Soit à partir d'un titre à rechercher, soit d'un
   * match TMDB déjà résolu ailleurs (évite une recherche redondante et la
   * race condition qui en découle — voir resolveMovieEntity).
   * @returns {Promise<object|null>} { movie: {...}, cast: [...], crew: [...] }
   */
  async function buildMovieCastPanel(titleOrMatch, opts = {}) {
    const lang = opts.lang || "fr-FR";
    let match;

    if (typeof titleOrMatch === "object" && titleOrMatch !== null) {
      match = titleOrMatch;
    } else {
      const title = titleOrMatch;
      const cacheKey = `cast:${lang}:${title.trim().toLowerCase()}`;
      const cached = cacheGet(cacheKey);
      if (cached) return cached;

      const search = await tmdbGet("/search/movie", {
        query: cleanQueryForTmdb(title),
        language: lang,
      });
      match = search.results?.[0];
      if (!match) {
        cacheSet(cacheKey, null);
        return null;
      }
    }

    const cacheKey = `cast:${lang}:id:${match.id}`;
    const cached = cacheGet(cacheKey);
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
      cast: (credits.cast || []).slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character,
        profile: imageUrl(p.profile_path),
      })),
      directors: (credits.crew || [])
        .filter((p) => p.job === "Director")
        .map((p) => ({
          id: p.id,
          name: p.name,
          profile: imageUrl(p.profile_path),
        })),
    };

    cacheSet(cacheKey, result);
    return result;
  }

  /**
   * Filmographie d'une personne. Soit à partir d'un nom à rechercher, soit
   * d'un match TMDB déjà résolu ailleurs (même logique anti-race-condition
   * que buildMovieCastPanel).
   * @returns {Promise<object|null>} { person: {...}, filmography: [...] }
   */
  async function buildFilmographyPanel(nameOrMatch, opts = {}) {
    const lang = opts.lang || "fr-FR";
    let match;

    if (typeof nameOrMatch === "object" && nameOrMatch !== null) {
      match = nameOrMatch;
    } else {
      const name = nameOrMatch;
      const cacheKey = `filmo:${lang}:${name.trim().toLowerCase()}`;
      const cached = cacheGet(cacheKey);
      if (cached) return cached;

      const search = await tmdbGet("/search/person", {
        query: cleanQueryForTmdb(name),
        language: lang,
      });
      match = search.results?.[0];
      if (!match) {
        cacheSet(cacheKey, null);
        return null;
      }
    }

    const cacheKey = `filmo:${lang}:id:${match.id}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const credits = await tmdbGet(`/person/${match.id}/combined_credits`, {
      language: lang,
    });

    // Un même film peut apparaître plusieurs fois en crew (ex: réalisateur + scénariste).
    // On regroupe par id de titre et on garde le(s) rôle(s).
    const byTitle = new Map();

    const addEntry = (entry, role) => {
      const key = `${entry.media_type}:${entry.id}`;
      if (!byTitle.has(key)) {
        byTitle.set(key, {
          id: entry.id,
          mediaType: entry.media_type, // "movie" | "tv"
          title: entry.title || entry.name,
          releaseDate: entry.release_date || entry.first_air_date || null,
          poster: imageUrl(entry.poster_path, "w185"),
          roles: new Set(),
        });
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

    cacheSet(cacheKey, result);
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
    const lang = opts.lang || "fr-FR";
    const minPopularity = opts.minPopularity ?? 5;
    const cleaned = cleanQueryForTmdb(query);

    const [movieSearch, personSearch] = await Promise.allSettled([
      tmdbGet("/search/movie", { query: cleaned, language: lang }),
      tmdbGet("/search/person", { query: cleaned, language: lang }),
    ]);

    const bestMovie =
      movieSearch.status === "fulfilled"
        ? movieSearch.value.results?.[0]
        : null;
    const bestPerson =
      personSearch.status === "fulfilled"
        ? personSearch.value.results?.[0]
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
    } else {
      const data = await buildFilmographyPanel(bestPerson, opts);
      return data ? { type: "person", data } : null;
    }
  }

  // Expose uniquement l'API publique, tout le reste reste privé à cette IIFE.
  self.setTmdbToken = setTmdbToken;
  self.buildMovieCastPanel = buildMovieCastPanel;
  self.buildFilmographyPanel = buildFilmographyPanel;
  self.resolveMovieEntity = resolveMovieEntity;
})();
