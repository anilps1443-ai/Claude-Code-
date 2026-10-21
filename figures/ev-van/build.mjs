import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../../.claude/skills/anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

const WIDTH = 600;
const HEIGHT = 330;

// World units: 1 = 2.5 cm. x runs along the van (front at +x), y across it (+y is the near side), z up.
const U = 40; // one metre
const PLINTH = { x: -266, y: -56, w: 400, d: 130, r: 10 };
const PLINTH_H = 9;
const FOOT_H = 5;

const VAN = { rear: -116, front: 116, half: 40, sill: 11, roof: 100 };
const NEAR = VAN.half;
const AXLES = [-66, 80]; // 3.66 m wheelbase
const TYRE = { r: 14, w: 9, rim: 9.6 };
const ARCH = 17.5;

const PACK = { x: -250, y: -6, w: 100, d: 58, r: 2.5 };
const STAND_TOP = 30; // pack seat on the display table (75 cm)
const TRAY_H = 3.2;
const LID_TOP = STAND_TOP + 11.5;
const MOD = { w: 13.4, d: 25, h: 6, gap: 1.2, z: STAND_TOP + 1.2 };
const MOD_X0 = PACK.x + 3;
const MOD_Y = [PACK.y + 3, PACK.y + PACK.d - 3 - MOD.d];
const BDU = { x: MOD_X0 + 6 * MOD.w + 5 * MOD.gap + 2.4, y: PACK.y + 4, w: 0, d: PACK.d - 8, r: 1.4 };
BDU.w = PACK.x + PACK.w - 3 - BDU.x;

const P = k.fitProjection(
  [...k.boxCorners(PLINTH, -PLINTH_H - FOOT_H, 0), ...k.boxCorners(PACK, 0, STAND_TOP + 12), [VAN.rear, -VAN.half, VAN.roof], [VAN.front, NEAR, VAN.roof], [VAN.front + 6, NEAR, 0], [VAN.rear, NEAR, VAN.roof]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 56 },
);
const V = G.viewOf(P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = (point) => k.depthOf(point, P);
const byDepth = (points) => [...points].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
const wrap = (cls, inner) => `<g class="${cls}">${inner}</g>`;

// A transform that maps local (u, w) onto the plane o + u·U + w·W.
function planeAt(o, Uv, Wv) {
  const [ox, oy] = at(o);
  const [ux, uy] = at(G.add3(o, Uv));
  const [wx, wy] = at(G.add3(o, Wv));
  const f = (n) => n.toFixed(4);
  return `matrix(${f(ux - ox)} ${f(uy - oy)} ${f(wx - ox)} ${f(wy - oy)} ${f(ox)} ${f(oy)})`;
}
// The near side of the van, local (x, −z).
const SIDE = planeAt([0, NEAR, 0], [1, 0, 0], [0, 0, -1]);
const FRONT_FACE = planeAt([VAN.front, 0, 0], [0, -1, 0], [0, 0, -1]);
const sideG = (inner) => `<g transform="${SIDE}">${inner}</g>`;
const frontG = (inner) => `<g transform="${FRONT_FACE}">${inner}</g>`;

// Rounded convex polygon: each corner [x, y, r] becomes a short arc.
function rounded(corners, steps = 6) {
  const out = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const [px, py, r = 0] = corners[i];
    if (!r) {
      out.push([px, py]);
      continue;
    }
    const [ax, ay] = corners[(i + n - 1) % n];
    const [bx, by] = corners[(i + 1) % n];
    const ua = G.unit3([ax - px, ay - py, 0]);
    const ub = G.unit3([bx - px, by - py, 0]);
    const half = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]))) / 2;
    const t = r / Math.tan(half);
    const p0 = [px + ua[0] * t, py + ua[1] * t];
    const p1 = [px + ub[0] * t, py + ub[1] * t];
    const bis = G.unit3([ua[0] + ub[0], ua[1] + ub[1], 0]);
    const c = [px + (bis[0] * r) / Math.sin(half), py + (bis[1] * r) / Math.sin(half)];
    let a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
    let a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    for (let s = 0; s <= steps; s++) out.push([c[0] + r * Math.cos(a0 + (da * s) / steps), c[1] + r * Math.sin(a0 + (da * s) / steps)]);
  }
  return out;
}
const flatPath = (points, closed = true) => k.pathOf(points.map(([u, w]) => [u, -w]), closed);
const flatRect = (x0, z0, x1, z1, r = 0, steps = 4) => flatPath(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps));

// Extrude an (x, z) polygon across y.
const FY = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const prismY = (polygon, y0, y1) => G.prismOf(FY, polygon, y0, y1, P);
// Extrude a (y, z) polygon along x.
const FX = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const prismX = (polygon, x0, x1) => G.prismOf(FX, polygon, x0, x1, P);

