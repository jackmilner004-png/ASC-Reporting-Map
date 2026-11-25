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
  label: std("#f4f4f1", { roughness: 0.7 }),
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
  /* Low-poly closed tote for stacks on pallets and rollers (inside is never seen). */
  toteLow(p) {
    const c = { black: "#141618", red: "#c4272f", pink: "#ec72ab" }[p.colour] || "#141618";
    garmentMats["tote" + c] = garmentMats["tote" + c] || std(c, { roughness: 0.5 });
    const m = garmentMats["tote" + c], g = new T.Group();
    g.add(bx(0.58, 0.284, 0.38, m, 0, 0.142, 0));
    g.add(bx(0.624, 0.016, 0.424, m, 0, 0.292, 0));
    for (const s of [-1, 1]) g.add(bx(0.012, 0.035, 0.12, M.black, s * 0.291, 0.24, 0));
    return g;
  },
  /* Low-poly bagged parcel for the layout (the library bag is ~3,000 triangles,
     too heavy for thousands of copies). Same sizes and colours. */
  bagLow(p) {
    const S = { small: [0.35, 0.25, 0.06], medium: [0.45, 0.35, 0.1] }[p.size], [L, W, Hh] = S;
    const geo = new T.BoxGeometry(1, 1, 1, 6, 1, 4), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) * 2, nz = pos.getZ(i) * 2, top = pos.getY(i) > 0;
      const f = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(nx), 4)), 0.55) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(nz), 4)), 0.55);
      pos.setXYZ(i, nx * L / 2, top ? 0.002 + (Hh - 0.002) * f : 0.004 * f, nz * W / 2);
    }
    geo.computeVertexNormals();
    garmentMats["bag" + p.colour] = garmentMats["bag" + p.colour] || std(p.colour === "white" ? "#dfe2e4" : "#5a6167", { roughness: 0.55 });
    const g = new T.Group(); g.add(new T.Mesh(geo, garmentMats["bag" + p.colour]));
    g.add(bx(Math.min(0.15, L * 0.4), 0.002, Math.min(0.1, W * 0.3), M.label, L * 0.08, Hh + 0.001, W * 0.06));
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
    im.userData.tid = t.id.slice(0, 40);
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
  else if (kind === "bagS") put(zone, "bagLow", { size: "small", colour: R() < 0.6 ? "grey" : "white" }, x, y, z, ry);
  else if (kind === "bagM") put(zone, "bagLow", { size: "medium", colour: R() < 0.6 ? "grey" : "white" }, x, y, z, ry);
}
const rot = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); return (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c]; };
/* A UK pallet (1.2 x 1.0) with goods stacked in layers, up to maxH tall. */
function palletLoad(zone, x, y, z, ry, kind, maxH) {
  put(zone, "pallet", { type: "uk" }, x, y, z, ry);
  const at = rot(x, z, ry);
  const grid = { tote: [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]], parcelM: [[-0.305, -0.23], [0.305, -0.23], [-0.305, 0.23], [0.305, 0.23]],
                 parcelS: [[-0.23, -0.19], [0.23, -0.19], [-0.23, 0.19], [0.23, 0.19]], bagM: [[-0.23, -0.19], [0.23, -0.19], [-0.23, 0.19], [0.23, 0.19]], os: [[0, 0]] }[kind];
  const h = H[kind], layers = Math.max(1, Math.floor(maxH / h)), full = Math.max(1, Math.round(layers * (0.45 + R() * 0.55)));
  let top = y + 0.144;
  for (let l = 0; l < full; l++) {
    const n = l === full - 1 ? 1 + Math.floor(R() * grid.length) : grid.length;
    const colour = pick(TOTES);
    for (let i = 0; i < n; i++) {
      const [px, pz] = at(grid[i][0], grid[i][1]), jit = kind === "bagM" ? (R() - 0.5) * 0.3 : 0;
      if (kind === "tote") put(zone, "toteLow", { colour }, px, top, pz, ry);
      else loose(zone, kind, px, top, pz, ry + jit);
    }
    top += h;
  }
}
/* Despatch pallet: exactly `count` totes, 4 per layer (24 = 6 layers, 1.94 m). */
function totePallet(zone, x, z, ry, colour, count) {
  put(zone, "pallet", { type: "uk" }, x, 0, z, ry);
  const at = rot(x, z, ry), grid = [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]];
  for (let i = 0; i < count; i++) {
    const [px, pz] = at(grid[i % 4][0], grid[i % 4][1]);
    put(zone, "toteLow", { colour }, px, 0.144 + Math.floor(i / 4) * 0.3, pz, ry);
  }
  return 0.144 + Math.ceil(count / 4) * 0.3 + 0.01;
}
/* Roll cage with some parcels and bags inside. Gates face +Z rotated by ry. */
function loadedCage(zone, x, z, ry, fill = R()) {
  put(zone, "cage", {}, x, 0, z, ry);
  const at = rot(x, z, ry);
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
  const at = rot(x, z, ry), top = 0.9;
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
/* Garment rail run of `len` metres along X at z, filled in clusters. */
function railRun(zone, x0, len, z, fill) {
  const nSec = Math.ceil(len / 3); len = nSec * 3;
  for (let s = 0; s < nSec; s++) put(zone, "rail", {}, x0 + 1.5 + s * 3, 0, z);
  let on = R() < fill, n = 0;
  for (let x = x0 + 0.15; x < x0 + len - 0.15; x += 0.13) {
    if (R() < 0.06) on = R() < fill;
    if (!on) continue;
    put(zone, "garment", { colour: pick(GARMENT_COLOURS) }, x, 0, z + (R() - 0.5) * 0.03, (R() - 0.5) * 0.12); n++;
  }
  return n;
}

/* Things the pointer can hover: { kind, rec, zone, x, y, z, w, h, d } in building coordinates. */
const hoverables = [];
const DATA = window.ASC_DATA || { inboundCages: [], despatchPallets: [] };

/* =========================================================================
   Layout (Jack's remap, 25 Nov):
     west wall (all bay doors) | middle                      | east
     Inbound (north)           | Hanging processing (north)  | Hanging storage (north)
                               | Conveyor processing         | Manual processing
     Despatch (south)          | Racking storage (south)     |
   Sizes come from the config counts.
   ========================================================================= */
const D = C.bayDoors, CV = C.conveyor, DS = C.despatch, IN = C.inbound, MN = C.manual, HG = C.hanging, ST = C.storage;
const doorsIn = Math.min(D.inbound, D.count), doorsOut = Math.max(0, D.count - doorsIn);

/* Conveyor: induction belt → 180° turn → incline → elevated loop sorter; chutes
   off both straights to pack benches; floor roller takeaway to a palletising comb. */
const perSide = [Math.ceil(CV.chutes / 2), Math.floor(CV.chutes / 2)];
const loopR = 1.3, loopLen = perSide[0] * CV.chuteSpacing + 2;
const chuteRun = 2.4;
const edgeOff = loopR + CV.beltWidth / 2 + 0.06;
const benchOff = edgeOff + chuteRun + 0.5 + 0.4;
const takeOff = benchOff + 0.4 + 1.4 + 0.35;
const turnR = 2.5;
const combW = 3 + CV.combSpurs * 2.0;
const convW = 1 + 2 * turnR + CV.inclineLength + loopR + loopLen + loopR + 2 + combW;

const inLane = 1.25, inSlot = 0.88, inApron = 4.5;            // inbound cage lanes run east from the west wall
const dsLane = 1.5, dsSlot = 1.35, dsApron = 5;               // despatch pallet lanes, same direction
const rackPitch = 4.4;
const margin = 1.5, gapX = 4, gapZ = 3;

const midW0 = Math.max(convW, 20);
const dims = {
  inbound:  { w: inApron + IN.cagesPerLane * inSlot + 1.5, d: Math.max(IN.lanes * inLane + 2, doorsIn * 5.5) },
  despatch: { w: dsApron + DS.palletsPerLine * dsSlot + 1.5, d: Math.max(DS.lines * dsLane + 2, doorsOut * 5.5) },
  hangProc: { w: midW0, d: 3 + HG.rails * 1.8 + 1 },
  conveyor: { w: convW, d: takeOff * 2 + 1.5 },
  storage:  { w: midW0, d: ST.rackRows * rackPitch + 0.5 },
  hangStor: { w: HG.storageRailLength + 4, d: HG.storageRails * 1.1 + 2 },
  manual:   { w: MN.benchesPerRow * 2.5 + 6, d: MN.rows * 3.4 + 3 }
};
const westW = Math.max(dims.inbound.w, dims.despatch.w), midW = midW0, eastW = Math.max(dims.hangStor.w, dims.manual.w);
const BW = margin + westW + gapX + midW + gapX + eastW + margin;
const BD = margin * 2 + Math.max(dims.inbound.d + gapZ + dims.despatch.d,
                                 dims.hangProc.d + dims.conveyor.d + dims.storage.d + gapZ * 2,
                                 dims.hangStor.d + dims.manual.d + gapZ);
const xW = margin, xM = xW + westW + gapX, xE = xM + midW + gapX;
const zN = -BD + margin, zS = -margin;                          // usable north and south edges
const R_ = (x0, w, z0, d) => ({ x0, x1: x0 + w, z0, z1: z0 + d });
const AREAS = {
  inbound:  R_(xW, westW, zN, dims.inbound.d),
  despatch: R_(xW, westW, zS - dims.despatch.d, dims.despatch.d),
  hangProc: R_(xM, midW, zN, dims.hangProc.d),
  storage:  R_(xM, midW, zS - dims.storage.d, dims.storage.d),
  hangStor: R_(xE, eastW, zN, dims.hangStor.d),
  manual:   R_(xE, eastW, zN + dims.hangStor.d + gapZ, zS - (zN + dims.hangStor.d + gapZ))
};
{ // conveyor sits centred between hanging and racking
  const top = AREAS.hangProc.z1 + gapZ, bot = AREAS.storage.z0 - gapZ, d = Math.max(dims.conveyor.d, bot - top);
  AREAS.conveyor = R_(xM, midW, top, d);
}
const rects = {
  inbound: [AREAS.inbound], despatch: [AREAS.despatch], conveyor: [AREAS.conveyor],
  manual: [AREAS.manual], hanging: [AREAS.hangProc, AREAS.hangStor], storage: [AREAS.storage]
};
/* Door centres along the west wall (z), inbound doors first. */
const doorZ = [];
for (let i = 0; i < doorsIn; i++) doorZ.push(AREAS.inbound.z0 + (i + 0.5) * (AREAS.inbound.z1 - AREAS.inbound.z0) / doorsIn);
for (let i = 0; i < doorsOut; i++) doorZ.push(AREAS.despatch.z0 + (i + 0.5) * (AREAS.despatch.z1 - AREAS.despatch.z0) / doorsOut);

function fmtTime(s) { const d = new Date(s); return isNaN(d) ? s : d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

/* ---------- Inbound: roll cages only, lanes running in from the doors ---------- */
function buildInbound() {
  const r = AREAS.inbound, z = "inbound";
  for (let i = 0; i < doorsIn; i++) put(z, "door", { w: D.width, h: D.height, n: i + 1, kind: "in" }, 0, 0, doorZ[i], -PI / 2);
  floorPaint(z, inApron - 1, r.z1 - r.z0 - 0.6, r.x0 + (inApron - 1) / 2, (r.z0 + r.z1) / 2, "#5f8fc0");
  const laneX0 = r.x0 + inApron, laneLen = IN.cagesPerLane * inSlot + 0.3, lz0 = (r.z0 + r.z1) / 2 - IN.lanes * inLane / 2;
  for (let i = 0; i <= IN.lanes; i++) floorPaint(z, laneLen, 0.05, laneX0 + laneLen / 2, lz0 + i * inLane, "#f2b705");
  const cap = IN.lanes * IN.cagesPerLane, cages = DATA.inboundCages.slice(0, cap);
  cages.forEach((rec, i) => {
    const lane = Math.floor(i / IN.cagesPerLane), k = i % IN.cagesPerLane;
    const x = laneX0 + 0.15 + (k + 0.5) * inSlot, zz = lz0 + (lane + 0.5) * inLane;
    loadedCage(z, x, zz, -PI / 2, 0.35 + R() * 0.65);           // gates face the doors
    hoverables.push({ kind: "cage", rec, zone: z, x, y: 0.85, z: zz, w: 0.86, h: 1.72, d: 0.76 });
  });
  return [["Bay doors", doorsIn], ["Cages in", cages.length], ["Cage spaces", cap], ["Lanes", IN.lanes]];
}

/* ---------- Conveyor processing ---------- */
function buildConveyor() {
  const r = AREAS.conveyor, z = "conveyor", zc = (r.z0 + r.z1) / 2, Hs = CV.sorterHeight, Hi = CV.inductHeight, bw = CV.beltWidth;
  const belt = (len, h) => ({ length: Math.round(len * 1000), belt: String(Math.round(bw * 1000)), height: Math.round(h * 1000), running: CV.animateBelts && !reduceMotion ? "on" : "off" });
  const curve = (cx, cz, rad, a0, angle, h) => put(z, "curve", { r: rad, a0, angle, w: bw, h }, cx, 0, cz);
  const x00 = r.x0 + (r.x1 - r.x0 - convW) / 2;
  const xi0 = x00 + 1 + turnR, xi1 = xi0 + CV.inclineLength;
  const lx0 = xi1 + loopR, lx1 = lx0 + loopLen;
  const zSo = zc + loopR, zNo = zc - loopR, zInd = zc - 2 * turnR;      // induction on the north side, nearest inbound
  const indLen = Math.min(CV.inductLength, lx0 - xi0 - 0.5);
  put(z, "conveyor", belt(indLen, Hi), xi0 + indLen / 2, 0, zInd);
  let cages = 0;
  for (let i = 0; i < Math.floor(indLen / 1.6); i++) { loadedCage(z, xi0 + 0.9 + i * 1.6, zInd - 1.5, 0, 0.4 + R() * 0.6); cages++; }
  for (let x = xi0 + 0.6; x < xi0 + indLen - 0.4; x += 1 + R() * 1.6) loose(z, pick(["parcelS", "bagS", "bagM"]), x, Hi, zInd, (R() - 0.5) * 0.4);
  curve(xi0, zc - turnR, turnR, PI / 2, PI, Hi);
  put(z, "incline", { len: CV.inclineLength, h1: Hi, h2: Hs, w: bw }, xi0, 0, zc);
  const nSec = Math.max(1, Math.round(loopLen / CV.sectionLength)), secL = loopLen / nSec;
  for (let i = 0; i < nSec; i++) for (const zz of [zSo, zNo]) put(z, "conveyor", belt(secL, Hs), lx0 + (i + 0.5) * secL, 0, zz);
  curve(lx0, zc, loopR, PI / 2, PI, Hs);
  curve(lx1, zc, loopR, -PI / 2, PI, Hs);
  for (const zz of [zSo, zNo]) for (let x = lx0 + 0.6; x < lx1 - 0.6; x += 1.4 + R() * 2.4) loose(z, pick(["parcelS", "bagS", "bagM", "parcelS"]), x, Hs, zz, (R() - 0.5) * 0.3);
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
  const tx0 = lx0 + 0.3, tx1 = lx1 + loopR + 2, rl = 3;
  const rollerRun = (xa, xb, zz, ry, totes) => {
    const n = Math.max(1, Math.round(Math.abs(xb - xa) / rl)), L = Math.abs(xb - xa) / n;
    for (let i = 0; i < n; i++) {
      const t = xa + Math.sign(xb - xa) * (i + 0.5) * L;
      const [px, pz] = ry ? [zz, t] : [t, zz];
      put(z, "roller", { len: +L.toFixed(3) }, px, 0, pz, ry);
    }
    if (totes) for (let t = Math.min(xa, xb) + 0.5; t < Math.max(xa, xb) - 0.5; t += 0.8 + R() * 2.5) { const [px, pz] = ry ? [zz, t] : [t, zz]; put(z, "toteLow", { colour: pick(TOTES) }, px, 0.75, pz, ry ? 0 : PI / 2); }
  };
  rollerRun(tx0, tx1, zc + takeOff, 0, true);
  rollerRun(tx0, tx1, zc - takeOff, 0, true);
  rollerRun(zc - takeOff + 0.35, zc + takeOff - 0.35, tx1 + 0.35, PI / 2, true);
  const cx0 = tx1 + 0.7, spurLen = 6;
  rollerRun(cx0, cx0 + combW - 1, zc, 0, true);
  let pallets = 0;
  for (let s = 0; s < CV.combSpurs; s++) {
    const sx = cx0 + 0.8 + s * 2.0;
    rollerRun(zc + 0.35, zc + 0.35 + spurLen, sx, PI / 2, true);     // spurs run south, towards despatch side
    for (let k = 0; k < 2; k++) if (R() < 0.8) { palletLoad(z, sx + 1.0, 0, zc + 2 + k * 2.2, PI / 2, "tote", 1.0); pallets++; }
  }
  for (let k = 0; k < CV.combSpurs; k++) if (R() < 0.75) { palletLoad(z, cx0 + 1.0 + k * 2.0, 0, zc - 2.2, 0, "tote", 1.2); pallets++; }
  const loopLength = Math.round(2 * loopLen + 2 * PI * loopR);
  return [["Chutes", chutes], ["Pack benches", benches], ["Sorter loop", loopLength + " m"], ["Sorter height", Hs + " m"], ["Induction cages", cages], ["Tote pallets", pallets]];
}

/* ---------- Despatch: pallets of 24 totes in lanes off the west-wall doors ---------- */
function buildDespatch() {
  const r = AREAS.despatch, z = "despatch";
  for (let i = 0; i < doorsOut; i++) put(z, "door", { w: D.width, h: D.height, n: doorsIn + i + 1, kind: "out" }, 0, 0, doorZ[doorsIn + i], -PI / 2);
  floorPaint(z, dsApron - 1, r.z1 - r.z0 - 0.6, r.x0 + (dsApron - 1) / 2, (r.z0 + r.z1) / 2, "#c2577a");
  const laneX0 = r.x0 + dsApron, laneLen = DS.palletsPerLine * dsSlot + 0.3, lz0 = (r.z0 + r.z1) / 2 - DS.lines * dsLane / 2;
  for (let i = 0; i <= DS.lines; i++) floorPaint(z, laneLen, 0.06, laneX0 + laneLen / 2, lz0 + i * dsLane, "#f2b705");
  floorPaint(z, 0.08, DS.lines * dsLane, laneX0 - 0.02, lz0 + DS.lines * dsLane / 2, "#f2b705");
  const used = new Array(DS.lines).fill(0);
  let shown = 0;
  for (let i = 0; i < DS.lines; i++) {
    const zz = lz0 + (i + 0.5) * dsLane;
    const tex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#f2b705"; g.font = "800 84px Archivo, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(i + 1), w / 2, h / 2 + 4); });
    const lbl = new T.Mesh(new T.PlaneGeometry(1.0, 1.0), std("#ffffff", { map: tex, transparent: true, roughness: 0.8 }));
    lbl.rotation.x = -PI / 2; lbl.rotation.z = -PI / 2; lbl.position.set(laneX0 - 0.65, 0.01, zz); addStatic(z, lbl);
  }
  for (const rec of DATA.despatchPallets) {
    const li = (rec.lane | 0) - 1;
    if (li < 0 || li >= DS.lines || used[li] >= DS.palletsPerLine) continue;
    const k = used[li]++, x = laneX0 + 0.15 + (k + 0.5) * dsSlot, zz = lz0 + (li + 0.5) * dsLane;
    const h = totePallet(z, x, zz, 0, TOTES.includes(rec.toteColour) ? rec.toteColour : "black", Math.min(rec.totes || DS.totesPerPallet, 32));
    hoverables.push({ kind: "pallet", rec, zone: z, x, y: h / 2, z: zz, w: 1.26, h, d: 1.06 });
    shown++;
  }
  const totes = DATA.despatchPallets.reduce((a, p) => a + (p.totes || 0), 0);
  return [["Despatch lines", DS.lines], ["Bay doors", doorsOut], ["Pallets staged", shown], ["Totes staged", totes], ["Pallet spaces", DS.lines * DS.palletsPerLine], ["Totes per pallet", DS.totesPerPallet]];
}

/* ---------- Manual processing ---------- */
function buildManual() {
  const r = AREAS.manual, z = "manual", cx = (r.x0 + r.x1) / 2;
  let benches = 0;
  for (let row = 0; row < MN.rows; row++) {
    const zz = r.z0 + 2 + row * 3.4, ry = row % 2 ? PI : 0;
    for (let c = 0; c < MN.benchesPerRow; c++) { dressedBench(z, cx + (c - (MN.benchesPerRow - 1) / 2) * 2.5, zz, ry, "manual"); benches++; }
    loadedCage(z, r.x0 + 1.2, zz, PI / 2, R());
    palletLoad(z, r.x1 - 1.4, 0, zz, PI / 2, row % 2 ? "os" : "parcelM", 1.0);
  }
  return [["Benches", benches], ["Rows", MN.rows], ["Feed cages", MN.rows], ["Oversize pallets", MN.rows]];
}

/* ---------- Hanging: processing rails along the back wall + dense hanging storage ---------- */
function buildHanging() {
  const z = "hanging", p = AREAS.hangProc, s = AREAS.hangStor;
  const len = Math.floor((p.x1 - p.x0 - 4) / 3) * 3, x0 = p.x0 + (p.x1 - p.x0 - len) / 2;
  let garments = 0;
  for (let i = 0; i < HG.rails; i++) garments += railRun(z, x0, len, p.z0 + 1.2 + i * 1.8, HG.fill);
  for (let b = 0; b < HG.benches; b++) dressedBench(z, p.x0 + 3 + (b + 0.5) * (p.x1 - p.x0 - 6) / HG.benches, p.z1 - 1.1, 0, "hanging");
  const sl = Math.floor(HG.storageRailLength / 3) * 3, sx0 = s.x0 + (s.x1 - s.x0 - sl) / 2;
  let stored = 0;
  for (let i = 0; i < HG.storageRails; i++) stored += railRun(z, sx0, sl, s.z0 + 1 + i * 1.1, HG.storageFill);
  return [["Processing rails", HG.rails], ["Storage rails", HG.storageRails], ["Garments in process", garments], ["Garments stored", stored], ["Benches", HG.benches], ["Rail length", HG.rails * len + HG.storageRails * sl + " m"]];
}

/* ---------- Racking storage along the south wall ---------- */
function buildStorage() {
  const r = AREAS.storage, z = "storage";
  const levels = [0, ...ST.beamLevels], height = ST.beamLevels[ST.beamLevels.length - 1] + 1.4;
  const bays = Math.max(1, Math.floor((r.x1 - r.x0 - 1) / 2.75)), cx = (r.x0 + r.x1) / 2;
  let positions = 0, used = 0;
  for (let row = 0; row < ST.rackRows; row++) {
    const zz = r.z1 - 0.7 - row * rackPitch;
    for (let b = 0; b < bays; b++) {
      const x = cx + (b - (bays - 1) / 2) * 2.75;
      put(z, "rack", { levels: ST.beamLevels, height: +height.toFixed(2) }, x, 0, zz);
      levels.forEach((y, li) => {
        const clear = (li + 1 < levels.length ? levels[li + 1] - 0.15 : y + 1.3) - y - 0.2;
        for (const dx of [-0.66, 0.66]) {
          positions++;
          if (R() > ST.fill) continue;
          used++;
          palletLoad(z, x + dx, y, zz, PI / 2, pick(["parcelM", "parcelM", "tote", "parcelS", "bagM"]), clear);
        }
      });
    }
  }
  return [["Rack rows", ST.rackRows], ["Bays", ST.rackRows * bays], ["Pallet positions", positions], ["Occupied", Math.round(100 * used / positions) + "%"]];
}

const BUILD = { inbound: buildInbound, conveyor: buildConveyor, manual: buildManual, hanging: buildHanging, storage: buildStorage, despatch: buildDespatch };
const ZONE_TEXT = {
  inbound: "All inbound arrives in roll cages through the inbound doors on the west wall. Hover a cage to see where it came from, when it arrived and what is in it.",
  conveyor: `Cages are tipped onto a low induction belt, which turns and climbs an incline to a loop sorter at ${CV.sorterHeight} m. ${CV.chutes} chutes drop from both sides of the loop to ${CV.chutes * CV.benchesPerChute} pack benches. Packed totes leave on floor roller lines to the palletising spurs.`,
  manual: "Benches for returns that cannot go down the conveyor: oversized, damaged or needing a closer check.",
  hanging: "Garment rails along the back wall for hanging processing, with dense hanging storage in the north-east corner.",
  storage: "Pallet racking along the south wall.",
  despatch: `${DS.lines} despatch lanes off the west-wall doors. Each pallet holds ${DS.totesPerPallet} totes. Hover a pallet to see where it is going and what is on it.`
};

/* =========================================================================
   Viewer
   ========================================================================= */
const viewport = document.getElementById("viewport");
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputEncoding = T.sRGBEncoding;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;           // the scene is static: shadows are drawn once
viewport.appendChild(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(38, 1, 0.5, 1000);
const controls = new T.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.1; controls.maxPolarAngle = PI * 0.47; controls.minDistance = 4; controls.maxDistance = 450;
scene.add(new T.HemisphereLight(0xffffff, 0x8a8f94, 0.7));
const sun = new T.DirectionalLight(0xffffff, 0.85);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
scene.add(world);

/* Render only when something changed. */
let dirty = true;
const invalidate = () => { dirty = true; };
controls.addEventListener("change", invalidate);

let hitMesh = null, hoverBox = null;
function build() {
  const stats = {};
  for (const z of ZONES) stats[z.id] = BUILD[z.id]();
  flushInstances();
  const floorTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,0.07)"; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); });
  floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(BW / 6, BD / 6);
  const floorMat = std(css("--floor"), { map: floorTex, roughness: 0.9 });
  const floor = new T.Mesh(new T.PlaneGeometry(BW, BD), floorMat);
  floor.rotation.x = -PI / 2; floor.position.set(BW / 2, 0, -BD / 2); floor.receiveShadow = true; world.add(floor);
  const wallMat = std(css("--wall"), { roughness: 0.9 }), wh = C.site.wallHeight, t = 0.3;
  const wall = (w, h, d, x, y, z) => { const m = bx(w, h, d, wallMat, x, y, z); m.receiveShadow = true; world.add(m); };
  wall(BW + t * 2, wh, t, BW / 2, wh / 2, -BD - t / 2);            // north
  wall(t, wh, BD, BW + t / 2, wh / 2, -BD / 2);                     // east
  wall(BW + t * 2, 1.2, t, BW / 2, 0.6, t / 2);                     // south, cut away so the view can see in
  // west wall with openings at the doors (header above each)
  const gaps = doorZ.map(z => [z - D.width / 2 - 0.3, z + D.width / 2 + 0.3]).sort((a, b) => a[0] - b[0]);
  let z = -BD;
  for (const [a, b] of [...gaps, [t, t]]) {
    if (a > z) wall(t, wh, a - z, -t / 2, wh / 2, (a + z) / 2);
    if (b > a) wall(t, wh - D.height - 0.5, b - a, -t / 2, (wh + D.height + 0.5) / 2, (a + b) / 2);
    z = Math.max(z, b);
  }
  // aisle lines between the three columns
  for (const x of [xM - gapX / 2, xE - gapX / 2]) { const m = new T.Mesh(new T.PlaneGeometry(0.1, BD - 3), M.yellow); m.rotation.x = -PI / 2; m.position.set(x, 0.008, -BD / 2); world.add(m); }
  // zone floor tints and outlines
  for (const zdef of ZONES) {
    zdef.tints = []; zdef.lines = [];
    for (const r of rects[zdef.id]) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const tint = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: zdef.color, transparent: true, opacity: 0.16, depthWrite: false }));
      tint.rotation.x = -PI / 2; tint.position.set(r.x0 + w / 2, 0.004, r.z0 + d / 2); tint.renderOrder = -1; world.add(tint);
      const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([a, b]) => new T.Vector3(a, 0.03, b));
      const line = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: zdef.color, transparent: true, opacity: 0.7 }));
      world.add(line); zdef.tints.push(tint); zdef.lines.push(line);
    }
    zdef.stats = stats[zdef.id];
  }
  world.position.set(-BW / 2, 0, BD / 2);
  for (const zdef of ZONES) {
    const rs = rects[zdef.id];
    zdef.box = { x0: Math.min(...rs.map(r => r.x0)) - BW / 2, x1: Math.max(...rs.map(r => r.x1)) - BW / 2, z0: Math.min(...rs.map(r => r.z0)) + BD / 2, z1: Math.max(...rs.map(r => r.z1)) + BD / 2 };
    const r0 = rs[0]; zdef.anchorAt = [(r0.x0 + r0.x1) / 2 - BW / 2, (r0.z0 + r0.z1) / 2 + BD / 2];
  }
  // hover targets: one invisible box per hoverable item, all in one instanced mesh
  if (hoverables.length) {
    hitMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ visible: false }), hoverables.length);
    const m4 = new T.Matrix4(), q = new T.Quaternion();
    hoverables.forEach((h, i) => hitMesh.setMatrixAt(i, m4.compose(new T.Vector3(h.x, h.y, h.z), q, new T.Vector3(h.w, h.h, h.d))));
    hitMesh.frustumCulled = false; world.add(hitMesh);
    hitMesh.updateMatrixWorld(true);
    hoverBox = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({ color: 0xf2b705, depthTest: false, transparent: true }));
    hoverBox.renderOrder = 10; hoverBox.visible = false; world.add(hoverBox);
  }
  const e = Math.max(BW, BD) * 0.62;
  Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 400 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(-BW * 0.25, 90, BD * 0.6); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
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
  if (instant || reduceMotion) { camera.position.copy(v.pos); controls.target.copy(v.target); controls.update(); invalidate(); return; }
  tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target };
  invalidate();
}

