import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 760;
const HEIGHT = 392;

// ---------------------------------------------------------------- the data (the model)
// 108 records from three sources. A record's height (4..15) is how noisy it is; 20 of them are
// really bad. Everything the figure shows (blocks, gate, dial, readout) comes from this list.
const SOURCES = [
  { count: 48, bad: 6 },
  { count: 36, bad: 10 },
  { count: 24, bad: 4 },
];
const TOTAL = SOURCES.reduce((sum, source) => sum + source.count, 0);
const BAD_TOTAL = SOURCES.reduce((sum, source) => sum + source.bad, 0);

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(11);
const pick = (weights, low) => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return low + i;
  }
  return low + weights.length - 1;
};
const GOOD_WEIGHTS = [4, 5, 5, 4, 3, 2, 2, 1]; // heights 4..11
const BAD_WEIGHTS = [1, 1, 2, 3, 3, 3, 3, 3]; // heights 8..15
const bySource = SOURCES.map((source, s) => {
  const list = Array.from({ length: source.count }, () => ({ s, bad: 0, h: 0 }));
  for (let j = 0; j < source.bad; j++) list[Math.floor(((j + 0.5) * source.count) / source.bad)].bad = 1;
  list.forEach((record) => (record.h = record.bad ? pick(BAD_WEIGHTS, 8) : pick(GOOD_WEIGHTS, 4)));
  return list;
});
const RECORDS = [];
const taken = SOURCES.map(() => 0);
while (RECORDS.length < TOTAL) {
  let best = -1;
  let gap = -Infinity;
  SOURCES.forEach((source, s) => {
    if (taken[s] >= source.count) return;
    const behind = ((RECORDS.length + 1) * source.count) / TOTAL - taken[s];
    if (behind > gap) {
      gap = behind;
      best = s;
    }
  });
  RECORDS.push(bySource[best][taken[best]++]);
}

// The score for a gate height: keep every record no taller than the gate, then ask how clean
// the kept batch is (precision) and how much of the good data survived (recall).
function scoreAt(records, gate) {
  let kept = 0;
  let keptGood = 0;
  let good = 0;
  for (const record of records) {
    if (!record.bad) good++;
    if (record.h <= gate) {
      kept++;
      if (!record.bad) keptGood++;
    }
  }
  const precision = kept ? keptGood / kept : 0;
  const recall = good ? keptGood / good : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { kept, keptGood, precision, recall, f1 };
}

const GATE_MIN = 4.5;
const GATE_MAX = 15.5;
const GATE_START = 11;
if (process.argv.includes("--table")) {
  for (let g = 4; g <= 15; g++) {
    const s = scoreAt(RECORDS, g);
    console.log(`gate ${g}: kept ${s.kept} · clean ${(s.precision * 100).toFixed(0)}% · kept-of-good ${(s.recall * 100).toFixed(0)}% · score ${s.f1.toFixed(2)}`);
  }
}

// ---------------------------------------------------------------- the world
const PLATE = { x: -178, y: -78, w: 372, d: 146, r: 9 };
const PLATE_H = 12;
const FOOT_H = 5;

const BELT = { x: -150, y: -17, w: 270, d: 34, r: 2 };
const BELT_TOP = 5;
const BELT_X0 = -140;
const BELT_X1 = 120;
const RAIL_H = 9;
const LANES = [-7, 0, 7];
const TOKEN = 6;

const HX = [-114, -78, -42];
const POST_H = 48;

const GX = 20;
const GATE_POST = [GX - 17, 27];
const ARM_Z0 = BELT_TOP + GATE_MIN - 0.5; // arm underside when the gate is at its lowest
const ARM_FROM = [GATE_POST[0] + 2, GATE_POST[1] - 4];
const ARM_TO = [GX + 12, -19.5];
const ARM_T = 3.4;
const ARM_H = 5;

const BIN = { x: GX - 6, y: -71, w: 48, d: 40, r: 3 };
const BIN_WALL = 12;

