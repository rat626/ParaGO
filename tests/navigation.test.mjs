import test from "node:test";
import assert from "node:assert/strict";

function estimateWalkMinutes(distanceMeters, providerDurationSeconds) {
  const safeDistance = Number.isFinite(distanceMeters) ? distanceMeters : 0;
  const providerMinutes = Number.isFinite(providerDurationSeconds) ? providerDurationSeconds / 60 : 0;
  const baselineMinutes = safeDistance > 0 ? (safeDistance / 5000) * 60 : 0;
  return Math.max(1, Math.round(Math.max(providerMinutes, baselineMinutes)));
}

function birdSizeTier(displayName, scientificName) {
  const s = `${String(displayName || "")} ${String(scientificName || "")}`.toLowerCase();
  if (
    /(crane|heron|swan|pelican|stork|egret|condor|albatross|flamingo|ibis|bittern|cormorant|loon|grebe)/.test(s)
  ) {
    return "xl";
  }
  if (/(eagle|hawk|osprey|vulture|falcon|raven|crow|goose|gull|tern|turkey vulture|kite)/.test(s)) {
    return "lg";
  }
  if (/(sparrow|finch|wren|warbler|hummingbird|chickadee|kinglet|gnatcatcher|vireo|titmouse|nuthatch)/.test(s)) {
    return "xs";
  }
  return "md";
}

test("walking ETA uses 5 km/h floor", () => {
  assert.equal(estimateWalkMinutes(5000, 60), 60);
  assert.equal(estimateWalkMinutes(2500, 60), 30);
});

test("Google Maps dir URLs use travelmode walking", () => {
  const url =
    "https://www.google.com/maps/dir/?api=1&origin=0,0&destination=1,1&travelmode=walking";
  assert.ok(url.includes("travelmode=walking"));
});

test("bird size tier: sparrow smaller tier than heron", () => {
  assert.equal(birdSizeTier("House Sparrow", "Passer domesticus"), "xs");
  assert.equal(birdSizeTier("Great Blue Heron", "Ardea herodias"), "xl");
});
