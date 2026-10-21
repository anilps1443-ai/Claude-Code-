/**
 * Van pack: a panel van with its traction pack beside it, out of the floor and
 * in an open tray of six modules. The module under the pointer lifts clear of
 * the tray and its neighbours rise less the farther they are, staggered
 * outwards on the 700ms lift curve. Module numbers are dots on each lid. The
 * slider is the stagger, in ms.
 *
 * The pattern: discrete items, as Riffle. The hit test unprojects the pointer
 * onto the modules' resting lids, so a lifted module cannot flip the choice.
 */
const {
  Cam, clamp, facing, fillet, fit, hull, open, poly, proj, ringAt, rings, rrect, run, seg, unproj,
  tdone, tset, tval, tween, disposer, mk, place, pointer, register,
} = HL;

// Van: x along its length (front at +x), y across it, z up. Pack: x from PX0 to PX1.
const VL = 100, VW = 20, BELT = 30, ROOF = 56, SILL = 7, AX = [19, 80], WR = 9, TT = 5;
const PX0 = -90, PX1 = -36, PY0 = -19, PY1 = 19, TH = 8, TR = 5, TW = 2;
const N = 6, PITCH = (PX1 - PX0 - 2 * TW - 2) / N, MX0 = PX0 + TW + 1, LID = 10, LIFT = 28, NEAR1 = 15, NEAR2 = 6, REST = 2;

/** Run of points ordered left to right on screen. */
const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());

/** A solid whose top ring is smaller than its foot: silhouette and one crease (rule 09). */
function taper(P, front, foot, top, inner, z0, z1) {
  return { sil: poly(hull(ringAt(P, foot, z0).concat(ringAt(P, top, z1)))), crease: open(ringAt(P, run(inner, front), z1)) };
}

/** A wheel on the axle at x: the hull of its two faces, and the hub ring on the face toward y = side. */
function wheel(P, x, side) {
  const ring = (y, r) => Array.from({ length: 24 }, (_, k) => P(x + r * Math.cos((k / 24) * 2 * Math.PI), y, WR + r * Math.sin((k / 24) * 2 * Math.PI)));
  const out = side * (VW + 0.6), inn = side * (VW + 0.6 - TT);
  return { tyre: poly(hull(ring(out, WR).concat(ring(inn, WR)))), hub: poly(ring(out, WR * 0.52)) + poly(ring(out, WR * 0.2)) };
}

/** The van, back to front: far wheels, lower body, cab and cargo box, the lines on its faces, near wheels. */
function van(P, front, g) {
  const add = (d, cls) => mk("path", { d, class: cls }, g);
  for (const x of AX) add(wheel(P, x, -1).tyre, "sil");
  const lower = taper(P, front, rrect(0, -VW, VL, VW, 5, 4), rrect(0, -VW, VL - 5, VW, 5, 4), rrect(1.4, -VW + 1.4, VL - 6.4, VW - 1.4, 3.6, 4), SILL, BELT);
  add(lower.sil, "sil"); add(lower.crease, "nf lo");
  const upper = taper(P, front, rrect(0, -VW, 76, VW, 4, 4), rrect(0, -VW + 1, 62, VW - 1, 4, 4), rrect(1.4, -VW + 2.4, 60.6, VW - 2.4, 2.6, 4), BELT, ROOF);
  add(upper.sil, "sil"); add(upper.crease, "nf lo");
  // Faces: the near side leans in by one unit over the cab; the screen and nose lean back.
  const ys = (z) => VW - Math.max(0, z - BELT) / (ROOF - BELT);
  const xs = (z) => 76 - (14 * (z - BELT)) / (ROOF - BELT);
  const side = (pts, r) => poly(fillet(pts, pts.map(() => r)).map(([x, z]) => P(x, ys(z), z)));
  add(side([[17, SILL + 2], [48, SILL + 2], [48, ROOF - 3], [17, ROOF - 3]], 2) + side([[52, SILL + 2], [73, SILL + 2], [xs(BELT) - 2.5, BELT], [xs(ROOF - 4) - 2, ROOF - 4], [52, ROOF - 4]], 1.6), "nf lo");
  add(side([[54.5, BELT + 4], [xs(BELT + 4) - 5, BELT + 4], [xs(ROOF - 7) - 4.5, ROOF - 7], [54.5, ROOF - 7]], 1.4), "nf");
  add(side([[84, 19], [91, 19], [91, 25], [84, 25]], 1.2) + seg(P(5, VW, 22), P(82, VW, 22)), "nf lo");
  const screen = [[BELT + 3, -1], [BELT + 3, 1], [ROOF - 3, 1], [ROOF - 3, -1]].map(([z, s]) => [xs(z), s * (ys(z) - 3.2), z]);
  add(poly(fillet(screen.map(([x, y, z]) => [y, z]), [1.5, 1.5, 1.5, 1.5]).map(([y, z]) => P(xs(z), y, z))), "nf");
  const nose = (z) => VL - (5 * (z - SILL)) / (BELT - SILL);
  const onNose = (y0, z0, y1, z1) => poly(rrect(y0, z0, y1, z1, 1.2, 3).map((q) => P(nose(q.v), q.u, q.v)));
  add(onNose(-17, 21, -11, 26) + onNose(11, 21, 17, 26) + onNose(-8, 12, 8, 16), "nf lo");
  for (const x of AX) { const w = wheel(P, x, 1); add(w.tyre, "sil"); add(w.hub, "nf lo"); }
}