/* ---------- Focus / dimming (colour only, so no shader recompiles) ---------- */
let current = "all", greyCol = new T.Color(), shell;
function setFocus(id, instant) {
  current = id;
  for (const z of ZONES) {
    const dim = id !== "all" && z.id !== id, on = z.id === id;
    for (const r of zoneMats[z.id]) {
      const m = r.mat;
      if (dim) { m.color.copy(r.color).lerp(greyCol, r.map ? 0.65 : 0.8); if (r.emissive) m.emissive.setRGB(0, 0, 0); }
      else { m.color.copy(r.color); if (r.emissive) m.emissive.copy(r.emissive); }
    }
    z.tints.forEach(t => t.material.opacity = dim ? 0.04 : on ? 0.3 : 0.16);
    z.lines.forEach(l => l.material.opacity = dim ? 0.15 : 1);
    z.label.classList.toggle("dim", dim);
  }
  hideTip();
  flyTo(id === "all" ? ALL : Z[id].box, instant);
  document.querySelectorAll("#sections button").forEach(b => { const on = b.dataset.id === id; b.setAttribute("aria-pressed", String(on)); if (on && !instant) b.scrollIntoView({ block: "nearest", inline: "nearest" }); });
  renderPanel();
  try { history.replaceState(null, "", id === "all" ? location.pathname + location.search : "#" + id); } catch (e) {}
  invalidate();
}

