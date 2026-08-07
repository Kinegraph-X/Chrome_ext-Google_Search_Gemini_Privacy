

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
    MOVIE_THUMB_COUNT : 9,

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
}

export default constants