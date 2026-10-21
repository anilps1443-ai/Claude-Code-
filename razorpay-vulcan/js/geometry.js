// Procedural point/line data for the scene. Everything is generated from a
// seeded RNG so the world is identical on every load.

import { WORLD } from './beats.js';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r) => {
  const u = Math.max(1e-6, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
};

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const PALETTE = {
  logo: hex(0xb4c8f2),
  logoDeep: hex(0x7d98d8),
  dust: hex(0xa9c3dc),
  cyan: hex(0x7fd7ff),
  teal: hex(0x5fd8cf),
  white: hex(0xeef3ff),
  blue: hex(0x4d86ff),
  ring: hex(0x9fbccc),
  grey: hex(0xd6dbe6),
};

/* ---------------------------------------------------------------- builders */

class PointBuf {
  constructor(n) {
    this.n = 0;
    this.position = new Float32Array(n * 3);
    this.color = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.seed = new Float32Array(n);
  }
  push(p, c, s, seed) {
    const i = this.n++;
    this.position.set(p, i * 3);
    this.color.set(c, i * 3);
    this.size[i] = s;
    this.seed[i] = seed;
    return i;
  }
  trim() {
    const n = this.n;
    this.position = this.position.subarray(0, n * 3);
    this.color = this.color.subarray(0, n * 3);
    this.size = this.size.subarray(0, n);
    this.seed = this.seed.subarray(0, n);
    return this;
  }
}

class LineBuf {
  constructor() { this.pos = []; this.col = []; this.alpha = []; }
  seg(a, b, c, alA = 1, alB = alA) {
    this.pos.push(...a, ...b);
    this.col.push(...c, ...c);
    this.alpha.push(alA, alB);
  }
  poly(points, c, alphaFn = () => 1, closed = false) {
    const n = points.length;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const j = (i + 1) % n;
      this.seg(points[i], points[j], c, alphaFn(i / Math.max(1, n - 1)), alphaFn(j / Math.max(1, n - 1)));
    }
  }
  out() {
    return { position: new Float32Array(this.pos), color: new Float32Array(this.col), alpha: new Float32Array(this.alpha) };
  }
}

/* ------------------------------------------------------------------ galaxy */

export function galaxy(count) {
  const r = rng(11);
  const b = new PointBuf(count);
  for (let i = 0; i < count; i++) {
    const m = 2 * r() - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - m * m);
    const rad = 24 + (58 - 24) * Math.cbrt(r());
    const tint = r() ** 2;
    const c = [0.85 + 0.15 * (1 - tint), 0.88 + 0.08 * (1 - tint), 1];
    b.push([Math.cos(th) * s * rad, m * rad, Math.sin(th) * s * rad], c, 0.35 + r() ** 3 * 2.6, r());
  }
  return b.trim();
}

/* --------------------------------------------------- logo mark → canopy dust */

// Brand mark outline in a 24×24 box (y down). Swap these two polygons to rebrand.
const MARK = [
  [[22.436, 0], [10.526, 7.773], [9.352, 12.049], [15.977, 7.752], [11.65, 24], [16.041, 24]],
  [[14.26, 10.098], [3.389, 17.166], [1.564, 24], [10.572, 24]],
];

function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const MARK_SCALE = 0.097;
const markToWorld = (x, y) => [(x - 12.6) * MARK_SCALE, (12 - y) * MARK_SCALE - 0.17];

function sampleMark(r) {
  // 72% interior fill, 28% concentrated on the outline so edges read crisply
  if (r() < 0.72) {
    for (;;) {
      const x = 1.5 + r() * 21, y = r() * 24;
      if (MARK.some((p) => insidePoly(x, y, p))) return markToWorld(x, y);
    }
  }
  const poly = MARK[r() < 0.66 ? 0 : 1];
  const k = Math.floor(r() * poly.length);
  const a = poly[k], b = poly[(k + 1) % poly.length], t = r();
  const x = a[0] + (b[0] - a[0]) * t + gauss(r) * 0.12, y = a[1] + (b[1] - a[1]) * t + gauss(r) * 0.12;
  return markToWorld(x, y);
}