/* ---------------- plinth ---------------- */
function plinth() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLINTH, -PLINTH_H - FOOT_H, PLINTH_H, P)}"/>`];
  const feet = [...k.corners(PLINTH, 24), [PLINTH.x + PLINTH.w / 2 - 40, PLINTH.y + 24], [PLINTH.x + PLINTH.w / 2 - 40, PLINTH.y + PLINTH.d - 24]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 7.5, -PLINTH_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.6, -PLINTH_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLINTH, -PLINTH_H, PLINTH_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLINTH, -3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLINTH, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Painted bay around the van.
  const bay = { x: VAN.rear - 12, y: -VAN.half - 10, w: VAN.front - VAN.rear + 28, d: VAN.half * 2 + 22, r: 1 };
  out.push(L(k.planOutline(bay, 0, P, 2) + k.planOutline(k.insetPlan(bay, 1.6), 0, P, 2), { tone: "faint" }));
  // Ruler strip along the near edge, 10 cm minor, 1 m major.
  const strip = { x: PLINTH.x + 40, y: PLINTH.y + PLINTH.d - 13, w: 6 * U + 8, d: 6.5, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + 4 + 6 * U, U / 10, 10, strip.y + 0.8, 0.6, [1.8, 3.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.2, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.2, 0.6])], { size: 0.45 }));
  // Label plate.
  const label = { x: PLINTH.x + PLINTH.w - 64, y: PLINTH.y + PLINTH.d - 17, w: 44, d: 10, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  out.push(L([30, 22, 26].map((w, i) => k.lineOnTop([label.x + 4, label.y + 2.8 + i * 2.2], [label.x + 4 + w, label.y + 2.8 + i * 2.2], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 3, label.y + 2.6, 0.8]), at([label.x + label.w - 3, label.y + label.d - 2.6, 0.8])], { size: 0.45 }));
  return out.join("");
}

/* ---------------- wheels ---------------- */
function wheel(x, near) {
  const y0 = near ? NEAR - TYRE.w : -NEAR;
  const a = near ? [0, 1, 0] : [0, -1, 0];
  const F = G.frameOf([x, near ? y0 : -NEAR + TYRE.w, TYRE.r], a, [1, 0, 0], [0, 0, 1]);
  const w = TYRE.w;
  const tyre = G.lathe([[0, 9.6], [0, 12.4], [0.7, 13.5, 1], [1.8, 14, 1], [w - 1.8, 14, 1], [w - 0.7, 13.5, 1], [w, 12.4], [w, 9.6]], F, P, { rows: 4 });
  const out = [wrap("ev-rubber", S(tyre, { tone: "hi", crease: "none" }))];
  if (!near) return out.join("");
  // Tread grooves on the visible shoulder, fading toward the limbs.
  const tread = G.ribsOf(F, 1.8, w - 1.8, 14, 54, P, { fade: [0.1, 0.55], seams: false });
  out.push(wrap("ev-rubber", k.fadedSvg(tread, { tone: "mid" })));
  const face = w - 0.3;
  const rim = G.disc(w - 2.4, face, TYRE.rim, F, P);
  out.push(wrap("ev-alloy", S(rim, { tone: "hi", inner: L(G.circleOf(F, face, 7.6, P) + G.circleOf(F, face, 3.6, P), { tone: "lo" }) })));
  out.push(wrap("ev-alloy", L(G.spokesOf(F, face, 3.6, 7.6, 10, P, { sweep: 0.18 }), { tone: "lo" })));
  out.push(D(G.dotsOf(F, face, 2.5, 5, P, { all: true }), { size: 0.5, tone: "hi" }));
  out.push(wrap("ev-alloy", S(G.disc(face, face + 0.5, 1.5, F, P), { tone: "mid" })));
  return out.join("");
}

/* ---------------- van ---------------- */
const CAB = rounded([[VAN.rear, VAN.sill, 3], [VAN.rear, VAN.roof, 7], [42, VAN.roof, 12], [78, 62, 3], [78, VAN.sill, 0]], 7);
const NOSE = rounded([[78, 62, 0], [111, 50.5, 5], [VAN.front, 40, 3], [VAN.front, VAN.sill, 3], [78, VAN.sill, 0]], 6);
const SLOPE = { top: [42 + 8, VAN.roof - 8.8], bottom: [76.5, 63.6] }; // windscreen run on the screen face

function vanBody() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: VAN.rear + 6, y: -VAN.half + 4, w: VAN.front - VAN.rear - 8, d: VAN.half * 2 - 4, r: 10 }, 0, 6, P)}"/>`);
  for (const x of AXLES) out.push(wheel(x, false));
  // Rear bumper with its step.
  out.push(wrap("ev-plastic", S(k.slabOf({ x: VAN.rear - 5, y: -VAN.half + 1, w: 8, d: VAN.half * 2 - 2, r: 3 }, 8.5, 11.5, P, 4, 0.5), { tone: "hi", inner: L(k.sideSeam({ x: VAN.rear - 5, y: -VAN.half + 1, w: 8, d: VAN.half * 2 - 2, r: 3 }, 14, P, 4), { tone: "faint" }) })));
  out.push(wrap("ev-under", S(k.slabOf({ x: VAN.rear + 8, y: -VAN.half + 6, w: VAN.front - VAN.rear - 16, d: VAN.half * 2 - 12, r: 4 }, 4.5, VAN.sill - 4.5 + 0.5, P, 4), { tone: "mid", crease: "none" })));
  out.push(wrap("ev-paint", S(prismY(CAB, -VAN.half, NEAR), { tone: "hi" })));
  out.push(wrap("ev-paint", S(prismY(NOSE, -VAN.half, NEAR), { tone: "hi" })));
  return out.join("");
}

