

import constants from "src/constants.js"
import * as utils from "src/aboutUtils.js"



// --- 1. Nominatim : tente de résoudre la query comme un lieu ---
async function fetchNominatim(query, lang) {
    await utils.throttleNominatim();
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
export async function buildAboutPanel(query, opts = {}) {
    const lang = opts.lang || "en";
    const cacheKey = `${lang}:${query.trim().toLowerCase()}`;

    const cached = utils.aboutCacheGet(cacheKey);
    if (cached) return cached;

    let place = null;
    let wikidataEntity = null;
    try {
        place = await fetchNominatim(query, opts.lang);
        console.log("place", place)
        if (!utils.isPlaceNotable(place)) {
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
    console.log("wikipediaTag", wikipediaTag)
    if (wikipediaTag && wikipediaTag.includes(":")) {
        const [tagLang, ...rest] = wikipediaTag.split(":");
        // wikiLang = tagLang;
        wikiTitle = rest.join(":");
        console.log("wikipediaTag wikiTitle", wikiTitle)
    } else {
        try {
            wikiTitle = await resolveWikipediaTitle(query, wikiLang);
            console.log("resolved wikiTitle", wikiTitle)
        } catch (e) {
            console.warn("[about-builder] Wikipedia search error", e);
        }
        // Filet de sécurité si la recherche échoue ou ne renvoie rien.
        if (!wikiTitle) {
            console.log("from_place wikiTitle", wikiTitle)
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
        utils.aboutCacheSet(cacheKey, null);
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

    utils.aboutCacheSet(cacheKey, about);
    return about;
}