/** Dust: each particle has a hero (logo) position and a canopy position. */
export function dust(count) {
  const r = rng(23);
  const b = new PointBuf(count);
  const logo = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [lx, ly] = sampleMark(r);
    logo.set([lx, ly, gauss(r) * 0.018], i * 3);
    // canopy disc: dense core band, long sparse tail
    const rad = r() < 0.82 ? 0.08 + Math.sqrt(r()) * 1.05 : 1.1 + r() ** 1.6 * 0.75;
    const th = r() * Math.PI * 2;
    const y = WORLD.canopyY + gauss(r) * (0.006 + rad * 0.006);
    const pick = r();
    const c = pick < 0.68 ? PALETTE.dust : pick < 0.9 ? PALETTE.cyan : PALETTE.white;
    b.push([Math.cos(th) * rad, y, Math.sin(th) * rad], c, 0.7 + r() ** 2 * 1.3, r());
  }
  b.trim();
  b.logo = logo;
  return b;
}

/* ------------------------------------------------------------ signal clumps */

/** Short horizontal bars of particles hanging in the volume under the canopy. */
export function signals(clumps, perClump) {
  const r = rng(37);
  const b = new PointBuf(clumps * perClump + 4000);
  for (let k = 0; k < clumps; k++) {
    const rad = 0.45 + r() * 1.5, th = r() * Math.PI * 2;
    const y = 0.02 - r() ** 0.8 * 1.65;
    const len = 0.05 + r() * 0.16, dep = 0.008 + r() * 0.02, hgt = 0.004 + r() * 0.01;
    const ang = th + Math.PI / 2 + gauss(r) * 0.25;
    const pick = r();
    const c = pick < 0.62 ? PALETTE.teal : pick < 0.85 ? PALETTE.cyan : PALETTE.white;
    const cx = Math.cos(th) * rad, cz = Math.sin(th) * rad;
    for (let i = 0; i < perClump; i++) {
      const u = (r() - 0.5) * len, v = gauss(r) * dep, w = gauss(r) * hgt;
      b.push([cx + Math.cos(ang) * u - Math.sin(ang) * v, y + w, cz + Math.sin(ang) * u + Math.cos(ang) * v], c, 1 + r() * 1.4, r());
    }
  }
  // loose sparkle in the same volume
  for (let i = 0; i < 4000; i++) {
    const rad = 0.3 + Math.sqrt(r()) * 1.9, th = r() * Math.PI * 2;
    b.push([Math.cos(th) * rad, 0.05 - r() * 1.8, Math.sin(th) * rad], r() < 0.7 ? PALETTE.cyan : PALETTE.white, 0.6 + r() ** 3 * 2.4, r());
  }
  return b.trim();
}

/* ------------------------------------------------------------------- rings */

export function rings() {
  const r = rng(41);
  const L = new LineBuf();
  const circle = (rad, y, seg = 160, a0 = 0, a1 = Math.PI * 2) => {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg;
      pts.push([Math.cos(a) * rad, y, Math.sin(a) * rad]);
    }
    return pts;
  };
  // canopy tracks
  [0.2, 0.31, 0.44, 0.52, 0.6, 0.74, 0.86, 1.0, 1.16, 1.34].forEach((rad, i) => {
    L.poly(circle(rad, WORLD.canopyY, 220), i % 2 ? PALETTE.white : PALETTE.ring, () => (i % 3 === 0 ? 0.85 : 0.55));
  });
  // broken arcs + tick marks give the canopy its instrument look
  for (let k = 0; k < 26; k++) {
    const rad = 0.25 + r() * 1.05, a0 = r() * Math.PI * 2, span = 0.2 + r() * 0.9;
    L.poly(circle(rad, WORLD.canopyY + 0.004, 40, a0, a0 + span), PALETTE.white, () => 0.6);
  }
  for (let k = 0; k < 120; k++) {
    const rad = 0.6 + r() * 0.6, a = r() * Math.PI * 2, len = 0.015 + r() * 0.03;
    L.seg([Math.cos(a) * rad, WORLD.canopyY, Math.sin(a) * rad], [Math.cos(a) * (rad + len), WORLD.canopyY, Math.sin(a) * (rad + len)], PALETTE.ring, 0.5);
  }
  // funnel rings stepping down the trunk (the "tunnel" seen from above)
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    L.poly(circle(0.95 - t * 0.7, WORLD.canopyY - 0.04 - t * 0.42, 160), PALETTE.ring, () => 0.22 + 0.15 * (1 - t));
  }
  return L.out();
}

