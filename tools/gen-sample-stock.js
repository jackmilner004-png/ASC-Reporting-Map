// Generates js/sample-stock.js: made-up stock for the two storage sections. Run: node tools/gen-sample-stock.js js/sample-stock.js
let s = 31337; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(R() * a.length)];
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pad = (n, w) => String(n).padStart(w, "0");
const AS_OF = new Date("2026-11-25T13:30:00");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}T${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:00`;
const daysAgo = (d0, d1) => { const d = new Date(AS_OF); d.setDate(d.getDate() - ri(d0, d1)); d.setHours(ri(5, 21), ri(0, 59)); return d; };
const later = (d, h0, h1) => { const x = new Date(d); x.setMinutes(x.getMinutes() + ri(h0 * 60, h1 * 60)); if (x > AS_OF) x.setTime(AS_OF.getTime() - 3600e3); return x; };
const items = ["Knit jumper", "Slim jeans", "Cotton T-shirt", "Wool coat", "Midi dress", "Chinos", "Hoodie", "Pyjama set", "Trainers", "Ankle boots", "Bra", "Socks 5-pack", "Shirt", "Blazer", "Leggings", "Puffer jacket", "Skirt", "Cardigan", "Polo shirt", "Swimsuit", "Cushion cover", "Throw", "Bath towel", "Lamp shade"];
const hangItems = ["Wool coat", "Midi dress", "Blazer", "Shirt", "Trench coat", "Suit jacket", "Maxi dress", "Blouse", "Puffer jacket", "Trousers", "Jumpsuit", "Parka"];
const sizes = ["XS", "S", "M", "L", "XL", "8", "10", "12", "14", "16"];
const cats = ["Womenswear", "Menswear", "Kids", "Footwear", "Accessories", "Home"];
const catOf = d => /Trainers|boots/.test(d) ? "Footwear" : /Cushion|Throw|towel|Lamp/.test(d) ? "Home" : /Socks|Bra/.test(d) ? "Accessories" : R() < 0.15 ? "Kids" : /Shirt|Chinos|Polo|Blazer|Hoodie/.test(d) ? "Menswear" : "Womenswear";
const A = ["Northline", "Harbour", "Kestrel", "Meadow", "Ironbridge", "Larkfield", "Ashford", "Cobalt", "Juniper", "Wren", "Halden", "Marlow", "Saltash", "Thistle", "Brookes", "Fenwick", "Oakridge", "Peregrine", "Quill", "Rowan", "Sable", "Tamar", "Umber", "Vale", "Willow", "Yarrow", "Alder", "Bramble", "Calder", "Dunmore", "Elmstead", "Foxley", "Glenrose", "Hawthorn", "Linden"];
const B = ["Apparel", "Home", "Footwear", "Living", "Kids", "Outdoor", "Clothing", "Studio"];
const VENDORS = A.map((a, i) => `${a} ${B[i % B.length]}`);
const vw = VENDORS.map(() => 0.2 + R() ** 2 * 3);                    // a few big vendors, a long tail
const vpick = () => { let t = R() * vw.reduce((a, b) => a + b, 0); for (let i = 0; i < VENDORS.length; i++) { t -= vw[i]; if (t <= 0) return VENDORS[i]; } return VENDORS[0]; };
const sku = () => String(10000000 + Math.floor(R() * 89999999));
const CONS = [["Tote liner bags", "case of 500"], ["Polybags 300x400", "case of 1,000"], ["Polybags 450x600", "case of 500"], ["Parcel tape 48 mm", "box of 36"], ["Thermal labels 100x150", "box of 12 rolls"], ["Cardboard box, small", "bale of 25"], ["Cardboard box, medium", "bale of 20"], ["Cardboard box, large", "bale of 15"], ["Hangers, plastic", "box of 250"], ["Garment covers", "roll of 200"], ["Security tags", "box of 1,000"], ["Pallet wrap", "box of 6 rolls"]];
const CONS_SKU = Object.fromEntries(CONS.map(([n]) => [n, "C" + pad(ri(10000, 99999), 5)]));

/* Racking: 4 rows x 25 bays x 5 levels (L0 floor .. L4) x 2 positions (A, B) = 1,000 spaces */
const RACK = { rows: 4, bays: 25, levels: 5, positions: ["A", "B"] };
const free = { };
const slots = row => { const out = []; for (let b = 1; b <= RACK.bays; b++) for (let l = 0; l < RACK.levels; l++) for (const p of RACK.positions) out.push(`R${pad(row, 2)}-B${pad(b, 2)}-L${l}-${p}`); return out; };
const taken = new Set();
function place(rows, lowFirst) {
  for (let tries = 0; tries < 5000; tries++) {
    const row = pick(rows), b = ri(1, RACK.bays), l = lowFirst && R() < 0.7 ? ri(0, 1) : ri(0, RACK.levels - 1), p = pick(RACK.positions);
    const id = `R${pad(row, 2)}-B${pad(b, 2)}-L${l}-${p}`;
    if (!taken.has(id)) { taken.add(id); return id; }
  }
  throw new Error("racking full");
}
const pallets = []; let palletNo = 300100, toteNo = 5401200;
let dsCount = 0;
function totePallet(type) {
  const delivered = daysAgo(type === "jobber" ? 2 : 3, type === "jobber" ? 45 : 120), scanned = later(delivered, 6, 96);
  const vendor = type === "dropship" ? (dsCount < VENDORS.length ? VENDORS[dsCount++] : vpick()) : null;   // every vendor holds at least one pallet
  const n = ri(10, 16), totes = [];
  for (let t = 0; t < n; t++) {
    const lines = Array.from({ length: R() < 0.6 ? 1 : 2 }, () => { const d = pick(items) + ", " + pick(sizes); return { sku: sku(), description: d, qty: ri(2, 14), category: catOf(d) }; });
    totes.push({ id: "T" + toteNo++, lines });
  }
  return { id: "SP-" + palletNo++, type, vendor, toteColour: type === "jobber" ? "red" : "pink", location: place(type === "jobber" ? [2, 3] : [3, 4]), deliveredAt: iso(delivered), scannedAt: iso(scanned), totes };
}
for (let i = 0; i < 50; i++) {
  const [name, pack] = pick(CONS), delivered = daysAgo(1, 60), scanned = later(delivered, 1, 30);
  pallets.push({ id: "SP-" + palletNo++, type: "consumables", location: place([1], true), deliveredAt: iso(delivered), scannedAt: iso(scanned),
    lines: [{ sku: CONS_SKU[name], description: `${name} (${pack})`, qty: ri(8, 40), category: name }] });
}
for (let i = 0; i < 38; i++) pallets.push(totePallet("jobber"));
for (let i = 0; i < 57; i++) pallets.push(totePallet("dropship"));
pallets.sort((a, b) => a.location < b.location ? -1 : 1);

/* Hanging storage: 10 rails x 136 slots */
const HANG = { rails: 10, slotsPerRail: 136 };
const garments = []; let gNo = 880100;
for (let r = 1; r <= HANG.rails; r++) {
  const fill = 0.55 + R() * 0.4, jobberRail = r <= 3;
  for (let sl = 1; sl <= HANG.slotsPerRail; sl++) {
    if (R() > fill) continue;
    const delivered = daysAgo(1, 90), scanned = later(delivered, 2, 72), d = pick(hangItems) + ", " + pick(sizes);
    const jobber = jobberRail ? R() < 0.85 : R() < 0.1;
    garments.push({ id: "HG-" + gNo++, sku: sku(), description: d, type: jobber ? "jobber" : "dropship", vendor: jobber ? null : vpick(), category: catOf(d),
      location: `HS-R${pad(r, 2)}-S${pad(sl, 3)}`, deliveredAt: iso(delivered), scannedAt: iso(scanned) });
  }
}

const out = `/* =========================================================================
   SAMPLE STOCK for the two storage sections. Every record here is made up.
   Swap this file for a real feed with the same shape and the map follows.

   racking: pallet racking along the south wall.
     Location IDs: R<row>-B<bay>-L<level>-<position>, e.g. R03-B12-L2-A.
     L0 is the floor position. Each pallet sits in the space its location names.
     type: "consumables" (boxes), "jobber" (red totes, grade C) or
           "dropship" (pink totes, one vendor per pallet).
     Tote pallets list their totes, each with a unique tote ID and its SKU lines.
   hanging: hanging storage rails. Location IDs: HS-R<rail>-S<slot>.
   deliveredAt = arrived in the warehouse; scannedAt = scanned into the location.
   ========================================================================= */
window.ASC_DATA = window.ASC_DATA || {};
window.ASC_DATA.stock = ${JSON.stringify({ asOf: iso(AS_OF), vendors: VENDORS, racking: { ...RACK, pallets }, hanging: { ...HANG, garments } })};
`;
require("fs").writeFileSync(process.argv[2], out);
const units = p => p.totes ? p.totes.reduce((a, t) => a + t.lines.reduce((b, l) => b + l.qty, 0), 0) : p.lines[0].qty;
console.log("pallets", pallets.length, "garments", garments.length, "bytes", out.length, "vendors used", new Set(pallets.filter(p => p.vendor).map(p => p.vendor)).size);
