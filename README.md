# ASC Reporting Map

A 3D map of the ASC returns warehouse that runs in the browser. It is built with three.js (r147, loaded from jsDelivr), so there is no build step.

## View it

- Open `index.html` through any static web server, for example `python3 -m http.server`, then go to http://localhost:8000.
- Or turn on GitHub Pages for the `main` branch.

Opening the file straight from disk (`file://`) also works in most browsers.

## Using the map

- The view opens as an eagle-eye shot from the door side of the building, angled down.
- The buttons along the top frame one section and grey out the others: View all, Inbound, Conveyor processing, Manual processing, Hanging processing, Storage, Despatch. Keys 0–6 do the same.
- Drag to orbit, scroll or pinch to zoom, right-drag to pan. "Reset view" goes back to the framed shot.
- A link can open a section directly, e.g. `index.html#conveyor`.

## Changing the layout

All counts live in `js/layout-config.js`: bay doors, despatch lines, chutes, benches per chute, rack rows, rails and so on. Zone sizes and the building outline are worked out from those counts, so changing a number re-flows the floor.

Zones marked `guess: true` (manual processing and hanging processing) are placed without a floor plan yet, and the UI labels them as guesses.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell |
| `css/style.css` | Styles, light and dark |
| `js/asc-elements.js` | Element library: roll cage, pallet, totes, boxed and bagged returns parcels, conveyor section. Copied from the ASC Element Library. `ASC.setOverride(key, object3d)` swaps any element for a Blender export. |
| `js/layout-config.js` | Counts and options for the layout |
| `js/warehouse.js` | Site elements (benches, chutes, curves, incline, roller conveyor, racking, rails, dock doors), zone layout and the viewer |