/** The tray, which never moves: `far` before the modules, `near` after them (Riffle's construction). */
function tray(P, front, outer, inner) {
  const far = [[poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, TH)))), "sil"], [poly(ringAt(P, inner, TH)), "nf"], [open(ringAt(P, run(inner, (q) => !front(q)), 2)), "nf lo"]];
  const iF = LR(ringAt(P, run(inner, front), TH)), oT = LR(ringAt(P, run(outer, front), TH)), oB = LR(ringAt(P, run(outer, front), 0));
  const near = [[poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"], [open(oT), "nf lo"], [open(iF), "nf"], [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"]];
  return { far, near };
}

/** Module i's footprint, lid lines and dot positions, lifted by z. */
function module(P, front, i, z) {
  const x0 = MX0 + i * PITCH, x1 = x0 + PITCH - 1.2, y0 = PY0 + TW + 1, y1 = PY1 - TW - 1;
  const [ring, inner] = rings(x0, y0, x1, y1, 1.2, 0.7);
  const sil = poly(hull(ringAt(P, ring, 1 + z).concat(ringAt(P, ring, LID + z))));
  const crease = open(ringAt(P, run(inner, front), LID + z));
  const cells = [-8, 0, 8].map((y) => seg(P(x0 + 0.7, y, LID + z), P(x1 - 0.7, y, LID + z))).join("");
  const dots = Array.from({ length: i + 1 }, (_, k) => P((x0 + x1) / 2, y1 - 2.6 - k * 2.2, LID + z));
  return { sil, crease, cells, dots };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // Fitted to the van, the tray and a module at full lift, so nothing leaves the frame.
  const C = Cam(45, 0.5, 1.75);
  fit(C, [[PX0, PY0, 0], [PX1, PY1, 0], [PX0, PY1, 0], [VL, VW, 0], [VL, -VW, 0], [0, -VW, ROOF], [62, VW, ROOF], [MX0, PY0, LID + LIFT]], 200, 166);
  const P = proj(C), front = facing(C);
  const outer = rrect(PX0, PY0, PX1, PY1, TR, 6), inner = rrect(PX0 + TW, PY0 + TW, PX1 - TW, PY1 - TW, TR - TW, 6);
  const paths = tray(P, front, outer, inner);

  const g = mk("g", {}, svg);
  for (const [d, cls] of paths.far) mk("path", { d, class: cls }, g);
  const mods = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g);
    const sil = mk("path", { class: "sil" }, grp), cr = mk("path", { class: "nf lo" }, grp), cells = mk("path", { class: "nf lo" }, grp);
    const dots = Array.from({ length: i + 1 }, () => mk("circle", { r: 0.95, class: "dot off" }, grp));
    mods.push({ sil, cr, cells, dots, z: tween(0), last: NaN });
  }
  for (const [d, cls] of paths.near) mk("path", { d, class: cls }, g);
  van(P, front, mk("g", {}, svg));

  function draw(i, z) {
    const m = mods[i];
    if (z === m.last) return;
    m.last = z;
    const q = module(P, front, i, z);
    m.sil.setAttribute("d", q.sil); m.cr.setAttribute("d", q.crease); m.cells.setAttribute("d", q.cells);
    m.dots.forEach((el, k) => place(el, q.dots[k]));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    mods.forEach((m, i) => { draw(i, tval(m.z, now)); if (!tdone(m.z, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  /** Rule 01: the pointer is put on the plane of the resting lids, which never moves. */
  function hit([sx, sy]) {
    const [x, y] = unproj(C, sx, sy, LID);
    if (y < PY0 - 4 || y > PY1 + 4 || x < MX0 - 1 || x > MX0 + N * PITCH) return -1;
    return clamp(Math.floor((x - MX0) / PITCH), 0, N - 1);
  }

  let act = null;
  /** Lifts module a (-1 for rest, which half-lifts module REST). The stagger spreads from the module lifted, or let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act === null || act < 0 ? REST : act;
    const top = a >= 0 ? a : REST, peak = a >= 0 ? LIFT : LIFT / 2;
    act = a;
    mods.forEach((m, i) => {
      const d = Math.abs(i - top), z = d === 0 ? peak : a < 0 ? 0 : d === 1 ? NEAR1 : d === 2 ? NEAR2 : 0;
      tset(m.z, z, now, Math.abs(i - from) * stag);
      m.sil.classList.toggle("hi", i === top);
      m.dots.forEach((el) => el.classList.toggle("off", i !== top));
      m.dots.forEach((el) => el.classList.toggle("m", i === top));
    });
    read.textContent = a < 0 ? "rest" : "module " + (a + 1);
    B.wake();
  }

  setActive(-1);
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "van-pack",
  means: "A panel van beside its battery pack: the module under the pointer lifts out, and its neighbours rise less with distance.",
  rules: [1, 2, 5, 9],
  range: [0, 45, 90],
  tour: [[90, 124], [120, 139], [140, 149], null],
  mount,
});
