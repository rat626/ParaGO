# ParaGo

ParaGo is a web app for live bird spotting with a troll-map inspired UI.
It combines nearby iNaturalist sightings with your own locally reported sightings.

## Features

- Live map with your location and nearby bird sightings
- iNaturalist observation fetch (species + research-grade(verified appearance) + photos)
- Walkable route generation to selected sightings
- "Mark Found" geofence flow[can only mark if within a certain radius of the past sighting location] and personal photo uploads
- Optional publish flow to iNaturalist using your token
- Google Maps overlay toggle when API key is provided
- **Report Bird You Saw** section to add your own local sightings

## Run Locally

From this project folder:

```bash
python3 -m http.server 8080
```

Then open:

- [http://localhost:8080](http://localhost:8080)

## Project Files

- `index.html` - app structure and UI
- `styles.css` - visual styling and marker styles
- `app.js` - map logic, geolocation, sightings, routes, uploads

## GitHub Setup

Initialize repo (if not already initialized):

```bash
git init
git add .
git commit -m "Initial ParaGo"
```

Create a new empty repo on GitHub, then connect and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## Tests

```bash
npm test
```

Validates walking ETA (5 km/h baseline), walking-mode URL shape, and bird size tier helpers (mirrors `app.js` logic).

## Notes

- Static frontend; no build step for the map UI.
- Optional Google overlay uses `DirectionsRenderer` with `TravelMode.WALKING`.
- Default map uses Leaflet plus OSRM `foot` profile; external Google Maps links use `travelmode=walking`.
