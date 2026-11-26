# ASC Reporting Map

A 3D map of the ASC returns warehouse that runs in the browser. It is built with three.js (r147, loaded from jsDelivr), so there is no build step.

## View it

- Open `index.html` through any static web server, for example `python3 -m http.server`, then go to http://localhost:8000.
- Or turn on GitHub Pages for the `main` branch.

Opening the file straight from disk (`file://`) also works in most browsers.

## Using the map

- The view opens as an eagle-eye shot from the door side of the building, angled down.
- The buttons along the top frame one section and grey out the others: View all, Inbound, Conveyor processing, Manual processing, Hanging processing, Hanging storage, Storage, Despatch. Keys 0–7 do the same.
- Storage and Hanging storage open a wide detail panel (about 75% of the screen): stockholding cards (Jobber grade C, dropship vendors, consumables, capacity), split charts, and a searchable, sortable table of every SKU line with its tote, pallet or garment ID, location, delivered date and scanned-into-location date. Click a row to pull that pallet out of the rack in the 3D view.
- Stock comes from `js/sample-stock.js` (made up). Racking locations are `R<row>-B<bay>-L<level>-<A|B>` (L0 = floor), 4 rows x 25 bays x 5 levels x 2 = 1,000 spaces. Hanging storage locations are `HS-R<rail>-S<slot>`. Each pallet or garment is drawn in the space its location names.
- The camera stays on the framed view and drifts slightly with the pointer. Hovering an area lights it up in its colour with an outline; clicking it opens that section. "Orbit" unlocks free orbit, zoom and pan. "Reset" goes back to the framed shot.
- Clicking a chart card replays its animation. Clicking one column, route bar or grade picks it out and shows its value.
- A link can open a section directly, e.g. `index.html#conveyor`.
- Hover an inbound roll cage or a despatch pallet: it lifts slightly and a short card shows where it came from or is going. Click it to pop it out and open the full card with every SKU. On a touch screen, tap.
- Click a conveyor pack bench to see its output today, split by grade (A, B, C) and despatch route. The cards along the bottom show the whole day: inbound cages by hour, conveyor output by grade and by despatch route, and despatch pallets by hour. Click a card to jump to its section.
- Layout: the map fills the screen with glass panels over it. Section navigation is on the left, the section detail is on the right, and today's numbers sit along the bottom. Dark mode uses a deep navy palette. On phones the panels stack under the map.

## Hover data

`js/sample-data.js` holds made-up records (`window.ASC_DATA`). Swap it for a real feed with the same shape:

- `inboundCages[]`: `{ id, origin, deliveredAt, trailer, door, skus: [{ sku, description, qty }] }`, filled into the inbound lanes in order.
- `despatchPallets[]`: `{ id, lane, route, builtAt, packedAt, toteColour, totes, skus: [...] }`, placed in their lane (1-based).
- `benchOutput[]`: `{ bench: "7A", chute, operator, status, units, unitsPerHour, lastItemAt, grades: { A, B, C }, routes: { [route]: units } }`. The conveyor day totals are summed from these.
- `routes[]`: the despatch routes, in the order they are listed.

## Performance

The page draws only when the view changes, the shadows are drawn once, and every repeated item is instanced. Moving belts are off by default (`conveyor.animateBelts` in the config), because they make the page redraw every frame.

## Changing the layout

All counts live in `js/layout-config.js`: bay doors, despatch lines, chutes, benches per chute, rack rows, rails and so on. Zone sizes and the building outline are worked out from those counts, so changing a number re-flows the floor.

The zone arrangement follows Jack's remap: all bay doors on the west wall (inbound north, despatch south), hanging processing along the back wall, the conveyor in the middle, racking along the south wall, and hanging storage and manual processing on the east side. Set `guess: true` on a zone to label it as unconfirmed in the UI.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell |
| `css/style.css` | Styles, light and dark |
| `js/asc-elements.js` | Element library: roll cage, pallet, totes, boxed and bagged returns parcels, conveyor section. Copied from the ASC Element Library. `ASC.setOverride(key, object3d)` swaps any element for a Blender export. |
| `js/layout-config.js` | Counts and options for the layout |
| `js/sample-data.js` | Sample records for the hover tooltips |
| `js/sample-stock.js` | Sample stock for Storage and Hanging storage (pallets, totes, garments, locations) |
| `js/warehouse.js` | Site elements (benches, chutes, curves, incline, roller conveyor, racking, rails, dock doors), zone layout and the viewer |
