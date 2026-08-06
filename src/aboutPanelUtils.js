
import constants from "./constants.js"


export function buildOsmEmbedUrl(lat, lon, zoomDelta = 0.02) {
    const bbox = [lon - zoomDelta, lat - zoomDelta, lon + zoomDelta, lat + zoomDelta].join(",");
    const marker = `${lat},${lon}`;
    return constants.osmUrlTemplate`${bbox}${marker}`;
}

export function buildGoogleSearchUrl(query) {
    return constants.googleSearchUrlTempate`${query}`
}