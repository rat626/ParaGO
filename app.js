"use strict";

const NEARBY_MARK_THRESHOLD_METERS = 120;
const DEFAULT_CENTER = { lat: 20, lon: 0 };
const LAST_KNOWN_LOCATION_KEY = "LAST_KNOWN_BROWSER_LOCATION";
const USER_REPORTED_SIGHTINGS_KEY = "USER_REPORTED_SIGHTINGS";
const FOUND_SPECIES_KEY = "FOUND_SPECIES";
const BIRD_WISHLIST_KEY = "BIRD_WISHLIST";

const statusEl = document.getElementById("status");
const sourceMetaEl = document.getElementById("sourceMeta");
const diagnosticsSummaryEl = document.getElementById("diagnosticsSummary");
const diagnosticsListEl = document.getElementById("diagnosticsList");
const birdListEl = document.getElementById("birdList");
const detailsEl = document.getElementById("details");
const birdNameEl = document.getElementById("birdName");
const birdMetaEl = document.getElementById("birdMeta");
const birdRouteEl = document.getElementById("birdRoute");
const markFoundBtn = document.getElementById("markFoundBtn");
const takeMeThereBtnEl = document.getElementById("takeMeThereBtn");
const takeMeThereCardBtnEl = document.getElementById("takeMeThereCardBtn");
const uploadPhotoInputEl = document.getElementById("uploadPhotoInput");
const publishInatBtnEl = document.getElementById("publishInatBtn");
const photoStripEl = document.getElementById("photoStrip");
const audioStripEl = document.getElementById("audioStrip");
const userPhotoStripEl = document.getElementById("userPhotoStrip");
const inatObservationLinkEl = document.getElementById("inatObservationLink");
const locateBtn = document.getElementById("locateBtn");
const rescanBtn = document.getElementById("rescanBtn");
const reportSpeciesInputEl = document.getElementById("reportSpeciesInput");
const reportPhotoInputEl = document.getElementById("reportPhotoInput");
const submitBirdReportBtnEl = document.getElementById("submitBirdReportBtn");
const wishlistSpeciesInputEl = document.getElementById("wishlistSpeciesInput");
const addWishlistBirdBtnEl = document.getElementById("addWishlistBirdBtn");
const wishlistListEl = document.getElementById("wishlistList");

const photoModalEl = document.getElementById("photoModal");
const photoModalImageEl = document.getElementById("photoModalImage");
const photoModalCloseEl = document.getElementById("photoModalClose");
const photoModalMessageEl = document.getElementById("photoModalMessage");
const photoModalFallbackLinkEl = document.getElementById("photoModalFallbackLink");

const observationCardModalEl = document.getElementById("observationCardModal");
const observationCardCloseEl = document.getElementById("observationCardClose");
const observationPrimaryImageEl = document.getElementById("observationPrimaryImage");
const observationThumbsEl = document.getElementById("observationThumbs");
const observationSpeciesTitleEl = document.getElementById("observationSpeciesTitle");
const observationMetaTextEl = document.getElementById("observationMetaText");
const observationMiniMapEl = document.getElementById("observationMiniMap");
const observationOpenInatEl = document.getElementById("observationOpenInat");

const googleMapsApiKeyInputEl = document.getElementById("googleMapsApiKeyInput");
const saveGoogleKeyBtnEl = document.getElementById("saveGoogleKeyBtn");
const inatApiTokenInputEl = document.getElementById("inatApiTokenInput");
const saveInatTokenBtnEl = document.getElementById("saveInatTokenBtn");
const googleOverlayBtnEl = document.getElementById("googleOverlayBtn");

const state = {
  map: null,
  markersLayer: null,
  routeLayer: null,
  userMarker: null,
  accuracyCircle: null,
  inatObservations: [],
  userReportedObservations: JSON.parse(localStorage.getItem(USER_REPORTED_SIGHTINGS_KEY) || "[]"),
  wishlist: JSON.parse(localStorage.getItem(BIRD_WISHLIST_KEY) || "[]"),
  foundSpecies: new Set(JSON.parse(localStorage.getItem(FOUND_SPECIES_KEY) || "[]")),
  observations: [],
  selectedObservationId: null,
  userLocation: null,
  foundIds: new Set(JSON.parse(localStorage.getItem("FOUND_OBSERVATIONS") || "[]")),
  userPhotosByObservation: JSON.parse(localStorage.getItem("USER_BIRD_PHOTOS") || "{}"),
  observationMiniMap: null,
  googleMapsApiKey: localStorage.getItem("GOOGLE_MAPS_API_KEY") || "",
  inatApiToken: localStorage.getItem("INAT_API_TOKEN") || "",
  useGoogleOverlay: false,
  distanceUnit: "km",
  regionCode: null,
  googleMap: null,
  googleMarkers: [],
  googleInfoWindow: null,
  googleDirectionsService: null,
  googleDirectionsRenderer: null,
  diagnostics: {
    geolocationSupported: false,
    permissionApiSupported: false,
    permissionState: "unknown",
    locationRequestSent: false,
    locationGranted: false,
    locationError: "",
    mapReady: false,
    dataLoaded: false,
    liveBirdCount: 0,
    provider: "none",
    routeLoaded: false,
    lastUpdated: null,
  },
};

let activeWatchId = null;

function normalizeSpeciesKey(speciesName) {
  return String(speciesName || "")
    .trim()
    .toLowerCase();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setSourceMeta(text) {
  sourceMetaEl.textContent = text;
}

function diagnosticsClass(status) {
  if (status === "pass") return "diag-pass";
  if (status === "warn") return "diag-warn";
  if (status === "fail") return "diag-fail";
  return "diag-pending";
}

function diagnosticsSymbol(status) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  if (status === "fail") return "FAIL";
  return "WAIT";
}

function updateDiagnostics(patch) {
  Object.assign(state.diagnostics, patch, { lastUpdated: new Date() });
  renderDiagnostics();
}

function renderDiagnostics() {
  const d = state.diagnostics;
  diagnosticsSummaryEl.textContent = `Last update: ${d.lastUpdated ? d.lastUpdated.toLocaleTimeString() : "not yet"}`;
  const locationDetail = state.userLocation
    ? `lat ${state.userLocation.lat.toFixed(5)}, lon ${state.userLocation.lon.toFixed(5)}`
    : "none yet";

  const rows = [
    {
      label: "Geolocation API available",
      status: d.geolocationSupported ? "pass" : "fail",
      detail: d.geolocationSupported ? "navigator.geolocation detected" : "unsupported browser",
    },
    {
      label: "Permissions API",
      status: d.permissionApiSupported ? "pass" : "warn",
      detail: d.permissionApiSupported ? `state ${d.permissionState}` : "not supported",
    },
    {
      label: "Location request sent",
      status: d.locationRequestSent ? "pass" : "pending",
      detail: d.locationRequestSent ? "getCurrentPosition called" : "awaiting request",
    },
    {
      label: "Location permission granted",
      status: d.locationGranted ? "pass" : d.locationError ? "fail" : "pending",
      detail: d.locationGranted ? locationDetail : d.locationError || "waiting on browser prompt",
    },
    {
      label: "Map ready",
      status: d.mapReady ? "pass" : "pending",
      detail: state.useGoogleOverlay ? "Google Maps overlay active" : "Leaflet initialized",
    },
    {
      label: "iNaturalist sightings + media loaded",
      status: d.dataLoaded ? (d.liveBirdCount > 0 ? "pass" : "warn") : "pending",
      detail: `${d.liveBirdCount} sightings from ${d.provider}`,
    },
    {
      label: "Route to selected marker",
      status: d.routeLoaded ? "pass" : "pending",
      detail: d.routeLoaded ? "path drawn on map" : "select marker to test",
    },
  ];

  diagnosticsListEl.innerHTML = rows
    .map((row) => `<li class="${diagnosticsClass(row.status)}">${diagnosticsSymbol(row.status)} - ${row.label}: ${row.detail}</li>`)
    .join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatHours(hours) {
  if (!Number.isFinite(hours)) return "unknown";
  if (hours < 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

function detectLocaleRegionCode() {
  const locale =
    (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().locale) ||
    navigator.language ||
    "";
  const parts = locale.replace("_", "-").split("-");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
}

function distanceUnitForRegion(regionCode) {
  const imperialRegions = new Set(["US", "LR", "MM", "GB"]);
  return imperialRegions.has(String(regionCode || "").toUpperCase()) ? "mi" : "km";
}

function setDistanceUnit(regionCode) {
  const resolvedRegion = regionCode || detectLocaleRegionCode();
  state.regionCode = resolvedRegion || state.regionCode;
  state.distanceUnit = distanceUnitForRegion(state.regionCode);
}

function getLastKnownLocation() {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lon !== "number" ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lon)
    ) {
      return null;
    }
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      accuracy: Number.isFinite(parsed.accuracy) ? parsed.accuracy : 250,
    };
  } catch (_error) {
    return null;
  }
}

