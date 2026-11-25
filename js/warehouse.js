/* =========================================================================
   ASC warehouse layout and viewer.
   - Site elements (benches, chutes, racking, hanging rails, dock doors) are
     defined here in the same style as the element library.
   - Everything placed is instanced per zone, so thousands of items stay fast
     and each zone can be greyed out or highlighted on its own.
   Axes: +X east, +Z south (the bay-door wall), +Y up. 1 unit = 1 m.
   ========================================================================= */
(() => {
const T = THREE, C = window.ASC_LAYOUT, PI = Math.PI;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const R = seeded(20261125);
const pick = a => a[Math.floor(R() * a.length)];

function std(color, o = {}) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o)); }
function bx(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function cy(r, len, mat, axis, x = 0, y = 0, z = 0, seg = 14) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg), mat);
  if (axis === "x") m.rotation.z = PI / 2;
  if (axis === "z") m.rotation.x = PI / 2;
  m.position.set(x, y, z); return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
}

/* ---------- Zones ---------- */
const ZONES = [
  { id: "inbound",  name: "Inbound",             color: "#3b7fc4", key: "1" },
  { id: "conveyor", name: "Conveyor processing", color: "#e0a800", key: "2" },
  { id: "manual",   name: "Manual processing",   color: "#2f9e6e", key: "3" },
  { id: "hanging",  name: "Hanging processing",  color: "#8a5cc9", key: "4" },
  { id: "storage",  name: "Storage",             color: "#cf5f34", key: "5" },
  { id: "despatch", name: "Despatch",            color: "#c93a6a", key: "6" }
];
const Z = Object.fromEntries(ZONES.map(z => [z.id, z]));

/* =========================================================================
   Site elements (metres). Origin: floor, centre of footprint.
   ========================================================================= */
const M = {
  steel: std("#9aa3aa", { metalness: 0.6, roughness: 0.4 }),
  frame: std("#3d4a57", { metalness: 0.5, roughness: 0.5 }),
  benchTop: std("#c3c9ce", { metalness: 0.25, roughness: 0.45 }),
  black: std("#1b1e21", { roughness: 0.5 }),
  screen: std("#33424f", { roughness: 0.2, metalness: 0.3, emissive: "#18242e" }),
  rackBlue: std("#2f5d9e", { metalness: 0.4, roughness: 0.5 }),
  rackOrange: std("#e2711d", { roughness: 0.5 }),
  rubber: std("#26292c", { roughness: 0.85 }),
  doorPanel: std("#8f9aa3", { metalness: 0.4, roughness: 0.45 }),
  leveller: std("#4a5056", { metalness: 0.5, roughness: 0.6 }),
  yellow: std("#f2b705", { roughness: 0.5 }),
  belt: std("#0d0f11", { roughness: 0.8 }),                         // matches the library conveyor
  convFrame: std("#5f6a73", { metalness: 0.5, roughness: 0.45 }),
  leg: std("#4b545b", { metalness: 0.5, roughness: 0.5 })
};
const STRIPE = canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = "#f2b705"; g.fillRect(0, 0, w, h); g.fillStyle = "#16181b";
  for (let y = -w; y < h + w; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + w); g.lineTo(w, y + w + 22); g.lineTo(0, y + 22); g.fill(); }
});
M.stripe = std("#ffffff", { map: STRIPE, roughness: 0.5 });
const GARMENT_COLOURS = ["#1f2a44", "#151617", "#e6dfcf", "#7a1f2b", "#5b6b3a", "#3d5a80", "#8a8d91", "#c7a27c"];
const garmentMats = {};

