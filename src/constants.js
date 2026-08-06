

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
}

export default constants