function saveLastKnownLocation(lat, lon, accuracy) {
  try {
    localStorage.setItem(
      LAST_KNOWN_LOCATION_KEY,
      JSON.stringify({
        lat,
        lon,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (_error) {
    // Ignore storage failures.
  }
}

function formatDistanceFromMeters(meters) {
  if (!Number.isFinite(meters)) return "n/a";
  if (state.distanceUnit === "mi") return `${(meters / 1609.344).toFixed(2)} mi`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function estimateWalkMinutes(distanceMeters, providerDurationSeconds) {
  const safeDistance = Number.isFinite(distanceMeters) ? distanceMeters : 0;
  const providerMinutes = Number.isFinite(providerDurationSeconds) ? providerDurationSeconds / 60 : 0;
  // 1.35 m/s ~= 3.0 mph typical walking pace; clamp ETA so it is never implausibly fast.
  const baselineMinutes = safeDistance > 0 ? safeDistance / 1.35 / 60 : 0;
  return Math.max(1, Math.round(Math.max(providerMinutes, baselineMinutes)));
}

function normalizeMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url;
}

function hoursAgoFromDate(value) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return Infinity;
  return (Date.now() - ts) / 3600000;
}

function distanceMeters(aLat, aLon, bLat, bLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function speciesHash(speciesName) {
  const value = String(speciesName || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function markerIcon(observation, found) {
  if (observation?.source === "user") {
    return L.divIcon({
      className: "bird-marker-wrapper",
      html: `<div class="bird-dot-marker user-reported-marker ${found ? "found" : ""}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  const animClass = `bird-float-${(speciesHash(observation.species) % 3) + 1}`;
  return L.divIcon({
    className: "bird-marker-wrapper",
    html: `<div class="bird-dot-marker ${found ? "found" : ""} ${animClass}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read photo file"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}

async function compressImageFile(file) {
  const srcDataUrl = await fileToDataUrl(file);
  const img = await loadImageFromDataUrl(srcDataUrl);
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function dataUrlToBlob(dataUrl) {
  const [meta, payload] = String(dataUrl).split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(payload || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function getUserPhotos(observationId) {
  return state.userPhotosByObservation[String(observationId)] || [];
}

function saveUserPhotos() {
  localStorage.setItem("USER_BIRD_PHOTOS", JSON.stringify(state.userPhotosByObservation));
}

function normalizeUserReportedObservations(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return null;
      const observedAt = item.observedAt || item.createdAt || new Date().toISOString();
      const photos = Array.isArray(item.photos) ? item.photos : [];
      const normalizedPhotos = photos
        .map((photo, idx) => {
          const thumb = normalizeMediaUrl(photo?.thumb || photo?.medium || photo?.large || photo?.dataUrl || "");
          const medium = normalizeMediaUrl(photo?.medium || photo?.large || photo?.thumb || "");
          const large = normalizeMediaUrl(photo?.large || photo?.medium || photo?.thumb || "");
          if (!thumb && !medium && !large) return null;
          return {
            id: photo?.id || `${item.id || "user"}-photo-${idx + 1}`,
            thumb,
            medium,
            large,
            pageUrl: "",
          };
        })
        .filter(Boolean);
      const id = item.id || `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      return {
        id,
        source: "user",
        species: String(item.species || "My Bird Sighting"),
        scientificName: String(item.scientificName || "User reported"),
        taxonId: null,
        lat: item.lat,
        lon: item.lon,
        observedAt,
        hoursAgo: hoursAgoFromDate(observedAt),
        placeGuess: String(item.placeGuess || "your current location"),
        photos: normalizedPhotos,
        sounds: [],
        inatUrl: "",
        createdAt: item.createdAt || observedAt,
      };
    })
    .filter(Boolean);
}

function saveUserReportedObservations() {
  localStorage.setItem(USER_REPORTED_SIGHTINGS_KEY, JSON.stringify(state.userReportedObservations));
}

function rebuildObservationList() {
  const reported = normalizeUserReportedObservations(state.userReportedObservations);
  state.userReportedObservations = reported;
  state.observations = [...reported, ...(Array.isArray(state.inatObservations) ? state.inatObservations : [])];
}

function buildGoogleDirectionsUrl(observation) {
  const origin = state.userLocation ? `${state.userLocation.lat},${state.userLocation.lon}` : "";
  const destination = `${observation.lat},${observation.lon}`;
  const originPart = origin ? `origin=${encodeURIComponent(origin)}&` : "";
  return `https://www.google.com/maps/dir/?api=1&${originPart}destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

function buildAppleDirectionsUrl(observation) {
  const destination = `${observation.lat},${observation.lon}`;
  if (state.userLocation) {
    const origin = `${state.userLocation.lat},${state.userLocation.lon}`;
    return `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&dirflg=w`;
  }
  return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=w`;
}

function buildOsmDirectionsUrl(observation) {
  if (!state.userLocation) {
    return `https://www.openstreetmap.org/?mlat=${observation.lat}&mlon=${observation.lon}#map=15/${observation.lat}/${observation.lon}`;
  }
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${state.userLocation.lat}%2C${state.userLocation.lon}%3B${observation.lat}%2C${observation.lon}`;
}

function promptTakeMeThere(observation) {
  const choice = window.prompt(
    "Route options:\n1 = Google Maps walking\n2 = Apple Maps walking\n3 = OpenStreetMap walking",
    "1",
  );
  if (choice === null) return;
  if (choice.trim() === "2") return void window.open(buildAppleDirectionsUrl(observation), "_blank", "noopener,noreferrer");
  if (choice.trim() === "3") return void window.open(buildOsmDirectionsUrl(observation), "_blank", "noopener,noreferrer");
  window.open(buildGoogleDirectionsUrl(observation), "_blank", "noopener,noreferrer");
}

function initMap() {
  state.map = L.map("mapContainer", { zoomControl: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lon], 2);
  const cartoLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    referrerPolicy: "strict-origin-when-cross-origin",
  }).addTo(state.map);

  let fallbackApplied = false;
  cartoLayer.on("tileerror", () => {
    if (fallbackApplied) return;
    fallbackApplied = true;
    setStatus("Primary tiles blocked in this browser. Switched basemap.");
    state.map.removeLayer(cartoLayer);
    L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    }).addTo(state.map);
  });

  state.markersLayer = L.layerGroup().addTo(state.map);
  state.routeLayer = L.layerGroup().addTo(state.map);
  updateDiagnostics({ mapReady: true });
}

function clearGoogleMarkers() {
  state.googleMarkers.forEach((marker) => {
    marker.map = null;
  });
  state.googleMarkers = [];
}

function renderGoogleMarkers() {
  if (!state.useGoogleOverlay || !state.googleMap || !window.google?.maps?.marker) return;
  clearGoogleMarkers();

  const { AdvancedMarkerElement } = window.google.maps.marker;
  if (!state.googleInfoWindow) state.googleInfoWindow = new window.google.maps.InfoWindow();

  state.observations.forEach((obs) => {
    const isUserReported = obs.source === "user";
    const pinImg = document.createElement("img");
    pinImg.src =
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42"><circle cx="21" cy="21" r="11" fill="${isUserReported ? "#9a5c24" : "#3f6ea8"}" stroke="#f9f2de" stroke-width="3"/></svg>`,
      );
    pinImg.width = 40;
    pinImg.height = 40;
    pinImg.alt = obs.species;

    const marker = new AdvancedMarkerElement({
      map: state.googleMap,
      position: { lat: obs.lat, lng: obs.lon },
      title: obs.species,
    });
    marker.append(pinImg);
    marker.addListener("click", () => {
      const firstPhoto = obs.photos?.[0]?.thumb || "";
      state.googleInfoWindow.setContent(
        `<div style="max-width:260px;font-family:'Nunito Sans',system-ui,sans-serif">
          <strong>${escapeHtml(obs.species)}</strong><br/>
          <span style="color:#666">${isUserReported ? "Your reported sighting" : `Seen ${formatHours(obs.hoursAgo)} ago`}</span><br/>
          ${firstPhoto ? `<img src="${firstPhoto}" style="margin-top:6px;width:100%;border-radius:6px;" alt="Observation photo"/>` : ""}
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            ${obs.inatUrl ? `<a href="${obs.inatUrl}" target="_blank" rel="noreferrer noopener">Open observation</a>` : ""}
            <a href="${buildGoogleDirectionsUrl(obs)}" target="_blank" rel="noreferrer noopener">Take me there</a>
          </div>
        </div>`,
      );
      state.googleInfoWindow.open({ anchor: marker, map: state.googleMap });
      selectObservation(obs.id);
    });
    state.googleMarkers.push(marker);
  });
}

function loadGoogleMapsJsApi() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google);
  if (!state.googleMapsApiKey) return Promise.reject(new Error("Google API key missing"));

  return new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-js-api");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-js-api";
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.googleMapsApiKey)}` +
      `&v=beta&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(script);
  });
}

async function enableGoogleOverlay() {
  try {
    await loadGoogleMapsJsApi();
  } catch (error) {
    setStatus(`Google overlay failed: ${error.message}`);
    return;
  }
  if (state.map) {
    state.map.remove();
    state.map = null;
  }
  state.useGoogleOverlay = true;
  googleOverlayBtnEl.textContent = "Use Leaflet Overlay";
  const center = state.userLocation || DEFAULT_CENTER;
  state.googleMap = new window.google.maps.Map(document.getElementById("mapContainer"), {
    center: { lat: center.lat, lng: center.lon },
    zoom: state.userLocation ? 14 : 9,
    mapId: "DEMO_MAP_ID",
    streetViewControl: false,
  });
  state.googleDirectionsService = new window.google.maps.DirectionsService();
  state.googleDirectionsRenderer = new window.google.maps.DirectionsRenderer({
    map: state.googleMap,
    suppressMarkers: true,
    polylineOptions: { strokeColor: "#c6a03b", strokeOpacity: 0.92, strokeWeight: 5 },
  });
  renderGoogleMarkers();
  setStatus("Google overlay active.");
}

function enableLeafletOverlay() {
  if (state.googleDirectionsRenderer) state.googleDirectionsRenderer.setMap(null);
  state.googleDirectionsRenderer = null;
  clearGoogleMarkers();
  state.googleMap = null;
  state.useGoogleOverlay = false;
  googleOverlayBtnEl.textContent = "Use Google Overlay";
  initMap();
  if (state.userLocation) {
    updateUserMarker();
    state.map.setView([state.userLocation.lat, state.userLocation.lon], 14);
  }
  renderObservations();
  setStatus("Leaflet overlay active.");
}

async function installPermissionWatcher() {
  const geolocationSupported = Boolean(navigator.geolocation);
  const permissionApiSupported = Boolean(navigator.permissions?.query);
  updateDiagnostics({ geolocationSupported, permissionApiSupported });
  if (!permissionApiSupported) return;
  try {
    const permissionStatus = await navigator.permissions.query({ name: "geolocation" });
    updateDiagnostics({ permissionState: permissionStatus.state });
    permissionStatus.onchange = () => updateDiagnostics({ permissionState: permissionStatus.state });
  } catch (_error) {
    updateDiagnostics({ permissionApiSupported: false });
  }
}

function updateUserMarker() {
  if (state.useGoogleOverlay || !state.map || !state.userLocation) return;
  if (state.userMarker) state.userMarker.remove();
  if (state.accuracyCircle) state.accuracyCircle.remove();

  const markerColor = state.diagnostics.locationGranted ? "#2f915f" : "#996b2b";
  state.userMarker = L.circleMarker([state.userLocation.lat, state.userLocation.lon], {
    radius: 12,
    color: "#fff4ee",
    weight: 3,
    fillColor: "#d84343",
    fillOpacity: 1,
  }).addTo(state.map);

  const accuracyMeters = Math.max(20, Math.round(state.userLocation.accuracy || 250));
  state.accuracyCircle = L.circle([state.userLocation.lat, state.userLocation.lon], {
    radius: accuracyMeters,
    color: markerColor,
    weight: 1,
    fillColor: markerColor,
    fillOpacity: 0.12,
  }).addTo(state.map);
}

function applyResolvedLocation(lat, lon, accuracy, label, regionCode = null) {
  setDistanceUnit(regionCode);
  state.userLocation = { lat, lon, accuracy };
  updateUserMarker();
  if (state.useGoogleOverlay && state.googleMap) {
    state.googleMap.setCenter({ lat, lng: lon });
    state.googleMap.setZoom(14);
  } else if (state.map) {
    state.map.setView([lat, lon], 13);
  }
  setStatus(`Using ${label} location${accuracy ? ` (±${Math.round(accuracy)}m)` : ""}.`);
}

async function fetchApproxLocationFromIp() {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.latitude !== "number" || typeof data.longitude !== "number") return null;
    return {
      lat: data.latitude,
      lon: data.longitude,
      countryCode: data.country_code || null,
      label: `IP fallback (${data.city || "unknown city"}, ${data.region_code || data.country_code || "?"})`,
    };
  } catch (_error) {
    return null;
  }
}

function requestLocation(options = {}) {
  const forceFresh = Boolean(options.forceFresh);
  if (!navigator.geolocation) {
    updateDiagnostics({ geolocationSupported: false, locationGranted: false, locationError: "unsupported" });
    setStatus("Geolocation not supported in this browser.");
    return;
  }
  if (activeWatchId !== null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
  updateDiagnostics({ locationRequestSent: true, locationError: "" });
  setStatus(forceFresh ? "Requesting fresh GPS location..." : "Requesting location...");

  let settled = false;
  const finishSuccess = (position) => {
    if (settled) return;
    settled = true;
    onSuccess(position);
  };
  const finishFailure = (error) => {
    if (settled) return;
    settled = true;
    onFailure(error);
  };

  const onSuccess = (position) => {
    if (activeWatchId !== null) {
      navigator.geolocation.clearWatch(activeWatchId);
      activeWatchId = null;
    }
    applyResolvedLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy, "browser GPS", null);
    saveLastKnownLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
    updateDiagnostics({ locationGranted: true, permissionState: "granted", locationError: "" });
    refreshSightings();
  };

  const onFailure = async (error) => {
    const denied = error?.code === 1;
    updateDiagnostics({
      locationGranted: false,
      locationError: error?.message || "location unavailable",
      permissionState: denied ? "denied" : state.diagnostics.permissionState,
    });
    if (denied) {
      if (!state.userLocation) {
        state.inatObservations = [];
        rebuildObservationList();
        renderObservations();
      }
      setStatus("Location permission denied. Enable location for this site, then press Recenter Me.");
      return;
    }
    if (forceFresh) {
      setStatus("Could not get a fresh GPS fix. Try again outdoors or check OS/browser location services.");
      return;
    }
    const approx = await fetchApproxLocationFromIp();
    if (approx) {
      applyResolvedLocation(approx.lat, approx.lon, 25000, approx.label, approx.countryCode);
      refreshSightings();
      return;
    }
    state.inatObservations = [];
    rebuildObservationList();
    renderObservations();
    setStatus("Could not get location. Check browser/system location settings.");
  };

  // Non-fresh requests try a quick cached browser fix first so startup recenters immediately.
  if (!forceFresh) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!state.userLocation) {
          applyResolvedLocation(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
            "recent browser cache",
            null,
          );
          saveLastKnownLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
          updateDiagnostics({ locationGranted: true, permissionState: "granted", locationError: "" });
          refreshSightings();
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 600000 },
    );
  }

  // Fail-safe for browsers that hang without resolving geolocation callbacks.
  const hardTimeoutMs = forceFresh ? 26000 : 30000;
  const hardTimeout = setTimeout(() => {
    finishFailure({ code: 3, message: "Geolocation timed out" });
  }, hardTimeoutMs);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      clearTimeout(hardTimeout);
      finishSuccess(position);
    },
    (error) => {
      if (error?.code === 2 || error?.code === 3) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(hardTimeout);
            finishSuccess(position);
          },
          (lowAccError) => {
            const watchStart = Date.now();
            activeWatchId = navigator.geolocation.watchPosition(
              (position) => {
                clearTimeout(hardTimeout);
                finishSuccess(position);
              },
              (watchError) => {
                if (activeWatchId !== null) navigator.geolocation.clearWatch(activeWatchId);
                activeWatchId = null;
                clearTimeout(hardTimeout);
                finishFailure(watchError);
              },
              { enableHighAccuracy: false, timeout: 20000, maximumAge: forceFresh ? 0 : 300000 },
            );
            setTimeout(() => {
              if (activeWatchId !== null && Date.now() - watchStart >= 22000) {
                navigator.geolocation.clearWatch(activeWatchId);
                activeWatchId = null;
                clearTimeout(hardTimeout);
                finishFailure(lowAccError);
              }
            }, 23000);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: forceFresh ? 0 : 300000 },
        );
        return;
      }
      clearTimeout(hardTimeout);
      finishFailure(error);
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  );
}