const WINDOW = flatPath([[43.5, 66], [43.5, 94.5], [46, 95.5], [58.5, 82], [71.5, 67.2], [71.5, 66]]);
function cabInterior() {
  // Seat and steering wheel, seen through the cab window and clipped by it.
  const seatY = 22;
  const T = planeAt([0, seatY, 0], [1, 0, 0], [0, 0, -1]);
  const wheelF = G.frameOf([60, 26, 73], G.unit3([-0.55, 0, 0.83]), [0, 1, 0], G.unit3([0.83, 0, 0.55]));
  const seat = flatPath(rounded([[40, 66, 1], [42, 86, 2], [48, 86, 2], [48.5, 66, 1]], 3));
  const head = flatRect(41.4, 87.2, 47, 92.6, 1.8);
  return [
    `<clipPath id="ev-cab"><path transform="${SIDE}" d="${WINDOW}"/></clipPath>`,
    `<g clip-path="url(#ev-cab)">`,
    `<g transform="${T}"><path class="ev-seat" d="${seat}${head}"/></g>`,
    `<path class="ev-wheel" d="${G.circleOf(wheelF, 0, 7, P, 40)}"/>`,
    `<path class="ev-dash" d="${k.pathOf([at([60, NEAR - 2, 66.5]), at([74, NEAR - 2, 66.5]), at([74, -NEAR + 2, 66.5])])}"/>`,
    `</g>`,
    sideG(`<path class="ev-glass-edge" d="${WINDOW}"/>`),
  ].join("");
}

function vanSide() {
  const out = [];
  // Wheel wells: the dark opening, then the arch trim around it.
  const arch = (x, r) => {
    const pts = [];
    const a0 = Math.asin(Math.min(1, (VAN.sill - TYRE.r) / r));
    for (let i = 0; i <= 28; i++) {
      const t = Math.PI - a0 - ((Math.PI - 2 * a0) * i) / 28;
      pts.push([x + r * Math.cos(t), TYRE.r + r * Math.sin(t)]);
    }
    return pts;
  };
  for (const x of AXLES) {
    const well = arch(x, ARCH);
    out.push(`<path class="ev-well" d="${flatPath([...well, [well[well.length - 1][0], VAN.sill - 0.6], [well[0][0], VAN.sill - 0.6]])}"/>`);
    const trimOut = arch(x, ARCH + 2.2);
    out.push(`<path class="ev-trim" d="${flatPath([...trimOut, ...well.slice().reverse()])}"/>`);
  }
  // Panel lines: B-pillar, cab door, sliding door, rail.
  const cabDoor = flatPath([[40, VAN.sill + 1.5], [40, 97], [44, 98.5], [60, 81], [74.5, 64.5], [74.5, VAN.sill + 1.5]]);
  const sliding = flatRect(-30, VAN.sill + 1.5, 37, 96.5, 2.2);
  const rail = `M-30 -73H${VAN.rear + 6}`;
  out.push(`<path class="iso-line" data-tone="mid" d="${cabDoor}${sliding}"/>`);
  out.push(`<path class="iso-line" data-tone="lo" d="${rail}"/>`);
  out.push(`<path class="iso-line" data-tone="faint" d="M${VAN.rear} -62H40M74.5 -62H84M${VAN.rear} -45H114"/>`);
  out.push(`<path class="iso-line" data-tone="lo" d="M${VAN.rear} -46.2H114"/>`);
  out.push(`<circle class="ev-lock" cx="32" cy="-55.4" r="0.9"/>`);
  // Cab window and rear quarter light.
  out.push(`<path class="ev-glass" d="${WINDOW}"/>`);
  // Rub strips between the arches.
  for (const [x0, x1] of [[VAN.rear + 2, AXLES[0] - ARCH - 3.2], [AXLES[0] + ARCH + 3.2, AXLES[1] - ARCH - 3.2], [AXLES[1] + ARCH + 3.2, VAN.front - 1]])
    out.push(`<path class="ev-trimband" d="${flatRect(x0, 22, x1, 27.5, 1.2)}"/>`);
  // Handles, charge flap, side marker, tail light.
  out.push(`<path class="ev-trimband" d="${flatRect(47, 57.5, 54, 60, 1.2)}${flatRect(29, 57.5, 35, 60, 1.2)}"/>`);
  out.push(`<path class="iso-line" data-tone="mid" d="${flatRect(99, 33, 108, 41, 1.6)}"/>`);
  out.push(`<path class="ev-amber" d="${flatRect(VAN.rear + 30, 36, VAN.rear + 36, 38, 1)}"/>`);
  out.push(`<path class="ev-tail" d="${flatRect(VAN.rear + 0.6, 52, VAN.rear + 6, 92, 1.6)}"/>`);
  out.push(`<path class="iso-line" data-tone="lo" d="${flatRect(VAN.rear + 0.6, 52, VAN.rear + 6, 92, 1.6)}M${VAN.rear + 0.6} -66H${VAN.rear + 6}M${VAN.rear + 0.6} -78H${VAN.rear + 6}"/>`);
  return sideG(out.join(""));
}

function hoodLines() {
  // The bonnet panel's shut line, round the top of the nose at y = ±34.
  const top = NOSE.filter(([x, z]) => x >= 78.5 && z >= 40.5);
  const side = (y) => top.map(([x, z]) => at([x + 0.01, y, z + 0.01]));
  const loop = [...side(34), ...side(-34).reverse()];
  return L(k.pathOf(loop, true), { tone: "lo" });
}

