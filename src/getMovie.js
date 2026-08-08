



import constants from "src/constants.js"
import * as utils from "src/movieUtils.js"

async function tmdbGet(path, params = {}) {
    const url = new URL(`${constants.TMDB_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: utils.tmdbHeaders() });

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
        const cached = utils.tmdbCacheGet(cacheKey);
        
        if (cached) return cached;

        const search = await tmdbGet("/search/movie", {
            query: cleanQueryForTmdb(title),
            language: lang,
        });
        match = search.results?.[0];
        if (!match) {
            utils.tmdbCacheSet(cacheKey, null);
            return null;
        }
    }
    else {
        return null;
    }

    const cacheKey = `cast:${lang}:id:${match.id}`;
    const cached = utils.tmdbCacheGet(cacheKey);
    
    if (cached) return cached;

    const credits = await tmdbGet(`/movie/${match.id}/credits`, {
        language: lang,
    });

    const result = {
        movie: {
            id: match.id,
            title: match.title,
            releaseDate: match.release_date || null,
            poster: utils.imageUrl(match.poster_path, "w342"),
            overview: match.overview || null,
        },
        cast: (credits.cast || []).slice(0, 12).map(
            (p) => (
                {
                    id: p.id,
                    name: p.name,
                    character: p.character,
                    profile: utils.imageUrl(p.profile_path),
                }
            )
        ),
        directors: (credits.crew || [])
            .filter((p) => p.job === "Director")
            .map((p) => (
                {
                    id: p.id,
                    name: p.name,
                    profile: utils.imageUrl(p.profile_path),
                }
            )),
    };

    utils.tmdbCacheSet(cacheKey, result);
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
        
        const cached = utils.tmdbCacheGet(cacheKey);
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
            utils.tmdbCacheSet(cacheKey, null);
            return null;
        }
    }

    const cacheKey = `filmo:${lang}:id:${match.id}`;
    
    const cached = utils.tmdbCacheGet(cacheKey);
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
                    poster: utils.imageUrl(entry.poster_path, "w185"),
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
            profile: utils.imageUrl(match.profile_path, "w342"),
        },
        filmography,
    };

    utils.tmdbCacheSet(cacheKey, result);
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
export async function resolveMovieEntity(query, opts = {}) {
    const lang = opts.lang || "en-US";
    const minPopularity = opts.minPopularity ?? constants.TMDB_MIN_POPULARITY;
    const cleaned = utils.cleanQueryForTmdb(query);
    
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