/* =========================================================================
   DRAFT: outdoor surroundings (yard, trailers on the doors, road, trees).
   Self-contained so it is easy to drop: delete this file, its <script> tag
   and the "Yard" button in index.html, and the map is back to the building
   only. Or set ASC_LAYOUT.site.outdoor = false to start with it hidden.
   Kept low-detail on purpose: flat colours, instanced trees and wheels, and
   no shadows from anything outside the building.
   ========================================================================= */
(() => {
const T = THREE, PI = Math.PI;
function start() {
  const A = window.ASC_MAP, C = window.ASC_LAYOUT;
  const { BW, BD } = A.size, group = new T.Group();
  const lam = c => new T.MeshLambertMaterial({ color: c });
  const M = {
    grass: lam("#58723f"), tarmac: lam("#45494d"), road: lam("#33363a"), paint: lam("#f4f4f0"), yellow: lam("#e9b300"),
    trailer: lam("#c3c8cd"), stripe: lam("#2f5d9e"), chassis: lam("#2b2e31"), wheel: lam("#1b1d1f"),
    cab: lam("#c93a6a"), cab2: lam("#3b7fc4"), glass: lam("#3a4a58"), trunk: lam("#5a4430"), leaf: lam("#2f4a26"), leaf2: lam("#3b5a2f")
  };
  const themed = ["grass", "tarmac", "road", "trailer", "leaf", "leaf2"];
  const base = Object.fromEntries(themed.map(k => [k, M[k].color.clone()]));
  const flat = (w, d, mat, x, z, y = 0) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; group.add(m); return m; };
  const box = (w, h, d, mat, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); group.add(m); return m; };

  // Ground, yard and roads (building coordinates: x 0..BW east, z -BD..0, doors on the west wall)
  const yardW = 48, roadX = -yardW - 9, cx = BW / 2, cz = -BD / 2;
  flat(900, 900, M.grass, cx, cz, -0.05);
  flat(yardW, BD + 30, M.tarmac, -yardW / 2, cz, -0.02);                         // yard off the doors
  flat(BW + 8, 8, M.tarmac, BW / 2, 4, -0.02);                                   // south service road
  flat(BW + 8, 6, M.tarmac, BW / 2, -BD - 3, -0.02);                             // north perimeter
  flat(6, BD + 14, M.tarmac, BW + 3, cz, -0.02);                                 // east perimeter
  flat(10, 900, M.road, roadX, cz, -0.03);                                       // public road
  for (let z = cz - 440; z < cz + 440; z += 9) flat(0.15, 4, M.paint, roadX, z, -0.02);
  flat(18, 8, M.road, roadX + 9, -BD - 8, -0.025);                               // entrance
  flat(0.3, 8, M.yellow, -yardW + 0.5, -BD - 8, -0.015);                         // gate line
  // Trailer bays painted on the yard: one per door, plus a parking row
  for (const z of A.doorZ) for (const s of [-1, 1]) flat(16, 0.12, M.paint, -8.3, z + s * 1.6, -0.01);
  const parkZ = [], parkX = -yardW + 9;
  for (let z = -BD + 6; z < -6; z += 3.6) parkZ.push(z);
  for (const z of parkZ) flat(16, 0.12, M.paint, parkX, z - 1.8, -0.01);

  // Trailers (13.6 m box) and tractor units, instanced by part
  const trailers = [], cabs = [];
  A.doorZ.forEach((z, i) => { if (i !== 2) trailers.push([-0.6 - 6.8, z, 0, i < A.doorsIn]); if (i % 3 === 0) cabs.push([-0.6 - 13.6 - 1.8, z, i % 2]); });
  parkZ.forEach((z, i) => { if ((i * 7) % 5 < 3) trailers.push([parkX, z, 0, false]); });
  const inst = (geo, mat, list, fn) => {
    const im = new T.InstancedMesh(geo, mat, list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(1, 1, 1);
    list.forEach((it, i) => im.setMatrixAt(i, m4.compose(fn(it), q, s)));
    im.frustumCulled = false; group.add(im); return im;
  };
  const V = (x, y, z) => new T.Vector3(x, y, z);
  inst(new T.BoxGeometry(13.6, 2.7, 2.5), M.trailer, trailers, t => V(t[0], 1.25 + 1.35, t[1])).castShadow = false;
  inst(new T.BoxGeometry(13.62, 0.35, 2.52), M.stripe, trailers, t => V(t[0], 3.2, t[1]));
  inst(new T.BoxGeometry(13, 0.3, 1.2), M.chassis, trailers, t => V(t[0], 1.05, t[1]));
  const wheelGeo = new T.CylinderGeometry(0.5, 0.5, 0.35, 10); wheelGeo.rotateX(PI / 2);
  const wheels = [];
  for (const t of trailers) for (const dx of [3.6, 4.9, 6.2]) for (const s of [-1, 1]) wheels.push([t[0] - dx, t[1] + s * 1.05]);
  for (const c of cabs) for (const dx of [-1.2, 1.4]) for (const s of [-1, 1]) wheels.push([c[0] + dx, c[1] + s * 1.05]);
  inst(wheelGeo, M.wheel, wheels, w => V(w[0], 0.5, w[1]));
  [0, 1].forEach(k => {
    const list = cabs.filter(c => c[2] === k);
    if (!list.length) return;
    inst(new T.BoxGeometry(2.4, 2.6, 2.5), k ? M.cab2 : M.cab, list, c => V(c[0] - 0.9, 2.2, c[1]));
    inst(new T.BoxGeometry(0.05, 1.0, 2.1), M.glass, list, c => V(c[0] - 2.13, 2.8, c[1]));
    inst(new T.BoxGeometry(3.6, 0.35, 1.2), M.chassis, list, c => V(c[0], 1.0, c[1]));
  });

  // Trees: low-poly cones on trunks around the site boundary
  const trees = [], R = (() => { let s = 4242; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const ring = (x0, x1, z0, z1, step) => {
    for (let x = x0; x <= x1; x += step) { trees.push([x + R() * 2, z0 + R() * 3]); trees.push([x + R() * 2, z1 - R() * 3]); }
    for (let z = z0 + step; z < z1; z += step) trees.push([x1 + R() * 3, z + R() * 2]);
  };
  ring(roadX + 10, BW + 16, -BD - 22, 16, 7);
  for (let z = -BD - 30; z < 30; z += 8) trees.push([roadX - 9 - R() * 4, z + R() * 3]);
  const trunk = new T.CylinderGeometry(0.18, 0.25, 2.2, 6); trunk.translate(0, 1.1, 0);
  const crown = new T.ConeGeometry(2.0, 5.5, 8); crown.translate(0, 4.6, 0);
  inst(trunk, M.trunk, trees, t => V(t[0], 0, t[1]));
  const half = Math.ceil(trees.length / 2);
  inst(crown, M.leaf, trees.slice(0, half), t => V(t[0], 0, t[1]));
  inst(crown, M.leaf2, trees.slice(half), t => V(t[0], 0, t[1]));

  group.traverse(o => { if (o.isMesh) o.castShadow = false; });
  A.world.add(group);

  // Theme and focus: darker in dark mode; muted while a section is focused
  let focus = A.current(), dark = false;
  const grey = new T.Color("#9aa1a8");
  // Dark mode: deep navy night palette to match the glass UI
  const night = { grass: "#0f1b26", tarmac: "#1b2536", road: "#141c2a", trailer: "#6f7d92", leaf: "#16303a", leaf2: "#1b3a44" };
  const nightC = Object.fromEntries(Object.entries(night).map(([k, v]) => [k, new T.Color(v).convertSRGBToLinear()]));
  function paint() {
    dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    for (const k of themed) {
      M[k].color.copy(dark ? nightC[k] : base[k]);
      if (focus !== "all") M[k].color.lerp(dark ? grey.clone().multiplyScalar(0.25) : grey, 0.35);
    }
    A.invalidate();
  }
  addEventListener("asc-map-focus", e => { focus = e.detail; paint(); });
  addEventListener("asc-map-theme", paint);
  paint();

  // Toggle button
  const btn = document.getElementById("btn-yard");
  // With the yard on, "View all" also takes in the trailers on the doors.
  const x0 = A.all.x0;
  const set = (on, fly) => {
    group.visible = on; btn.setAttribute("aria-pressed", String(on));
    A.all.x0 = on ? x0 - 18 : x0;
    if (A.current() === "all") A.flyTo(A.all, !fly);
    A.invalidate();
  };
  btn.hidden = false;
  btn.addEventListener("click", () => set(btn.getAttribute("aria-pressed") !== "true", true));
  set(C.site.outdoor !== false);
}
if (window.ASC_MAP && window.ASC_MAP.ready) start(); else addEventListener("asc-map-ready", start, { once: true });
})();