const SITE = {
  /* Pack bench: operator stands on the +Z side. */
  bench() {
    const g = new T.Group();
    g.add(bx(1.8, 0.04, 0.8, M.benchTop, 0, 0.88, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.05, 0.86, 0.05, M.frame, sx * 0.85, 0.43, sz * 0.35));
    g.add(bx(1.72, 0.025, 0.7, M.benchTop, 0, 0.25, 0));
    for (const sx of [-1, 1]) g.add(bx(0.04, 0.72, 0.04, M.frame, sx * 0.85, 1.26, -0.38));
    g.add(bx(1.8, 0.03, 0.3, M.benchTop, 0, 1.5, -0.25));
    g.add(bx(0.5, 0.31, 0.03, M.screen, 0.45, 1.2, -0.3));
    g.add(bx(0.04, 0.2, 0.04, M.black, 0.45, 0.98, -0.31));
    g.add(bx(0.14, 0.05, 0.09, M.black, -0.2, 0.925, 0.15));   // scanner
    return g;
  },
  /* Gravity chute: starts at the belt edge (z=0) and runs out along +Z to a
     wide tray spanning the benches it feeds. */
  chute(p) {
    const g = new T.Group(), L = p.L || 1.6, h1 = p.h1, h2 = p.h2, trayW = p.trayW;
    const ang = Math.atan2(h1 - h2, L), len = Math.hypot(L, h1 - h2);
    const slide = new T.Group();
    slide.add(bx(0.6, 0.02, len, M.steel));
    for (const sx of [-1, 1]) slide.add(bx(0.02, 0.12, len, M.steel, sx * 0.31, 0.06, 0));
    slide.rotation.x = ang; slide.position.set(0, (h1 + h2) / 2, L / 2); g.add(slide);
    g.add(bx(trayW, 0.025, 0.5, M.steel, 0, h2, L + 0.25));
    g.add(bx(trayW, 0.1, 0.02, M.yellow, 0, h2 + 0.05, L + 0.5));
    for (const sx of [-1, 1]) g.add(bx(0.02, 0.1, 0.5, M.steel, sx * trayW / 2, h2 + 0.05, L + 0.25));
    for (const sx of [-1, 1]) { g.add(bx(0.04, h2, 0.04, M.frame, sx * (trayW / 2 - 0.1), h2 / 2, L + 0.3)); g.add(bx(0.04, h1 - 0.1, 0.04, M.frame, sx * 0.27, (h1 - 0.1) / 2, 0.2)); }
    return g;
  },
  /* Curved belt section. Centre at origin, centreline radius p.r, running from
     angle p.a0 through p.angle (radians), point = (r cos a, r sin a) in X/Z. */
  curve(p) {
    const g = new T.Group(), n = Math.max(6, Math.round(Math.abs(p.angle) / (PI / 16))), w = p.w, h = p.h;
    const seg = (r, a, b, wd, ht, y, mat) => {
      const x1 = r * Math.cos(a), z1 = r * Math.sin(a), x2 = r * Math.cos(b), z2 = r * Math.sin(b);
      const m = bx(Math.hypot(x2 - x1, z2 - z1) + 0.02, ht, wd, mat, (x1 + x2) / 2, y, (z1 + z2) / 2);
      m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1); g.add(m);
    };
    for (let i = 0; i < n; i++) {
      const a = p.a0 + p.angle * i / n, b = p.a0 + p.angle * (i + 1) / n;
      seg(p.r, a, b, w, 0.012, h - 0.006, M.belt);
      for (const s of [-1, 1]) { seg(p.r + s * (w / 2 + 0.02), a, b, 0.04, 0.13, h - 0.055, M.convFrame); seg(p.r + s * (w / 2 + 0.004), a, b, 0.008, 0.04, h + 0.055, M.yellow); }
    }
    for (let i = 0; i <= n; i += Math.max(2, Math.round(n / 4))) {
      const a = p.a0 + p.angle * i / n;
      for (const s of [-1, 1]) { const r = p.r + s * (w / 2 + 0.02); g.add(bx(0.05, h - 0.12, 0.05, M.leg, r * Math.cos(a), (h - 0.12) / 2, r * Math.sin(a))); }
    }
    return g;
  },
  /* Inclined belt running along +X from height h1 (x=0) to h2 (x=len). */
  incline(p) {
    const g = new T.Group(), L = p.len, w = p.w, ang = Math.atan2(p.h2 - p.h1, L), sl = Math.hypot(L, p.h2 - p.h1);
    const run = new T.Group();
    run.add(bx(sl, 0.012, w, M.belt, 0, -0.006, 0));
    for (const s of [-1, 1]) { run.add(bx(sl, 0.13, 0.04, M.convFrame, 0, -0.055, s * (w / 2 + 0.02))); run.add(bx(sl, 0.04, 0.008, M.yellow, 0, 0.055, s * (w / 2 + 0.004))); }
    run.rotation.z = ang; run.position.set(L / 2, (p.h1 + p.h2) / 2, 0); g.add(run);
    const nl = Math.max(2, Math.ceil(L / 2.5));
    for (let i = 0; i <= nl; i++) {
      const x = 0.2 + (L - 0.4) * i / nl, y = p.h1 + (p.h2 - p.h1) * x / L - 0.12;
      for (const s of [-1, 1]) g.add(bx(0.05, y, 0.05, M.leg, x, y / 2, s * (w / 2 + 0.02)));
    }
    return g;
  },
  /* Gravity roller conveyor section along X, rollers at 100 mm pitch. */
  roller(p) {
    const g = new T.Group(), L = p.len, w = 0.6, h = 0.75;
    for (const s of [-1, 1]) g.add(bx(L, 0.1, 0.04, M.leg, 0, h - 0.05, s * (w / 2 + 0.02)));
    for (let x = -L / 2 + 0.05; x < L / 2; x += 0.1) g.add(cy(0.024, w, M.steel, "z", x, h - 0.03, 0, 8));
    for (const x of [-L / 2 + 0.15, L / 2 - 0.15]) for (const s of [-1, 1]) g.add(bx(0.05, h - 0.1, 0.05, M.leg, x, (h - 0.1) / 2, s * (w / 2 + 0.02)));
    return g;
  },
  /* One bay of pallet racking, 2.7 m wide x 1.1 m deep. Beam tops at p.levels. */
  rack(p) {
    const g = new T.Group(), H = p.height;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(bx(0.08, H, 0.08, M.rackBlue, sx * 1.35, H / 2, sz * 0.55));
    for (const sx of [-1, 1]) {
      for (const y of [0.3, H / 2, H - 0.15]) g.add(bx(0.04, 0.04, 1.1, M.rackBlue, sx * 1.35, y, 0));
      const d = bx(0.03, Math.hypot(1.1, H / 2 - 0.3), 0.03, M.rackBlue, sx * 1.35, (H / 2 + 0.3) / 2, 0);
      d.rotation.x = Math.atan2(1.1, H / 2 - 0.3); g.add(d);
    }
    for (const y of p.levels) for (const sz of [-1, 1]) g.add(bx(2.62, 0.12, 0.05, M.rackOrange, 0, y - 0.06, sz * 0.55));
    return g;
  },
  /* 3 m section of garment rail at 2.3 m. */
  rail() {
    const g = new T.Group();
    g.add(cy(0.022, 3.0, M.steel, "x", 0, 2.3, 0));
    for (const sx of [-1, 1]) {
      g.add(bx(0.06, 2.36, 0.06, M.frame, sx * 1.5, 1.18, 0));
      g.add(bx(0.3, 0.012, 0.3, M.frame, sx * 1.5, 0.006, 0));
    }
    return g;
  },
  /* Garment on a hanger, hanging off a rail at 2.3 m. Thin along X (the rail). */
  garment(p) {
    const g = new T.Group();
    garmentMats[p.colour] = garmentMats[p.colour] || std(p.colour, { roughness: 0.85 });
    g.add(bx(0.01, 0.08, 0.01, M.steel, 0, 2.27, 0));
    g.add(bx(0.015, 0.02, 0.42, M.black, 0, 2.22, 0));
    g.add(bx(0.05, 0.9, 0.44, garmentMats[p.colour], 0, 1.76, 0));
    return g;
  },
  /* Dock door portal in the south wall; outside faces +Z. */
  door(p) {
    const g = new T.Group(), w = p.w, h = p.h;
    for (const sx of [-1, 1]) g.add(bx(0.3, h + 0.5, 0.35, M.stripe, sx * (w / 2 + 0.15), (h + 0.5) / 2, 0));
    g.add(bx(w + 0.6, 0.5, 0.35, M.frame, 0, h + 0.25, 0));
    g.add(cy(0.24, w, M.doorPanel, "x", 0, h - 0.05, -0.25));
    g.add(bx(w, h * 0.4, 0.05, M.doorPanel, 0, h - h * 0.2, 0.05));
    for (let i = 1; i < 6; i++) g.add(bx(w, 0.015, 0.06, M.frame, 0, h - i * h * 0.4 / 6, 0.06));
    g.add(bx(w - 0.2, 0.05, 2.2, M.leveller, 0, 0.025, -1.3));
    for (const sx of [-1, 1]) g.add(bx(0.25, 0.4, 0.15, M.rubber, sx * (w / 2 - 0.35), 1.15, 0.25));
    const sign = new T.Mesh(new T.PlaneGeometry(1.4, 0.4), std("#ffffff", { map: canvasTex(280, 80, (c, cw, ch) => {
      c.fillStyle = p.kind === "in" ? "#3b7fc4" : "#c93a6a"; c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#fff"; c.font = "800 44px Archivo, Arial, sans-serif"; c.textBaseline = "middle"; c.fillText("D" + p.n, 14, ch / 2 + 2);
      c.font = "600 22px Inter, Arial, sans-serif"; c.textAlign = "right"; c.fillText(p.kind === "in" ? "INBOUND" : "DESPATCH", cw - 12, ch / 2 + 1);
    }), roughness: 0.6 }));
    sign.position.set(0, h + 0.25, 0.18); g.add(sign);
    return g;
  }
};