const ENGINE = { x: 120, y: -32, w: 56, d: 64, r: 4 };
const ENGINE_FRONT = ENGINE.y + ENGINE.d;
const ENGINE_SIDE = ENGINE.x + ENGINE.w;
const ENGINE_BODY_Z = 6;
const ENGINE_TOP = 46;
const DIAL = [158, -6];
const DIAL_R = 14;
const DIAL_Z = ENGINE_TOP;
const DIAL_H = 8;
const DIAL_TOP = DIAL_Z + DIAL_H;
const DEG = Math.PI / 180;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...HX.flatMap((x) => [[x, -28, 58], [x, 28, 58]]),
    [DIAL[0], DIAL[1], DIAL_TOP + 2],
    [ENGINE.x, ENGINE.y, DIAL_TOP],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, tone, steps = 4, bevel = 0.4, style = {}) => S(k.slabOf(plan, z, h, P, steps, bevel), { tone, ...style });
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const rectY = (y, x0, x1, z0, z1) => k.pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]].map(at), true);
const rectX = (x, y0, y1, z0, z1) => k.pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map(at), true);
const seg = (a, b) => k.segment(a, b, P);
const lineOnTop = k.lineOnTop;
const BELT_Y0 = BELT.y;
const BELT_Y1 = BELT.y + BELT.d;

