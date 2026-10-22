/**
 * Swap Pack: an EV battery tray holding six cell modules, each with two
 * terminal studs and its number as a dot code along its lid. At rest module 04
 * is half out, mid-swap. The module under the pointer lifts clear of the tray
 * for inspection; its neighbours rise a little, less the farther they are,
 * staggered outwards from it. The slider is the stagger, in ms.
 *
 * The pattern: discrete items in one row. Tweens, a stagger by distance, and a
 * hit test on the modules' REST tops, so a module lifting out from under the
 * pointer cannot flip the choice.
 */
const {
  Cam, fit, proj, facing, rings, prism, ringAt, run, hull, poly, open, rrect,
  tween, tset, tval, tdone, mk, solid, put, place, reflect, register, pointer, disposer,
} = HL;

const N = 6, MW = 22, PITCH = 26, MD = 50, MH = 34, MR = 3, MB = 1.4;
const LIFT = 30, NEAR = [1, 0.32, 0.12], REST = [0, 2, 4, 14, 3, 0], HOME = 3;
const X0 = -6, X1 = (N - 1) * PITCH + MW + 6, Y0 = -6, Y1 = MD + 6, WH = 14, WR = 6, WT = 2.4;

/** Module i's footprint, x0..x1 along the row. */
const span = (i) => [i * PITCH, i * PITCH + MW];

/** One module standing from z: body, two studs, and where its six code dots sit on the lid. */
function shape(P, front, i, z) {
  const [x0, x1] = span(i), cx = (x0 + x1) / 2;
  const [ring, inner] = rings(x0, 0, x1, MD, MR, MB);
  const body = prism(P, front, ring, inner, z, z + MH);
  const studs = [10, MD - 10].map((y) => {
    const [r, n] = rings(cx - 3.2, y - 3.2, cx + 3.2, y + 3.2, 3.2, 0.9);
    return prism(P, front, r, n, z + MH, z + MH + 3);
  });
  const dots = [];
  for (let k = 0; k < N; k++) dots.push(P(cx, 18 + k * 2.8, z + MH));
  return { body, studs, dots };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // fitted to the tray with the far-end module fully lifted, the most extreme pose
  const C = Cam(45, 0.5, 1.5);
  fit(C, [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0], [0, 0, MH + 3 + LIFT], [X1, Y0, MH + 3 + LIFT]], 200, 166);
  const P = proj(C), front = facing(C);
  const outer = rrect(X0, Y0, X1, Y1, WR, 6), inner = rrect(X0 + WT, Y0 + WT, X1 - WT, Y1 - WT, WR - WT, 6);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, outer, 0, 14);
  // the tray's far half: body, rim's inner edge, the floor seam along the far walls
  mk("path", { d: poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, WH)))), class: "sil" }, g);
  mk("path", { d: poly(ringAt(P, inner, WH)), class: "nf" }, g);
  mk("path", { d: open(ringAt(P, run(inner, (q) => !front(q)), 2)), class: "nf lo" }, g);

  // modules back to front: +x runs toward the viewer
  const mods = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g);
    const body = solid(grp), studs = [solid(grp), solid(grp)];
    const dots = [];
    for (let k = 0; k < N; k++) dots.push(mk("circle", { r: 1.05, class: "dot " + (k === i ? "m" : "off") }, grp));
    mods.push({ body, studs, dots, z: tween(REST[i]), last: null });
  }

  // the tray's near half: one opaque wall from the rim's inner edge down to the floor
  const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
  const iF = LR(ringAt(P, run(inner, front), WH)), oT = LR(ringAt(P, run(outer, front), WH)), oB = LR(ringAt(P, run(outer, front), 0));
  mk("path", { d: poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), class: "fo" }, g);
  mk("path", { d: open(oT), class: "nf lo" }, g);
  mk("path", { d: open(iF), class: "nf" }, g);
  mk("path", { d: open([oT[0], ...oB, oT[oT.length - 1]]), class: "nf sil" }, g);

  function draw(i, z) {
    const m = mods[i];
    if (m.last === z) return;
    m.last = z;
    const s = shape(P, front, i, z);
    put(m.body, s.body);
    m.studs.forEach((st, k) => put(st, s.studs[k]));
    m.dots.forEach((el, k) => place(el, s.dots[k]));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    mods.forEach((m, i) => { draw(i, tval(m.z, now)); if (!tdone(m.z, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  // hit test on the REST tops: the module whose resting lid centre is nearest the pointer on screen
  const tops = mods.map((_, i) => P((span(i)[0] + span(i)[1]) / 2, MD / 2, MH + REST[i]));
  function hit([x, y]) {
    let best = -1, bd = 1e9;
    tops.forEach(([sx, sy], i) => { const d = Math.hypot(x - sx, (y - sy) * 0.6); if (d < bd) { bd = d; best = i; } });
    return bd < 58 ? best : -1;
  }

  let act = -2;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act >= 0 ? act : HOME;
    act = a;
    mods.forEach((m, i) => {
      const d = Math.abs(i - from);
      const z = a < 0 ? REST[i] : LIFT * (NEAR[d] ?? 0);
      tset(m.z, z, now, d * stag);
      const lit = a < 0 ? i === HOME : i === a;
      m.body.sil.classList.toggle("hi", lit);
      m.dots[i].classList.toggle("m", !lit);
    });
    read.textContent = a < 0 ? "rest" : "module " + String(a + 1).padStart(2, "0");
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "swappack",
  means: "A battery tray of six modules: the one under the pointer lifts out for inspection, its neighbours rising less the farther they are.",
  rules: [1, 2, 5, 9],
  range: [0, 45, 90],
  tour: [[150, 150], [215, 170], [270, 200], null],
  mount,
});