/* =========================================================================
   Instancing: each element variant is flattened to one geometry per
   material, then drawn as InstancedMesh per zone.
   ========================================================================= */
const templates = new Map(), ticks = [];
function sliceGeo(g, start, count) {
  const out = new T.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes))
    out.setAttribute(name, new T.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  return out;
}
function mergeGeos(gs) {
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) {
    const a = g.attributes, c = a.position.count;
    pos.set(a.position.array, o * 3);
    if (a.normal) nor.set(a.normal.array, o * 3);
    if (a.uv) uv.set(a.uv.array, o * 2);
    o += c;
  }
  const m = new T.BufferGeometry();
  m.setAttribute("position", new T.BufferAttribute(pos, 3));
  m.setAttribute("normal", new T.BufferAttribute(nor, 3));
  m.setAttribute("uv", new T.BufferAttribute(uv, 2));
  return m;
}
function template(key, p = {}) {
  const id = key + JSON.stringify(p);
  if (templates.has(id)) return templates.get(id);
  const obj = SITE[key] ? SITE[key](p) : ASC.make(key, p);
  obj.updateMatrixWorld(true);
  const byMat = new Map();
  const add = (mat, g) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); };
  obj.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (Array.isArray(o.material)) {
      if (g.groups.length) for (const gr of g.groups) add(o.material[gr.materialIndex], sliceGeo(g, gr.start, gr.count));
      else add(o.material[0], g);
    } else add(o.material, g);
  });
  const t = { id, parts: [...byMat].map(([mat, gs]) => ({ mat, geo: mergeGeos(gs) })) };
  if (obj.userData.tick) ticks.push(obj.userData.tick);
  templates.set(id, t);
  return t;
}

