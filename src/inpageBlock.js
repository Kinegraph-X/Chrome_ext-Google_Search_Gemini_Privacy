


export const fragment = document.createDocumentFragment();

// --- Root ---
export const rootEl = document.createElement("div");
rootEl.className = "gsgp-root";
rootEl.id = "gsgpRoot";

// --- Empty ---
export const emptyEl = document.createElement("div");
emptyEl.className = "gsgp-empty";
emptyEl.id = "gsgpEmpty";


// --- Title ---
export const titleEl = document.createElement("div");
titleEl.id = "gsgpPageTitle";
titleEl.style.display = "block";

export const containerEl = document.createElement("div");
containerEl.id = "gsgpContainer";
containerEl.style.display = "block";

// --- Container to handle toggling block/flex  ----
export const flexBlockEl = document.createElement("div");
flexBlockEl.id = "gsgpFlexBlock";

export const aboutEl = document.createElement("div");
aboutEl.id = "gsgpAbout";
aboutEl.style.display = "block";

// --- Main panel ---
export const panelEl = document.createElement("div");
panelEl.id = "gsgpPanel";
panelEl.style.display = "none";

export const headingEl = document.createElement("h1");
headingEl.className = "gsgp-heading";
headingEl.id = "gsgpHeading";

export const imageEl = document.createElement("img");
imageEl.className = "gsgp-image";
imageEl.id = "gsgpImage";
imageEl.alt = "";

export const abstractEl = document.createElement("div");
abstractEl.className = "gsgp-abstract";
abstractEl.id = "gsgpAbstract";

// --- Official site ---
export const officialSiteRow = document.createElement("div");
officialSiteRow.className = "gsgp-link-row";
officialSiteRow.id = "gsgpOfficialSiteRow";
officialSiteRow.style.visibility = "hidden";

export const officialSiteLink = document.createElement("a");
officialSiteLink.className = "gsgp-btn-link";
officialSiteLink.id = "gsgpOfficialSiteLink";
officialSiteLink.target = "_blank";
officialSiteLink.rel = "noopener";
officialSiteLink.append("🔗 ");

export const officialSiteLabel = document.createElement("span");
officialSiteLabel.id = "gsgpOfficialSiteLabel";

officialSiteLink.appendChild(officialSiteLabel);
officialSiteRow.appendChild(officialSiteLink);


// --- Abstract URL ---
export const abstractUrlRow = document.createElement("div");
abstractUrlRow.className = "gsgp-link-row";
abstractUrlRow.id = "gsgpAbstractUrlRow";
abstractUrlRow.style.visibility = 'hidden'

export const abstractUrlLink = document.createElement("a");
abstractUrlLink.className = "gsgp-btn-link";
abstractUrlLink.id = "gsgpAbstractUrlLink";
abstractUrlLink.target = "_blank";
abstractUrlLink.rel = "noopener";
abstractUrlLink.append("📖 ");

export const abstractUrlLabel = document.createElement("span");
abstractUrlLabel.id = "gsgpAbstractUrlLabel";

abstractUrlLink.appendChild(abstractUrlLabel);
abstractUrlRow.appendChild(abstractUrlLink);

// --- Map OSM ---
export const mapEl = document.createElement("iframe");
mapEl.className = "gsgp-map";
mapEl.id = "gsgpMap";
mapEl.loading = "lazy";

// --- Source ---
export const sourceLine = document.createElement("div");
sourceLine.className = "gsgp-source";
sourceLine.id = "gsgpSourceLine";

aboutEl.append(
  headingEl,
  imageEl,
);

flexBlockEl.append(
  aboutEl,
  mapEl
)

// --- About Panel ---
panelEl.append(
  flexBlockEl,
  abstractEl,
  officialSiteRow,
  abstractUrlRow,
  sourceLine
);


// --- Movie panel ---
export const moviePanelEl = document.createElement("div");
moviePanelEl.className = "gsgp-movie-panel";
moviePanelEl.id = "gsgpMoviePanel";
moviePanelEl.style.display = "none";

export const movieHeadingEl = document.createElement("h2");
movieHeadingEl.className = "gsgp-movie-heading";
movieHeadingEl.id = "gsgpMovieHeading";

export const movieCastGridEl = document.createElement("div");
movieCastGridEl.className = "gsgp-cast-grid";
movieCastGridEl.id = "gsgpMovieCastGrid";

export const movieSourceLine = document.createElement("div");
movieSourceLine.className = "gsgp-source";
movieSourceLine.id = "gsgpMovieSourceLine";


// --- Images panel ---
export const imagesPanelEl = document.createElement("div");
imagesPanelEl.className = "gsgp-movie-panel";
imagesPanelEl.id = "gsgpImagesPanel";
imagesPanelEl.style.display = "none";

export const imagesHeadingEl = document.createElement("h2");
imagesHeadingEl.className = "gsgp-movie-heading";
imagesHeadingEl.id = "gsgpImagesHeading";

export const imagesGridEl = document.createElement("div");
imagesGridEl.className = "gsgp-images-grid";
imagesGridEl.id = "gsgpImagesCastGrid";

export const imagesSourceLine = document.createElement("div");
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
)

containerEl.append(
  emptyEl,
  panelEl,
  moviePanelEl,
  imagesPanelEl
)

rootEl.append(
  titleEl,
  containerEl
);

// --- Final Fragment ---
fragment.append(
  rootEl
)

// --- Initial texts ---
titleEl.textContent = chrome.i18n.getMessage("appName");
officialSiteLabel.textContent = chrome.i18n.getMessage("sidePanelOfficialSite");
abstractUrlLabel.textContent = chrome.i18n.getMessage("sidePanelWikipediaLink");
movieSourceLine.textContent = chrome.i18n.getMessage("sidePanelSourceTmdb");