/** Radial spokes from the core to the canopy edge (ignite with the core). */
export function spokes(n = 30) {
  const r = rng(43);
  const L = new LineBuf();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + gauss(r) * 0.02;
    const r1 = 0.55 + r() * 0.4;
    L.seg([Math.cos(a) * 0.035, WORLD.ringY, Math.sin(a) * 0.035], [Math.cos(a) * r1, WORLD.canopyY, Math.sin(a) * r1], PALETTE.white, 1, 0.05);
  }
  return L.out();
}

/* ---------------------------------------------------------- chips/stations */

function boxEdges(L, c, half, color, alpha) {
  const [cx, cy, cz] = c, [hx, hy, hz] = half;
  const v = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) v.push([cx + sx * hx, cy + sy * hy, cz + sz * hz]);
  const e = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  e.forEach(([a, b]) => L.seg(v[a], v[b], color, alpha));
}

function boxFill(P, r, c, half, color, n, size = 1) {
  const [cx, cy, cz] = c, [hx, hy, hz] = half;
  // stations read as wireframes with a light particle skin
  n = Math.round(n * 0.35);
  for (let i = 0; i < n; i++) {
    // sample on faces so boxes read as shells
    const f = Math.floor(r() * 3), s = r() < 0.5 ? -1 : 1;
    const p = [(r() * 2 - 1) * hx, (r() * 2 - 1) * hy, (r() * 2 - 1) * hz];
    p[f] = s * [hx, hy, hz][f];
    P.push([cx + p[0], cy + p[1], cz + p[2]], color, size * (0.6 + r() * 0.9), r());
  }
}

/** Small flat data chips scattered along the canopy tracks. */
export function chips(n) {
  const r = rng(53);
  const L = new LineBuf();
  const P = new PointBuf(n * 90);
  for (let k = 0; k < n; k++) {
    const rad = 0.42 + r() * 0.85, th = r() * Math.PI * 2;
    const w = 0.035 + r() * 0.04, d = 0.02 + r() * 0.018;
    const lift = r() < 0.25 ? 0.01 + r() * 0.03 : 0;
    const cx = Math.cos(th) * rad, cz = Math.sin(th) * rad, cy = WORLD.canopyY + lift;
    const ang = th + Math.PI / 2;
    const corner = (u, v) => [cx + Math.cos(ang) * u - Math.sin(ang) * v, cy, cz + Math.sin(ang) * u + Math.cos(ang) * v];
    const pts = [corner(-w, -d), corner(w, -d), corner(w, d), corner(-w, d)];
    const filled = r() < 0.8;
    const pick = r();
    const col = pick < 0.45 ? PALETTE.white : pick < 0.75 ? PALETTE.cyan : PALETTE.teal;
    L.poly(pts, col, () => 0.9, true);
    const m = filled ? 110 : 18;
    for (let i = 0; i < m; i++) {
      const u = (r() * 2 - 1) * w, v = (r() * 2 - 1) * d;
      P.push(corner(u, v), col, 0.7 + r() * 0.6, r());
    }
  }
  return { lines: L.out(), points: P.trim() };
}

// Canopy node positions (labelled stations first, then unlabelled structures)
export const STATION_NODES = [
  [0.294, 0.123, 0.611],
  [-0.381, 0.119, 0.55],
  [-0.636, 0.122, -0.187],
  [0.043, 0.13, -0.614],
  [0.649, 0.12, -0.166],
  [-0.85, 0.12, 0.15],
  [0.78, 0.12, 0.5],
];