async function fetchInatObservations() {
  if (!state.userLocation) return [];
  const lat = state.userLocation.lat;
  const lon = state.userLocation.lon;
  const url =
    "https://api.inaturalist.org/v1/observations?" +
    `taxon_id=3&rank=species&quality_grade=research&photos=true&identifications=most_agree&` +
    `lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lon)}&radius=12&order=desc&order_by=observed_on&per_page=80`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`iNaturalist request failed (${response.status})`);
  const data = await response.json();
  const items = Array.isArray(data.results) ? data.results : [];

  return items
    .map((item) => {
      const observedAt = item.time_observed_at || item.observed_on || item.created_at;
      const coords = item.geojson?.coordinates;
      const photos = Array.isArray(item.photos) ? item.photos : [];
      if (!coords || coords.length < 2) return null;
      if (photos.length === 0) return null;
      if (item.taxon?.rank !== "species") return null;

      return {
        id: item.id,
        species: item.taxon?.preferred_common_name || item.taxon?.name || "Unknown species",
        scientificName: item.taxon?.name || "Unknown",
        taxonId: item.taxon?.id || null,
        lat: coords[1],
        lon: coords[0],
        observedAt: new Date(observedAt).toISOString(),
        hoursAgo: hoursAgoFromDate(observedAt),
        placeGuess: item.place_guess || "unknown location",
        photos: photos
          .map((photo) => ({
            id: photo.id,
            thumb: normalizeMediaUrl(photo.small_url || photo.thumb_url || (photo.url || "").replace("square", "small")),
            medium: normalizeMediaUrl(photo.medium_url || (photo.url || "").replace("square", "medium")),
            large: normalizeMediaUrl(photo.large_url || photo.original_url || (photo.url || "").replace("square", "large")),
            pageUrl: photo.id ? `https://www.inaturalist.org/photos/${photo.id}` : "",
          }))
          .filter((p) => p.large || p.medium || p.thumb),
        sounds: (Array.isArray(item.sounds) ? item.sounds : [])
          .map((sound, idx) => ({
            id: sound.id || `${item.id}-sound-${idx + 1}`,
            url: normalizeMediaUrl(sound.file_url || sound.sound_url || sound.url || ""),
          }))
          .filter((s) => s.url),
        inatUrl: `https://www.inaturalist.org/observations/${item.id}`,
      };
    })
    .filter(Boolean);
}