function vanFront() {
  const out = [];
  out.push(`<path class="ev-grille" d="${flatRect(-20, 25, 20, 35, 2)}"/>`);
  out.push(`<path class="iso-line" data-tone="lo" d="M-18.8 -28.3H18.8M-18.8 -31.6H18.8"/>`);
  for (const s of [-1, 1]) {
    out.push(`<path class="ev-lamp" d="${flatPath([[s * 23, 31], [s * 23, 37], [s * 36.5, 38.5], [s * 37.5, 37.5], [s * 37.5, 32], [s * 36, 31]])}"/>`);
    out.push(`<path class="iso-line" data-tone="lit" d="M${s * 24} -35.2L${s * 36.4} -36.6"/>`);
  }
  out.push(`<circle class="ev-badge" cx="0" cy="-38" r="2.2"/>`);
  return frontG(out.join(""));
}

function vanScreen() {
  // The windscreen sits on the sloped face between the roof and the cowl.
  const [x0, z0] = SLOPE.top;
  const [x1, z1] = SLOPE.bottom;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const along = [(x1 - x0) / len, 0, (z1 - z0) / len];
  const out = [];
  const T = planeAt([x0, 0, z0], [0, -1, 0], along);
  const glass = flatPath([[-36.5, 0], [36.5, 0], [37.5, -len], [-37.5, -len]].map(([u, w]) => [u, w]));
  out.push(`<g transform="${T}"><path class="ev-glass" d="${k.pathOf([[-36, 1.2], [36, 1.2], [37.2, len - 0.5], [-37.2, len - 0.5]], true)}"/></g>`);
  // Wipers parked on the cowl.
  const cowl = (y) => at([77.2, y, 63.4]);
  out.push(L(k.pathOf([cowl(10), at([72.5, -24, 68.6])]) + k.pathOf([cowl(-22), at([72.5, -54 + 18, 68.6])]), { tone: "hi", free: "end" }));
  out.push(D([cowl(10), cowl(-22)], { size: 0.7, tone: "hi" }));
  return out.join("");
}

function vanTrim() {
  const out = [];
  // Bumpers.
  out.push(wrap("ev-plastic", S(k.slabOf({ x: VAN.front - 3, y: -VAN.half + 1, w: 8, d: VAN.half * 2 - 2, r: 3 }, 8.5, 14, P, 4, 0.5), { tone: "hi" })));
  out.push(frontG(`<path class="ev-grille" d="${flatRect(-24, 11, 24, 16, 2)}"/><path class="ev-plate" d="${flatRect(-11, 16.6, 11, 21.6, 0.8)}"/>`).replace(FRONT_FACE, planeAt([VAN.front + 5, 0, 0], [0, -1, 0], [0, 0, -1])));
  out.push(frontG(`<circle class="ev-fog" cx="-31" cy="-14.5" r="2.4"/><circle class="ev-fog" cx="31" cy="-14.5" r="2.4"/>`).replace(FRONT_FACE, planeAt([VAN.front + 5, 0, 0], [0, -1, 0], [0, 0, -1])));
  out.push(D([-20, -7, 7, 20].map((y) => at([VAN.front + 5, y, 19.6])), { size: 0.55, tone: "hi" }));
  // Mud flaps behind each wheel.
  for (const x of AXLES) out.push(wrap("ev-plastic", S(k.slabOf({ x: x - ARCH - 2.4, y: NEAR - 8, w: 1, d: 7.6, r: 0.3 }, 3, VAN.sill - 3 + 1, P, 2), { tone: "hi", crease: "none" })));
  // Mirror arm and head.
  out.push(wrap("ev-plastic", S(k.slabOf({ x: 70.5, y: NEAR - 1, w: 4, d: 6, r: 1 }, 70, 2.6, P, 3), { tone: "hi" })));
  out.push(wrap("ev-plastic", S(k.slabOf({ x: 69.5, y: NEAR + 4, w: 5.5, d: 8, r: 1.6 }, 66, 14, P, 4, 0.4), { tone: "hi" })));
  // Side step under the sliding door.
  out.push(wrap("ev-plastic", S(k.slabOf({ x: -26, y: NEAR - 4, w: 58, d: 9, r: 1.6 }, 7.2, 3.6, P, 3, 0.4), { tone: "hi", inner: L(k.sideSeam({ x: -26, y: NEAR - 4, w: 58, d: 9, r: 1.6 }, 9, P, 3), { tone: "faint" }) })));
  // Roof: ribs, antenna fin, third brake light.
  const ribs = [];
  for (let x = VAN.rear + 18; x <= 22; x += 16) ribs.push(k.pathOf([at([x, -VAN.half + 0.6, VAN.roof]), at([x, NEAR - 0.6, VAN.roof])]));
  out.push(L(ribs.join(""), { tone: "faint" }));
  out.push(wrap("ev-plastic", S(prismX(rounded([[-3, VAN.roof, 0], [-1, VAN.roof + 4.2, 1.2], [1, VAN.roof + 4.2, 1.2], [3, VAN.roof, 0]], 3), 20, 30), { tone: "hi" })));
  out.push(wrap("ev-tailcap", S(k.slabOf({ x: VAN.rear + 1.5, y: -9, w: 2.6, d: 18, r: 1 }, VAN.roof, 1.8, P, 3), { tone: "hi" })));
  // Wheel chocks either side of the near rear tyre.
  const chock = (dir) => {
    // The wedge face is tangent to the tyre at 45°: toe 5.9 and top 13.6 from the contact point.
    const toe = AXLES[0] + dir * 5.9;
    const top = AXLES[0] + dir * 13.8;
    const heel = AXLES[0] + dir * 19;
    return wrap("ev-rubber", S(prismY(rounded([[toe, 0, 0], [heel, 0, 0], [heel, 7.2, 0.8], [top, 7.6, 0.6]], 3), NEAR - 8.2, NEAR - 0.8), { tone: "hi" }));
  };
  out.push(chock(-1));
  for (const x of AXLES) out.push(wheel(x, true));
  out.push(chock(1));
  return out.join("");
}