const world = new T.Group();
const zoneGroups = {}, zoneMats = {}, zoneMatCache = new Map(), buckets = new Map(), counts = {};
ZONES.forEach(z => { zoneGroups[z.id] = new T.Group(); zoneMats[z.id] = []; counts[z.id] = {}; world.add(zoneGroups[z.id]); });
function zoneMat(zone, mat) {
  const k = zone + mat.uuid;
  if (!zoneMatCache.has(k)) {
    const m = mat.clone();
    zoneMatCache.set(k, m);
    zoneMats[zone].push({ mat: m, color: m.color.clone(), map: m.map, emissive: m.emissive ? m.emissive.clone() : null });
  }
  return zoneMatCache.get(k);
}
const _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3(1, 1, 1);
function put(zone, key, p, x, y, z, ry = 0) {
  const t = template(key, p), k = zone + "|" + t.id;
  if (!buckets.has(k)) buckets.set(k, { zone, t, list: [] });
  _q.setFromEuler(_e.set(0, ry, 0));
  buckets.get(k).list.push(new T.Matrix4().compose(new T.Vector3(x, y, z), _q, _s));
  counts[zone][key] = (counts[zone][key] || 0) + 1;
}
function addStatic(zone, mesh) {
  mesh.material = zoneMat(zone, mesh.material);
  mesh.receiveShadow = true;
  zoneGroups[zone].add(mesh);
}
function flushInstances() {
  for (const { zone, t, list } of buckets.values()) for (const part of t.parts) {
    const im = new T.InstancedMesh(part.geo, zoneMat(zone, part.mat), list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;       // r147 has no per-instance bounds
    zoneGroups[zone].add(im);
  }
}
function floorPaint(zone, w, d, x, z, color, map) {
  const m = new T.Mesh(new T.PlaneGeometry(w, d), std(color, { map: map || null, roughness: 0.8 }));
  m.rotation.x = -PI / 2; m.position.set(x, 0.006, z);
  addStatic(zone, m);
}

/* ---------- Load helpers ---------- */
const H = { tote: 0.3, parcelS: 0.16, parcelM: 0.46, os: 0.6, bagS: 0.06, bagM: 0.1 };
const TOTES = ["black", "red", "pink"];
function loose(zone, kind, x, y, z, ry = 0) {
  if (kind === "tote") put(zone, "tote", { colour: pick(TOTES) }, x, y, z, ry);
  else if (kind === "parcelS") put(zone, "parcel", { size: "small" }, x, y, z, ry);
  else if (kind === "parcelM") put(zone, "parcel", { size: "medium" }, x, y, z, ry);
  else if (kind === "os") put(zone, "parcel", { size: "oversized" }, x, y, z, ry);
  else if (kind === "bagS") put(zone, "bag", { size: "small", colour: R() < 0.6 ? "grey" : "white" }, x, y, z, ry);
  else if (kind === "bagM") put(zone, "bag", { size: "medium", colour: R() < 0.6 ? "grey" : "white" }, x, y, z, ry);
}
/* A UK pallet (1.2 x 1.0) with goods stacked in layers, up to maxH tall. */
function palletLoad(zone, x, y, z, ry, kind, maxH) {
  put(zone, "pallet", { type: "uk" }, x, y, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const grid = { tote: [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]], parcelM: [[-0.305, -0.23], [0.305, -0.23], [-0.305, 0.23], [0.305, 0.23]],
                 parcelS: [[-0.23, -0.19], [0.23, -0.19], [-0.23, 0.19], [0.23, 0.19]], bagM: [[-0.23, -0.19], [0.23, -0.19], [-0.23, 0.19], [0.23, 0.19]], os: [[0, 0]] }[kind];
  const h = H[kind], layers = Math.max(1, Math.floor(maxH / h)), full = Math.max(1, Math.round(layers * (0.45 + R() * 0.55)));
  let top = y + 0.144;
  for (let l = 0; l < full; l++) {
    const n = l === full - 1 ? 1 + Math.floor(R() * grid.length) : grid.length;
    const colour = pick(TOTES);
    for (let i = 0; i < n; i++) {
      const [px, pz] = at(grid[i][0], grid[i][1]), jit = kind === "bagM" ? (R() - 0.5) * 0.3 : 0;
      if (kind === "tote") put(zone, "tote", { colour }, px, top, pz, ry);
      else loose(zone, kind, px, top, pz, ry + jit);
    }
    top += h;
  }
}
/* Roll cage with some parcels and bags inside. Gates face +Z rotated by ry. */
function loadedCage(zone, x, z, ry, fill = R()) {
  put(zone, "cage", {}, x, 0, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  let y = 0.165;
  const layers = Math.floor(fill * 7);
  for (let l = 0; l < layers; l++) {
    const [ax, az] = at(-0.12, 0.14), [bx_, bz] = at(0.17, -0.2);
    loose(zone, "parcelS", ax, y, az, ry + PI / 2);
    loose(zone, R() < 0.5 ? "bagS" : "bagM", bx_, y, bz, ry + PI / 2 + (R() - 0.5) * 0.4);
    y += 0.17;
  }
}
/* Bench plus what is sitting on it. */
function dressedBench(zone, x, z, ry, style) {
  put(zone, "bench", {}, x, 0, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const top = 0.9;
  let [px, pz] = at(-0.5, -0.05);
  if (R() < 0.85) put(zone, "tote", { colour: style === "pack" ? pick(["black", "red"]) : pick(TOTES) }, px, top, pz, ry);
  [px, pz] = at(0.35, 0.12);
  const k = R();
  if (style === "hanging") loose(zone, "bagM", px, top, pz, ry + 0.2);
  else if (k < 0.4) loose(zone, "parcelS", px, top, pz, ry + (R() - 0.5) * 0.4);
  else if (k < 0.75) loose(zone, pick(["bagS", "bagM"]), px, top, pz, ry + (R() - 0.5) * 0.6);
  [px, pz] = at(0, 0);
  if (R() < 0.6) put(zone, "tote", { colour: "black" }, px, 0.265, pz, ry);
}

/* =========================================================================
   Layout. Two bands: south (doors) = inbound | conveyor | despatch,
   north = manual | hanging | storage. Sizes come from the config counts.
   ========================================================================= */
const D = C.bayDoors, CV = C.conveyor, DS = C.despatch, IN = C.inbound, MN = C.manual, HG = C.hanging, ST = C.storage;
const doorsIn = Math.min(D.inbound, D.count), doorsOut = Math.max(0, D.count - doorsIn);

/* Conveyor geometry (from the layout video): induction belt → 180° turn →
   incline → elevated loop sorter; chutes drop from both straights of the loop
   to pack benches; packed totes leave on floor roller lines to a palletising comb. */
const perSide = [Math.ceil(CV.chutes / 2), Math.floor(CV.chutes / 2)];   // [south straight, north straight]
const loopR = 1.3, loopLen = perSide[0] * CV.chuteSpacing + 2;          // straight length of the loop
const chuteRun = 2.4;                                                     // plan length of each chute
const edgeOff = loopR + CV.beltWidth / 2 + 0.06;                          // loop centre → chute start
const benchOff = edgeOff + chuteRun + 0.5 + 0.4;                          // loop centre → bench centre
const takeOff = benchOff + 0.4 + 1.4 + 0.35;                              // loop centre → takeaway roller line
const turnR = 2.5;                                                        // induction U-turn radius
const combW = 3 + CV.combSpurs * 2.0;                                     // palletising comb width
const convW = 1 + 2 * turnR + CV.inclineLength + loopR + loopLen + loopR + 2 + combW;
const lanePitch = 1.6, cageSlot = 0.95, laneHead = 7;

const dims = {
  inbound:  { w: Math.max(IN.bulkCols * 1.35 + 3, doorsIn * 6, IN.cages * 0.95 + 2) + 2, d: 6 + IN.bulkRows * 1.2 + 3 },
  conveyor: { w: convW, d: takeOff * 2 + 1.5 },
  despatch: { w: DS.lines * lanePitch + 4, d: laneHead + DS.cagesPerLine * cageSlot + 2.5 },
  manual:   { w: MN.benchesPerRow * 2.5 + 6, d: MN.rows * 3.4 + 3 },
  hanging:  { w: Math.ceil(HG.railLength / 3) * 3 + 6, d: 4.2 + HG.rails * 2.0 + 1.5 },
  storage:  { w: ST.rackRows * 4.4 + 1, d: ST.baysPerRow * 2.75 + 2 }
};
const margin = 1.5, gap = 3, minAisle = 6;
const SOUTH = ["manual", "inbound", "despatch"], NORTH = ["conveyor", "hanging"];
const southD = Math.max(...SOUTH.map(id => dims[id].d)), northD = Math.max(...NORTH.map(id => dims[id].d));
const bandW = ids => ids.reduce((a, id) => a + dims[id].w, 0) + gap * (ids.length - 1);
const innerW = Math.max(bandW(SOUTH), bandW(NORTH));
const BW = margin + innerW + gap + dims.storage.w + margin;
const BD = Math.max(margin + southD + minAisle + northD + margin, dims.storage.d + margin * 2);
const aisle = BD - margin * 2 - southD - northD;
const rects = {};
function placeBand(ids, zTop, depth, alignTop) {
  const extra = (innerW - bandW(ids)) / Math.max(1, ids.length - 1);
  let x = margin;
  for (const id of ids) {
    const w = dims[id].w, d = dims[id].d;
    rects[id] = alignTop ? { x0: x, x1: x + w, z1: zTop, z0: zTop - d } : { x0: x, x1: x + w, z0: zTop - depth, z1: zTop - depth + d };
    x += w + gap + extra;
  }
}
placeBand(SOUTH, 0, southD, true);                      // south band runs up to the door wall
placeBand(NORTH, -BD + margin + northD, northD, false); // north band sits against the back wall
rects.manual.z1 = -margin; rects.manual.z0 = -margin - dims.manual.d;
rects.storage = { x0: BW - margin - dims.storage.w, x1: BW - margin, z0: -BD + margin, z1: -margin };

/* ---------- Inbound: bulk floor-stacked pallets in front of the doors ---------- */
function buildInbound() {
  const r = rects.inbound, z = "inbound", cx = (r.x0 + r.x1) / 2;
  for (let i = 0; i < doorsIn; i++) put(z, "door", { w: D.width, h: D.height, n: i + 1, kind: "in" }, r.x0 + (i + 0.5) * (r.x1 - r.x0) / doorsIn, 0, 0);
  floorPaint(z, r.x1 - r.x0 - 1, 4, cx, -2.2, "#5f8fc0");     // unloading apron
  let pallets = 0, cages = 0;
  // roll cages just off the trailers
  for (let i = 0; i < IN.cages; i++) { if (R() < 0.2) continue; loadedCage(z, cx + (i - (IN.cages - 1) / 2) * 0.95, -4.9, 0, 0.3 + R() * 0.7); cages++; }
  // bulk block, outlined in yellow like the floor marking in the video
  const bz0 = -6.4, bw = IN.bulkCols * 1.35, bd = IN.bulkRows * 1.2;
  for (const [w, d, x, zz] of [[bw + 0.8, 0.08, cx, bz0 + 0.2], [bw + 0.8, 0.08, cx, bz0 - bd - 0.2], [0.08, bd + 0.4, cx - bw / 2 - 0.4, bz0 - bd / 2], [0.08, bd + 0.4, cx + bw / 2 + 0.4, bz0 - bd / 2]])
    floorPaint(z, w, d, x, zz, "#f2b705");
  for (let row = 0; row < IN.bulkRows; row++) for (let col = 0; col < IN.bulkCols; col++) {
    if (R() > IN.fill) continue;
    palletLoad(z, cx + (col - (IN.bulkCols - 1) / 2) * 1.35, 0, bz0 - 0.6 - row * 1.2, PI / 2, R() < 0.8 ? "parcelM" : pick(["parcelS", "os"]), 1.4); pallets++;
  }
  return [["Bay doors", doorsIn], ["Pallets in bulk", pallets], ["Bulk spaces", IN.bulkRows * IN.bulkCols], ["Roll cages waiting", cages]];
}

/* ---------- Conveyor processing ---------- */
function buildConveyor() {
  const r = rects.conveyor, z = "conveyor", zc = (r.z0 + r.z1) / 2, Hs = CV.sorterHeight, Hi = CV.inductHeight, bw = CV.beltWidth;
  const belt = (len, h) => ({ length: Math.round(len * 1000), belt: String(Math.round(bw * 1000)), height: Math.round(h * 1000), running: reduceMotion ? "off" : "on" });
  const curve = (cx, cz, rad, a0, angle, h) => put(z, "curve", { r: rad, a0, angle, w: bw, h }, cx, 0, cz);
  // west → east: U-turn centre, incline, loop
  const xi0 = r.x0 + 1 + turnR;                  // incline start / U-turn centre
  const xi1 = xi0 + CV.inclineLength;            // incline top, touches the loop's west apex
  const lx0 = xi1 + loopR, lx1 = lx0 + loopLen;  // loop straights
  const zS = zc + loopR, zN = zc - loopR, zInd = zc + 2 * turnR;
  // 1. Induction belt (low), fed from roll cages, running west
  const indLen = Math.min(CV.inductLength, lx0 - xi0 - 0.5);
  put(z, "conveyor", belt(indLen, Hi), xi0 + indLen / 2, 0, zInd);
  let cages = 0;
  for (let i = 0; i < Math.floor(indLen / 1.6); i++) { loadedCage(z, xi0 + 0.9 + i * 1.6, zInd + 1.5, PI, 0.4 + R() * 0.6); cages++; }
  for (let x = xi0 + 0.6; x < xi0 + indLen - 0.4; x += 1 + R() * 1.6) loose(z, pick(["parcelS", "bagS", "bagM"]), x, Hi, zInd, (R() - 0.5) * 0.4);
  // 2. U-turn at the west end, 3. incline up to the sorter
  curve(xi0, zc + turnR, turnR, PI / 2, PI, Hi);
  put(z, "incline", { len: CV.inclineLength, h1: Hi, h2: Hs, w: bw }, xi0, 0, zc);
  // 4. Elevated loop sorter: two straights joined by 180° curves
  const nSec = Math.max(1, Math.round(loopLen / CV.sectionLength)), secL = loopLen / nSec;
  for (let i = 0; i < nSec; i++) for (const zz of [zS, zN]) put(z, "conveyor", belt(secL, Hs), lx0 + (i + 0.5) * secL, 0, zz);
  curve(lx0, zc, loopR, PI / 2, PI, Hs);
  curve(lx1, zc, loopR, -PI / 2, PI, Hs);
  for (const zz of [zS, zN]) for (let x = lx0 + 0.6; x < lx1 - 0.6; x += 1.4 + R() * 2.4) loose(z, pick(["parcelS", "bagS", "bagM", "parcelS"]), x, Hs, zz, (R() - 0.5) * 0.3);
  // 5. Chutes and pack benches on the outside of each straight
  const nb = CV.benchesPerChute, trayW = nb * 1.9 - 0.1;
  let chutes = 0, benches = 0;
  [1, -1].forEach((side, si) => {
    for (let k = 0; k < perSide[si]; k++) {
      const x = lx0 + 1 + (k + 0.5) * CV.chuteSpacing, ry = side > 0 ? 0 : PI, edge = zc + side * edgeOff;
      put(z, "chute", { L: chuteRun, h1: Hs - 0.02, h2: 0.86, trayW }, x, 0, edge, ry); chutes++;
      for (let j = 0; j < nb; j++) { dressedBench(z, x + (j - (nb - 1) / 2) * 1.9, zc + side * benchOff, ry, "pack"); benches++; }
      if (R() < 0.7) loose(z, pick(["parcelS", "bagS", "bagM"]), x + (R() - 0.5) * trayW * 0.6, 0.875, edge + side * (chuteRun + 0.25), R() * PI);
    }
  });
  // 6. Takeaway roller lines behind the operators, joining at the east end
  const tx0 = lx0 + 0.3, tx1 = lx1 + loopR + 2, rl = 3;
  const rollerRun = (xa, xb, zz, ry, totes) => {
    const n = Math.max(1, Math.round(Math.abs(xb - xa) / rl)), L = Math.abs(xb - xa) / n;
    for (let i = 0; i < n; i++) {
      const t = xa + Math.sign(xb - xa) * (i + 0.5) * L;
      const [px, pz] = ry ? [zz, t] : [t, zz];
      put(z, "roller", { len: +L.toFixed(3) }, px, 0, pz, ry);
    }
    if (totes) for (let t = Math.min(xa, xb) + 0.5; t < Math.max(xa, xb) - 0.5; t += 0.8 + R() * 2.5) { const [px, pz] = ry ? [zz, t] : [t, zz]; put(z, "tote", { colour: pick(TOTES) }, px, 0.75, pz, ry ? 0 : PI / 2); }
  };
  rollerRun(tx0, tx1, zc + takeOff, 0, true);
  rollerRun(tx0, tx1, zc - takeOff, 0, true);
  rollerRun(zc - takeOff + 0.35, zc + takeOff - 0.35, tx1 + 0.35, PI / 2, true);
  // 7. Palletising comb: a feed line with spurs, pallets of totes beside each spur
  const cx0 = tx1 + 0.7, spurLen = 6;
  rollerRun(cx0, cx0 + combW - 1, zc, 0, true);
  let pallets = 0;
  for (let s = 0; s < CV.combSpurs; s++) {
    const sx = cx0 + 0.8 + s * 2.0;
    rollerRun(zc - 0.35, zc - 0.35 - spurLen, sx, PI / 2, true);
    for (let k = 0; k < 2; k++) { if (R() < 0.8) { palletLoad(z, sx + 1.0, 0, zc - 2 - k * 2.2, PI / 2, "tote", 1.0); pallets++; } }
  }
  for (let k = 0; k < CV.combSpurs; k++) if (R() < 0.75) { palletLoad(z, cx0 + 1.0 + k * 2.0, 0, zc + 2.2, 0, "tote", 1.2); pallets++; }
  const loopLength = Math.round(2 * loopLen + 2 * PI * loopR);
  return [["Chutes", chutes], ["Pack benches", benches], ["Sorter loop", loopLength + " m"], ["Sorter height", Hs + " m"], ["Induction cages", cages], ["Tote pallets", pallets]];
}

/* ---------- Despatch ---------- */
function buildDespatch() {
  const r = rects.despatch, z = "despatch", cx = (r.x0 + r.x1) / 2;
  for (let i = 0; i < doorsOut; i++) put(z, "door", { w: D.width, h: D.height, n: doorsIn + i + 1, kind: "out" }, r.x0 + (i + 0.5) * (r.x1 - r.x0) / doorsOut, 0, 0);
  floorPaint(z, r.x1 - r.x0 - 1, 4, cx, -2.2, "#c2577a");
  const lx0 = cx - DS.lines * lanePitch / 2, laneLen = DS.cagesPerLine * cageSlot + 0.4;
  let cages = 0;
  for (let i = 0; i <= DS.lines; i++) floorPaint(z, 0.06, laneLen, lx0 + i * lanePitch, -laneHead - laneLen / 2, "#f2b705");
  floorPaint(z, DS.lines * lanePitch, 0.08, cx, -laneHead + 0.02, "#f2b705");
  for (let i = 0; i < DS.lines; i++) {
    const x = lx0 + (i + 0.5) * lanePitch;
    const tex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#f2b705"; g.font = "800 84px Archivo, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(i + 1), w / 2, h / 2 + 4); });
    const lbl = new T.Mesh(new T.PlaneGeometry(1.0, 1.0), std("#ffffff", { map: tex, transparent: true, roughness: 0.8 }));
    lbl.rotation.x = -PI / 2; lbl.position.set(x, 0.01, -laneHead + 0.65); addStatic(z, lbl);
    const n = Math.max(0, Math.min(DS.cagesPerLine, Math.round(DS.cagesPerLine * DS.fill * (0.3 + R() * 1.4))));
    for (let k = 0; k < n; k++) { loadedCage(z, x, -laneHead - laneLen + 0.2 + cageSlot / 2 + k * cageSlot, 0, 0.5 + R() * 0.5); cages++; }
  }
  for (let i = 0; i < doorsOut; i++) {
    const dx = r.x0 + (i + 0.5) * (r.x1 - r.x0) / doorsOut;
    for (let k = 0; k < 3; k++) if (R() < 0.7) { loadedCage(z, dx + (k - 1) * 0.85, -3.4, 0, 0.9); cages++; }
  }
  return [["Despatch lines", DS.lines], ["Bay doors", doorsOut], ["Lane capacity", DS.lines * DS.cagesPerLine + " cages"], ["Cages shown", cages]];
}

/* ---------- Manual processing (GUESS) ---------- */
function buildManual() {
  const r = rects.manual, z = "manual", cx = (r.x0 + r.x1) / 2;
  let benches = 0;
  for (let row = 0; row < MN.rows; row++) {
    const zz = r.z1 - 2.2 - row * 3.4, ry = row % 2 ? PI : 0;
    for (let c = 0; c < MN.benchesPerRow; c++) { dressedBench(z, cx + (c - (MN.benchesPerRow - 1) / 2) * 2.5, zz, ry, "manual"); benches++; }
    loadedCage(z, r.x0 + 1.2, zz, PI / 2, R());
    palletLoad(z, r.x1 - 1.4, 0, zz, PI / 2, row % 2 ? "os" : "parcelM", 1.0);
  }
  return [["Benches", benches], ["Rows", MN.rows], ["Feed cages", MN.rows], ["Oversize pallets", MN.rows]];
}

/* ---------- Hanging processing (GUESS) ---------- */
function buildHanging() {
  const r = rects.hanging, z = "hanging", cx = (r.x0 + r.x1) / 2;
  const nSec = Math.ceil(HG.railLength / 3), len = nSec * 3, rx0 = cx - len / 2;
  for (let b = 0; b < HG.benches; b++) dressedBench(z, cx + (b - (HG.benches - 1) / 2) * 2.6, r.z1 - 1.6, 0, "hanging");
  let garments = 0;
  for (let i = 0; i < HG.rails; i++) {
    const zz = r.z1 - 4.2 - i * 2.0;
    for (let s = 0; s < nSec; s++) put(z, "rail", {}, rx0 + 1.5 + s * 3, 0, zz);
    let on = R() < HG.fill;
    for (let x = rx0 + 0.15; x < rx0 + len - 0.15; x += 0.13) {
      if (R() < 0.06) on = R() < HG.fill;
      if (!on) continue;
      put(z, "garment", { colour: pick(GARMENT_COLOURS) }, x, 0, zz + (R() - 0.5) * 0.03, (R() - 0.5) * 0.12); garments++;
    }
  }
  return [["Rails", HG.rails], ["Rail length", HG.rails * len + " m"], ["Garments shown", garments], ["Benches", HG.benches]];
}

/* ---------- Storage: racking along the far end wall ---------- */
function buildStorage() {
  const r = rects.storage, z = "storage", cz = (r.z0 + r.z1) / 2;
  const levels = [0, ...ST.beamLevels], height = ST.beamLevels[ST.beamLevels.length - 1] + 1.4;
  let positions = 0, used = 0;
  for (let row = 0; row < ST.rackRows; row++) {
    const x = r.x1 - 0.7 - row * 4.4;              // first row backs onto the end wall
    for (let b = 0; b < ST.baysPerRow; b++) {
      const zz = cz + (b - (ST.baysPerRow - 1) / 2) * 2.75;
      put(z, "rack", { levels: ST.beamLevels, height: +height.toFixed(2) }, x, 0, zz, PI / 2);
      levels.forEach((y, li) => {
        const clear = (li + 1 < levels.length ? levels[li + 1] - 0.15 : y + 1.3) - y - 0.2;
        for (const dz of [-0.66, 0.66]) {
          positions++;
          if (R() > ST.fill) continue;
          used++;
          palletLoad(z, x, y, zz + dz, 0, pick(["parcelM", "parcelM", "tote", "parcelS", "bagM"]), clear);
        }
      });
    }
  }
  return [["Rack rows", ST.rackRows], ["Bays", ST.rackRows * ST.baysPerRow], ["Pallet positions", positions], ["Occupied", Math.round(100 * used / positions) + "%"]];
}

const BUILD = { inbound: buildInbound, conveyor: buildConveyor, manual: buildManual, hanging: buildHanging, storage: buildStorage, despatch: buildDespatch };
const ZONE_TEXT = {
  inbound: "Trailers unload through the inbound doors. Returns wait as floor-stacked pallets in the marked bulk area, plus roll cages near the doors.",
  conveyor: `Roll cages are tipped onto a low induction belt, which turns and climbs an incline to a loop sorter at ${CV.sorterHeight} m. ${CV.chutes} chutes drop from both sides of the loop to ${CV.chutes * CV.benchesPerChute} pack benches. Packed totes leave on floor roller lines to the palletising spurs.`,
  manual: "Benches for returns that cannot go down the conveyor: oversized, damaged or needing a closer check.",
  hanging: "Garments on hangers, processed on rails at 2.3 m with benches at the front for bagging and checks.",
  storage: "Pallet racking along the far end wall, as in the layout video.",
  despatch: `${DS.lines} despatch lines of roll cages, staged at the despatch doors for loading.`
};

/* =========================================================================
   Viewer
   ========================================================================= */
const viewport = document.getElementById("viewport");
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = T.sRGBEncoding;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(38, 1, 0.3, 1200);
const controls = new T.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = PI * 0.47; controls.minDistance = 4; controls.maxDistance = 450;
scene.add(new T.HemisphereLight(0xffffff, 0x8a8f94, 0.7));
const sun = new T.DirectionalLight(0xffffff, 0.85);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
scene.add(world);

function build() {
  const stats = {};
  for (const z of ZONES) stats[z.id] = BUILD[z.id]();
  flushInstances();
  // building shell
  const floorTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,0.07)"; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); });
  floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(BW / 6, BD / 6);
  const floorMat = std(css("--floor"), { map: floorTex, roughness: 0.9 });
  const floor = new T.Mesh(new T.PlaneGeometry(BW, BD), floorMat);
  floor.rotation.x = -PI / 2; floor.position.set(BW / 2, 0, -BD / 2); floor.receiveShadow = true; world.add(floor);
  const wallMat = std(css("--wall"), { roughness: 0.9 }), wh = C.site.wallHeight, t = 0.3;
  const wall = (w, h, d, x, y, z) => { const m = bx(w, h, d, wallMat, x, y, z); m.castShadow = m.receiveShadow = true; world.add(m); };
  wall(BW + t * 2, wh, t, BW / 2, wh / 2, -BD - t / 2);
  wall(t, wh, BD, -t / 2, wh / 2, -BD / 2); wall(t, wh, BD, BW + t / 2, wh / 2, -BD / 2);
  // south wall cut away to 1.2 m so the eagle-eye view can see in, with gaps at the doors
  const doorXs = [];
  for (let i = 0; i < doorsIn; i++) doorXs.push(rects.inbound.x0 + (i + 0.5) * (rects.inbound.x1 - rects.inbound.x0) / doorsIn);
  for (let i = 0; i < doorsOut; i++) doorXs.push(rects.despatch.x0 + (i + 0.5) * (rects.despatch.x1 - rects.despatch.x0) / doorsOut);
  doorXs.sort((a, b) => a - b);
  let x = -t;
  for (const dx of [...doorXs, BW + t + D.width / 2 + 0.3]) {
    const a = dx - D.width / 2 - 0.3; if (a > x) wall(a - x, 1.2, t, (a + x) / 2, 0.6, t / 2); x = dx + D.width / 2 + 0.3;
  }
  // main aisle markings
  const aisleZ0 = -margin - southD, aisleZ1 = aisleZ0 - aisle;
  const ax1 = rects.storage.x0 - 1;
  for (const az of [aisleZ0 - 0.4, aisleZ1 + 0.4]) { const m = new T.Mesh(new T.PlaneGeometry(ax1 - 1, 0.1), M.yellow); m.rotation.x = -PI / 2; m.position.set((ax1 + 1) / 2, 0.008, az); world.add(m); }
  // zone floor tints and outlines
  for (const zdef of ZONES) {
    const r = rects[zdef.id], w = r.x1 - r.x0, d = r.z1 - r.z0;
    const tint = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: zdef.color, transparent: true, opacity: 0.16, depthWrite: false }));
    tint.rotation.x = -PI / 2; tint.position.set(r.x0 + w / 2, 0.004, r.z0 + d / 2); tint.renderOrder = -1; world.add(tint);
    const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([a, b]) => new T.Vector3(a, 0.03, b));
    const line = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: zdef.color, transparent: true, opacity: 0.7 }));
    world.add(line);
    zdef.tint = tint; zdef.line = line; zdef.stats = stats[zdef.id];
  }
  world.position.set(-BW / 2, 0, BD / 2);
  for (const zdef of ZONES) { const r = rects[zdef.id]; zdef.box = { x0: r.x0 - BW / 2, x1: r.x1 - BW / 2, z0: r.z0 + BD / 2, z1: r.z1 + BD / 2 }; }
  const e = Math.max(BW, BD) * 0.62;
  Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 400 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(-BW * 0.25, 90, BD * 0.6); sun.target.position.set(0, 0, 0);
  return { floorMat, wallMat };
}