function sortByDistance(obs) {
  if (!state.userLocation) return obs.slice();
  return obs.slice().sort((a, b) => {
    const da = distanceMeters(state.userLocation.lat, state.userLocation.lon, a.lat, a.lon);
    const db = distanceMeters(state.userLocation.lat, state.userLocation.lon, b.lat, b.lon);
    return da - db;
  });
}

function canMarkFound(observation) {
  if (!state.userLocation || !state.diagnostics.locationGranted) return false;
  const meters = distanceMeters(state.userLocation.lat, state.userLocation.lon, observation.lat, observation.lon);
  return meters <= NEARBY_MARK_THRESHOLD_METERS;
}

function saveFoundSet() {
  localStorage.setItem("FOUND_OBSERVATIONS", JSON.stringify(Array.from(state.foundIds)));
}

function saveFoundSpecies() {
  localStorage.setItem(FOUND_SPECIES_KEY, JSON.stringify(Array.from(state.foundSpecies)));
}

function saveWishlist() {
  localStorage.setItem(BIRD_WISHLIST_KEY, JSON.stringify(state.wishlist));
}

function normalizeWishlistItems(items) {
  if (!Array.isArray(items)) return [];
  const dedup = new Set();
  const normalized = [];
  items.forEach((item) => {
    const species = typeof item === "string" ? item : item?.species;
    const text = String(species || "").trim();
    if (!text) return;
    const key = normalizeSpeciesKey(text);
    if (!key || dedup.has(key)) return;
    dedup.add(key);
    normalized.push({
      id: typeof item === "object" && item?.id ? item.id : `wish-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      species: text,
      key,
      createdAt: typeof item === "object" && item?.createdAt ? item.createdAt : new Date().toISOString(),
    });
  });
  return normalized;
}

function renderWishlist() {
  state.wishlist = normalizeWishlistItems(state.wishlist);
  if (state.wishlist.length === 0) {
    wishlistListEl.innerHTML = `<li class="meta">No wishlist birds yet.</li>`;
    return;
  }
  wishlistListEl.innerHTML = state.wishlist
    .map((item) => {
      const matched = state.foundSpecies.has(item.key);
      return `
        <li class="wishlist-item ${matched ? "matched" : ""}">
          <span class="wishlist-text">
            <span class="wishlist-prefix">${matched ? "✔" : "○"}</span>
            ${escapeHtml(item.species)}
          </span>
          <button type="button" class="wishlist-remove-btn" data-wishlist-id="${item.id}">Remove</button>
        </li>
      `;
    })
    .join("");
}

function addWishlistSpecies(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    setStatus("Enter a bird name to add it to your wishlist.");
    return;
  }
  const key = normalizeSpeciesKey(text);
  if (state.wishlist.some((w) => w.key === key)) {
    setStatus(`"${text}" is already on your wishlist.`);
    return;
  }
  state.wishlist.unshift({
    id: `wish-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    species: text,
    key,
    createdAt: new Date().toISOString(),
  });
  state.wishlist = state.wishlist.slice(0, 120);
  saveWishlist();
  renderWishlist();
  const alreadyFound = state.foundSpecies.has(key);
  setStatus(alreadyFound ? `Added "${text}" to wishlist (already found ✔).` : `Added "${text}" to wishlist.`);
}

function renderObservations() {
  if (state.markersLayer) state.markersLayer.clearLayers();
  birdListEl.innerHTML = "";

  if (state.observations.length === 0) {
    birdListEl.innerHTML = `<article class="bird-item"><div class="meta">No sightings yet. Rescan iNaturalist or add your own bird sighting.</div></article>`;
    return;
  }

  sortByDistance(state.observations).forEach((obs) => {
    const found = state.foundIds.has(obs.id);
    const userPhotos = getUserPhotos(obs.id);
    const isUserReported = obs.source === "user";

    if (!state.useGoogleOverlay && state.markersLayer) {
      const marker = L.marker([obs.lat, obs.lon], {
        icon: markerIcon(obs, found),
        title: obs.species,
      }).addTo(state.markersLayer);

      const hoverImg = obs.photos?.[0]?.thumb || obs.photos?.[0]?.medium || "";
      marker.bindTooltip(
        `<div class="hover-card">
          <div class="hover-card-title">${escapeHtml(obs.species)}</div>
          ${hoverImg ? `<img src="${hoverImg}" alt="${escapeHtml(obs.species)} recent sighting photo" />` : `<div class="hover-card-empty">No photo preview</div>`}
          <div class="hover-card-meta">${isUserReported ? "Your reported sighting" : `Seen ${formatHours(obs.hoursAgo)} ago`}</div>
        </div>`,
        { direction: "top", className: "bird-tooltip", opacity: 1, sticky: true },
      );
      marker.on("mouseover", () => marker.openTooltip());
      marker.on("mouseout", () => marker.closeTooltip());
      marker.on("click", () => selectObservation(obs.id));
    }

    const distM = state.userLocation ? distanceMeters(state.userLocation.lat, state.userLocation.lon, obs.lat, obs.lon) : NaN;
    const distanceText = Number.isFinite(distM) ? formatDistanceFromMeters(distM) : "distance unavailable";
    const row = document.createElement("article");
    row.className = "bird-item";
    row.innerHTML = `
      <button type="button" data-observation-id="${obs.id}">
        <strong>${escapeHtml(obs.species)}</strong>
        <div class="meta">${distanceText} away • ${isUserReported ? "you reported this" : `seen ${formatHours(obs.hoursAgo)} ago`}</div>
        <div class="meta">${isUserReported ? "Source: your upload" : "Source: iNaturalist research-grade"}</div>
        ${userPhotos.length > 0 ? `<div class="meta"><span class="user-photo-count">📷 ${userPhotos.length} your photo${userPhotos.length > 1 ? "s" : ""}</span></div>` : ""}
        ${userPhotos.length > 0 ? `<img class="user-photo-thumb" src="${userPhotos[0].dataUrl}" alt="Your uploaded bird photo thumbnail" />` : ""}
        ${found ? '<div class="found-badge">✔ Marked Found</div>' : ""}
      </button>
    `;
    birdListEl.appendChild(row);
  });

  if (state.useGoogleOverlay) renderGoogleMarkers();
}

function routeSeedFromId(observationId) {
  const raw = String(observationId);
  let seed = 0;
  for (let i = 0; i < raw.length; i += 1) seed += raw.charCodeAt(i) * (i + 1);
  return seed % 97;
}

function handDrawnRouteLatLngs(latLngs, observationId) {
  if (!Array.isArray(latLngs) || latLngs.length < 3) return latLngs;
  const seed = routeSeedFromId(observationId);
  const styled = [latLngs[0]];
  for (let i = 1; i < latLngs.length - 1; i += 1) {
    const prev = latLngs[i - 1];
    const curr = latLngs[i];
    const next = latLngs[i + 1];
    const dx = next[1] - prev[1];
    const dy = next[0] - prev[0];
    const mag = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / mag;
    const ny = dx / mag;
    const ampMeters = 6 + 3 * Math.sin(i * 0.42 + seed);
    const latScale = ampMeters / 111111;
    const lonScale = ampMeters / (111111 * Math.cos((curr[0] * Math.PI) / 180));
    const wobble = Math.sin(i * 0.77 + seed * 0.2);
    styled.push([curr[0] + ny * latScale * wobble, curr[1] + nx * lonScale * wobble]);
  }
  styled.push(latLngs[latLngs.length - 1]);
  return styled;
}

function chooseWalkableRoute(routes) {
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const minDuration = Math.min(...routes.map((r) => r.duration || Infinity));
  const candidates = routes.filter((r) => Number.isFinite(r.duration) && r.duration <= minDuration * 1.35);
  const pool = candidates.length > 0 ? candidates : routes;
  return pool.reduce((best, route) => (route.duration > (best?.duration || 0) ? route : best), null);
}

async function drawRouteToObservation(observation) {
  if (!state.userLocation) return;
  if (state.routeLayer) state.routeLayer.clearLayers();
  updateDiagnostics({ routeLoaded: false });

  if (state.useGoogleOverlay && state.googleDirectionsService && state.googleDirectionsRenderer) {
    try {
      const result = await state.googleDirectionsService.route({
        origin: { lat: state.userLocation.lat, lng: state.userLocation.lon },
        destination: { lat: observation.lat, lng: observation.lon },
        travelMode: window.google.maps.TravelMode.WALKING,
        provideRouteAlternatives: true,
      });
      const best = result.routes?.[0];
      if (best) {
        state.googleDirectionsRenderer.setDirections({ ...result, routes: [best] });
        const leg = best.legs?.[0];
        birdRouteEl.innerHTML = `
          <li>Walking route distance: ${leg?.distance?.text || "n/a"}</li>
          <li>Estimated time: ${leg?.duration?.text || "n/a"}</li>
          <li>Trail mode: walkable (Google Directions WALKING)</li>
          <li>Observation age: ${formatHours(observation.hoursAgo)} ago</li>
          <li>Observed near: ${escapeHtml(observation.placeGuess)}</li>
        `;
        updateDiagnostics({ routeLoaded: true });
        return;
      }
    } catch (_error) {
      // Continue to OSRM fallback.
    }
  }

  const start = [state.userLocation.lon, state.userLocation.lat];
  const end = [observation.lon, observation.lat];
  try {
    const url =
      `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}` +
      `?overview=full&geometries=geojson&steps=true&alternatives=true&continue_straight=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("route provider unavailable");
    const data = await response.json();
    const route = chooseWalkableRoute(data.routes);
    if (!route?.geometry?.coordinates?.length) throw new Error("route not found");
    const latLngs = route.geometry.coordinates.map((c) => [c[1], c[0]]);
    const sketchLatLngs = handDrawnRouteLatLngs(latLngs, observation.id);
    L.polyline(latLngs, { color: "#f7e2a7", weight: 8, opacity: 0.55 }).addTo(state.routeLayer);
    L.polyline(sketchLatLngs, {
      color: "#c6a03b",
      weight: 4,
      opacity: 0.95,
      dashArray: "9 8",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(state.routeLayer);

    birdRouteEl.innerHTML = `
      <li>Walking route distance: ${formatDistanceFromMeters(route.distance)}</li>
      <li>Estimated time: ${estimateWalkMinutes(route.distance, route.duration)} min</li>
      <li>Trail mode: walkable (OSRM foot profile)</li>
      <li>Observation age: ${formatHours(observation.hoursAgo)} ago</li>
      <li>Observed near: ${escapeHtml(observation.placeGuess)}</li>
    `;
    updateDiagnostics({ routeLoaded: true });
  } catch (_error) {
    const direct = distanceMeters(state.userLocation.lat, state.userLocation.lon, observation.lat, observation.lon);
    L.polyline(
      [
        [state.userLocation.lat, state.userLocation.lon],
        [observation.lat, observation.lon],
      ],
      { color: "#c6a03b", weight: 3, opacity: 0.7, dashArray: "7 8" },
    ).addTo(state.routeLayer);
    birdRouteEl.innerHTML = `
      <li>Direct distance: ${formatDistanceFromMeters(direct)} (routing unavailable)</li>
      <li>Observation age: ${formatHours(observation.hoursAgo)} ago</li>
      <li>Observed near: ${escapeHtml(observation.placeGuess)}</li>
    `;
    updateDiagnostics({ routeLoaded: true });
  }
}

function renderPhotoStrip(observation) {
  photoStripEl.innerHTML = "";
  if (!observation.photos || observation.photos.length === 0) {
    photoStripEl.classList.add("empty");
    return;
  }
  photoStripEl.classList.remove("empty");
  observation.photos.slice(0, 4).forEach((photo, idx) => {
    const img = document.createElement("img");
    img.src = photo.medium || photo.thumb || photo.large;
    img.alt = `${observation.species} photo ${idx + 1}`;
    img.loading = "lazy";
    img.dataset.candidates = [photo.large, photo.medium, photo.thumb].filter(Boolean).join("|");
    img.dataset.observationUrl = photo.pageUrl || observation.inatUrl;
    img.addEventListener("click", () =>
      openPhotoModal(
        img.dataset.candidates ? img.dataset.candidates.split("|") : [],
        img.alt,
        img.dataset.observationUrl,
      ),
    );
    img.addEventListener("error", () => {
      if (img.src !== photo.thumb && photo.thumb) {
        img.src = photo.thumb;
      }
    });
    photoStripEl.appendChild(img);
  });
}

function renderAudioStrip(observation) {
  audioStripEl.innerHTML = "";
  if (!observation.sounds || observation.sounds.length === 0) {
    audioStripEl.classList.add("empty");
    return;
  }
  audioStripEl.classList.remove("empty");
  observation.sounds.slice(0, 3).forEach((sound, idx) => {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = sound.url;
    audio.setAttribute("aria-label", `${observation.species} recording ${idx + 1}`);
    audioStripEl.appendChild(audio);
  });
}

function renderUserPhotoStrip(observationId) {
  const photos = getUserPhotos(observationId);
  userPhotoStripEl.innerHTML = "";
  if (photos.length === 0) {
    userPhotoStripEl.classList.add("empty");
    return;
  }
  userPhotoStripEl.classList.remove("empty");
  photos.slice(0, 6).forEach((photo, index) => {
    const img = document.createElement("img");
    img.src = photo.dataUrl;
    img.alt = `Your photo ${index + 1}`;
    img.loading = "lazy";
    userPhotoStripEl.appendChild(img);
  });
}

function updatePublishButtonState(observation) {
  const hasToken = Boolean(state.inatApiToken);
  const hasFound = Boolean(observation && state.foundIds.has(observation.id));
  const hasPhoto = Boolean(observation && getUserPhotos(observation.id).length > 0);
  publishInatBtnEl.disabled = !(hasToken && hasFound && hasPhoto);
}

async function inatAuthedFetch(url, init = {}) {
  const token = state.inatApiToken.trim();
  if (!token) throw new Error("Missing iNaturalist API token");
  let response = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (response.ok || response.status !== 401) return response;
  response = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: token },
  });
  return response;
}

async function publishSelectedToInat() {
  const observation = state.observations.find((o) => o.id === state.selectedObservationId);
  if (!observation) return setStatus("Select a sighting first.");
  if (!state.foundIds.has(observation.id)) return setStatus("Mark this sighting as found before publishing.");
  const localPhotos = getUserPhotos(observation.id);
  if (localPhotos.length === 0) return setStatus("Upload your own photo first.");
  if (!state.inatApiToken) return setStatus("Save your iNaturalist API token first.");

  publishInatBtnEl.disabled = true;
  publishInatBtnEl.textContent = "Publishing...";
  try {
    const createBody = {
      observation: {
        species_guess: observation.species,
        taxon_id: observation.taxonId || undefined,
        description: `Published from ParaGo. Reference: ${observation.inatUrl}`,
        latitude: observation.lat,
        longitude: observation.lon,
        observed_on_string: new Date().toISOString(),
      },
    };
    const createResp = await inatAuthedFetch("https://api.inaturalist.org/v1/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    if (!createResp.ok) throw new Error(`Create observation failed (${createResp.status})`);
    const created = await createResp.json();
    const createdObservationId = created?.results?.[0]?.id || created?.id;
    if (!createdObservationId) throw new Error("Created observation id missing");

    const latestPhoto = localPhotos[localPhotos.length - 1];
    const fd = new FormData();
    fd.append("observation_photo[observation_id]", String(createdObservationId));
    fd.append("file", dataUrlToBlob(latestPhoto.dataUrl), `birdgo-${createdObservationId}.jpg`);
    const uploadResp = await inatAuthedFetch("https://api.inaturalist.org/v1/observation_photos", {
      method: "POST",
      body: fd,
    });
    if (!uploadResp.ok) throw new Error(`Photo upload failed (${uploadResp.status})`);

    setStatus(`Published to iNaturalist: observation #${createdObservationId}`);
    window.open(`https://www.inaturalist.org/observations/${createdObservationId}`, "_blank", "noopener,noreferrer");
  } catch (error) {
    setStatus(`Publish failed: ${error.message}`);
  } finally {
    publishInatBtnEl.textContent = "Publish Your Photo to iNaturalist";
    updatePublishButtonState(observation);
  }
}

function tryLoadModalImage(urls, index = 0) {
  if (!Array.isArray(urls) || index >= urls.length) {
    photoModalImageEl.classList.add("hidden");
    photoModalMessageEl.classList.remove("hidden");
    photoModalFallbackLinkEl.classList.remove("hidden");
    return;
  }
  const url = normalizeMediaUrl(urls[index]);
  if (!url) return void tryLoadModalImage(urls, index + 1);
  photoModalImageEl.onerror = () => tryLoadModalImage(urls, index + 1);
  photoModalImageEl.onload = () => {
    photoModalImageEl.classList.remove("hidden");
    photoModalMessageEl.classList.add("hidden");
    photoModalFallbackLinkEl.classList.add("hidden");
  };
  photoModalImageEl.src = url;
}

function openPhotoModal(imageUrls, altText, fallbackObservationUrl) {
  photoModalImageEl.alt = altText || "Bird observation photo";
  photoModalMessageEl.classList.add("hidden");
  photoModalFallbackLinkEl.classList.add("hidden");
  photoModalFallbackLinkEl.textContent = "Open source photo on iNaturalist";
  photoModalFallbackLinkEl.href = fallbackObservationUrl || inatObservationLinkEl.href || "#";
  photoModalEl.classList.remove("hidden");
  tryLoadModalImage(imageUrls, 0);
}

function closePhotoModal() {
  photoModalEl.classList.add("hidden");
  photoModalImageEl.src = "";
  photoModalImageEl.onerror = null;
  photoModalImageEl.onload = null;
  photoModalImageEl.classList.remove("hidden");
  photoModalMessageEl.classList.add("hidden");
  photoModalFallbackLinkEl.classList.add("hidden");
}

function destroyObservationMiniMap() {
  if (state.observationMiniMap) {
    state.observationMiniMap.remove();
    state.observationMiniMap = null;
  }
}

function setObservationPrimaryPhoto(observation, photo) {
  const preferred = photo?.large || photo?.medium || photo?.thumb || "";
  observationPrimaryImageEl.src = preferred;
  observationPrimaryImageEl.alt = `${observation.species} observation photo`;
  observationPrimaryImageEl.onclick = () =>
    openPhotoModal(
      [photo?.large, photo?.medium, photo?.thumb].filter(Boolean),
      observationPrimaryImageEl.alt,
      photo?.pageUrl || observation.inatUrl,
    );
  observationPrimaryImageEl.onerror = () => {
    if (observationPrimaryImageEl.src !== photo?.thumb && photo?.thumb) {
      observationPrimaryImageEl.src = photo.thumb;
      return;
    }
    observationPrimaryImageEl.src = "";
  };
}

function openObservationCard(observation) {
  observationCardModalEl.classList.remove("hidden");
  observationSpeciesTitleEl.textContent = `${observation.species} (${observation.scientificName})`;
  observationMetaTextEl.textContent =
    `Observed ${formatHours(observation.hoursAgo)} ago near ${observation.placeGuess}. ` +
    `Coordinates: ${observation.lat.toFixed(5)}, ${observation.lon.toFixed(5)}.`;
  if (observation.inatUrl) {
    observationOpenInatEl.href = observation.inatUrl;
    observationOpenInatEl.classList.remove("hidden");
  } else {
    observationOpenInatEl.removeAttribute("href");
    observationOpenInatEl.classList.add("hidden");
  }

  setObservationPrimaryPhoto(observation, observation.photos?.[0]);
  observationThumbsEl.innerHTML = "";
  observation.photos.slice(0, 8).forEach((photo, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `Photo ${idx + 1}`;
    const img = document.createElement("img");
    img.src = photo.thumb || photo.medium || photo.large;
    img.alt = `${observation.species} thumbnail ${idx + 1}`;
    btn.appendChild(img);
    btn.addEventListener("click", () => setObservationPrimaryPhoto(observation, photo));
    observationThumbsEl.appendChild(btn);
  });

  destroyObservationMiniMap();
  state.observationMiniMap = L.map(observationMiniMapEl, {
    zoomControl: false,
    attributionControl: false,
  }).setView([observation.lat, observation.lon], 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    subdomains: "abcd",
  }).addTo(state.observationMiniMap);
  L.marker([observation.lat, observation.lon]).addTo(state.observationMiniMap);
  if (state.userLocation) {
    L.circleMarker([state.userLocation.lat, state.userLocation.lon], {
      radius: 5,
      color: "#fff7e8",
      weight: 2,
      fillColor: "#2f915f",
      fillOpacity: 1,
    }).addTo(state.observationMiniMap);
    state.observationMiniMap.fitBounds(
      [
        [state.userLocation.lat, state.userLocation.lon],
        [observation.lat, observation.lon],
      ],
      { padding: [22, 22], maxZoom: 15 },
    );
  }
}

function closeObservationCard() {
  observationCardModalEl.classList.add("hidden");
  destroyObservationMiniMap();
}

async function selectObservation(observationId) {
  const observation = state.observations.find((o) => o.id === Number(observationId) || o.id === observationId);
  if (!observation) return;
  state.selectedObservationId = observation.id;

  detailsEl.classList.remove("hidden");
  birdNameEl.textContent = observation.species;
  const distM = state.userLocation ? distanceMeters(state.userLocation.lat, state.userLocation.lon, observation.lat, observation.lon) : NaN;
  const distLabel = Number.isFinite(distM) ? formatDistanceFromMeters(distM) : "distance unavailable";
  const sourceLabel =
    observation.source === "user" ? "user reported sighting" : "species-level research grade";
  birdMetaEl.textContent = `${distLabel} away • ${formatHours(observation.hoursAgo)} ago • ${sourceLabel}`;

  if (observation.inatUrl) {
    inatObservationLinkEl.href = observation.inatUrl;
    inatObservationLinkEl.classList.remove("hidden");
  } else {
    inatObservationLinkEl.removeAttribute("href");
    inatObservationLinkEl.classList.add("hidden");
  }
  renderPhotoStrip(observation);
  renderAudioStrip(observation);
  renderUserPhotoStrip(observation.id);
  updatePublishButtonState(observation);
  openObservationCard(observation);
  await drawRouteToObservation(observation);

  const found = state.foundIds.has(observation.id);
  markFoundBtn.disabled = found || !canMarkFound(observation);
  markFoundBtn.textContent = found ? "Marked Found ✔" : "Mark Found";
  uploadPhotoInputEl.disabled = !found;
  uploadPhotoInputEl.value = "";

  if (state.useGoogleOverlay && state.googleMap && window.google?.maps) {
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: state.userLocation.lat, lng: state.userLocation.lon });
    bounds.extend({ lat: observation.lat, lng: observation.lon });
    state.googleMap.fitBounds(bounds);
  } else if (state.map) {
    state.map.fitBounds(
      [
        [state.userLocation.lat, state.userLocation.lon],
        [observation.lat, observation.lon],
      ],
      { padding: [40, 40], maxZoom: 16 },
    );
  }
}