/* ---------------- stand and pack ---------------- */
const TABLE = k.insetPlan(PACK, -5);
const TABLE_T = 2.4;
const APRON = k.insetPlan(TABLE, 5);
const APRON_H = 5;
const LEG = 3.2;
const LEG_TOP = STAND_TOP - TABLE_T - APRON_H;
const STRETCH_Z = 6;
function stand() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(TABLE, 4), 0, 4, P)}"/>`];
  const legs = k.corners(APRON, LEG / 2 + 0.4);
  const legAt = ([x, y]) => {
    const parts = [];
    parts.push(S(k.cylinder(x, y, 2.6, 0, 1.2, P, 20), { tone: "lo" }));
    parts.push(S(k.cylinder(x, y, 1.1, 1.2, 1.6, P, 14), { tone: "mid", crease: "none" }));
    const plan = { x: x - LEG / 2, y: y - LEG / 2, w: LEG, d: LEG, r: 0.6 };
    parts.push(S(k.slabOf(plan, 2.8, LEG_TOP - 2.8, P, 2, 0.3), { tone: "mid", inner: L(k.sideSeam(plan, 4.4, P, 2), { tone: "faint" }) }));
    return parts.join("");
  };
  const [xa, xb] = [APRON.x + LEG / 2 + 0.4, APRON.x + APRON.w - LEG / 2 - 0.4];
  const [ya, yb] = [APRON.y + LEG / 2 + 0.4, APRON.y + APRON.d - LEG / 2 - 0.4];
  const railX = (y) => S(k.slabOf({ x: xa + LEG / 2, y: y - 1, w: xb - xa - LEG, d: 2, r: 0.4 }, STRETCH_Z, 2, P, 2), { tone: "mid" });
  const railY = (x) => S(k.slabOf({ x: x - 1, y: ya + LEG / 2, w: 2, d: yb - ya - LEG, r: 0.4 }, STRETCH_Z, 2, P, 2), { tone: "mid" });
  out.push(legAt([xa, ya]), railX(ya), legAt([xb, ya]), railY(xa), railY(xb), legAt([xa, yb]), railX(yb), legAt([xb, yb]));
  out.push(S(k.slabOf(APRON, LEG_TOP, APRON_H, P, 3, 0.3), { tone: "mid", inner: L(k.sideSeam(APRON, LEG_TOP + 1.2, P, 3), { tone: "faint" }) }));
  out.push(D([[xa + 5, yb], [xb - 5, yb]].map(([x]) => at([x, APRON.y + APRON.d, LEG_TOP + APRON_H / 2])), { size: 0.45, tone: "mid" }));
  out.push(S(k.slabOf(TABLE, STAND_TOP - TABLE_T, TABLE_T, P, 6, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TABLE, 2.2), STAND_TOP, P, 6), { tone: "faint" }));
  // Corner stops that locate the pack on the table.
  for (const [x, y] of k.corners(k.insetPlan(PACK, -2.4), 0)) {
    const plan = { x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, r: 0.5 };
    out.push(S(k.slabOf(plan, STAND_TOP, 2.2, P, 2), { tone: "mid" }));
  }
  return out.join("");
}

