
import constants from "src/constants.js"


export function buildOsmEmbedUrl(lat, lon, zoomDelta, theme) {
    const bbox = [lon - zoomDelta, lat - zoomDelta, lon + zoomDelta, lat + zoomDelta].join(",");
    const marker = `${lat},${lon}`;
    return constants.osmUrlTemplate`${bbox}${marker}${theme}`;
}

export function buildGoogleSearchUrl(query) {
    return constants.googleSearchUrlTempate`${query}`
}