# ParaGO project

## Business Requirements

- An MVP of a 2D Pokemon - Go style app to locate nearby birds and route to them/mark them as found
- The web app should be a stylized 2D map based on GPS location
- There should be a side panel that reads "life list", and has the birds in the nearby area based on iNaturalist sightings
- On the side panel - each bird should be listed by name and icon
- Option to check off birds that have been found
- On map, there should be a marker for your location, and the markers for birds should be the same icons used in the life list
- When hovering over marker on map, a popup of the bird's name and inaturalist photo should pop up, and when clicked, full inaturalist sighting should be displayed
- There should be a "take me there" button on the popup that when clicked, draws a stylized line that maps walkable route to the location
- No more functionality: no archive, no search/filter. Keep it simple.
- The priority is a slick, professional, gorgeous UI/UX with very simple features and easy to use interface
- The app should use data from the past 24 hrs of inaturalist sightings in the city

## Strategy

1. Follow mapping requirements guide
2. Implement clean UI features for pop up, life list, take me there, and route drawing/mapping features
3. Execute the plan ensuring all criteria are met
4. Carry out extensive integration testing with Playwright or similar, fixing defects
5. Only complete when the MVP is finished and tested, with the server running and ready for the user

## Mapping Requirements

- Use Leaflet API for open source mapping with interactive visualization
- Mandatory Parameter: Every directions request must include mode=walking to ensure routes prioritize sidewalks and footpaths.

### Core Functional Requirements

Define the specific behaviors you want the agent to implement.

**Route Visualization:**
Display routes as a map of feathers to lead to the bird

For the bird markers on the map - use leaflet api to generate a bird icon proportional to the size of the bird (eg. icon for hawk will be larger than sparrow, crane larger than hawk)

Use the DirectionsRenderer object to bind the route to the map UI.

**Pedestrian Logic:**
Calculate estimates based on an average walking speed of 5 km/h.
Provide turn-by-turn text instructions (e.g., "Turn left onto the footpath") using the DirectionsService.

**Advanced Features:**
Include a "Preview" mode that allows users to see a 3D or Street View perspective of key turns.

**Error Handling:** If a walking route is unavailable between two points, the agent must catch the error and suggest the nearest public transit option rather than defaulting to driving.

**Performance:** Optimize waypoints if the user selects multiple stops on their walk.

### Verification and Testing

Tell the agent how to verify its work.

- Test Command: Run `npm test` (or `pnpm test`) to execute existing navigation unit tests.
- Validation: Every PR must include a screenshot or logs showing the travel_mode is explicitly set to WALK.

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
