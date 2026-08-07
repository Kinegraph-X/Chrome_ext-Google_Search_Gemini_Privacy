


import constants from "./constants.js"
import * as dom from "./inpageBlock.js"
import * as utils from "./aboutPanelUtils.js"


export function render(about, query, theme) {
  dom.titleEl.style.display = "block";

  if (!about) {
    return false;
  }

  dom.emptyEl.style.display = "none";
  dom.panelEl.style.display = "block";

  dom.headingEl.textContent = about.heading || query;

  if (about.image) {
    dom.imageEl.src = about.image;
    dom.imageEl.style.display = "block";
  } else {
    dom.imageEl.style.display = "none";
  }

  dom.abstractEl.textContent = about.abstract || "";

  if (about.coordinates) {
    dom.mapEl.src = utils.buildOsmEmbedUrl(
      about.coordinates.lat,
      about.coordinates.lon,
      constants.OSM_ZOOM_DELTA,
      theme
    );
    dom.mapEl.style.display = "block";
  } else {
    dom.mapEl.style.display = "none";
  }

  if (about.officialSite) {
    dom.officialSiteRow.style.visibility = "visible";
    dom.officialSiteLink.href = about.officialSite;
  } else {
    dom.officialSiteRow.style.visibility = "hidden";
  }

  if (about.abstractUrl) {
    dom.abstractUrlRow.style.visibility = "visible";
    dom.abstractUrlLink.href = about.abstractUrl;
  } else {
    dom.abstractUrlRow.style.visibility = "hidden";
  }

  dom.sourceLine.textContent = about.abstractSource
    ? chrome.i18n.getMessage("sidePanelSourceWithName", [about.abstractSource])
    : chrome.i18n.getMessage("sidePanelSourceOsmOnly");

  return true;
}

function personCard(name, subtitle, imgSrc, searchQuery) {
  const card = document.createElement(searchQuery ? "a" : "div");
  card.className = "gsgp-person-card";

  if (searchQuery) {
    card.href = utils.buildGoogleSearchUrl(searchQuery);
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
        )
    });
    moreBtn.remove();
  });
  container.appendChild(moreBtn);
}

export function renderMovie(movie) {
  if (!movie) {
    dom.moviePanelEl.style.display = "none";
    return false;
  }
  dom.moviePanelEl.style.display = "block";

  if (movie.type === "movie") {
    const { movie: m, cast, directors } = movie.data;
    dom.movieHeadingEl.textContent = chrome.i18n.getMessage("sidePanelCastHeading", [m.title]);
    const directorRole = chrome.i18n.getMessage("sidePanelDirectorRole");
    const configs = [
      ...directors.map((d) => [d.name, directorRole, d.profile, d.name]),
      ...cast.map((c) => [c.name, c.character, c.profile, c.name]),
    ];
    renderCastGrid(dom.movieCastGridEl, configs);
  }
  else if (movie.type === "person") {
    const { person, filmography } = movie.data;
    dom.movieHeadingEl.textContent = chrome.i18n.getMessage("sidePanelFilmographyHeading", [person.name]);
    const configs = filmography.map((f) => {
      const label = `${f.title}${f.releaseDate ? " (" + f.releaseDate.slice(0, 4) + ")" : ""}`;
      return [label, f.roles.join(", "), f.poster, f.title];
    });
    renderCastGrid(dom.movieCastGridEl, configs);
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
        )
    });
    moreBtn.remove();
  });
  container.appendChild(moreBtn);
}

export function renderImages(imagesData) {
  if (!imagesData) {
    dom.imagesPanelEl.style.display = "none";
    return false;
  }
  dom.imagesPanelEl.style.display = "block";
  console.log(chrome.i18n.getMessage(
    "sidePanelImagesHeading",
    [imagesData.tag]
  ))
  dom.imagesHeadingEl.textContent = chrome.i18n.getMessage(
    "sidePanelImagesHeading",
    [imagesData.tag]
  );
  const {images, count, tag} = imagesData;
  const configs = images.map((i) => [`©${i.author}`, `license: cc-${i.license}`, i.thumbnailUrl, i.imageUrl])
  
  renderImagesGrid(dom.imagesGridEl, configs);

  return true;
}