async function refreshSightings() {
  if (!state.userLocation) {
    state.inatObservations = [];
    rebuildObservationList();
    renderObservations();
    setStatus("Waiting for location fix.");
    return;
  }
  setStatus("Loading iNaturalist sightings...");
  try {
    const observations = await fetchInatObservations();
    state.inatObservations = observations;
    rebuildObservationList();
    renderObservations();
    updateDiagnostics({
      dataLoaded: true,
      liveBirdCount: observations.length,
      provider: "iNaturalist",
      routeLoaded: false,
    });
    setStatus(observations.length > 0 ? `Tracking ${observations.length} iNaturalist sightings + your uploads.` : "No iNaturalist sightings found nearby. Add your own bird sighting.");
    setSourceMeta("Source: iNaturalist observations + your local sightings");
    detailsEl.classList.add("hidden");
    if (state.routeLayer) state.routeLayer.clearLayers();
    if (state.useGoogleOverlay && state.googleDirectionsRenderer) {
      state.googleDirectionsRenderer.set("directions", null);
    }
  } catch (error) {
    state.inatObservations = [];
    rebuildObservationList();
    renderObservations();
    updateDiagnostics({
      dataLoaded: false,
      liveBirdCount: 0,
      provider: `iNaturalist error: ${error.message}`,
    });
    setStatus(`Could not fetch iNaturalist data: ${error.message}. Your local sightings are still shown.`);
  }
}