/* ---------- Framing: eagle-eye view from the south side, angled down ---------- */
const EL = 50 * PI / 180, AZ = -12 * PI / 180;
const ALL = { x0: -BW / 2, x1: BW / 2, z0: -BD / 2, z1: BD / 2 };
function viewFor(b) {
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, sx = b.x1 - b.x0, sz = b.z1 - b.z0;
  const fov = camera.fov * PI / 180, tanV = Math.tan(fov / 2), tanH = tanV * camera.aspect;
  const halfV = (sz / 2) * Math.sin(EL) + 3 * Math.cos(EL), halfH = (sx / 2) * Math.cos(AZ) + (sz / 2) * Math.abs(Math.sin(AZ));
  const dist = Math.max(halfV / tanV, halfH / tanH) * 1.1 + (sz / 2) * Math.cos(EL) * 0.35;
  const target = new T.Vector3(cx, 0, cz);
  const dir = new T.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
  return { target, pos: target.clone().addScaledVector(dir, dist) };
}
let tween = null;
function flyTo(b, instant) {
  const v = viewFor(b);
  if (instant || reduceMotion) { camera.position.copy(v.pos); controls.target.copy(v.target); controls.update(); return; }
  tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target };
}

/* ---------- Focus / dimming ---------- */
let current = "all", greyCol = new T.Color(), shell;
function setFocus(id, instant) {
  current = id;
  for (const z of ZONES) {
    const dim = id !== "all" && z.id !== id, on = z.id === id;
    for (const r of zoneMats[z.id]) {
      const m = r.mat;
      if (dim) {
        m.color.copy(r.color).lerp(greyCol, 0.8);
        if (r.emissive) m.emissive.setRGB(0, 0, 0);
        if (r.map && !m.alphaTest && !m.transparent) { m.map = null; m.needsUpdate = true; }
      } else {
        m.color.copy(r.color);
        if (r.emissive) m.emissive.copy(r.emissive);
        if (r.map && m.map !== r.map) { m.map = r.map; m.needsUpdate = true; }
      }
    }
    z.tint.material.opacity = dim ? 0.04 : on ? 0.3 : 0.16;
    z.line.material.opacity = dim ? 0.15 : 1;
    z.label.classList.toggle("dim", dim);
  }
  flyTo(id === "all" ? ALL : Z[id].box, instant);
  document.querySelectorAll("#sections button").forEach(b => { const on = b.dataset.id === id; b.setAttribute("aria-pressed", String(on)); if (on && !instant) b.scrollIntoView({ block: "nearest", inline: "nearest" }); });
  renderPanel();
  try { history.replaceState(null, "", id === "all" ? location.pathname + location.search : "#" + id); } catch (e) {}
}

