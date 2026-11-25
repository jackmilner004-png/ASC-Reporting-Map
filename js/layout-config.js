/* =========================================================================
   ASC warehouse layout: the numbers to change.
   Every count here drives the 3D model. Zone sizes and the building outline
   are worked out from these, so changing a count re-flows the floor.
   Units: metres unless a name says otherwise.
   `guess: true` marks placements nobody has confirmed yet (shown in the UI).
   Arrangement follows Jack's layout video (Media1.mp4): doors on one long
   wall, bulk pallets in front of them, the loop sorter along the back wall,
   racking along the far end wall.
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
    bulkRows: 7, bulkCols: 16, fill: 0.85,   // floor-stacked pallets in the yellow-marked bulk area
    cages: 12                                // roll cages just off the trailers
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
    combSpurs: 4            // roller spurs where packed totes are palletised
  },

  manual: {
    guess: true,            // GUESS: not in the video
    rows: 4, benchesPerRow: 6
  },

  hanging: {
    guess: true,            // GUESS: not in the video
    rails: 6, railLength: 27, fill: 0.7,
    benches: 4
  },

  storage: {
    guess: false,           // racking along the far end wall, per the video. Sizes are estimates.
    rackRows: 4, baysPerRow: 15, beamLevels: [1.8, 3.6, 5.4], fill: 0.75
  },

  despatch: {
    guess: false,
    lines: 18,
    cagesPerLine: 7,        // capacity of each lane
    fill: 0.65              // share of lane slots shown occupied
  }
};
