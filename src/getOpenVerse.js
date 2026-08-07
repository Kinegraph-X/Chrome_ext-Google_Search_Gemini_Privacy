


import  constants from "./constants.js"
import * as utils from "./movieUtils.js"

export async function fetchOpenVerse(query) {
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
    console.log(data.results)

    let count = 0;
    const tagMatching = data.results.filter((item, key) => {
        if (item.fields_matched.includes("tags.name")) {
            count++
            return item;
        };
    });
    console.log(tagMatching)

    return {
        count : count,
        results : tagMatching,
        tag : query
    };
}


export async function buildImagesPanel(query) {
    const images = await fetchOpenVerse(query);
    console.log(images)
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
    }

    return result;
}