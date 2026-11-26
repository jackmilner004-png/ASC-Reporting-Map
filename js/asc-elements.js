/* ASC element factories, copied from the ASC Element Library (stage 1). Units: metres, origin floor-centre, +Y up. */
(() => {
/* =========================================================================
   ASC element factories
   Units: everything is authored in millimetres and converted to metres
   (1 scene unit = 1 m, matching Blender's default glTF export).
   Origin of every element: floor level, centred on its footprint.
   +X = length / width, +Z = depth (front), +Y = up.
   ========================================================================= */
const V3 = THREE.Vector3;
const mm = v => v / 1000;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o));
}
function shade(m) { m.castShadow = true; m.receiveShadow = true; return m; }
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(mm(w), mm(h), mm(d)), mat);
  m.position.set(mm(x), mm(y), mm(z));
  return shade(m);
}
function cyl(r, len, mat, axis, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(mm(r), mm(r), mm(len), seg), mat);
  if (axis === "x") m.rotation.z = Math.PI / 2;
  if (axis === "z") m.rotation.x = Math.PI / 2;
  m.position.set(mm(x), mm(y), mm(z));
  return shade(m);
}
function canvasTex(w, h, draw, color = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ---------- shared textures ---------- */
const TEX = {
  mesh: canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = "#fff";
    g.fillRect(0, 0, w, 5); g.fillRect(0, 0, 5, h);
  }),
  wood: canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = "#d2ad7c"; g.fillRect(0, 0, w, h);
    const r = rand(7);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(110,70,30,${0.06 + r() * 0.12})`; g.lineWidth = 1 + r() * 2;
      const y = r() * h; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 30 + i) * 2);
      g.stroke();
    }
  }),
  card: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#b8895a"; g.fillRect(0, 0, w, h);
    const r = rand(3);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,240,210" : "80,50,20"},${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
    for (let y = 0; y < h; y += 6) { g.fillStyle = "rgba(90,60,30,0.035)"; g.fillRect(0, y, w, 2); }
  }),
  belt: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#2a2d30"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#3b3f43";
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 3, h);
    g.fillStyle = "#f2b705"; g.fillRect(0, 0, 6, h);       // one marker stripe per tile shows belt travel
  })
};
TEX.card.wrapS = TEX.card.wrapT = THREE.RepeatWrapping;

function meshPanel(w, h, pitch, mat) {
  const t = TEX.mesh.clone(); t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / pitch, h / pitch);
  const m = mat.clone(); m.map = t; m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(mm(w), mm(h)), m);
  p.receiveShadow = true;
  return p;
}

/* ---------- 1. Roll cage ---------- */
function makeCage(p) {
  const W = 720, D = 820, H = 1700, castorH = 125, deckT = 40, tube = 25, pitch = 75;
  const g = new THREE.Group();
  const steel = std("#9aa3aa", { metalness: 0.75, roughness: 0.35 });
  const meshMat = std("#aab2b8", { metalness: 0.7, roughness: 0.4 });
  const rubber = std("#26292c", { roughness: 0.85 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(50, 32, rubber, "x", sx * (W / 2 - 70), 50, sz * (D / 2 - 70)));
    g.add(box(46, 55, 50, steel, sx * (W / 2 - 70), 97, sz * (D / 2 - 70)));
  }
  g.add(box(W, deckT, D, steel, 0, castorH + deckT / 2, 0));
  const y0 = castorH + deckT, ph = H - y0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    g.add(box(tube, ph, tube, steel, sx * (W / 2 - tube / 2), y0 + ph / 2, sz * (D / 2 - tube / 2)));
  for (const sx of [-1, 1]) {
    g.add(box(tube, tube, D, steel, sx * (W / 2 - tube / 2), H - tube / 2, 0));
    g.add(box(tube * 0.7, tube * 0.7, D, steel, sx * (W / 2 - tube / 2), y0 + ph / 2, 0));
    const side = meshPanel(D - tube * 2, ph - tube, pitch, meshMat);
    side.rotation.y = Math.PI / 2; side.position.set(mm(sx * (W / 2 - tube / 2)), mm(y0 + ph / 2), 0);
    g.add(side);
  }
  g.add(box(W, tube, tube, steel, 0, H - tube / 2, -(D / 2 - tube / 2)));
  const back = meshPanel(W - tube * 2, ph - tube, pitch, meshMat);
  back.position.set(0, mm(y0 + ph / 2), mm(-(D / 2 - tube / 2))); g.add(back);
  // Two front half-gates, hinged on the corner posts
  const gw = W / 2 - tube - 4, gh = ph - 60, theta = p.gates === "open" ? 1.75 : 0;
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(mm(sx * (W / 2 - tube)), mm(y0 + 30), mm(D / 2 - tube / 2));
    const dir = -sx;               // gate extends toward the centre
    const gate = new THREE.Group();
    gate.add(box(gw, 18, 18, steel, dir * gw / 2, gh - 9, 0));
    gate.add(box(gw, 18, 18, steel, dir * gw / 2, 9, 0));
    gate.add(box(18, gh, 18, steel, dir * (gw - 9), gh / 2, 0));
    const mp = meshPanel(gw - 18, gh - 36, pitch, meshMat);
    mp.position.set(mm(dir * (gw - 18) / 2), mm(gh / 2), 0); gate.add(mp);
    gate.add(box(14, 60, 30, steel, dir * (gw - 9), gh * 0.55, 18));   // latch
    hinge.add(gate);
    hinge.rotation.y = sx < 0 ? -theta : theta;
    g.add(hinge);
  }
  return g;
}

/* ---------- 2. Pallet ---------- */
const PALLETS = { uk: { L: 1200, W: 1000, n: 7, name: "UK standard" }, euro: { L: 1200, W: 800, n: 5, name: "Euro (EUR1)" } };
function makePallet(p) {
  const { L, W, n } = PALLETS[p.type];
  const g = new THREE.Group();
  const woods = ["#d6b080", "#cba272", "#dcb98c", "#c79c6b"].map(c => std(c, { map: TEX.wood, roughness: 0.85 }));
  const pick = i => woods[i % woods.length];
  const bt = 22, bh = 78;
  const zs = [-(W / 2 - 50), 0, W / 2 - 50], xs = [-(L / 2 - 72), 0, L / 2 - 72];
  zs.forEach((z, i) => g.add(box(L, bt, 100, pick(i), 0, bt / 2, z)));                            // bottom runners
  xs.forEach((x, i) => zs.forEach((z, j) => g.add(box(i === 1 ? 100 : 145, bh, j === 1 ? 145 : 100, pick(i + j + 1), x, bt + bh / 2, z)))); // blocks
  xs.forEach((x, i) => g.add(box(i === 1 ? 100 : 145, bt, W, pick(i + 2), x, bt + bh + bt / 2, 0))); // stringer boards
  const bw = 100, gap = (W - n * bw) / (n - 1);
  for (let i = 0; i < n; i++) g.add(box(L, bt, bw, pick(i + 3), 0, bt * 2 + bh + bt / 2, -W / 2 + bw / 2 + i * (bw + gap)));  // top deck
  return g;
}

/* ---------- 3. Tote box ---------- */
const TOTE_COLOURS = { black: "#141618", red: "#c4272f", pink: "#ec72ab" };
function makeTote(p) {
  const L = 600, Wd = 400, H = 300, t = 6;
  const g = new THREE.Group();
  const mat = std(TOTE_COLOURS[p.colour], { roughness: 0.5 });
  g.add(box(L, t, Wd, mat, 0, t / 2, 0));
  for (const sz of [-1, 1]) {
    g.add(box(L, H, t, mat, 0, H / 2, sz * (Wd / 2 - t / 2)));
    for (let i = -2; i <= 2; i++) g.add(box(12, H - 50, 8, mat, i * 115, (H - 50) / 2 + 12, sz * (Wd / 2 + 4)));
    g.add(box(L + 24, 16, 12, mat, 0, H - 8, sz * (Wd / 2 + 6)));
  }
  // End walls with rounded handle cut-outs
  const shape = new THREE.Shape();
  shape.moveTo(-Wd / 2, 0); shape.lineTo(Wd / 2, 0); shape.lineTo(Wd / 2, H); shape.lineTo(-Wd / 2, H); shape.closePath();
  const hw = 120, hr = 17, yc = H - 52, hole = new THREE.Path();
  hole.moveTo(-hw / 2 + hr, yc - hr); hole.lineTo(hw / 2 - hr, yc - hr);
  hole.absarc(hw / 2 - hr, yc, hr, -Math.PI / 2, Math.PI / 2, false);
  hole.lineTo(-hw / 2 + hr, yc + hr);
  hole.absarc(-hw / 2 + hr, yc, hr, Math.PI / 2, Math.PI * 1.5, false);
  shape.holes.push(hole);
  for (const sx of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -t / 2); geo.rotateY(Math.PI / 2); geo.scale(0.001, 0.001, 0.001);
    const m = shade(new THREE.Mesh(geo, mat)); m.position.x = mm(sx * (L / 2 - t / 2)); g.add(m);
    g.add(box(12, 16, Wd + 24, mat, sx * (L / 2 + 6), H - 8, 0));
  }
  if (p.lid === "closed") {
    for (const sz of [-1, 1]) g.add(box(L + 20, 8, Wd / 2 + 10, mat, 0, H + 4, sz * (Wd / 4 + 5)));
  }
  return g;
}

/* ---------- 4. Returns parcel ---------- */
const PARCELS = {
  small:     { L: 450,  W: 350, H: 160, code: "S",  est: false },
  medium:    { L: 610,  W: 460, H: 460, code: "M",  est: false },
  oversized: { L: 1000, W: 600, H: 600, code: "OS", est: true }
};
function labelTex(code) {
  return canvasTex(300, 200, (g, w, h) => {
    g.fillStyle = "#fbfbf8"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#16181b"; g.font = "800 42px Archivo, Arial, sans-serif"; g.fillText("RETURN", 16, 52);
    g.fillStyle = "#16181b"; g.fillRect(w - 86, 14, 70, 48);
    g.fillStyle = "#fbfbf8"; g.font = "800 34px Archivo, Arial, sans-serif"; g.textAlign = "center"; g.fillText(code, w - 51, 51);
    g.textAlign = "left"; g.fillStyle = "#16181b"; g.font = "500 15px ui-monospace, monospace"; g.fillText("ASC · RTN-0000-" + code, 16, 84);
    const r = rand(code.length * 31);
    let x = 16; while (x < w - 16) { const bw = 1 + Math.floor(r() * 4); if (r() > 0.4) g.fillRect(x, 104, bw, 72); x += bw + 1; }
  });
}
function makeParcel(p) {
  const { L, W, H, code } = PARCELS[p.size];
  const g = new THREE.Group();
  const t = TEX.card.clone(); t.needsUpdate = true; t.repeat.set(L / 400, H / 400);
  const card = std("#ffffff", { map: t, roughness: 0.9 });
  g.add(box(L, H, W, card, 0, H / 2, 0));
  const tape = std("#c9a56a", { roughness: 0.35 });
  g.add(box(L + 2, 1.5, 50, tape, 0, H + 0.75, 0));
  for (const sx of [-1, 1]) g.add(box(1.5, Math.min(120, H * 0.6), 50, tape, sx * (L / 2 + 0.75), H - Math.min(120, H * 0.6) / 2, 0));
  const lw = Math.min(150, L * 0.34), lh = lw * 0.66;
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(mm(lw), mm(lh)), std("#ffffff", { map: labelTex(code), roughness: 0.7 }));
  lbl.rotation.x = -Math.PI / 2; lbl.position.set(mm(-L / 2 + lw / 2 + 25), mm(H + 1.6), mm(W / 2 - lh / 2 - 20));
  lbl.receiveShadow = true; g.add(lbl);
  return g;
}

/* ---------- 4b. Bagged returns parcel (poly mailer) ---------- */
const BAGS = {
  small:  { L: 350, W: 250, H: 60,  code: "BS" },
  medium: { L: 450, W: 350, H: 100, code: "BM" }
};
function makeBag(p) {
  const { L, W, H, code } = BAGS[p.size];
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1, 32, 2, 24), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) * 2, nz = pos.getZ(i) * 2, top = pos.getY(i) > 0;
    // pillow shape: flat plateau in the middle, thinning to a sealed seam at the edges
    const f = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(nx), 4)), 0.55) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(nz), 4)), 0.55);
    const shrink = 1 - 0.03 * f;   // fabric pulls in slightly where the bag is fullest
    pos.setXYZ(i, mm(nx * L / 2 * shrink), top ? mm(2 + (H - 2) * f) : mm(f * 4), mm(nz * W / 2 * shrink));
  }
  geo.computeVertexNormals();
  const poly = std(p.colour === "white" ? "#dfe2e4" : "#5a6167", { roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide });
  g.add(shade(new THREE.Mesh(geo, poly)));
  // peel-and-seal flap across one end
  const flap = std(p.colour === "white" ? "#cfd3d6" : "#4c5258", { roughness: 0.35 });
  g.add(box(L * 0.96, 2, 45, flap, 0, 2 + (H - 2) * 0.35, -(W / 2 - 30)));
  const lw = Math.min(150, L * 0.4), lh = lw * 0.66;
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(mm(lw), mm(lh)), std("#ffffff", { map: labelTex(code), roughness: 0.7 }));
  lbl.rotation.x = -Math.PI / 2; lbl.position.set(mm(L * 0.08), mm(H + 1.5), mm(W * 0.06));
  lbl.receiveShadow = true; g.add(lbl);
  return g;
}

/* ---------- 5. Conveyor section ---------- */
function makeConveyor(p) {
  const L = +p.length, W = +p.belt, H = +p.height;
  const g = new THREE.Group();
  const frame = std("#5f6a73", { metalness: 0.5, roughness: 0.45 });
  const leg = std("#4b545b", { metalness: 0.5, roughness: 0.5 });
  const drum = std("#30353a", { metalness: 0.6, roughness: 0.4 });
  const guard = std("#f2b705", { roughness: 0.5 });
  const bt = TEX.belt.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
  const tile = 250; bt.repeat.set(L / tile, 1);
  const beltTop = std("#ffffff", { map: bt, roughness: 0.8 });
  const beltSide = std("#2a2d30", { roughness: 0.8 });
  const belt = shade(new THREE.Mesh(new THREE.BoxGeometry(mm(L), mm(12), mm(W)), [beltSide, beltSide, beltTop, beltSide, beltSide, beltSide]));
  belt.position.y = mm(H - 6); g.add(belt);
  for (const sx of [-1, 1]) g.add(cyl(60, W, drum, "z", sx * L / 2, H - 60, 0));
  for (const sz of [-1, 1]) {
    g.add(box(L, 130, 40, frame, 0, H - 55, sz * (W / 2 + 20)));
    g.add(box(L, 40, 8, guard, 0, H + 55, sz * (W / 2 + 4)));
    for (let x = -L / 2 + 150; x <= L / 2 - 150 + 1; x += Math.max(300, (L - 300) / Math.max(1, Math.round((L - 300) / 1000)))) {
      g.add(box(20, 45, 20, frame, x, H + 25, sz * (W / 2 + 20)));
    }
  }
  const nLegs = Math.max(2, Math.ceil(L / 1500) + 1);
  for (let i = 0; i < nLegs; i++) {
    const x = -L / 2 + 120 + i * (L - 240) / (nLegs - 1);
    for (const sz of [-1, 1]) {
      g.add(box(50, H - 120, 50, leg, x, (H - 120) / 2, sz * (W / 2 + 20)));
      g.add(box(90, 10, 90, drum, x, 5, sz * (W / 2 + 20)));
    }
    g.add(box(40, 40, W + 40, leg, x, 260, 0));
  }
  const speed = 0.5; // m/s, guess
  g.userData.tick = dt => { if (p.running === "on") bt.offset.x -= (speed * dt) / mm(tile); };
  return g;
}

/* =========================================================================
   Element definitions. dims rows: [label, mm, estimated?, note]
   ========================================================================= */
const DEFS = {
  cage: {
    name: "Roll cage", blurb: "Mesh roll container on four castors, three fixed sides and two front half-gates.",
    params: [{ id: "gates", label: "Front gates", type: "seg", options: [["closed", "Closed"], ["open", "Open"]], def: "closed", keepView: true }],
    dims: () => [["Width", 720, true], ["Depth", 820, true], ["Height", 1700, true]],
    notes: "All sizes are estimates for a standard mail roll container. Mesh pitch (75 mm) and castor size are approximate. Send measured sizes or a Blender model and they replace these.",
    make: makeCage
  },
  pallet: {
    name: "Pallet", blurb: "Block pallet with three bottom runners and a slatted top deck.",
    params: [{ id: "type", label: "Pallet type", type: "seg", options: [["uk", "UK 1200 × 1000"], ["euro", "Euro 1200 × 800"]], def: "uk" }],
    dims: p => [["Length", PALLETS[p.type].L, false], ["Width", PALLETS[p.type].W, false], ["Height", 144, false]],
    notes: "Footprints are the published UK and Euro standards. Board count and block sizes are typical, not measured.",
    make: makePallet
  },
  tote: {
    name: "Tote box", blurb: "Stacking plastic tote with ribbed sides and handle cut-outs at each end.",
    params: [
      { id: "colour", label: "Colour", type: "seg", options: [["black", "Black"], ["red", "Red"], ["pink", "Pink"]], def: "black", keepView: true, swatch: TOTE_COLOURS },
      { id: "lid", label: "Lid", type: "seg", options: [["open", "Open"], ["closed", "Closed"]], def: "open", keepView: true }
    ],
    dims: () => [["Length", 600, true], ["Width", 400, true], ["Height", 300, true]],
    notes: "600 × 400 × 300 mm is a common stacking tote size, used as a stand-in until you confirm the totes on site. Colours are placeholders for your black, red and pink totes.",
    make: makeTote
  },
  parcel: {
    name: "Returns parcel", blurb: "Taped cardboard parcel with a returns label on top, in three size bands.",
    params: [{ id: "size", label: "Size", type: "seg", options: [["small", "Small"], ["medium", "Medium"], ["oversized", "Oversized"]], def: "small" }],
    dims: p => { const s = PARCELS[p.size]; return [["Length", s.L, s.est], ["Width", s.W, s.est], ["Height", s.H, s.est]]; },
    notes: "Small and medium are modelled at the top of the Royal Mail small (45 × 35 × 16 cm) and medium (61 × 46 × 46 cm) parcel bands. Oversized is a placeholder until you confirm the cut-off you use for returns.",
    make: makeParcel
  },
  bag: {
    name: "Bagged parcel", blurb: "Returns item in a sealed poly mailer bag, with a returns label on top.",
    params: [
      { id: "size", label: "Size", type: "seg", options: [["small", "Small"], ["medium", "Medium"]], def: "small" },
      { id: "colour", label: "Bag colour", type: "seg", options: [["grey", "Grey"], ["white", "White"]], def: "grey", keepView: true, swatch: { grey: "#5a6167", white: "#dfe2e4" } }
    ],
    dims: p => { const s = BAGS[p.size]; return [["Length", s.L, true], ["Width", s.W, true], ["Filled height", s.H, true]]; },
    notes: "Bag sizes are estimates for typical small and medium poly mailers when filled. Height is the puff at the middle of the bag. Send the bag sizes you use and these will be updated.",
    make: makeBag
  },
  conveyor: {
    name: "Conveyor section", blurb: "Straight belt conveyor on legs, with side guards. Sections chain end to end.",
    params: [
      { id: "length", label: "Length", type: "range", min: 1000, max: 8000, step: 250, def: 3000, unit: "mm" },
      { id: "belt", label: "Belt width", type: "seg", options: [["450", "450"], ["600", "600"], ["800", "800 mm"]], def: "600" },
      { id: "height", label: "Belt height", type: "range", min: 500, max: 1200, step: 25, def: 800, unit: "mm" },
      { id: "running", label: "Belt", type: "seg", options: [["on", "Running"], ["off", "Stopped"]], def: reduceMotion ? "off" : "on", keepView: true }
    ],
    dims: p => [["Length", +p.length, false, "set"], ["Overall width", +p.belt + 80, false, "set"], ["Belt height", +p.height, false, "set"]],
    notes: "A simple straight section to start. Belt speed is shown at 0.5 m/s. When you send floor plans, the 24 chutes and 48 pack benches will attach to its sides in the layout stage.",
    make: makeConveyor
  }
};
const ORDER = ["cage", "pallet", "tote", "parcel", "bag", "conveyor"];

/* Blender overrides: element key -> THREE.Object3D (normalised to floor/centre) */
const overrides = {};

function defaults(key) { const o = {}; DEFS[key].params.forEach(p => o[p.id] = p.def); return o; }
function make(key, params = {}) {
  const p = Object.assign(defaults(key), params);
  const obj = overrides[key] ? overrides[key].clone(true) : DEFS[key].make(p);
  obj.userData.element = key; obj.userData.params = p;
  return obj;
}
function setOverride(key, object3d) {
  if (!object3d) { delete overrides[key]; return; }
  object3d.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(object3d), c = b.getCenter(new V3());
  const wrap = new THREE.Group(); object3d.position.sub(new V3(c.x, b.min.y, c.z)); wrap.add(object3d);
  wrap.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  overrides[key] = wrap;
}
/* Public API for the layout stage, e.g. ASC.make('tote', { colour: 'pink' }) */
window.ASC = { make, defs: DEFS, setOverride, overrides, THREE };
})();