/* ---------- UI ---------- */
const sectionsEl = document.getElementById("sections"), panel = document.getElementById("panel"), labelsEl = document.getElementById("labels");
function renderSections() {
  const btn = (id, name, color, key) => `<button data-id="${id}" aria-pressed="false" title="Shortcut: ${key}">${color ? `<span class="swatch" style="background:${color}"></span>` : ""}${name}</button>`;
  sectionsEl.innerHTML = btn("all", "View all", null, "0") + ZONES.map(z => btn(z.id, z.name, z.color, z.key)).join("");
  sectionsEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setFocus(b.dataset.id); });
}
function renderPanel() {
  const guessNote = `<p class="guess">Placement is a first guess. Send the floor plan and this zone will be moved to match.</p>`;
  if (current === "all") {
    const totals = [["Bay doors", D.count], ["Despatch lines", DS.lines], ["Chutes", CV.chutes], ["Pack benches", CV.chutes * CV.benchesPerChute]];
    panel.innerHTML = `<div><div class="kicker">Whole site</div><h2>${C.site.name}</h2>
      <p class="blurb">Single floor, about ${Math.round(BW)} × ${Math.round(BD)} m. Bay doors are on the south wall, nearest the camera.</p></div>
      <div><h3>Headline counts</h3><div class="stats">${totals.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div></div>
      <div><h3>Sections</h3><ul class="zlist">${ZONES.map(z => `<li><button data-id="${z.id}"><span class="swatch" style="background:${z.color}"></span><span>${z.name}${C[z.id] && C[z.id].guess ? ` <span class="est-inline" style="color:var(--accent-ink);font-family:var(--f-mono);font-size:11px">guess</span>` : ""}</span><span class="n">${Math.round(z.box.x1 - z.box.x0)}×${Math.round(z.box.z1 - z.box.z0)} m</span></button></li>`).join("")}</ul></div>
      <p class="notes">Doors ${doorsIn > 1 ? "1–" + doorsIn : "1"} are shown as inbound and the rest as despatch. That split is a guess. All counts live in <code>js/layout-config.js</code>.</p>`;
    panel.querySelectorAll(".zlist button").forEach(b => b.addEventListener("click", () => setFocus(b.dataset.id)));
    return;
  }
  const z = Z[current], cfg = C[current] || {};
  panel.innerHTML = `<div><div class="kicker"><span class="swatch" style="background:${z.color}"></span>Section</div><h2>${z.name}</h2><p class="blurb">${ZONE_TEXT[current]}</p></div>
    <div><h3>In this section</h3><div class="stats">${z.stats.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div></div>
    ${cfg.guess ? guessNote : ""}
    <p class="notes">Area about ${Math.round(z.box.x1 - z.box.x0)} × ${Math.round(z.box.z1 - z.box.z0)} m. Fill levels are illustrative until live data is connected.</p>
    <button class="btn" id="back-all">Back to view all</button>`;
  panel.querySelector("#back-all").addEventListener("click", () => setFocus("all"));
}
function makeLabels() {
  for (const z of ZONES) {
    const el = document.createElement("div");
    el.className = "zlabel"; el.style.setProperty("--zc", z.color);
    el.innerHTML = z.name + (C[z.id] && C[z.id].guess ? `<span class="g">guess</span>` : "");
    el.addEventListener("click", () => setFocus(z.id));
    labelsEl.appendChild(el); z.label = el;
    z.anchor = new T.Vector3((z.box.x0 + z.box.x1) / 2, 4.5, (z.box.z0 + z.box.z1) / 2);
  }
}
const _v = new T.Vector3();
function placeLabels() {
  if (labelsEl.hidden) return;
  const w = viewport.clientWidth, h = viewport.clientHeight;
  for (const z of ZONES) {
    _v.copy(z.anchor).project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
    z.label.style.display = vis ? "" : "none";
    if (vis) z.label.style.transform = `translate(${(_v.x + 1) / 2 * w}px, ${(1 - _v.y) / 2 * h}px) translate(-50%, -100%)`;
  }
}

