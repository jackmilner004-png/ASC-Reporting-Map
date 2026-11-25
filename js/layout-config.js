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
  site: { name: "ASC returns centre", wallHeight: 8 },

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
    storageRails: 10, storageRailLength: 18, storageFill: 0.85
  },

  storage: {
    guess: false,           // racking along the south wall. Bays fill the section width.
    rackRows: 2, beamLevels: [1.8, 3.6, 5.4], fill: 0.75
  },

  despatch: {
    guess: false,
    lines: 18,
    palletsPerLine: 7,      // capacity of each lane
    totesPerPallet: 24      // pallets come from js/sample-data.js
  }
};