/** Wireframe + particle shells for the payment-infrastructure stations. */
export function stations() {
  const r = rng(61);
  const L = new LineBuf();
  const P = new PointBuf(60000);
  const base = WORLD.canopyY;
  const tops = [];
  const shapes = [
    // 0 Payment Processor: 2×2×2 stacked cubes
    (c) => {
      const s = 0.034;
      for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) {
        const cc = [c[0] + x * s, base + s + y * 2 * s, c[2] + z * s];
        boxEdges(L, cc, [s, s, s], PALETTE.white, 0.85);
        boxFill(P, r, cc, [s, s, s], PALETTE.white, 260);
      }
      return base + 4 * s;
    },
    // 1 Issuing Bank: ribbed slab
    (c) => {
      const h = 0.085, cc = [c[0], base + h, c[2]];
      boxEdges(L, cc, [0.06, h, 0.03], PALETTE.blue, 0.9);
      for (let i = -2; i <= 2; i++) L.seg([cc[0] + i * 0.024, base, cc[2] + 0.03], [cc[0] + i * 0.024, base + 2 * h, cc[2] + 0.03], PALETTE.blue, 0.7);
      boxFill(P, r, cc, [0.06, h, 0.03], PALETTE.blue, 2600);
      return base + 2 * h;
    },
    // 2 Network: octagonal prism
    (c) => {
      const R = 0.07, h = 0.11, ring = (y) => Array.from({ length: 8 }, (_, i) => [c[0] + Math.cos((i / 8) * Math.PI * 2) * R, y, c[2] + Math.sin((i / 8) * Math.PI * 2) * R]);
      const lo = ring(base), hi = ring(base + h);
      L.poly(lo, PALETTE.teal, () => 0.8, true);
      L.poly(hi, PALETTE.teal, () => 0.8, true);
      lo.forEach((p, i) => L.seg(p, hi[i], PALETTE.teal, 0.8));
      for (let i = 0; i < 3800; i++) {
        const a = r() * Math.PI * 2, y = base + r() * h, rr = R * (0.93 + r() * 0.07);
        P.push([c[0] + Math.cos(a) * rr, y, c[2] + Math.sin(a) * rr], PALETTE.teal, 0.6 + r() * 0.9, r());
      }
      return base + h;
    },
    // 3 Acquiring Bank: plus-shaped prism
    (c) => {
      const s = 0.028;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([x, z]) => {
        const cc = [c[0] + x * 2 * s, base + 1.6 * s, c[2] + z * 2 * s];
        boxEdges(L, cc, [s, 1.6 * s, s], PALETTE.white, 0.85);
        boxFill(P, r, cc, [s, 1.6 * s, s], PALETTE.white, 320);
      });
      return base + 3.2 * s;
    },
    // 4 Payment Gateway: stepped blocks
    (c) => {
      const parts = [[[0, 0.05, 0], [0.05, 0.05, 0.035]], [[0.05, 0.03, 0.03], [0.03, 0.03, 0.03]]];
      parts.forEach(([o, hh]) => {
        const cc = [c[0] + o[0], base + o[1], c[2] + o[2]];
        boxEdges(L, cc, hh, PALETTE.cyan, 0.85);
        boxFill(P, r, cc, hh, PALETTE.cyan, 1500);
      });
      return base + 0.1;
    },
  ];
  // node → shape, matched to where each structure sits in the reference's wide shots
  const SHAPE_FOR_NODE = [3, 4, 4, 1, 0, 2, 1];
  STATION_NODES.forEach((node, i) => tops.push(shapes[SHAPE_FOR_NODE[i]](node)));
  return { lines: L.out(), points: P.trim(), tops };
}

/* --------------------------------------------------------- funnel + inflow */