function applyTheme() {
  scene.background = new T.Color(css("--scene"));
  greyCol.set(css("--dim"));
  if (shell) { shell.floorMat.color.set(css("--floor")); shell.wallMat.color.set(css("--wall")); }
  if (current) setFocus(current, true);
}
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}

/* ---------- Start ---------- */
renderSections();
requestAnimationFrame(() => {
  shell = build();
  makeLabels();
  resize();
  scene.background = new T.Color(css("--scene")); greyCol.set(css("--dim"));
  const start = location.hash.slice(1);
  setFocus(Z[start] ? start : "all", true);
  document.getElementById("loading").hidden = true;
  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.9);
      const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.t >= 1) tween = null;
    }
    ticks.forEach(f => f(dt));
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
  });
});
new ResizeObserver(() => { resize(); }).observe(viewport);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
document.getElementById("btn-reset").addEventListener("click", () => flyTo(current === "all" ? ALL : Z[current].box));
document.getElementById("btn-labels").addEventListener("click", e => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on)); labelsEl.hidden = !on;
});
addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (e.key === "0") setFocus("all");
  const z = ZONES.find(z => z.key === e.key); if (z) setFocus(z.id);
});
window.ASC_MAP = { setFocus, zones: ZONES, rects, scene, camera, controls };
})();
