



import * as about from "src/getAbout.js"
import * as movie from "src/getMovie.js"
import * as openVerse from "src/getOpenVerse.js"

const tasks = {
    about : {
        fetcher : about.buildAboutPanel,
        show : 'renderAbout',
        minPopularity : -1
    },
    movie : {
        fetcher : movie.resolveMovieEntity,
        show : 'renderMovie',
        minPopularity : -1
    },
    images : {
        fetcher : openVerse.buildImagesPanel,
        show : 'renderImages',
        minPopularity : -1
    },
}

export default tasks