/* ---------- UI ---------- */
const sectionsEl = document.getElementById("sections"), panel = document.getElementById("panel"), labelsEl = document.getElementById("labels"), tip = document.getElementById("tip");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function renderSections() {
  const btn = (id, name, color, key) => `<button data-id="${id}" aria-pressed="false" title="Shortcut: ${key}">${color ? `<span class="swatch" style="background:${color}"></span>` : ""}${name}</button>`;
  sectionsEl.innerHTML = btn("all", "View all", null, "0") + ZONES.map(z => btn(z.id, z.name, z.color, z.key)).join("");
  sectionsEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setFocus(b.dataset.id); });
}
function renderPanel() {
  const guessNote = `<p class="guess">Placement is a first guess. Send the floor plan and this zone will be moved to match.</p>`;
  const dataNote = `<p class="notes">Hover data: <b>${esc(DATA.source || "Unknown source")}</b>${DATA.asOf ? `, as of ${esc(fmtTime(DATA.asOf))}` : ""}. It comes from <code>js/sample-data.js</code>.</p>`;
  if (current === "all") {
    const totals = [["Bay doors", D.count], ["Despatch lines", DS.lines], ["Chutes", CV.chutes], ["Pack benches", CV.chutes * CV.benchesPerChute]];
    panel.innerHTML = `<div><div class="kicker">Whole site</div><h2>${esc(C.site.name)}</h2>
      <p class="blurb">Single floor, about ${Math.round(BW)} × ${Math.round(BD)} m. All bay doors are on the west wall, on the left of the view.</p></div>
      <div><h3>Headline counts</h3><div class="stats">${totals.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div></div>
      <div><h3>Sections</h3><ul class="zlist">${ZONES.map(z => `<li><button data-id="${z.id}"><span class="swatch" style="background:${z.color}"></span><span>${z.name}${C[z.id] && C[z.id].guess ? ` <span style="color:var(--accent-ink);font-family:var(--f-mono);font-size:11px">guess</span>` : ""}</span><span class="n">${Math.round(z.box.x1 - z.box.x0)}×${Math.round(z.box.z1 - z.box.z0)} m</span></button></li>`).join("")}</ul></div>
      <p class="notes">Doors ${doorsIn > 1 ? "1–" + doorsIn : "1"} are shown as inbound and the rest as despatch. That split is a guess. All counts live in <code>js/layout-config.js</code>.</p>${dataNote}`;
    panel.querySelectorAll(".zlist button").forEach(b => b.addEventListener("click", () => setFocus(b.dataset.id)));
    return;
  }
  const z = Z[current], cfg = C[current] || {};
  panel.innerHTML = `<div><div class="kicker"><span class="swatch" style="background:${z.color}"></span>Section</div><h2>${z.name}</h2><p class="blurb">${ZONE_TEXT[current]}</p></div>
    <div><h3>In this section</h3><div class="stats">${z.stats.map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div></div>
    ${cfg.guess ? guessNote : ""}
    ${current === "inbound" || current === "despatch" ? dataNote : `<p class="notes">Area about ${Math.round(z.box.x1 - z.box.x0)} × ${Math.round(z.box.z1 - z.box.z0)} m. Fill levels are illustrative until live data is connected.</p>`}
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
    z.anchor = new T.Vector3(z.anchorAt[0], 4.5, z.anchorAt[1]);
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

/* ---------- Hover tooltips ---------- */
const ray = new T.Raycaster(), ndc = new T.Vector2();
let hovered = -1, pinned = false;
function tipHTML(h) {
  const r = h.rec, skus = Array.isArray(r.skus) ? r.skus : [];
  const units = skus.reduce((a, s) => a + (s.qty || 0), 0);
  const rows = h.kind === "cage"
    ? [["From", r.origin], ["Delivered", fmtTime(r.deliveredAt)], ["Trailer", r.trailer], ["Door", r.door != null ? "D" + r.door : null]]
    : [["Lane", r.lane], ["Going to", r.destination], ["Built", fmtTime(r.builtAt)], ["Packed at", r.packedAt], ["Totes", r.totes]];
  const show = skus.slice(0, 8);
  return `<div class="tip-h"><span class="tip-k">${h.kind === "cage" ? "Inbound cage" : "Despatch pallet"}</span><b>${esc(r.id || "No ID")}</b></div>
    <dl>${rows.filter(([, v]) => v != null && v !== "").map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div class="tip-s">${skus.length} SKU${skus.length === 1 ? "" : "s"} · ${units} units</div>
    <table>${show.map(s => `<tr><td class="sku">${esc(s.sku)}</td><td>${esc(s.description || "")}</td><td class="q">×${esc(s.qty)}</td></tr>`).join("")}</table>
    ${skus.length > show.length ? `<div class="tip-more">+ ${skus.length - show.length} more SKUs</div>` : ""}`;
}
function hideTip() { if (hovered < 0 && tip.hidden) return; hovered = -1; pinned = false; tip.hidden = true; if (hoverBox) hoverBox.visible = false; renderer.domElement.style.cursor = ""; invalidate(); }
function pickAt(cx, cy) {
  if (!hitMesh) return -1;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(hitMesh, false);
  for (const hit of hits) { const h = hoverables[hit.instanceId]; if (current === "all" || current === h.zone) return hit.instanceId; }
  return -1;
}
function showTip(i, cx, cy) {
  const h = hoverables[i];
  if (i !== hovered) {
    hovered = i; tip.innerHTML = tipHTML(h); tip.hidden = false;
    hoverBox.position.set(h.x, h.y, h.z); hoverBox.scale.set(h.w + 0.06, h.h + 0.06, h.d + 0.06); hoverBox.visible = true;
    renderer.domElement.style.cursor = "pointer"; invalidate();
  }
  const sr = viewport.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = cx - sr.left + 16, y = cy - sr.top + 16;
  if (x + tw > sr.width - 8) x = cx - sr.left - tw - 16;
  if (y + th > sr.height - 8) y = Math.max(8, sr.height - th - 8);
  tip.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
}
let pending = null;
renderer.domElement.addEventListener("pointermove", e => {
  if (e.pointerType !== "mouse" || e.buttons) return;
  pending = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener("pointerleave", () => { pending = null; if (!pinned) hideTip(); });
let downAt = null;
renderer.domElement.addEventListener("pointerdown", e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const i = pickAt(e.clientX, e.clientY);              // tap / click pins the tooltip (touch screens)
  if (i >= 0) { showTip(i, e.clientX, e.clientY); pinned = true; } else hideTip();
});
controls.addEventListener("start", () => { if (!pinned) hideTip(); });

function applyTheme() {
  scene.background = new T.Color(css("--scene"));
  greyCol.set(css("--dim"));
  if (shell) { shell.floorMat.color.set(css("--floor")); shell.wallMat.color.set(css("--wall")); }
  if (current) setFocus(current, true);
}
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); invalidate();
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
  const animate = CV.animateBelts && !reduceMotion && ticks.length;
  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.9);
      const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.t >= 1) tween = null;
      dirty = true;
    }
    controls.update();                                  // fires "change" while damping settles
    if (pending) { const [x, y] = pending; pending = null; const i = pickAt(x, y); if (i >= 0) showTip(i, x, y); else if (!pinned) hideTip(); }
    if (animate) { ticks.forEach(f => f(dt)); dirty = true; }
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
    placeLabels();
  });
});
new ResizeObserver(() => { resize(); }).observe(viewport);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
document.getElementById("btn-reset").addEventListener("click", () => flyTo(current === "all" ? ALL : Z[current].box));
document.getElementById("btn-labels").addEventListener("click", e => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on)); labelsEl.hidden = !on; invalidate();
});
addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (e.key === "Escape") return hideTip();
  if (e.key === "0") setFocus("all");
  const z = ZONES.find(z => z.key === e.key); if (z) setFocus(z.id);
});
window.ASC_MAP = { setFocus, zones: ZONES, rects, scene, camera, controls, renderer, hoverables, invalidate };
})();