// ---------------------------------------------------------------- base plate
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const mid = PLATE.x + PLATE.w / 2;
  const feet = [...k.corners(PLATE, 22), [mid, PLATE.y + 22], [mid, PLATE.y + PLATE.d - 22]];
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -150, y: PLATE.y + PLATE.d - 16, w: 250, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  const label = { x: 128, y: 44, w: 36, d: 14, r: 1.6 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  [[label.w - 14, 4.2], [label.w - 8, 7.4], [label.w - 17, 10.6]].forEach(([length, offset]) => {
    out.push(L(k.lineOnTop([label.x + 5, label.y + offset], [label.x + 5 + length, label.y + offset], 0.8, P), { tone: "lo", free: true }));
  });
  out.push(D([at([label.x + 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], { size: 0.4 }));
  return out.join("");
}

// ---------------------------------------------------------------- belt
function belt() {
  const out = [];
  out.push(S(k.slabOf(BELT, 0, BELT_TOP, P, 3, 0.5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(BELT, 2), BELT_TOP, P, 3), { tone: "faint" }));
  // drive housing at the left end, the belt runs out from under its face
  const housing = { x: -158, y: -21, w: 18, d: 42, r: 3 };
  out.push(slab(housing, 0, 13, "mid", 5, 0.7));
  out.push(L(k.planOutline(k.insetPlan(housing, 3), 13, P, 5), { tone: "faint" }));
  out.push(D([at([housing.x + 4, housing.y + 5, 13]), at([housing.x + 4, housing.y + housing.d - 5, 13])], { size: 0.45 }));
  out.push(S(k.cylinder(housing.x + 9, 0, 7, 13, 5, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(housing.x + 9, 0, 7, 13, 18, 32, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([housing.x + 9, 0], [housing.x + 15.4, 0], 18, P), { tone: "hi" }));
  out.push(D([at([housing.x + 9, 0, 18])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function slatsAt(phase) {
  let d = "";
  for (let x = BELT_X0 + phase; x < BELT_X1 - 2; x += 9) d += lineOnTop([x, BELT_Y0], [x, BELT_Y1], BELT_TOP, P);
  return d;
}

function farRails() {
  const pieces = [
    { x: BELT_X0, y: -21, w: GX - 2 - BELT_X0, d: 4, r: 1 },
    { x: GX + 22, y: -21, w: BELT_X1 - GX - 22, d: 4, r: 1 },
  ];
  const out = pieces.map((rail) => slab(rail, 0, RAIL_H, "mid", 3, 0.4));
  out.push(D([-100, -40, 80].map((x) => at([x, -19, RAIL_H])), { size: 0.4 }));
  // the exit gap has its own cheek plates
  out.push(slab({ x: GX - 3, y: -21, w: 1.4, d: 4, r: 0.4 }, 0, RAIL_H + 2, "mid", 2, 0.3));
  out.push(slab({ x: GX + 22, y: -21, w: 1.4, d: 4, r: 0.4 }, 0, RAIL_H + 2, "mid", 2, 0.3));
  return out.join("");
}

function nearRail() {
  const rail = { x: BELT_X0, y: 17, w: BELT_X1 - BELT_X0, d: 4, r: 1 };
  const out = [slab(rail, 0, RAIL_H, "mid", 3, 0.4)];
  out.push(D([-100, -40, 80].map((x) => at([x, 19, RAIL_H])), { size: 0.4 }));
  return out.join("");
}

// ---------------------------------------------------------------- hoppers (the three sources)
function hopperFar(hx) {
  const out = [];
  out.push(slab({ x: hx - 3, y: -27, w: 6, d: 6, r: 1 }, 0, POST_H, "mid", 3, 0.4));
  out.push(slab({ x: hx - 4.5, y: -28.5, w: 9, d: 9, r: 1.5 }, POST_H, 2.4, "mid", 3, 0.4));
  out.push(slab({ x: hx - 2.5, y: -21, w: 5, d: 6, r: 0.6 }, 38, 6, "mid", 2, 0.3));
  out.push(D([at([hx, -26, POST_H + 2.4])], { size: 0.45 }));
  return out.join("");
}

function hopperNear(hx, index) {
  const out = [];
  out.push(slab({ x: hx - 6.5, y: -11, w: 13, d: 22, r: 2.4 }, 22, 6.2, "mid", 4, 0.4));
  out.push(slab({ x: hx - 8.5, y: -13.5, w: 17, d: 27, r: 3 }, 28, 6.2, "mid", 4, 0.5));
  out.push(L(k.sideSeam({ x: hx - 6.5, y: -11, w: 13, d: 22, r: 2.4 }, 25, P, 4), { tone: "faint" }));
  const body = { x: hx - 12, y: -16, w: 24, d: 32, r: 3 };
  out.push(slab(body, 34, 17, "hi", 5, 0.7));
  const lip = { x: hx - 13.5, y: -17.5, w: 27, d: 35, r: 3.6 };
  out.push(slab(lip, 51, 3.4, "mid", 5, 0.6));
  out.push(L(k.planOutline(k.insetPlan(lip, 3.4), 54.4, P, 5), { tone: "faint" }));
  out.push(D(k.corners(lip, 3).map(([x, y]) => at([x, y, 54.4])), { size: 0.45 }));
  // label plate with the source marks
  out.push(slab({ x: hx - 8, y: 16, w: 16, d: 0.9, r: 0.4 }, 38, 9, "lo", 2, 0));
  out.push(L(seg([hx - 5.4, 16.9, 44.6], [hx + 4.6, 16.9, 44.6]), { tone: "lo", free: true }));
  out.push(D(Array.from({ length: index + 1 }, (_, i) => at([hx - 4.6 + i * 3.8, 16.9, 40.6])), { size: 0.5, tone: "hi" }));
  // the near arm and the near post, in front of the body
  out.push(slab({ x: hx - 2.5, y: 16, w: 5, d: 5, r: 0.6 }, 38, 6, "mid", 2, 0.3));
  out.push(slab({ x: hx - 3, y: 21, w: 6, d: 6, r: 1 }, 0, POST_H, "mid", 3, 0.4));
  out.push(L(seg([hx - 3, 27.01, 8], [hx - 3, 27.01, POST_H]), { tone: "faint" }));
  out.push(slab({ x: hx - 4.5, y: 19.5, w: 9, d: 9, r: 1.5 }, POST_H, 2.4, "mid", 3, 0.4));
  out.push(D([at([hx, 24, POST_H + 2.4])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- the gate (adjustable diverter arm)
function gatePost() {
  const [px, py] = GATE_POST;
  const out = [];
  out.push(slab({ x: px - 6, y: py - 6, w: 12, d: 12, r: 2 }, 0, 2, "lo", 3, 0.3));
  out.push(slab({ x: px - 3, y: py - 3, w: 6, d: 6, r: 1 }, 2, 50, "mid", 3, 0.4));
  out.push(slab({ x: px - 4.5, y: py - 4.5, w: 9, d: 9, r: 1.5 }, 52, 2.6, "mid", 3, 0.4));
  out.push(D([at([px, py, 54.6])], { size: 0.45 }));
  // ruler on the post's +x face, ticks hang from its far vertical edge (the silhouette)
  const minor = [];
  const major = [];
  for (let z = 8, n = 0; z <= 44; z += 2, n++) (n % 5 === 0 ? major : minor).push(seg([px + 3, py - 3, z], [px + 3, py - 3 + (n % 5 === 0 ? 4.4 : 2.4), z]));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  return out.join("");
}

function armRing() {
  const [sx, sy] = ARM_FROM;
  const [ex, ey] = ARM_TO;
  const length = Math.hypot(ex - sx, ey - sy);
  const dx = (ex - sx) / length;
  const dy = (ey - sy) / length;
  const nx = -dy * (ARM_T / 2);
  const ny = dx * (ARM_T / 2);
  return [[sx + nx, sy + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [sx - nx, sy - ny]];
}

function gateArm() {
  const [px, py] = GATE_POST;
  const out = [];
  const carriage = { x: px - 5.5, y: py - 5.5, w: 11, d: 11, r: 1.6 };
  out.push(slab(carriage, ARM_Z0 - 2, 12, "hi", 4, 0.6));
  out.push(L(k.sideSeam(carriage, ARM_Z0 + 4, P, 4), { tone: "faint" }));
  out.push(D([at([px - 3.5, py + 5.5, ARM_Z0 + 8]), at([px + 3.5, py + 5.5, ARM_Z0 + 8])], { size: 0.45 }));
  const ring = armRing();
  out.push(S(k.extrude(ring, ARM_Z0, ARM_H, P, { bevel: 0.4 }), { tone: "hi", crease: "lo" }));
  const [a, b] = [ARM_FROM, ARM_TO];
  out.push(L(k.lineOnTop([(ring[0][0] + ring[3][0]) / 2, (ring[0][1] + ring[3][1]) / 2], [(ring[1][0] + ring[2][0]) / 2, (ring[1][1] + ring[2][1]) / 2], ARM_Z0 + ARM_H, P), { tone: "faint" }));
  out.push(D([at([a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45, ARM_Z0 + ARM_H]), at([a[0] + (b[0] - a[0]) * 0.8, a[1] + (b[1] - a[1]) * 0.8, ARM_Z0 + ARM_H])], { size: 0.45 }));
  // clamp knob on the carriage
  out.push(S(k.cylinder(px, py, 3.4, ARM_Z0 + 10, 3.4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(px, py, 3.4, ARM_Z0 + 10, ARM_Z0 + 13.4, 22, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([px, py], [px + 3.4, py], ARM_Z0 + 13.4, P), { tone: "hi" }));
  out.push(D([at([px, py, ARM_Z0 + 13.4])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// ---------------------------------------------------------------- reject bin
function binBack() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(BIN, 0, 4, P)}"/>`);
  out.push(slab(BIN, 0, 2, "lo", 4, 0.3));
  out.push(slab({ x: BIN.x, y: BIN.y, w: BIN.w, d: 3, r: 0.8 }, 2, BIN_WALL, "mid", 3, 0.5));
  out.push(slab({ x: BIN.x, y: BIN.y + 3, w: 3, d: BIN.d - 6, r: 0.8 }, 2, BIN_WALL, "mid", 3, 0.5));
  return out.join("");
}

function binFront() {
  const out = [];
  out.push(slab({ x: BIN.x + BIN.w - 3, y: BIN.y + 3, w: 3, d: BIN.d - 6, r: 0.8 }, 2, BIN_WALL, "mid", 3, 0.5));
  const front = { x: BIN.x, y: BIN.y + BIN.d - 3, w: BIN.w, d: 3, r: 0.8 };
  out.push(slab(front, 2, BIN_WALL, "mid", 3, 0.5));
  out.push(D([6, BIN.w - 6].map((x) => at([BIN.x + x, BIN.y + BIN.d - 1.5, 2 + BIN_WALL])), { size: 0.45 }));
  // tag on the front wall
  out.push(slab({ x: BIN.x + 15, y: BIN.y + BIN.d, w: 18, d: 0.9, r: 0.4 }, 4.6, 5.4, "lo", 2, 0));
  out.push(L(seg([BIN.x + 18, BIN.y + BIN.d + 0.9, 8.2], [BIN.x + 28, BIN.y + BIN.d + 0.9, 8.2]), { tone: "lo", free: true }));
  out.push(D([at([BIN.x + 17.5, BIN.y + BIN.d + 0.9, 6])], { size: 0.4 }));
  return out.join("");
}

// ---------------------------------------------------------------- tokens (records)
const toneOfHeight = (h) => (h <= 8 ? "hi" : h <= 11 ? "mid" : "lo");
const tokenSvg = (h) => S(k.slabOf({ x: -TOKEN / 2, y: -TOKEN / 2, w: TOKEN, d: TOKEN, r: 0.8 }, 0, h, P, 2, 0.3), { tone: toneOfHeight(h) });
const TOKEN_SVG = {};
for (let h = 4; h <= 15; h++) TOKEN_SVG[h] = tokenSvg(h);
const tokenAt = (h, x, y, z) => `<g transform="${k.translateAlong(P, [x, y, z])}">${TOKEN_SVG[h]}</g>`;

const BIN_SLOTS = [];
for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) BIN_SLOTS.push([BIN.x + 8.5 + col * 10.5, BIN.y + 9 + row * 9.5]);

function binPile() {
  return byDepth([[BIN_SLOTS[0], 14], [BIN_SLOTS[4], 12], [BIN_SLOTS[1], 15]].map(([slot, h]) => [slot[0], slot[1], h]))
    .map(([x, y, h]) => tokenAt(h, x, y, 2))
    .join("");
}

// ---------------------------------------------------------------- insight engine
function engine() {
  const out = [];
  const plinth = { x: 117.5, y: -34.5, w: 61, d: 69, r: 5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(plinth, 0, ENGINE_BODY_Z, P)}"/>`);
  out.push(slab(plinth, 0, ENGINE_BODY_Z, "lo", 6, 0.8));
  out.push(D(k.corners(plinth, 3.4).map(([x, y]) => at([x, y, ENGINE_BODY_Z])), { size: 0.5 }));
  const bodySeam = k.sideSeam(ENGINE, 26, P, 5);
  out.push(S(k.slabOf(ENGINE, ENGINE_BODY_Z, ENGINE_TOP - ENGINE_BODY_Z - 4, P, 5, 0.8), { tone: "mid", inner: L(bodySeam, { tone: "faint" }) }));
  const cap = { x: ENGINE.x - 1.2, y: ENGINE.y - 1.2, w: ENGINE.w + 2.4, d: ENGINE.d + 2.4, r: 4.6 };
  out.push(slab(cap, ENGINE_TOP - 4, 4, "mid", 5, 0.8));
  out.push(L(k.planOutline(k.insetPlan(cap, 3), ENGINE_TOP, P, 5), { tone: "faint" }));
  // front face: label plate, vent slots
  const plateFront = { x: 126, y: ENGINE_FRONT, w: 22, d: 0.9, r: 0.4 };
  out.push(slab(plateFront, 28, 9, "lo", 2, 0));
  out.push(L(seg([129, ENGINE_FRONT + 0.9, 34], [143, ENGINE_FRONT + 0.9, 34]), { tone: "lo", free: true }));
  out.push(L(seg([129, ENGINE_FRONT + 0.9, 31.4], [138, ENGINE_FRONT + 0.9, 31.4]), { tone: "lo", free: true }));
  out.push(D([at([128.5, ENGINE_FRONT + 0.9, 29.6]), at([145.5, ENGINE_FRONT + 0.9, 29.6])], { size: 0.4 }));
  out.push(L([0, 1, 2, 3].map((i) => rectY(ENGINE_FRONT, 152, 171, 14 + i * 5, 16.4 + i * 5)).join(""), { tone: "lo" }));
  out.push(D([at([124, ENGINE_FRONT, 12]), at([172, ENGINE_FRONT, 12]), at([124, ENGINE_FRONT, 38]), at([172, ENGINE_FRONT, 38])], { size: 0.45 }));
  // side face: five vertical vent slots and a connector plate
  out.push(L([0, 1, 2, 3, 4].map((i) => rectX(ENGINE_SIDE, -24 + i * 6.4, -22 + i * 6.4, 12, 34)).join(""), { tone: "lo" }));
  out.push(slab({ x: ENGINE_SIDE, y: 12, w: 0.9, d: 14, r: 0.4 }, 14, 18, "lo", 2, 0));
  out.push(D([at([ENGINE_SIDE + 0.9, 15, 17]), at([ENGINE_SIDE + 0.9, 24, 17]), at([ENGINE_SIDE + 0.9, 15, 29]), at([ENGINE_SIDE + 0.9, 24, 29])], { size: 0.4 }));
  // intake hood: the belt runs into this, it is the first thing the records meet
  const hood = { x: 124, y: -26, w: 20, d: 52, r: 3 };
  out.push(slab(hood, ENGINE_TOP, DIAL_H, "mid", 4, 0.7));
  out.push(L([0, 1, 2].map((i) => k.lineOnTop([129 + i * 5, hood.y], [129 + i * 5, hood.y + hood.d], DIAL_TOP, P)).join(""), { tone: "faint" }));
  out.push(D([at([hood.x + 4, hood.y + 4, DIAL_TOP]), at([hood.x + hood.w - 4, hood.y + hood.d - 4, DIAL_TOP])], { size: 0.45 }));
  // two knurled knobs
  for (const kx of [148, 164]) {
    out.push(S(k.cylinder(kx, 24, 4.6, ENGINE_TOP, 5, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(kx, 24, 4.6, ENGINE_TOP, ENGINE_TOP + 5, 26, P), { tone: "lo" }));
    out.push(L(k.lineOnTop([kx, 24], [kx + 4.6, 24], ENGINE_TOP + 5, P), { tone: "hi" }));
    out.push(D([at([kx, 24, ENGINE_TOP + 5])], { size: 0.5, tone: "hi" }));
  }
  return out.join("");
}

function dial() {
  const [x, y] = DIAL;
  const out = [];
  out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3, DIAL_TOP, 76, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL_R - 2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL_R - 2.8, 20, 4, DIAL_TOP, [1.2, 2.6], P, -135 * DEG, 270 * DEG);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 7.6], DIAL_TOP, P, "x"), "SCORE", { size: 2.2, tone: "lo", anchor: "middle" }));
  out.push(L(k.ring(x, y, 1.6, DIAL_TOP, P, 16), { tone: "mid" }));
  return out.join("");
}

const needleAt = (score) => {
  const angle = (-135 + 270 * score) * DEG;
  const [x, y] = DIAL;
  return lineOnTop([x - Math.sin(angle) * 3.2, y + Math.cos(angle) * 3.2], [x + Math.sin(angle) * (DIAL_R - 4), y - Math.cos(angle) * (DIAL_R - 4)], DIAL_TOP + 0.2, P);
};

// ---------------------------------------------------------------- assemble
const start = scoreAt(RECORDS, GATE_START);
const readoutText = (gate, s) => `gate ${gate.toFixed(1)} · kept ${s.kept} of ${TOTAL} · score ${s.f1.toFixed(2)}`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: `A data-sorting production line. Three hoppers drop records onto a conveyor belt; each record is a block whose height is how noisy it is. An adjustable arm over the belt sweeps any block taller than its setting off into a reject bin, and the rest run into an insight engine whose dial shows a score for the batch. Of ${TOTAL} records, ${BAD_TOTAL} are really bad.`,
  body: [
    plate(),
    belt(),
    `<path data-part="slats" class="iso-line" data-tone="faint" data-free="" d="${slatsAt(0)}"/>`,
    binBack(),
    binPile(),
    `<g data-layer="bin"></g>`,
    binFront(),
    farRails(),
    HX.map((hx) => hopperFar(hx)).join(""),
    `<g data-layer="lane"></g>`,
    nearRail(),
    HX.map((hx, index) => hopperNear(hx, index)).join(""),
    gatePost(),
    `<g data-part="arm" transform="${k.translateAlong(P, [0, 0, GATE_START - GATE_MIN])}">${gateArm()}</g>`,
    engine(),
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(start.f1)}" style="stroke-width:1.1"/>`,
  ],
});

// ---------------------------------------------------------------- live
const live = `
const P = ${JSON.stringify(P)};
const RECORDS = ${JSON.stringify(RECORDS.map((r) => [r.s, r.h, r.bad]))}.map(([s, h, bad]) => ({ s, h, bad }));
const TOKEN_SVG = ${JSON.stringify(TOKEN_SVG)};
const HX = ${JSON.stringify(HX)}, LANES = ${JSON.stringify(LANES)};
const TOTAL = ${TOTAL}, GATE_MIN = ${GATE_MIN}, GATE_MAX = ${GATE_MAX}, BELT_TOP = ${BELT_TOP};
const BELT_X0 = ${BELT_X0}, BELT_X1 = ${BELT_X1}, BELT_Y0 = ${BELT_Y0}, BELT_Y1 = ${BELT_Y1};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP}, DEG = Math.PI / 180;
const ARM_FROM = ${JSON.stringify(ARM_FROM)}, ARM_TO = ${JSON.stringify(ARM_TO)};
const BIN_SLOTS = ${JSON.stringify(BIN_SLOTS)}, BIN_Z = 2;
const TOKEN = ${TOKEN}, BELT_SPEED = 34, SPAWN_EVERY = 0.62, SLIDE_SPEED = 50, FLIGHT = 0.6;
const scoreAt = ${scoreAt.toString()};
const needleAt = ${needleAt.toString()};
const slatsAt = ${slatsAt.toString()};

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const arm = svg.querySelector('[data-part="arm"]');
const needle = svg.querySelector('[data-part="needle"]');
const slats = svg.querySelector('[data-part="slats"]');
const lane = svg.querySelector('[data-layer="lane"]');
const binLayer = svg.querySelector('[data-layer="bin"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SVGNS = "http://www.w3.org/2000/svg";
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// the arm's centre line, in the floor plane, as x for a given y
const armDx = ARM_TO[0] - ARM_FROM[0], armDy = ARM_TO[1] - ARM_FROM[1], armLen = Math.hypot(armDx, armDy);
const armDir = [armDx / armLen, armDy / armLen];
const armXAt = (y) => ARM_FROM[0] + (y - ARM_FROM[1]) * armDx / armDy;
const hitX = (y) => armXAt(y) - TOKEN / 2 - 2.4;
const clearX = (y) => armXAt(y) + TOKEN / 2 + 2.4;

let gate = ${GATE_START}, target = gate;
let tokens = [], cursor = 0, spawnClock = 0, beltPhase = 0, binUse = 0;
let frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0, lastText = "";

function make(h, x, y, z, parent) {
  const el = document.createElementNS(SVGNS, "g");
  el.innerHTML = TOKEN_SVG[h];
  parent.appendChild(el);
  return el;
}
function spawn() {
  const record = RECORDS[cursor++ % RECORDS.length];
  const token = { record, st: "fall", t: 0, x: HX[record.s], y: LANES[record.s], z: 29, home: lane };
  token.el = make(record.h, token.x, token.y, token.z, lane);
  tokens.push(token);
}
function release(token, st) { token.st = st; token.t = 0; }
function step(dt) {
  beltPhase = (beltPhase + BELT_SPEED * dt) % 9;
  spawnClock += dt;
  while (spawnClock >= SPAWN_EVERY) { spawnClock -= SPAWN_EVERY; spawn(); }
  for (const token of tokens) {
    token.t += dt;
    if (token.st === "fall") {
      token.z = Math.max(BELT_TOP, 29 - 0.5 * 500 * token.t * token.t);
      if (token.z === BELT_TOP) release(token, "belt");
    } else if (token.st === "belt") {
      token.x += BELT_SPEED * dt;
      if (token.x > hitX(token.y) && token.x < clearX(token.y) && token.record.h > gate) release(token, "slide");
      if (token.x > BELT_X1 + 14) token.st = "gone";
    } else if (token.st === "slide") {
      token.x += armDir[0] * SLIDE_SPEED * dt;
      token.y += armDir[1] * SLIDE_SPEED * dt;
      if (token.y < -19) {
        const slot = BIN_SLOTS[binUse++ % BIN_SLOTS.length];
        token.from = [token.x, token.y]; token.to = slot;
        binLayer.appendChild(token.el);
        release(token, "fly");
      }
    } else if (token.st === "fly") {
      const u = Math.min(1, token.t / FLIGHT);
      token.x = token.from[0] + (token.to[0] - token.from[0]) * u;
      token.y = token.from[1] + (token.to[1] - token.from[1]) * u;
      token.z = BELT_TOP + (BIN_Z - BELT_TOP) * u + 14 * 4 * u * (1 - u);
      if (u === 1) { token.z = BIN_Z; release(token, "rest"); }
    } else if (token.st === "rest") {
      const fade = clamp((token.t - 4.5) / 1.5, 0, 1);
      token.el.style.opacity = String(1 - fade);
      if (fade === 1) token.st = "gone";
    }
  }
  const gone = tokens.filter((token) => token.st === "gone");
  gone.forEach((token) => token.el.remove());
  if (gone.length) tokens = tokens.filter((token) => token.st !== "gone");
}
function place() {
  for (const token of tokens) token.el.setAttribute("transform", translateAlong(P, [token.x, token.y, token.z]));
  for (const layer of [lane, binLayer]) {
    const own = tokens.filter((token) => token.el.parentNode === layer).sort((a, b) => depthOf([a.x, a.y, 0], P) - depthOf([b.x, b.y, 0], P));
    own.forEach((token, index) => { if (layer.children[index] !== token.el) layer.insertBefore(token.el, layer.children[index] || null); });
  }
  slats.setAttribute("d", slatsAt(beltPhase));
}
function draw() {
  arm.setAttribute("transform", translateAlong(P, [0, 0, gate - GATE_MIN]));
  const s = scoreAt(RECORDS, gate);
  needle.setAttribute("d", needleAt(s.f1));
  const text = "gate " + gate.toFixed(1) + " · kept " + s.kept + " of " + TOTAL + " · score " + s.f1.toFixed(2);
  if (text !== lastText) {
    lastText = text;
    readout.textContent = text;
    stage.setAttribute("aria-valuenow", gate.toFixed(1));
    stage.setAttribute("aria-valuetext", text);
  }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = 10.6 + 4.4 * Math.sin(0.3 * clock + 0.9); }
  gate = calm ? target : gate + (target - gate) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - gate) < 0.002) gate = target;
  if (!calm) step(dt);
  draw();
  place();
  frame = visible && (!calm || touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, GATE_MIN, GATE_MAX); clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; run(); }, 3600); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

if (still.matches) {
  touring = false;
  for (const x of [-100, -72, -44, -16, 10, 40, 66, 90]) {
    const record = RECORDS[cursor++ % RECORDS.length];
    const token = { record, st: "belt", t: 0, x, y: LANES[record.s], z: BELT_TOP, home: lane };
    token.el = make(record.h, token.x, token.y, token.z, lane);
    tokens.push(token);
  }
} else {
  for (let i = 0; i < 240; i++) step(1 / 40);
}
draw();
place();

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1);
  steer(GATE_MIN + share * (GATE_MAX - GATE_MIN));
});
stage.addEventListener("pointerleave", () => steer(target));
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + 0.5;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - 0.5;
  if (event.key === "Home") to = GATE_MIN;
  if (event.key === "End") to = GATE_MAX;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Data intelligence platform",
  hint: "Hover to move the quality gate",
  readout: readoutText(GATE_START, start),
  keys: [
    { mark: "lit", label: "Score needle: the one number to watch" },
    { mark: "raised", label: "Records: a taller block is a noisier record" },
  ],
  caption: `A data-sorting line. Three sources feed ${TOTAL} records onto the belt, ${BAD_TOTAL} of them bad. The gate arm sweeps any record taller than its setting into the reject bin. Set it too loose and noise reaches the engine; too strict and good records are thrown away. The dial scores the kept batch from 0 to 1, high only when most good records stay and most bad ones go.`,
  body: `<style>.iso-stage{border-radius:10px;touch-action:pan-y;-webkit-tap-highlight-color:transparent}.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}.iso-stage .iso-svg{overflow:visible}@media (max-width:640px){.iso-stage{overflow:hidden}.iso-plate .iso-stage .iso-svg{width:110%;margin:-2% -5% -1%}}@media (prefers-reduced-motion:reduce){.iso-stage *{transition:none!important}}</style><div class="iso-stage" tabindex="0" role="slider" aria-label="Quality gate: arrow keys raise and lower the gate" aria-valuemin="${GATE_MIN}" aria-valuemax="${GATE_MAX}" aria-valuenow="${GATE_START}">${svg}</div>`,
});

const name = theme === "light" ? "data-intelligence-light.html" : "data-intelligence.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Data intelligence platform", theme, body, script: kitScript() + live, width: 780 }));
console.log("wrote", name);
