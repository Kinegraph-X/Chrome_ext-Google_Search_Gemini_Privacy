
import constants from "./constants.js"

// --- Throttle simple pour respecter la politique d'usage de Nominatim (1 req/s) ---
let lastNominatimCall = 0;
export async function throttleNominatim() {
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - lastNominatimCall));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCall = Date.now();
}

// --- Cache mémoire simple par query normalisée ---
const aboutCache = new Map();

export function aboutCacheSet(key, value) {
    aboutCache.set(key, { value, ts: Date.now() });
}

export function aboutCacheGet(key) {
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
export function isPlaceNotable(place) {
    if (!place) return false;
    // Si `importance` est absent (rare), on ne filtre pas par précaution.
    if (typeof place.importance !== "number") return true;
    
    place.importance >= constants.MIN_PLACE_IMPORTANCE;
}