async function createUserReportedSighting() {
  const speciesRaw = reportSpeciesInputEl.value.trim();
  if (!speciesRaw) {
    setStatus("Enter a bird name before adding your sighting.");
    return;
  }
  if (!state.userLocation) {
    setStatus("Location is required. Press Locate Me first, then add your sighting.");
    return;
  }
  const pickedFile = reportPhotoInputEl.files?.[0] || null;
  submitBirdReportBtnEl.disabled = true;
  submitBirdReportBtnEl.textContent = "Adding...";
  try {
    let photoDataUrl = "";
    if (pickedFile) photoDataUrl = await compressImageFile(pickedFile);
    const now = new Date().toISOString();
    const id = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const reported = {
      id,
      source: "user",
      species: speciesRaw,
      scientificName: "User reported",
      taxonId: null,
      lat: state.userLocation.lat,
      lon: state.userLocation.lon,
      observedAt: now,
      hoursAgo: 0,
      placeGuess: "your current location",
      photos: photoDataUrl
        ? [
            {
              id: `${id}-photo-1`,
              thumb: photoDataUrl,
              medium: photoDataUrl,
              large: photoDataUrl,
              pageUrl: "",
            },
          ]
        : [],
      sounds: [],
      inatUrl: "",
      createdAt: now,
    };
    state.userReportedObservations = normalizeUserReportedObservations([reported, ...state.userReportedObservations]).slice(0, 200);
    saveUserReportedObservations();
    rebuildObservationList();
    renderObservations();
    reportSpeciesInputEl.value = "";
    reportPhotoInputEl.value = "";
    setStatus(`Added your sighting for "${speciesRaw}".`);
    selectObservation(id);
  } catch (error) {
    setStatus(`Could not add sighting: ${error.message}`);
  } finally {
    submitBirdReportBtnEl.disabled = false;
    submitBirdReportBtnEl.textContent = "Add My Sighting";
  }
}