function packSvg() {
  const out = [];
  // Tray with its bolted flange.
  const flange = k.insetPlan(PACK, -1.6);
  out.push(wrap("ev-tray", S(k.slabOf(flange, STAND_TOP, 1.2, P, 4, 0.4), { tone: "hi" })));
  const bolts = [];
  for (let x = flange.x + 4; x <= flange.x + flange.w - 4 + 0.01; x += (flange.w - 8) / 12) bolts.push([x, flange.y + 0.9], [x, flange.y + flange.d - 0.9]);
  for (let y = flange.y + 4 + (flange.d - 8) / 6; y < flange.y + flange.d - 4.5; y += (flange.d - 8) / 6) bolts.push([flange.x + 0.9, y], [flange.x + flange.w - 0.9, y]);
  out.push(D(bolts.map(([x, y]) => at([x, y, STAND_TOP + 1.2])), { size: 0.4, tone: "mid" }));
  out.push(wrap("ev-tray", S(k.slabOf(PACK, STAND_TOP + 1.2, TRAY_H - 1.2, P, 4), { tone: "hi" })));
  // Modules, back row first, each with its cell joints, terminals and monitoring board.
  out.push(`<g class="ev-cells" data-part="cells">`);
  for (const y of MOD_Y) {
    for (let i = 0; i < 6; i++) {
      const x = MOD_X0 + i * (MOD.w + MOD.gap);
      const plan = { x, y, w: MOD.w, d: MOD.d, r: 0.8 };
      const top = MOD.z + MOD.h;
      const cells = [];
      for (let c = 1; c < M.SERIES_PER_MODULE; c++) {
        const cx = x + 0.8 + (c * (MOD.w - 1.6)) / M.SERIES_PER_MODULE;
        cells.push(k.lineOnTop([cx, y], [cx, y + MOD.d], top, P));
      }
      const seam = L(k.sideSeam(plan, MOD.z + 1.4, P, 3), { tone: "faint" });
      out.push(wrap("ev-cell", S(k.slabOf(plan, MOD.z, MOD.h, P, 3), { tone: "hi", inner: seam })));
      out.push(wrap("ev-cell", L(cells.join(""), { tone: "lo" })));
      const terms = [];
      for (let c = 0; c < M.SERIES_PER_MODULE; c++) {
        const cx = x + 0.8 + ((c + 0.5) * (MOD.w - 1.6)) / M.SERIES_PER_MODULE;
        terms.push([cx, y + 3], [cx, y + MOD.d - 3]);
      }
      out.push(D(terms.map(([tx, ty]) => at([tx, ty, top])), { size: 0.32, tone: "mid" }));
      const cmc = { x: x + 1.2, y: y + MOD.d / 2 - 1.3, w: MOD.w - 2.4, d: 2.6, r: 0.4 };
      out.push(wrap("ev-board", S(k.slabOf(cmc, top, 0.5, P, 2), { tone: "hi", crease: "none" })));
      out.push(D([at([cmc.x + 1, cmc.y + 1.3, top + 0.5]), at([cmc.x + cmc.w - 1, cmc.y + 1.3, top + 0.5])], { size: 0.3, tone: "hi" }));
    }
  }
  out.push(`</g>`);
  // Series busbars between neighbouring modules.
  for (const y of MOD_Y) for (let i = 0; i < 5; i++) {
    const x = MOD_X0 + (i + 1) * (MOD.w + MOD.gap) - MOD.gap - 1.2;
    out.push(wrap("ev-bus", S(k.slabOf({ x, y: y + (i % 2 ? MOD.d - 4.6 : 1.6), w: MOD.gap + 2.4, d: 3, r: 0.5 }, MOD.z + MOD.h + 0.6, 0.6, P, 2), { tone: "hi" })));
  }
  // Main busbars: the ends of the 108-cell string run to the junction box.
  const lastX = MOD_X0 + 5 * (MOD.w + MOD.gap);
  for (const y of [MOD_Y[0] + 2, MOD_Y[1] + MOD.d - 5]) out.push(wrap("ev-bus", S(k.slabOf({ x: lastX + MOD.w - 3, y, w: BDU.x - lastX - MOD.w + 4.2, d: 3, r: 0.5 }, MOD.z + MOD.h + 0.6, 0.6, P, 2), { tone: "hi" })));
  // Row link at the far end.
  out.push(wrap("ev-bus", S(k.slabOf({ x: MOD_X0 + 1.5, y: MOD_Y[0] + MOD.d - 5, w: 3, d: MOD_Y[1] - MOD_Y[0] + 2, r: 0.5 }, MOD.z + MOD.h + 0.6, 0.6, P, 2), { tone: "hi" })));
  // Junction box (BDU) at the +x end.
  out.push(wrap("ev-tray", S(k.slabOf(BDU, MOD.z, MOD.h + 1.2, P, 3, 0.4), { tone: "hi", inner: L(k.sideSeam(BDU, MOD.z + MOD.h - 1, P, 3), { tone: "faint" }) })));
  const bTop = MOD.z + MOD.h + 1.2;
  out.push(wrap("ev-tray", L(k.planOutline(k.insetPlan(BDU, 1.4), bTop, P, 3), { tone: "lo" })));
  out.push(D(k.corners(BDU, 1.4).map(([x, y]) => at([x, y, bTop])), { size: 0.4, tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([BDU.x + BDU.w / 2 + 1.6, BDU.y + BDU.d / 2], bTop, P, "y"), "80.8 kWh", { size: 2.4, tone: "mid", anchor: "middle" }));
  for (const y of [BDU.y + 9, BDU.y + BDU.d - 9]) out.push(wrap("ev-tray", S(k.cylinder(BDU.x + BDU.w / 2, y, 2.4, bTop, 3, P, 20), { tone: "hi" })));
  // Glass lid over everything.
  out.push(wrap("ev-lid", S(k.slabOf(k.insetPlan(PACK, 0.4), STAND_TOP + TRAY_H, LID_TOP - STAND_TOP - TRAY_H, P, 4, 0.6), { tone: "hi" })));
  // HV connector and coolant ports on the +x face.
  const face = PACK.x + PACK.w;
  const port = (y, z, r, len, cls) => {
    const F = G.frameOf([face, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    return wrap(cls, S(G.disc(0, len, r, F, P), { tone: "hi", inner: L(G.circleOf(F, len, r * 0.55, P), { tone: "lo" }) }));
  };
  out.push(port(PACK.y + 12, STAND_TOP + 2.2, 1.5, 3.2, "ev-tray"), port(PACK.y + 20, STAND_TOP + 2.2, 1.5, 3.2, "ev-tray"));
  out.push(port(PACK.y + PACK.d - 16, STAND_TOP + 2.2, 2.0, 4.2, "ev-plastic"));
  return out.join("");
}

function ledBar() {
  // Ten segments on the stand's near rail.
  const T = planeAt([0, APRON.y + APRON.d, 0], [1, 0, 0], [0, 0, -1]);
  const x0 = APRON.x + APRON.w / 2 - 22;
  const segs = [];
  for (let i = 0; i < 10; i++) segs.push(`<path class="ev-led" data-led="${i}" d="${flatRect(x0 + i * 4.4, LEG_TOP + 1.4, x0 + i * 4.4 + 3.4, LEG_TOP + 3.6, 0.5)}"/>`);
  return `<g transform="${T}">${segs.join("")}</g>`;
}

/* ---------------- page ---------------- */
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: `A white electric panel van on a display plinth, with its traction battery beside it on a display table in a clear cyan case. Through the case you see twelve modules, 216 cells in all, joined in series by busbars to a junction box. The cells turn from pale grey to deep cyan as the state of charge rises.`,
  body: [plinth(), stand(), packSvg(), ledBar(), `<g class="ev-van">`, vanBody(), vanSide(), cabInterior(), hoodLines(), vanFront(), vanScreen(), vanTrim(), `</g>`],
});

const CSS = `
.iso{--ev-cyan:#1fb6d4;--ev-cyan-ink:#0b7d96}
.iso[data-theme="dark"] .ev-van{--anatomy-paper:#e9e9e6;--anatomy-face:#f4f4f2;--anatomy-top:#f6f6f4;--anatomy-shade-0:#c4c4c0;--anatomy-shade-1:#cfcfcb;--anatomy-shade-2:#d9d9d5;--anatomy-shade-3:#e2e2de;--anatomy-hi:#1a1a1c;--anatomy-mid:#77777c;--anatomy-lo:#a2a2a6;--anatomy-faint:#c6c6c8;--anatomy-dot:#2a2a2e}
.ev-rubber{--anatomy-paper:#3a3b3f;--anatomy-top:#4a4b50;--anatomy-shade-0:#2c2d30;--anatomy-shade-1:#333438;--anatomy-shade-2:#3a3b3f;--anatomy-shade-3:#424347;--anatomy-hi:#1d1d20;--anatomy-mid:#55565b;--anatomy-lo:#2e2f33}
.ev-plastic{--anatomy-paper:#4a4b4f;--anatomy-top:#5d5e63;--anatomy-shade-0:#38393c;--anatomy-shade-1:#3f4044;--anatomy-shade-2:#46474b;--anatomy-shade-3:#4e4f53;--anatomy-hi:#222225;--anatomy-faint:#5f6065}
.ev-under{--anatomy-paper:#2d2e31;--anatomy-top:#2d2e31;--anatomy-shade-0:#242528;--anatomy-shade-1:#28292c;--anatomy-shade-2:#2b2c2f;--anatomy-shade-3:#2f3033}
.ev-alloy{--anatomy-paper:#d9dadc;--anatomy-top:#eeeff0;--anatomy-shade-0:#b9babd;--anatomy-shade-1:#c5c6c9;--anatomy-shade-2:#d0d1d4;--anatomy-shade-3:#dcdde0;--anatomy-lo:#8d8e93}
.ev-tailcap{--anatomy-paper:#c9473f;--anatomy-top:#d85a52;--anatomy-shade-0:#a3352f;--anatomy-shade-1:#ad3a33;--anatomy-shade-2:#b84038;--anatomy-shade-3:#c2463d}
.ev-well{fill:#2a2b2e}
.ev-trim{fill:#45464a;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-trimband{fill:#4a4b4f;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-glass{fill:#30363c;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-grille{fill:#3d3e42;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-plate{fill:#f6f6f2;stroke:var(--anatomy-mid);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-lamp{fill:#e9eef1;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-amber{fill:#e8a23a;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-tail{fill:#c9473f}
.ev-lock{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-fog{fill:#e9eef1;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-seat{fill:#6b7078;stroke:#2a2d32;stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-wheel{fill:none;stroke:#7c828a;stroke-width:1.6;vector-effect:non-scaling-stroke}
.ev-dash{fill:none;stroke:#4d5258;stroke-width:1.2;vector-effect:non-scaling-stroke}
.ev-glass-edge{fill:none;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-glass-sheen{fill:#ffffff;opacity:.08}
.ev-badge{fill:none;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-tray{--anatomy-paper:#cfe9ef;--anatomy-top:#e2f4f8;--anatomy-shade-0:#a9d3dd;--anatomy-shade-1:#b6dbe4;--anatomy-shade-2:#c2e1e9;--anatomy-shade-3:#cee8ee;--anatomy-hi:#0e5f72;--anatomy-mid:#4f9aac;--anatomy-lo:#86bfcd;--anatomy-faint:#a8d3dd}
.ev-cells{--soc:30%}
.ev-cell{--anatomy-paper:color-mix(in oklab,#e2e7e9,#5fd3ec var(--soc));--anatomy-top:color-mix(in oklab,#eef1f2,#8be3f4 var(--soc));--anatomy-shade-0:color-mix(in oklab,#c3cbce,#1ba9c9 var(--soc));--anatomy-shade-1:color-mix(in oklab,#cbd2d5,#2cb5d3 var(--soc));--anatomy-shade-2:color-mix(in oklab,#d3d9db,#3fc0dc var(--soc));--anatomy-shade-3:color-mix(in oklab,#dadfe1,#52c9e3 var(--soc));--anatomy-hi:color-mix(in oklab,#5f6b70,#0b6880 var(--soc));--anatomy-mid:color-mix(in oklab,#8c979b,#2a8fa8 var(--soc));--anatomy-lo:color-mix(in oklab,#a9b2b5,#4aa6bd var(--soc));--anatomy-faint:color-mix(in oklab,#c2c9cb,#7cc4d5 var(--soc))}
.ev-board{--anatomy-paper:#2f6b5a;--anatomy-top:#3c7d6a;--anatomy-shade-0:#24574a;--anatomy-shade-1:#285e4f;--anatomy-shade-2:#2c6555;--anatomy-shade-3:#306b5a;--anatomy-hi:#173d33}
.ev-bus{--anatomy-paper:#d8b46a;--anatomy-top:#e6c784;--anatomy-shade-0:#b8924c;--anatomy-shade-1:#c29c54;--anatomy-shade-2:#cca65d;--anatomy-shade-3:#d5b066;--anatomy-hi:#7a5a1e}
.ev-lid .iso-fill{fill:rgba(64,196,226,.16)}
.ev-lid .iso-top{fill:rgba(140,224,242,.22)}
.ev-lid .iso-shade{fill:rgba(40,170,205,.20)}
.ev-lid .iso-line{stroke:#1593b0}
.ev-lid .iso-bevel{stroke:#bff0fa}
.iso-stage{touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ev-led{fill:#e3eef1;stroke:#4f9aac;stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ev-led[data-on]{fill:var(--ev-cyan)}
`;

const live = `
const MODEL = { capacity: ${M.CAPACITY_KWH}, consumption: ${M.CONSUMPTION}, series: ${M.SERIES} };
const OCV = ${JSON.stringify([[0, 3.0], [0.05, 3.38], [0.1, 3.47], [0.3, 3.58], [0.5, 3.65], [0.7, 3.79], [0.9, 4.0], [1, 4.15]])};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const cells = svg.querySelector('[data-part="cells"]');
const leds = [...svg.querySelectorAll("[data-led]")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ocv = (soc) => { for (let i = 1; i < OCV.length; i++) if (soc <= OCV[i][0]) { const [x0, y0] = OCV[i - 1], [x1, y1] = OCV[i]; return y0 + (y1 - y0) * (soc - x0) / (x1 - x0); } return OCV[OCV.length - 1][1]; };
let soc = 0.2, target = 0.2, frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0;
const tourAt = (t) => { const p = (t % 16) / 16; return p < 0.75 ? 0.1 + 0.9 * (p / 0.75) : 1 - 0.9 * ((p - 0.75) / 0.25); };
function draw() {
  cells.style.setProperty("--soc", (soc * 100).toFixed(1) + "%");
  const lit = Math.round(soc * 10);
  leds.forEach((el, i) => el.toggleAttribute("data-on", i < lit));
  const kwh = MODEL.capacity * soc;
  const text = Math.round(soc * 100) + " % · " + kwh.toFixed(1) + " kWh · " + Math.round(MODEL.series * ocv(soc)) + " V · " + Math.round(kwh / MODEL.consumption) + " km";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  soc = still.matches ? target : soc + (target - soc) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - soc) < 1e-4) soc = target;
  draw();
  frame = visible && (touring || soc !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, 0, 1); clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600); stage.setAttribute("aria-valuenow", String(Math.round(target * 100))); stage.setAttribute("aria-valuetext", Math.round(target * 100) + " percent charged"); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const aim = (e) => { const box = svg.getBoundingClientRect(); steer(clamp(((e.clientX - box.left) / box.width - 0.1) / 0.8, 0, 1)); };
stage.addEventListener("pointermove", aim);
stage.addEventListener("pointerdown", aim);
stage.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 0.25 : 0.1;
  let to = null;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") to = target + step;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = target - step;
  if (e.key === "Home") to = 0;
  if (e.key === "End") to = 1;
  if (to === null) return;
  e.preventDefault();
  steer(Math.round(to * 20) / 20);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Electric panel van",
  hint: "Hover to set the charge",
  readout: `20 % · ${M.energyKwh(0.2).toFixed(1)} kWh · ${Math.round(M.packVolts(0.2))} V · ${Math.round(M.rangeKm(0.2))} km`,
  keys: [
    { mark: "raised", label: "Panel van, 5.8 m, 3.66 m wheelbase" },
    { mark: "lit", label: `Traction pack: ${M.MODULES} modules, ${M.CELLS} cells, ${M.SERIES}s${M.PARALLEL}p` },
  ],
  caption: `A ${M.CAPACITY_KWH.toFixed(1)} kWh pack out of its van: ${M.SERIES} cell groups in series at ${M.NOMINAL_CELL_V} V make about ${Math.round(M.SERIES * M.NOMINAL_CELL_V)} V nominal. At ${M.CONSUMPTION} kWh per km a full pack carries the van about ${Math.round(M.rangeKm(1))} km.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="State of charge: arrow keys change it in steps of 10 percent" aria-valuemin="0" aria-valuemax="100" aria-valuenow="20">${svg}</div>`,
});

const file = theme === "dark" ? "ev-van-dark.html" : "ev-van.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Electric panel van", theme, body: `<style>${CSS}</style>${body}`, script: kitScript() + live }));
console.log("wrote", file);
