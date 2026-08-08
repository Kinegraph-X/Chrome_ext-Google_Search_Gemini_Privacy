
import constants from "src/constants.js"

let tmdbToken = null;
// --- Cache mémoire, même logique que about-builder.js ---
const movieCache = new Map();

/** À appeler une fois au démarrage du service worker, après lecture du storage. */
export function setTmdbToken(token) {
    tmdbToken = token;
}

// Charge le token TMDB une fois au démarrage, et à chaque changement en storage.
async function loadTmdbToken() {
  const result = await chrome.storage.local.get(constants.TMDB_TOKEN_KEY);
  setTmdbToken(result[constants.TMDB_TOKEN_KEY] || null);
}
loadTmdbToken();

export function tmdbHeaders() {
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

export function imageUrl(path, size = "w185") {
    return path ? `${constants.TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function cleanQueryForTmdb(query) {
    return query.replace(constants.TMDB_NOISE_WORD, " ").replace(/\s+/g, " ").trim() || query;
}

export function tmdbCacheGet(key) {
    const entry = movieCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > constants.MOVIE_CACHE_TTL_MS) {
        movieCache.delete(key);
        return null;
    }
    return entry.value;
}
export function tmdbCacheSet(key, value) {
    movieCache.set(key, { value, ts: Date.now() });
}