function setupInteractions() {
  birdListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-observation-id]");
    if (!btn) return;
    selectObservation(btn.dataset.observationId);
  });

  locateBtn.addEventListener("click", () => requestLocation({ forceFresh: true }));
  rescanBtn.addEventListener("click", () => refreshSightings());
  submitBirdReportBtnEl.addEventListener("click", async () => {
    await createUserReportedSighting();
  });

  takeMeThereBtnEl.addEventListener("click", () => {
    const observation = state.observations.find((o) => o.id === state.selectedObservationId);
    if (observation) promptTakeMeThere(observation);
  });
  takeMeThereCardBtnEl.addEventListener("click", () => {
    const observation = state.observations.find((o) => o.id === state.selectedObservationId);
    if (observation) promptTakeMeThere(observation);
  });

  saveGoogleKeyBtnEl.addEventListener("click", () => {
    state.googleMapsApiKey = googleMapsApiKeyInputEl.value.trim();
    localStorage.setItem("GOOGLE_MAPS_API_KEY", state.googleMapsApiKey);
    setStatus(state.googleMapsApiKey ? "Google Maps key saved." : "Google Maps key cleared.");
  });

  saveInatTokenBtnEl.addEventListener("click", () => {
    state.inatApiToken = inatApiTokenInputEl.value.trim();
    localStorage.setItem("INAT_API_TOKEN", state.inatApiToken);
    const selected = state.observations.find((o) => o.id === state.selectedObservationId);
    updatePublishButtonState(selected);
    setStatus(state.inatApiToken ? "iNaturalist token saved." : "iNaturalist token cleared.");
  });

  googleOverlayBtnEl.addEventListener("click", async () => {
    if (state.useGoogleOverlay) {
      enableLeafletOverlay();
      return;
    }
    await enableGoogleOverlay();
  });

  markFoundBtn.addEventListener("click", () => {
    const observation = state.observations.find((o) => o.id === state.selectedObservationId);
    if (!observation) return;
    if (state.foundIds.has(observation.id)) return;
    if (!canMarkFound(observation)) {
      setStatus("You need to be at the spot (within ~120m) to mark this species as found.");
      markFoundBtn.disabled = true;
      return;
    }
    state.foundIds.add(observation.id);
    saveFoundSet();
    state.foundSpecies.add(normalizeSpeciesKey(observation.species));
    saveFoundSpecies();
    renderWishlist();
    markFoundBtn.textContent = "Marked Found ✔";
    uploadPhotoInputEl.disabled = false;
    updatePublishButtonState(observation);
    renderObservations();
    renderUserPhotoStrip(observation.id);
    setStatus(`Marked "${observation.species}" as found at this location.`);
  });

  addWishlistBirdBtnEl.addEventListener("click", () => {
    addWishlistSpecies(wishlistSpeciesInputEl.value);
    wishlistSpeciesInputEl.value = "";
  });

  wishlistSpeciesInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addWishlistSpecies(wishlistSpeciesInputEl.value);
      wishlistSpeciesInputEl.value = "";
    }
  });

  wishlistListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-wishlist-id]");
    if (!btn) return;
    const id = btn.dataset.wishlistId;
    state.wishlist = state.wishlist.filter((item) => item.id !== id);
    saveWishlist();
    renderWishlist();
  });

  uploadPhotoInputEl.addEventListener("change", () => {
    const observation = state.observations.find((o) => o.id === state.selectedObservationId);
    const file = uploadPhotoInputEl.files?.[0];
    if (!observation || !file) return;
    if (!state.foundIds.has(observation.id)) {
      setStatus("You can only upload after marking this sighting as found.");
      uploadPhotoInputEl.value = "";
      return;
    }

    compressImageFile(file)
      .then((compressedDataUrl) => {
        const key = String(observation.id);
        const existing = state.userPhotosByObservation[key] || [];
        state.userPhotosByObservation[key] = [...existing, { dataUrl: compressedDataUrl, ts: new Date().toISOString() }].slice(-4);
        saveUserPhotos();
        renderUserPhotoStrip(observation.id);
        renderObservations();
        updatePublishButtonState(observation);
        setStatus(`Uploaded your photo for "${observation.species}".`);
        uploadPhotoInputEl.value = "";
      })
      .catch((error) => {
        setStatus(`Could not process photo: ${error.message}`);
        uploadPhotoInputEl.value = "";
      });
  });

  publishInatBtnEl.addEventListener("click", async () => {
    await publishSelectedToInat();
  });

  photoModalCloseEl.addEventListener("click", () => closePhotoModal());
  photoModalEl.addEventListener("click", (event) => {
    if (event.target === photoModalEl) closePhotoModal();
  });
  observationCardCloseEl.addEventListener("click", () => closeObservationCard());
  observationCardModalEl.addEventListener("click", (event) => {
    if (event.target === observationCardModalEl) closeObservationCard();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !photoModalEl.classList.contains("hidden")) closePhotoModal();
    if (event.key === "Escape" && !observationCardModalEl.classList.contains("hidden")) closeObservationCard();
  });
}

async function boot() {
  renderDiagnostics();
  setDistanceUnit(null);
  state.wishlist = normalizeWishlistItems(state.wishlist);
  saveWishlist();
  state.userReportedObservations = normalizeUserReportedObservations(state.userReportedObservations);
  rebuildObservationList();
  googleMapsApiKeyInputEl.value = state.googleMapsApiKey;
  inatApiTokenInputEl.value = state.inatApiToken;
  initMap();
  const lastKnown = getLastKnownLocation();
  if (lastKnown) {
    applyResolvedLocation(lastKnown.lat, lastKnown.lon, lastKnown.accuracy, "last known browser");
  }
  setupInteractions();
  renderWishlist();
  renderObservations();
  publishInatBtnEl.disabled = true;
  await installPermissionWatcher();
  requestLocation();
}

boot();
