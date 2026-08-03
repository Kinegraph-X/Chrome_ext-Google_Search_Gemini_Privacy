/**
 * side-panel.js
 * Écoute les messages ABOUT_PANEL_UPDATE envoyés par le service worker
 * et met à jour l'affichage. Utilise l'embed officiel OpenStreetMap
 * (https://www.openstreetmap.org/export/embed.html), sans clé requise.
 *
 * Tous les id/classes sont préfixés "aop" (About/Overlay Panel) pour
 * éviter toute collision avec le CSS/JS de la popup de l'extension.
 */

const emptyEl = document.getElementById("aopEmpty");
const panelEl = document.getElementById("aopPanel");
const headingEl = document.getElementById("aopHeading");
const imageEl = document.getElementById("aopImage");
const abstractEl = document.getElementById("aopAbstract");
const mapEl = document.getElementById("aopMap");
const officialSiteRow = document.getElementById("aopOfficialSiteRow");
const officialSiteLink = document.getElementById("aopOfficialSiteLink");
const abstractUrlRow = document.getElementById("aopAbstractUrlRow");
const abstractUrlLink = document.getElementById("aopAbstractUrlLink");
const sourceLine = document.getElementById("aopSourceLine");

const moviePanelEl = document.getElementById("aopMoviePanel");
const movieHeadingEl = document.getElementById("aopMovieHeading");
const movieCastGridEl = document.getElementById("aopMovieCastGrid");

function buildOsmEmbedUrl(lat, lon, zoomDelta = 0.02) {
  const bbox = [lon - zoomDelta, lat - zoomDelta, lon + zoomDelta, lat + zoomDelta].join(",");
  const marker = `${lat},${lon}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${marker}&layer=mapnik`;
}

function render(about, query) {
  if (!about) {
    emptyEl.style.display = "block";
    emptyEl.textContent = `Rien trouvé pour « ${query} ».`;
    panelEl.style.display = "none";
    return;
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
    mapEl.src = buildOsmEmbedUrl(about.coordinates.lat, about.coordinates.lon);
    mapEl.style.display = "block";
  } else {
    mapEl.style.display = "none";
  }

  if (about.officialSite) {
    officialSiteRow.style.display = "block";
    officialSiteLink.href = about.officialSite;
  } else {
    officialSiteRow.style.display = "none";
  }

  if (about.abstractUrl) {
    abstractUrlRow.style.display = "block";
    abstractUrlLink.href = about.abstractUrl;
  } else {
    abstractUrlRow.style.display = "none";
  }

  sourceLine.textContent = about.abstractSource
    ? `Source : ${about.abstractSource} / OpenStreetMap`
    : "Source : OpenStreetMap";
}

function buildGoogleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function personCard(name, subtitle, imgSrc, searchQuery) {
  const card = document.createElement(searchQuery ? "a" : "div");
  card.className = "aop-person-card";

  if (searchQuery) {
    card.href = buildGoogleSearchUrl(searchQuery);
    card.target = "_blank";
    card.rel = "noopener";
  }

  const img = document.createElement("img");
  img.className = "aop-person-img";
  if (imgSrc) {
    img.src = imgSrc;
    card.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "aop-person-img aop-person-img-placeholder";
    card.appendChild(placeholder);
  }

  const nameEl = document.createElement("div");
  nameEl.className = "aop-person-name";
  nameEl.textContent = name;
  card.appendChild(nameEl);

  const subtitleEl = document.createElement("div");
  subtitleEl.className = "aop-person-subtitle";
  subtitleEl.textContent = subtitle || "";
  card.appendChild(subtitleEl);

  return card;
}

function renderCastGrid(container, cardConfigs) {
  container.innerHTML = "";

  const PAGE_SIZE = 9;
  const visibleConfigs = cardConfigs.slice(0, PAGE_SIZE);
  const restConfigs = cardConfigs.slice(PAGE_SIZE);

  visibleConfigs.forEach((cfg) => container.appendChild(personCard(...cfg)));

  if (restConfigs.length === 0) return;

  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "aop-more-btn";
  moreBtn.textContent = `Voir plus (${restConfigs.length})`;
  moreBtn.addEventListener("click", () => {
    restConfigs.forEach((cfg) => container.insertBefore(personCard(...cfg), moreBtn));
    moreBtn.remove();
  });
  container.appendChild(moreBtn);
}

function renderMovie(movie) {
  if (!movie) {
    moviePanelEl.style.display = "none";
    return;
  }
  moviePanelEl.style.display = "block";

  if (movie.type === "movie") {
    const { movie: m, cast, directors } = movie.data;
    movieHeadingEl.textContent = `Casting — ${m.title}`;
    const configs = [
      ...directors.map((d) => [d.name, "Réalisateur", d.profile, d.name]),
      ...cast.map((c) => [c.name, c.character, c.profile, c.name]),
    ];
    renderCastGrid(movieCastGridEl, configs);
  } else if (movie.type === "person") {
    const { person, filmography } = movie.data;
    movieHeadingEl.textContent = `Filmographie — ${person.name}`;
    const configs = filmography.map((f) => {
      const label = `${f.title}${f.releaseDate ? " (" + f.releaseDate.slice(0, 4) + ")" : ""}`;
      return [label, f.roles.join(", "), f.poster, f.title];
    });
    renderCastGrid(movieCastGridEl, configs);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "ABOUT_PANEL_UPDATE") return;
  render(message.about, message.query);
  renderMovie(message.movie);
});
