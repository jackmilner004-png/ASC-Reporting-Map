/* =========================================================================
   ASC warehouse layout: the numbers to change.
   Every count here drives the 3D model. Zone sizes and the building outline
   are worked out from these, so changing a count re-flows the floor.
   Units: metres unless a name says otherwise.
   `guess: true` marks placements nobody has confirmed yet (shown in the UI).

   Arrangement follows Jack's remap (25 Nov):
     west wall: every bay door. Inbound to the north, despatch to the south.
     middle: hanging processing along the back wall, conveyor in the centre,
             racking storage along the south wall.
     east: hanging storage to the north, manual processing below it.
   ========================================================================= */
window.ASC_LAYOUT = {
  site: { name: "ASC returns centre", wallHeight: 8, outdoor: true },   // outdoor: DRAFT yard/trailers/trees (js/outdoor.js)

  bayDoors: {
    count: 6,
    inbound: 2,            // GUESS: doors 1–2 serve inbound, the rest despatch
    width: 3.0, height: 3.6
  },

  inbound: {
    guess: false,
    lanes: 6, cagesPerLane: 10   // all inbound arrives in roll cages; cages come from js/sample-data.js
  },

  conveyor: {
    guess: false,
    chutes: 24,             // split evenly across the two straights of the loop sorter
    benchesPerChute: 2,
    chuteSpacing: 4.0,      // centre to centre along each straight
    sorterHeight: 2.2,      // elevated loop
    inductHeight: 0.9,      // low induction belt fed from roll cages
    inductLength: 10,
    inclineLength: 10,
    beltWidth: 0.6,
    sectionLength: 4,       // length of each straight conveyor module
    combSpurs: 4,           // roller spurs where packed totes are palletised
    animateBelts: false     // true = moving belts, but the page then redraws every frame
  },

  manual: {
    guess: false,
    rows: 4, benchesPerRow: 6
  },

  hanging: {
    guess: false,
    rails: 4, fill: 0.7,            // processing rails run the width of the middle section
    benches: 8,
    storageRails: 10, storageRailLength: 18   // hanging storage (its own section); stock comes from js/sample-stock.js
  },

  storage: {
    guess: false,           // pallet racking along the south wall, in back-to-back pairs of rows
    rackRows: 4, bays: 25,  // 4 rows x 25 bays x 5 levels x 2 positions = 1,000 pallet spaces
    beamLevels: [1.6, 3.2, 4.8, 6.4]   // beam heights; the floor is level L0
  },

  despatch: {
    guess: false,
    lines: 18,
    palletsPerLine: 7,      // capacity of each lane
    totesPerPallet: 24      // pallets come from js/sample-data.js
  }
};