const bez = (a, b, c, d, t) => {
  const u = 1 - t;
  return [0, 1, 2].map((k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
};

export function funnel(n, models) {
  const r = rng(71);
  const curves = [];
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2, rad = 0.28 + r() * 0.85;
    const a = [Math.cos(th) * rad, WORLD.canopyY, Math.sin(th) * rad];
    const sr = 0.05 + r() * 0.08, st = th + gauss(r) * 0.4;
    const b = [Math.cos(th) * rad * 0.35, -0.12, Math.sin(th) * rad * 0.35];
    const m = models[i % models.length].pos;
    const c = [Math.cos(st) * sr, -0.42, Math.sin(st) * sr];
    const d = [m[0] + gauss(r) * 0.04, m[1] + gauss(r) * 0.04, m[2] + gauss(r) * 0.04];
    curves.push([a, b, c, d]);
  }
  const L = new LineBuf();
  curves.forEach(([a, b, c, d], i) => {
    const pts = [];
    for (let k = 0; k <= 28; k++) pts.push(bez(a, b, c, d, k / 28));
    L.poly(pts, i % 4 === 0 ? PALETTE.white : PALETTE.ring, (t) => 0.15 + 0.5 * Math.sin(Math.PI * t));
  });
  return { lines: L.out(), curves };
}

/** Particles that travel down the funnel curves (animated in the shader). */
export function inflow(curves, perCurve) {
  const r = rng(73);
  const n = curves.length * perCurve;
  const P = new PointBuf(n);
  const ctrl = [new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3)];
  curves.forEach((cv, ci) => {
    for (let k = 0; k < perCurve; k++) {
      const i = P.push(cv[0], r() < 0.7 ? PALETTE.cyan : PALETTE.white, 0.9 + r() * 1.2, r());
      cv.forEach((p, j) => ctrl[j].set(p, i * 3));
      void ci;
    }
  });
  P.trim();
  P.ctrl = ctrl;
  return P;
}

/* ------------------------------------------------------------------ models */

export const MODELS = [
  { key: 'Risk', label: 'Chargeback Protection', pos: [-0.114, -0.475, 0.215], color: 'white' },
  { key: 'SuccessRate', label: 'Success Rate Optimization', pos: [-0.3, -0.71, -0.106], color: 'blue' },
  { key: 'Fraud', label: 'Fraud Detection', pos: [0.32, -0.908, -0.464], color: 'teal' },
  { key: 'Checkout', label: 'Checkout Personalisation', pos: [0.231, -0.783, 0.41], color: 'grey' },
];

// Tilt the checkout torus so it reads as a ring from both side-on cameras
function torusTilt([x, y, z]) {
  const az = -0.85, ay = 0.7;
  const x1 = x * Math.cos(az) - y * Math.sin(az), y1 = x * Math.sin(az) + y * Math.cos(az);
  return [x1 * Math.cos(ay) + z * Math.sin(ay), y1, -x1 * Math.sin(ay) + z * Math.cos(ay)];
}

function modelPoint(kind, r) {
  switch (kind) {
    case 'Risk': { // sphere shell with a bright cap
      const m = 2 * r() - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - m * m), rr = 0.105 * (0.9 + r() * 0.12);
      return [Math.cos(th) * s * rr, m * rr, Math.sin(th) * s * rr];
    }
    case 'SuccessRate': { // cone, apex up
      const h = r(), a = r() * Math.PI * 2, rad = 0.1 * h * Math.sqrt(r() < 0.6 ? 1 : r());
      return [Math.cos(a) * rad, 0.14 - h * 0.28, Math.sin(a) * rad];
    }
    case 'Fraud': { // faceted blob (icosahedral-ish)
      const m = 2 * r() - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - m * m);
      const p = [Math.cos(th) * s, m, Math.sin(th) * s];
      const facet = 1 / Math.max(Math.abs(p[0] * 0.85 + p[1] * 0.5), Math.abs(p[1] * 0.9 - p[2] * 0.4), Math.abs(p[2] * 0.8 + p[0] * 0.55), 0.62);
      const rr = 0.066 * Math.min(1.35, facet) * (0.92 + r() * 0.1);
      return [p[0] * rr, p[1] * rr, p[2] * rr];
    }
    default: { // torus, tilted
      const a = r() * Math.PI * 2, b = r() * Math.PI * 2, R = 0.1, t = 0.048 * Math.sqrt(r() * 0.4 + 0.6);
      return torusTilt([Math.cos(a) * (R + Math.cos(b) * t), Math.sin(b) * t, Math.sin(a) * (R + Math.cos(b) * t)]);
    }
  }
}

