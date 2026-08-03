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
    img.style.display = "block";
  }
  card.appendChild(img);

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

function renderMovie(movie) {
  movieCastGridEl.innerHTML = "";

  if (!movie) {
    moviePanelEl.style.display = "none";
    return;
  }
  moviePanelEl.style.display = "block";

  if (movie.type === "movie") {
    const { movie: m, cast, directors } = movie.data;
    movieHeadingEl.textContent = `Casting — ${m.title}`;
    directors.forEach((d) =>
      movieCastGridEl.appendChild(personCard(d.name, "Réalisateur", d.profile, d.name))
    );
    cast.forEach((c) =>
      movieCastGridEl.appendChild(personCard(c.name, c.character, c.profile, c.name))
    );
  } else if (movie.type === "person") {
    const { person, filmography } = movie.data;
    movieHeadingEl.textContent = `Filmographie — ${person.name}`;
    filmography.slice(0, 12).forEach((f) => {
      const label = `${f.title}${f.releaseDate ? " (" + f.releaseDate.slice(0, 4) + ")" : ""}`;
      movieCastGridEl.appendChild(
        personCard(label, f.roles.join(", "), f.poster, f.title)
      );
    });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "ABOUT_PANEL_UPDATE") return;
  render(message.about, message.query);
  renderMovie(message.movie);
});
