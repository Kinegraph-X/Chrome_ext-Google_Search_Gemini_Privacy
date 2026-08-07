(function () {
    'use strict';

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
        MOVIE_THUMB_COUNT : 8,

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
    };

    const sheet = new CSSStyleSheet();sheet.replaceSync(":root {\r\n  --panel-width: 421px;\r\n  --gsgp-text: #202124;\r\n  --gsgp-text-muted: #5f6368;\r\n  --gsgp-bg: #ffffff;\r\n  --gsgp-border: #e8eaed;\r\n  --gsgp-accent: #1a73e8;\r\n  --gsgp-accent-text: #ffffff;\r\n  --gsgp-card-bg: #f1f3f4;\r\n}\r\n\r\n@media (prefers-color-scheme: dark) {\r\n  :root {\r\n    --gsgp-text: #e8eaed;\r\n    --gsgp-text-muted: #9aa0a6;\r\n    --gsgp-bg: #22242a;\r\n    --gsgp-border: #3c4043;\r\n    --gsgp-accent: #8ab4f8;\r\n    --gsgp-accent-text: #202124;\r\n    --gsgp-card-bg: #303134;\r\n  }\r\n}\r\n\r\n.gsgp-root {\r\n  display : block;\r\n  font-family: -apple-system, system-ui, sans-serif;\r\n  min-width : var(--panel-width);\r\n  margin: 0;\r\n  padding: 16px;\r\n  color: var(--gsgp-text);\r\n  background: var(--gsgp-bg);\r\n  box-sizing: border-box;\r\n}\r\n\r\n.gsgp-root *,\r\n.gsgp-root *::before,\r\n.gsgp-root *::after {\r\n  box-sizing: inherit;\r\n}\r\n\r\n#gsgpFlexBlock {\r\n  display : block;\r\n}\r\n\r\n#search #gsgpFlexBlock {\r\n  display : flex;\r\n  flex-flow : row;\r\n}\r\n\r\n#search #gsgpAbout {\r\n  width : 278px;\r\n  padding : 0px\r\n}\r\n\r\n#search .gsgp-map {\r\n  max-width : 327px;\r\n  margin: 30px 12px 12px;\r\n}\r\n\r\n.gsgp-empty {\r\n  color: var(--gsgp-text-muted);\r\n  font-size: 12px;\r\n}\r\n\r\n#gsgpPageTitle {\r\n  color : var(--gsgp-text-muted);\r\n  font-size : 13px;\r\n  margin-bottom : 21px;\r\n}\r\n\r\n.gsgp-heading {\r\n  font-size: 18px;\r\n  font-weight: 600;\r\n  margin: 0 0 8px;\r\n}\r\n\r\n.gsgp-image {\r\n  display: none;\r\n  width: 100%;\r\n  max-height: 260px;\r\n  object-fit: contain;\r\n  background: var(--gsgp-card-bg);\r\n  border-radius: 8px;\r\n  margin-bottom: 12px;\r\n}\r\n\r\n.gsgp-abstract {\r\n  font-size: 14px;\r\n  line-height: 1.5;\r\n}\r\n\r\n.gsgp-map {\r\n  width: 100%;\r\n  height: 220px;\r\n  border: 0;\r\n  border-radius: 8px;\r\n  display: none;\r\n  margin-bottom: 12px;\r\n}\r\n\r\n@media (prefers-color-scheme: dark) {\r\n  .gsgp-map {\r\n    filter: invert(100%) hue-rotate(180deg) saturate(50%) brightness(210%) contrast(90%);\r\n  }\r\n}\r\n\r\n.gsgp-link-row {\r\n  margin: 8px 8px 16px 0px;\r\n}\r\n\r\n\r\n#gsgpAbstractUrlRow, #gsgpOfficialSiteRow {\r\n  display : inline-block;\r\n}\r\n\r\n.gsgp-btn-link {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  padding: 8px 14px;\r\n  background: var(--gsgp-accent);\r\n  color: var(--gsgp-accent-text);\r\n  border-radius: 999px;\r\n  text-decoration: none;\r\n  font-size: 13px;\r\n  font-weight: 500;\r\n  transition: opacity 0.15s ease;\r\n}\r\n\r\n.gsgp-btn-link:hover {\r\n  opacity: 0.85;\r\n}\r\n\r\n.gsgp-source {\r\n  font-size: 11px;\r\n  color: var(--gsgp-text-muted);\r\n}\r\n\r\n.gsgp-images-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(4, 1fr);\r\n  gap: 12px;\r\n}\r\n\r\n#search .gsgp-images-grid {\r\n    grid-template-columns: repeat(4, 1fr);\r\n}\r\n\r\n.gsgp-movie-panel {\r\n  padding-bottom : 21px;\r\n}\r\n\r\n.gsgp-movie-heading {\r\n  font-size: 16px;\r\n  margin: 0 0 10px;\r\n}\r\n\r\n.gsgp-cast-grid {\r\n  display: grid;\r\n  grid-template-columns: repeat(4, 1fr);\r\n  gap: 12px;\r\n}\r\n\r\n#search .gsgp-cast-grid {\r\n  grid-template-columns: repeat(4, 1fr);\r\n}\r\n\r\n.gsgp-person-card {\r\n  text-align: center;\r\n  font-size: 12px;\r\n  display: block;\r\n  color: inherit;\r\n  text-decoration: none;\r\n  max-width: 131px;\r\n  border-radius: 8px;\r\n  padding: 4px;\r\n  transition: background 0.15s ease;\r\n}\r\n\r\na.gsgp-person-card:hover {\r\n  background: var(--gsgp-card-bg);\r\n  cursor: pointer;\r\n}\r\n\r\n.gsgp-more-btn {\r\n  grid-column: 1 / -1;\r\n  padding: 8px;\r\n  background: transparent;\r\n  border: 1px solid var(--gsgp-border);\r\n  border-radius: 8px;\r\n  color: var(--gsgp-text);\r\n  font-size: 12px;\r\n  font-weight: 500;\r\n  cursor: pointer;\r\n  transition: background 0.15s ease;\r\n}\r\n\r\n.gsgp-more-btn:hover {\r\n  background: var(--gsgp-card-bg);\r\n}\r\n\r\n.gsgp-person-img {\r\n  display: block;\r\n  width: 100%;\r\n  aspect-ratio: 13 / 16;\r\n  border-radius: 6px;\r\n  object-fit: cover;\r\n  background: var(--gsgp-card-bg);\r\n  margin: 0 auto 6px;\r\n}\r\n\r\n.gsgp-person-img-placeholder {\r\n  background-image: linear-gradient(\r\n    135deg,\r\n    var(--gsgp-card-bg) 0%,\r\n    var(--gsgp-border) 50%,\r\n    var(--gsgp-card-bg) 100%\r\n  );\r\n  background-position: center;\r\n  background-repeat: no-repeat;\r\n  background-size: 100% 100%;\r\n}\r\n\r\n.gsgp-person-name {\r\n  font-weight: 600;\r\n}\r\n\r\n.gsgp-person-subtitle {\r\n  color: var(--gsgp-text);\r\n  opacity: 0.75;\r\n}");

    /** À appeler une fois au démarrage du service worker, après lecture du storage. */
    function setTmdbToken(token) {
    }

    // Charge le token TMDB une fois au démarrage, et à chaque changement en storage.
    async function loadTmdbToken() {
      const result = await chrome.storage.local.get(constants.TMDB_TOKEN_KEY);
      setTmdbToken(result[constants.TMDB_TOKEN_KEY] || null);
    }
    loadTmdbToken();

    const fragment = document.createDocumentFragment();

    // --- Root ---
    const rootEl = document.createElement("div");
    rootEl.className = "gsgp-root";
    rootEl.id = "gsgpRoot";

    // --- Empty ---
    const emptyEl = document.createElement("div");
    emptyEl.className = "gsgp-empty";
    emptyEl.id = "gsgpEmpty";


    // --- Title ---
    const titleEl = document.createElement("div");
    titleEl.id = "gsgpPageTitle";
    titleEl.style.display = "block";

    const containerEl = document.createElement("div");
    containerEl.id = "gsgpContainer";
    containerEl.style.display = "block";

    // --- Container to handle toggling block/flex  ----
    const flexBlockEl = document.createElement("div");
    flexBlockEl.id = "gsgpFlexBlock";

    const aboutEl = document.createElement("div");
    aboutEl.id = "gsgpAbout";
    aboutEl.style.display = "block";

    // --- Main panel ---
    const panelEl = document.createElement("div");
    panelEl.id = "gsgpPanel";
    panelEl.style.display = "none";

    const headingEl = document.createElement("h1");
    headingEl.className = "gsgp-heading";
    headingEl.id = "gsgpHeading";

    const imageEl = document.createElement("img");
    imageEl.className = "gsgp-image";
    imageEl.id = "gsgpImage";
    imageEl.alt = "";

    const abstractEl = document.createElement("div");
    abstractEl.className = "gsgp-abstract";
    abstractEl.id = "gsgpAbstract";

    // --- Official site ---
    const officialSiteRow = document.createElement("div");
    officialSiteRow.className = "gsgp-link-row";
    officialSiteRow.id = "gsgpOfficialSiteRow";
    officialSiteRow.style.visibility = "hidden";

    const officialSiteLink = document.createElement("a");
    officialSiteLink.className = "gsgp-btn-link";
    officialSiteLink.id = "gsgpOfficialSiteLink";
    officialSiteLink.target = "_blank";
    officialSiteLink.rel = "noopener";
    officialSiteLink.append("🔗 ");

    const officialSiteLabel = document.createElement("span");
    officialSiteLabel.id = "gsgpOfficialSiteLabel";

    officialSiteLink.appendChild(officialSiteLabel);
    officialSiteRow.appendChild(officialSiteLink);


    // --- Abstract URL ---
    const abstractUrlRow = document.createElement("div");
    abstractUrlRow.className = "gsgp-link-row";
    abstractUrlRow.id = "gsgpAbstractUrlRow";
    abstractUrlRow.style.visibility = 'hidden';

    const abstractUrlLink = document.createElement("a");
    abstractUrlLink.className = "gsgp-btn-link";
    abstractUrlLink.id = "gsgpAbstractUrlLink";
    abstractUrlLink.target = "_blank";
    abstractUrlLink.rel = "noopener";
    abstractUrlLink.append("📖 ");

    const abstractUrlLabel = document.createElement("span");
    abstractUrlLabel.id = "gsgpAbstractUrlLabel";

    abstractUrlLink.appendChild(abstractUrlLabel);
    abstractUrlRow.appendChild(abstractUrlLink);

    // --- Map OSM ---
    const mapEl = document.createElement("iframe");
    mapEl.className = "gsgp-map";
    mapEl.id = "gsgpMap";
    mapEl.loading = "lazy";

    // --- Source ---
    const sourceLine = document.createElement("div");
    sourceLine.className = "gsgp-source";
    sourceLine.id = "gsgpSourceLine";

    aboutEl.append(
      headingEl,
      imageEl,
    );

    flexBlockEl.append(
      aboutEl,
      mapEl
    );

    // --- About Panel ---
    panelEl.append(
      flexBlockEl,
      abstractEl,
      officialSiteRow,
      abstractUrlRow,
      sourceLine
    );


    // --- Movie panel ---
    const moviePanelEl = document.createElement("div");
    moviePanelEl.className = "gsgp-movie-panel";
    moviePanelEl.id = "gsgpMoviePanel";
    moviePanelEl.style.display = "none";

    const movieHeadingEl = document.createElement("h2");
    movieHeadingEl.className = "gsgp-movie-heading";
    movieHeadingEl.id = "gsgpMovieHeading";

    const movieCastGridEl = document.createElement("div");
    movieCastGridEl.className = "gsgp-cast-grid";
    movieCastGridEl.id = "gsgpMovieCastGrid";

    const movieSourceLine = document.createElement("div");
    movieSourceLine.className = "gsgp-source";
    movieSourceLine.id = "gsgpMovieSourceLine";


    // --- Images panel ---
    const imagesPanelEl = document.createElement("div");
    imagesPanelEl.className = "gsgp-movie-panel";
    imagesPanelEl.id = "gsgpImagesPanel";
    imagesPanelEl.style.display = "none";

    const imagesHeadingEl = document.createElement("h2");
    imagesHeadingEl.className = "gsgp-movie-heading";
    imagesHeadingEl.id = "gsgpImagesHeading";

    const imagesGridEl = document.createElement("div");
    imagesGridEl.className = "gsgp-images-grid";
    imagesGridEl.id = "gsgpImagesCastGrid";

    const imagesSourceLine = document.createElement("div");
    imagesSourceLine.className = "gsgp-source";
    imagesSourceLine.id = "gsgpImagesSourceLine";



    moviePanelEl.append(
      movieHeadingEl,
      movieCastGridEl,
      movieSourceLine
    );

    imagesPanelEl.append(
      imagesHeadingEl,
      imagesGridEl,
      imagesSourceLine
    );

    containerEl.append(
      emptyEl,
      panelEl,
      moviePanelEl,
      imagesPanelEl
    );

    rootEl.append(
      titleEl,
      containerEl
    );

    // --- Final Fragment ---
    fragment.append(
      rootEl
    );

    // --- Initial texts ---
    titleEl.textContent = chrome.i18n.getMessage("appName");
    officialSiteLabel.textContent = chrome.i18n.getMessage("sidePanelOfficialSite");
    abstractUrlLabel.textContent = chrome.i18n.getMessage("sidePanelWikipediaLink");
    movieSourceLine.textContent = chrome.i18n.getMessage("sidePanelSourceTmdb");

    function buildOsmEmbedUrl(lat, lon, zoomDelta, theme) {
        const bbox = [lon - zoomDelta, lat - zoomDelta, lon + zoomDelta, lat + zoomDelta].join(",");
        const marker = `${lat},${lon}`;
        return constants.osmUrlTemplate`${bbox}${marker}${theme}`;
    }

    function buildGoogleSearchUrl(query) {
        return constants.googleSearchUrlTempate`${query}`
    }

    function render(about, query, theme) {
      titleEl.style.display = "block";

      if (!about) {
        return false;
      }

      emptyEl.style.display = "none";
      panelEl.style.display = "block";

      headingEl.textContent = about.heading || query;

      if (about.image) {
        imageEl.src = about.image;
        imageEl.style.display = "block";
      } else {
        imageEl.style.display = "none";
      }

      abstractEl.textContent = about.abstract || "";

      if (about.coordinates) {
        mapEl.src = buildOsmEmbedUrl(
          about.coordinates.lat,
          about.coordinates.lon,
          constants.OSM_ZOOM_DELTA,
          theme
        );
        mapEl.style.display = "block";
      } else {
        mapEl.style.display = "none";
      }

      if (about.officialSite) {
        officialSiteRow.style.visibility = "visible";
        officialSiteLink.href = about.officialSite;
      } else {
        officialSiteRow.style.visibility = "hidden";
      }

      if (about.abstractUrl) {
        abstractUrlRow.style.visibility = "visible";
        abstractUrlLink.href = about.abstractUrl;
      } else {
        abstractUrlRow.style.visibility = "hidden";
      }

      sourceLine.textContent = about.abstractSource
        ? chrome.i18n.getMessage("sidePanelSourceWithName", [about.abstractSource])
        : chrome.i18n.getMessage("sidePanelSourceOsmOnly");

      return true;
    }

    function personCard(name, subtitle, imgSrc, searchQuery) {
      const card = document.createElement(searchQuery ? "a" : "div");
      card.className = "gsgp-person-card";

      if (searchQuery) {
        card.href = buildGoogleSearchUrl(searchQuery);
        card.target = "_blank";
        card.rel = "noopener";
      }

      const img = document.createElement("img");
      img.className = "gsgp-person-img";
      if (imgSrc) {
        img.src = imgSrc;
        card.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "gsgp-person-img gsgp-person-img-placeholder";
        card.appendChild(placeholder);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "gsgp-person-name";
      nameEl.textContent = name;
      card.appendChild(nameEl);

      const subtitleEl = document.createElement("div");
      subtitleEl.className = "gsgp-person-subtitle";
      subtitleEl.textContent = subtitle || "";
      card.appendChild(subtitleEl);

      return card;
    }

    function renderCastGrid(container, cardConfigs) {
      container.innerHTML = "";

      const visibleConfigs = cardConfigs.slice(0, constants.MOVIE_THUMB_COUNT);
      const restConfigs = cardConfigs.slice(constants.MOVIE_THUMB_COUNT);

      visibleConfigs.forEach((cfg) => container.appendChild(personCard(...cfg)));

      if (restConfigs.length === 0) return;

      const moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "gsgp-more-btn";
      moreBtn.textContent = chrome.i18n.getMessage("sidePanelShowMore", [String(restConfigs.length)]);
      moreBtn.addEventListener("click", () => {
        restConfigs.forEach((cfg) => {
            container.insertBefore(
                personCard(...cfg),
                moreBtn
            );
        });
        moreBtn.remove();
      });
      container.appendChild(moreBtn);
    }

    function renderMovie(movie) {
      if (!movie) {
        moviePanelEl.style.display = "none";
        return false;
      }
      moviePanelEl.style.display = "block";

      if (movie.type === "movie") {
        const { movie: m, cast, directors } = movie.data;
        movieHeadingEl.textContent = chrome.i18n.getMessage("sidePanelCastHeading", [m.title]);
        const directorRole = chrome.i18n.getMessage("sidePanelDirectorRole");
        const configs = [
          ...directors.map((d) => [d.name, directorRole, d.profile, d.name]),
          ...cast.map((c) => [c.name, c.character, c.profile, c.name]),
        ];
        renderCastGrid(movieCastGridEl, configs);
      }
      else if (movie.type === "person") {
        const { person, filmography } = movie.data;
        movieHeadingEl.textContent = chrome.i18n.getMessage("sidePanelFilmographyHeading", [person.name]);
        const configs = filmography.map((f) => {
          const label = `${f.title}${f.releaseDate ? " (" + f.releaseDate.slice(0, 4) + ")" : ""}`;
          return [label, f.roles.join(", "), f.poster, f.title];
        });
        renderCastGrid(movieCastGridEl, configs);
      }

      return true;
    }



    function imageCard(author, subtitle, thumbnailSrc, imgSrc) {
      const card = document.createElement("a");
      card.className = "gsgp-person-card";

      card.href = imgSrc;
      card.target = "_blank";
      card.rel = "noopener";

      const img = document.createElement("img");
      img.className = "gsgp-person-img";
      if (thumbnailSrc) {
        img.src = thumbnailSrc;
        card.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "gsgp-person-img gsgp-person-img-placeholder";
        card.appendChild(placeholder);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "gsgp-person-subtitle";
      nameEl.innerHTML = author;
      card.appendChild(nameEl);

      const subtitleEl = document.createElement("div");
      subtitleEl.className = "gsgp-person-subtitle";
      subtitleEl.textContent = subtitle || "";
      card.appendChild(subtitleEl);

      return card;
    }

    function renderImagesGrid(container, cardConfigs) {
      container.innerHTML = "";

      const visibleConfigs = cardConfigs.slice(0, constants.IMAGES_COUNT);
      const restConfigs = cardConfigs.slice(constants.IMAGES_COUNT, constants.MAX_IMAGES_COUNT);

      visibleConfigs.forEach((cfg) => container.appendChild(imageCard(...cfg)));

      if (restConfigs.length === 0) return;

      const moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.className = "gsgp-more-btn";
      moreBtn.textContent = chrome.i18n.getMessage("sidePanelShowMore", [String(restConfigs.length)]);
      moreBtn.addEventListener("click", () => {
        restConfigs.forEach((cfg) => {
            container.insertBefore(
                imageCard(...cfg),
                moreBtn
            );
        });
        moreBtn.remove();
      });
      container.appendChild(moreBtn);
    }

    function renderImages(imagesData) {
      if (!imagesData) {
        imagesPanelEl.style.display = "none";
        return false;
      }
      imagesPanelEl.style.display = "block";
      console.log(chrome.i18n.getMessage(
        "sidePanelImagesHeading",
        [imagesData.tag]
      ));
      imagesHeadingEl.textContent = chrome.i18n.getMessage(
        "sidePanelImagesHeading",
        [imagesData.tag]
      );
      const {images, count, tag} = imagesData;
      const configs = images.map((i) => [`©${i.author}`, `license: cc-${i.license}`, i.thumbnailUrl, i.imageUrl]);
      
      renderImagesGrid(imagesGridEl, configs);

      return true;
    }

    /**
     * content-script.js
     * Chargé sur https://www.google.com/search*
     *
     * Rôle unique : lire le paramètre `q` de l'URL et le transmettre
     * au service worker. Ne modifie jamais le DOM de la page.
     */


    const uiLanguage = chrome.i18n.getUILanguage() || "en-US";
    const wikipediaLang = uiLanguage.split("-")[0] || "en";
    let theme;
    const darkModeMql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (darkModeMql && darkModeMql.matches) {
      theme = 'dark';
    } else {
      theme = 'light';
    }

    let lastUrl = window.location.href;

    function getSearchQuery() {
      const params = new URLSearchParams(window.location.search);
      return params.get("q");
    }

    async function sendQuery(query) {
      if (!query) return;
      chrome.runtime.sendMessage(
        {
          type: "SEARCH_QUERY_DETECTED",
          query : query,
          lang : wikipediaLang,
          url: window.location.href,
        },
        (response) => {
          const error = chrome.runtime.lastError;
          if (error)
            console.log('runtime lastError', error.message);
          if (response.type === "DATA_AVAILABLE") {
            showData(
              response.about,
              response.movie,
              response.images,
              query
            );
          }
        }
      );

      return true;
    }



    function onLayoutChange(rsoBlock, centerCol, rootEl, e) {
      if (!e.matches) {
        rsoBlock.prepend(
          rootEl
        );
      }
      else {
        centerCol.append(
          rootEl
        );
      }
    }


    function setSearchingState() {
      titleEl.textContent = chrome.i18n.getMessage("appName");
      emptyEl.textContent = chrome.i18n.getMessage("searching");
    }

    function setEmptyState() {
      titleEl.textContent = chrome.i18n.getMessage("appName");
      emptyEl.textContent = chrome.i18n.getMessage("sidePanelEmpty");
      panelEl.style.display = "none";
    }

    function setSuccessState() {
      titleEl.textContent = chrome.i18n.getMessage("sidePanelTitleSuccess");
    }

    let resizeListenerInstalled = false;

    async function init() {
      // navigation from BackForwardCache
      if (document.getElementById("gsgpRoot")) {
          return;
      }

      // Google is a partial SPA : some navigations (suggestions,
      // filters) change the URL swithout reloading the page.
      // Let's observe the history
      const observer = new MutationObserver((mutationList) => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          sendQuery(getSearchQuery());
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // --- Inject extension stylesheet  ---
      document.adoptedStyleSheets.push(sheet);

      const centerCol = document.querySelector("#rcnt"); 
      const rsoBlock = document.querySelector("#rso");
      
      // --- Initial state ---
      if (window.innerWidth <= constants.GGOGLE_RESPONSIVE_BREAKPOINT) {
        rsoBlock.prepend(fragment);
      }
      else {
        centerCol.append(fragment);
      }
      setSearchingState();

      const query = getSearchQuery();
      if (!query) {
        return;
      }

      if (!(await sendQuery(query))) {
        // console.error("API failure: see above");
        return;
      }

      // --- Responsiveness ---
      if (!resizeListenerInstalled) {
        const mq = window.matchMedia(`(min-width: ${constants.GGOGLE_RESPONSIVE_BREAKPOINT}px)`);
        mq.addEventListener("change", onLayoutChange.bind(null, rsoBlock, centerCol, rootEl));
        resizeListenerInstalled = true;
      }
    }



    function showData(aboutData, movieData, imagesData, query) {
      const rsoBlock = document.querySelector("#rso");
      const hasAbout = render(aboutData, query, theme);
      const hasMovie = renderMovie(movieData);
      const hasImages = renderImages(imagesData);
      

      if (!hasAbout && !hasMovie && !hasImages) {
        setEmptyState();
        return;
      }

      setSuccessState();

      // --- Movie infos are in-between Google results ---
      if (hasMovie) {
        const title = titleEl.cloneNode(true);
        moviePanelEl.prepend(title);

        // containerEl.style.display = "flex";
        // containerEl.style.flexFlow = "row";
        rsoBlock
          .querySelector(":scope > :nth-child(3)")
          .after(
            moviePanelEl
          );
      }

      if (hasImages) {
        const title = titleEl.cloneNode(true);
        imagesPanelEl.prepend(title);

        rsoBlock
          .querySelector(":scope > :nth-child(6)")
          .after(
            imagesPanelEl
          );
      }
    }

    window.addEventListener("pageshow", (e) => {
      if (e.persisted === true) init();
    });

    document.addEventListener("DOMContentLoaded", init, { once: true });

})();
//# sourceMappingURL=content-script.js.map