/** Model particles carry their model-space position and a band parameter for the merge. */
export function modelPoints(perModel) {
  const r = rng(83);
  const n = perModel * MODELS.length;
  const P = new PointBuf(n);
  const band = new Float32Array(n * 3);
  const which = new Float32Array(n);
  MODELS.forEach((m, mi) => {
    for (let k = 0; k < perModel; k++) {
      const p = modelPoint(m.key, r);
      const i = P.push([m.pos[0] + p[0], m.pos[1] + p[1], m.pos[2] + p[2]], PALETTE[m.color], 0.6 + r() ** 2 * 1.0, r());
      band.set([r() * Math.PI * 2, r() * Math.PI * 2, Math.sqrt(r())], i * 3);
      which[i] = mi;
    }
  });
  P.trim();
  P.band = band;
  P.which = which;
  return P;
}

export function modelWires() {
  const L = new LineBuf();
  MODELS.forEach((m, mi) => {
    const o = m.pos, col = PALETTE[m.color];
    const add = (pts, closed = true) => L.poly(pts.map((p) => [o[0] + p[0], o[1] + p[1], o[2] + p[2]]), col, () => 0.6, closed);
    const circle = (rad, y, n = 48, rot = 0) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const p = [Math.cos(a) * rad, y, Math.sin(a) * rad];
      return rot ? [p[0], p[1] * Math.cos(rot) - p[2] * Math.sin(rot), p[1] * Math.sin(rot) + p[2] * Math.cos(rot)] : p;
    });
    if (m.key === 'Risk') {
      for (let k = -3; k <= 3; k++) { const y = (k / 4) * 0.105; add(circle(Math.sqrt(0.105 ** 2 - y * y), y)); }
    } else if (m.key === 'SuccessRate') {
      add(circle(0.1, -0.14));
      add(circle(0.05, 0));
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; add([[0, 0.14, 0], [Math.cos(a) * 0.1, -0.14, Math.sin(a) * 0.1]], false); }
    } else if (m.key === 'Fraud') {
      const v = [[0, 0.09, 0], [0.08, 0.02, 0.03], [-0.02, 0.03, 0.085], [-0.08, 0.01, -0.03], [0.02, 0.02, -0.08], [0.03, -0.08, 0.02], [-0.04, -0.07, -0.02]];
      const e = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1], [5, 1], [5, 2], [6, 3], [6, 4], [5, 6], [6, 2], [5, 4]];
      e.forEach(([a, b]) => add([v[a], v[b]], false));
    } else {
      [0.148, 0.052, 0.1].forEach((rad) => add(circle(rad, 0, 64).map(torusTilt)));
    }
    void mi;
  });
  return L.out();
}

/* -------------------------------------------------------------------- core */

export function corePoints(n) {
  const r = rng(97);
  const P = new PointBuf(n);
  for (let i = 0; i < n; i++) {
    const m = 2 * r() - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - m * m), rr = 0.026 * Math.cbrt(r() * 0.5 + 0.5);
    P.push([Math.cos(th) * s * rr, m * rr, Math.sin(th) * s * rr], r() < 0.7 ? PALETTE.white : PALETTE.cyan, 0.7 + r() * 0.8, r());
  }
  return P.trim();
}

export function coreWires() {
  const L = new LineBuf();
  for (let k = 0; k < 6; k++) {
    const rot = (k / 6) * Math.PI;
    const pts = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2;
      return [Math.cos(a) * 0.028 * Math.cos(rot), Math.sin(a) * 0.028, Math.cos(a) * 0.028 * Math.sin(rot)];
    });
    L.poly(pts, PALETTE.white, () => 0.7, true);
  }
  return L.out();
}
