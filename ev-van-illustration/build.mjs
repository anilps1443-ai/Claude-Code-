import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../.claude/skills/anatomy/kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1600;
const H = 1000;
const AZIMUTH = 42;

// ---------------------------------------------------------------- the world
// Van: front toward +x, 172 long, 64 wide. Battery pack: a flat transparent box in front of it.
const VX = -96;
const VL = 172;
const VW = 32; // half width
const WHEEL = { r: 14, z: 14, rear: 38, front: 142 };
const PK = { x: 106, y: 8, w: 134, d: 74, r: 0 };
const PK_Z0 = 3;
const PK_Z1 = 27;
const C = [84, 28]; // centre of the ground rings

const vanBox = { x: VX, y: -VW, w: VL, d: VW * 2, r: 0 };
const P = k.fitProjection(
  [...k.boxCorners(vanBox, 0, 80), ...k.boxCorners(PK, 0, PK_Z1)],
  W,
  H,
  { pad: 150, azimuth: AZIMUTH },
);
P.origin[1] += 40;
const at = (point) => k.iso(point, P);
const V = (x, y, z) => [x + VX, y, z];
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const poly = (points) => k.pathOf(points.map(at), true);
const line3 = (points) => k.pathOf(points.map(at));
const byKey = (list) => [...list].sort((a, b) => a.key - b.key).map((item) => item.svg).join("");
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);

// ---------------------------------------------------------------- environment (faint, fades toward the edges)
function rings() {
  const radii = [112, 140, 176, 220, 270, 330, 396];
  const alphas = [0.9, 0.7, 0.55, 0.42, 0.3, 0.2, 0.12];
  return radii
    .map((r, i) => `<path class="ring" style="stroke-opacity:${alphas[i]}" d="${k.ring(C[0], C[1], r, 0, P, 140)}"/>`)
    .join("");
}

function building({ x, y, w, d, h, bands = 0 }) {
  const out = [];
  const plan = { x, y, w, d, r: 0 };
  out.push(S(k.slabOf(plan, 0, h, P, 2, 0), { tone: "faint", crease: "faint" }));
  // faint floor bands, running edge to edge on both visible faces
  for (let i = 1; i <= bands; i++) {
    const z = (h / (bands + 1)) * i;
    out.push(L(k.segment([x, y + d, z], [x + w, y + d, z], P), { tone: "faint" }));
    out.push(L(k.segment([x + w, y, z], [x + w, y + d, z], P), { tone: "faint" }));
  }
  return { key: depth(x + w / 2, y + d / 2, h / 2), svg: out.join("") };
}

function tree(x, y, s = 1) {
  const out = [];
  out.push(S(k.cylinder(x, y, 1.5 * s, 0, 8 * s, P, 10), { tone: "faint", crease: "none" }));
  const cone = (z, r, h) => G.solidOf([[0, r], [h, 0]], G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]), P, { steps: 9 });
  out.push(S(cone(7 * s, 11 * s, 19 * s), { tone: "faint" }));
  out.push(S(cone(16 * s, 8 * s, 17 * s), { tone: "faint" }));
  return { key: depth(x, y, 12 * s), svg: out.join("") };
}

const BUILDINGS = [
  { x: -330, y: -150, w: 44, d: 40, h: 64, bands: 3 },
  { x: -215, y: -235, w: 38, d: 34, h: 100, bands: 6 },
  { x: -70, y: -285, w: 50, d: 44, h: 82, bands: 5 },
  { x: 110, y: -280, w: 42, d: 40, h: 112, bands: 7 },
  { x: 262, y: -205, w: 40, d: 36, h: 72, bands: 4 },
  { x: 345, y: -105, w: 34, d: 34, h: 50, bands: 2 },
  { x: -352, y: -10, w: 38, d: 44, h: 46, bands: 2 },
];
const TREES = [
  [-270, -120, 0.95], [-120, -220, 1.0], [10, -235, 0.9], [60, -205, 0.8], [215, -190, 1.0], [310, -160, 0.85],
  [-300, 60, 0.9], [-250, 140, 0.8], [340, 20, 0.9], [330, 130, 0.8], [-130, 200, 0.75], [200, 210, 0.8],
];

function environment() {
  const items = [
    ...BUILDINGS.map(building),
    ...TREES.map(([x, y, s]) => tree(x, y, s)),
  ];
  return `<g class="ring-group">${rings()}</g><g class="ghost">${byKey(items)}</g>`;
}

// ---------------------------------------------------------------- the van
const bodyFrame = { o: [VX, 0, 0], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };
const CAB = [[0, 9], [0, 70], [5, 76], [118, 76], [146, 52], [146, 9]];
const HOOD = [[146, 9], [146, 52], [172, 45], [172, 9]];
const WIND_SLOPE = (52 - 76) / (146 - 118);

function wheel(side, x) {
  const F = G.frameOf([VX + x, 0, WHEEL.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const out = [];
  if (side < 0) {
    out.push(`<g class="tire">${S(G.disc(-33.5, -25, WHEEL.r, F, P), { tone: "hi" })}</g>`);
    return out.join("");
  }
  out.push(`<path class="arch" d="${G.circleOf(F, 33.45, WHEEL.r + 2, P, 64)}"/>`);
  out.push(`<g class="tire">${S(G.disc(25, 33.5, WHEEL.r, F, P), { tone: "hi" })}${S(G.disc(33.5, 33.9, WHEEL.r - 2.6, F, P), { tone: "mid" })}</g>`);
  out.push(S(G.disc(33.9, 34.4, 8.7, F, P), { tone: "hi" }));
  out.push(L(G.spokesOf(F, 34.4, 3, 8.7, 5, P, { phase: 0.3 }), { tone: "mid" }));
  out.push(S(G.disc(34.4, 35.2, 2.9, F, P), { tone: "hi" }));
  out.push(D([at(V(x, 35.2, WHEEL.z))], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function mirror(side) {
  const y0 = side > 0 ? VW : -VW - 9;
  return S(k.slabOf({ x: VX + 132, y: y0, w: 6, d: 9, r: 2 }, 53, 9, P, 3, 0.3), { tone: "mid" });
}

function van() {
  const out = [];
  out.push(`<path class="halo-blue" d="${k.haloOf({ x: VX - 4, y: -VW - 2, w: VL + 8, d: VW * 2 + 6, r: 10 }, 0, 4, P)}"/>`);
  // far side first: wheels and mirror peek out from behind the body
  out.push(wheel(-1, WHEEL.rear), wheel(-1, WHEEL.front), mirror(-1));
  // body: two convex side-profile prisms
  out.push(`<g class="van">`);
  out.push(S(G.prismOf(bodyFrame, CAB, -VW, VW, P), { tone: "hi", crease: "faint" }));
  out.push(S(G.prismOf(bodyFrame, HOOD, -VW, VW, P), { tone: "hi", crease: "faint" }));
  // roof rails, edge to edge along the roof
  for (const y of [-25, 25]) out.push(L(line3([V(5, y, 76), V(118, y, 76)]), { tone: "lo" }));
  // windshield: a glass quad on the slope
  const slope = (t) => [118 + 28 * t, 76 - 24 * t];
  const [t0x, t0z] = slope(0.09);
  const [t1x, t1z] = slope(0.9);
  out.push(`<path class="glass" d="${poly([V(t0x, -26, t0z), V(t0x, 26, t0z), V(t1x, 26, t1z), V(t1x, -26, t1z)])}"/>`);
  // side: cab door, glass, cargo door, belt line
  const face = VW + 0.12;
  out.push(L(poly([V(96, face, 16), V(96, face, 72), V(118, face, 72), V(134, face, 58.3), V(134, face, 16)]), { tone: "lo" }));
  out.push(`<path class="glass" d="${poly([V(100, face, 46), V(100, face, 68), V(117, face, 68), V(131, face, 56), V(131, face, 46)])}"/>`);
  out.push(L(poly([V(54, face, 16), V(54, face, 70), V(90, face, 70), V(90, face, 16)]), { tone: "lo" }));
  out.push(L(line3([V(0, face, 40), V(172, face, 40)]), { tone: "faint" }));
  out.push(S(k.slabOf({ x: VX + 82, y: VW, w: 5.4, d: 1.8, r: 0.8 }, 36, 3, P, 2, 0), { tone: "mid", crease: "none" }));
  // charge port flap on the front fender
  out.push(L(poly([V(152, face, 33), V(162, face, 33), V(162, face, 41), V(152, face, 41)]), { tone: "mid" }));
  out.push(D([at(V(157, face, 37))], { size: 0.7, tone: "hi" }));
  // floor battery hint: a glowing strip along the sill, ending on the wheel arches
  const sill = line3([V(55.6, face, 11.5), V(124.4, face, 11.5)]);
  out.push(`<path class="sill-glow" d="${sill}"/><path class="sill" d="${sill}"/>`);
  // front: light bar, lower air intake, headlamp slots
  const nose = VL + 0.12;
  out.push(`<path class="lamp" d="${poly([V(nose, -27, 33.2), V(nose, 27, 33.2), V(nose, 27, 35.6), V(nose, -27, 35.6)])}"/>`);
  out.push(L(poly([V(nose, -24, 12), V(nose, 24, 12), V(nose, 24, 25), V(nose, -24, 25)]), { tone: "lo" }));
  out.push(L(poly([V(nose, -28, 28), V(nose, -22, 28), V(nose, -22, 31), V(nose, -28, 31)]), { tone: "lo" }));
  out.push(L(poly([V(nose, 22, 28), V(nose, 28, 28), V(nose, 28, 31), V(nose, 22, 31)]), { tone: "lo" }));
  out.push(`</g>`);
  out.push(mirror(1));
  out.push(`<g class="van">${wheel(1, WHEEL.rear)}${wheel(1, WHEEL.front)}</g>`);
  return out.join("");
}

// ---------------------------------------------------------------- the battery pack (transparent)
const MODULE = { w: 25, d: 28 };
const ROW_Y = [PK.y + 5, PK.y + 5 + MODULE.d + 8];
const MOD_X0 = PK.x + 9.5;
const MOD_GAP = 5;
const MOD_Z0 = PK_Z0 + 3;
const MOD_H = 10;

function pack() {
  const out = [];
  const back = [];
  const front = [];
  // ground glow and soft shadow
  out.push(`<path class="halo-blue" d="${k.haloOf(k.insetPlan(PK, -2), 0, 3, P)}"/>`);
  out.push(`<path class="glow-ground" d="${k.haloOf(k.insetPlan(PK, -6), 0, 3, P)}"/>`);
  // feet
  const feet = k.corners(PK, 9).sort((a, b) => depth(a[0], a[1]) - depth(b[0], b[1])).slice(1);
  for (const [x, y] of feet) out.push(`<g class="batt-foot">${S(k.cylinder(x, y, 4, 0, PK_Z0, P, 16), { tone: "mid", crease: "none" })}</g>`);
  // connector block on the end that faces the van
  const conn = { x: PK.x - 9, y: PK.y + PK.d / 2 - 10, w: 9, d: 20, r: 1.6 };
  out.push(`<g class="batt-conn">${S(k.slabOf(conn, 6, 11, P, 3, 0.4), { tone: "hi", crease: "faint" })}`);
  out.push(D([at([conn.x + 4.5, conn.y + 5, 17]), at([conn.x + 4.5, conn.y + 15, 17])], { size: 0.8, tone: "hi" }));
  out.push(`</g>`);
  out.push(`<g class="batt">`);
  // cooling plate
  out.push(S(k.slabOf(k.insetPlan(PK, 3), PK_Z0, 2.4, P, 2, 0), { tone: "mid", crease: "faint" }));
  // modules, back row first
  const mods = [];
  for (const [rowIndex, y] of ROW_Y.entries()) for (let i = 0; i < 4; i++) mods.push({ x: MOD_X0 + i * (MODULE.w + MOD_GAP), y, rowIndex });
  mods.sort((a, b) => depth(a.x, a.y) - depth(b.x, b.y));
  for (const m of mods) {
    const plan = { x: m.x, y: m.y, w: MODULE.w, d: MODULE.d, r: 1.2 };
    out.push(`<g class="mod">${S(k.slabOf(plan, MOD_Z0, MOD_H, P, 3, 0.3), { tone: "mid", crease: "faint" })}</g>`);
    // prismatic cells: hairlines on both visible faces, edge to edge, and two busbars on the lid
    const hair = [];
    for (let t = 3.5; t < MODULE.w - 2; t += 3.5) hair.push(k.segment([m.x + t, m.y + MODULE.d, MOD_Z0], [m.x + t, m.y + MODULE.d, MOD_Z0 + MOD_H], P));
    for (let t = 3.5; t < MODULE.d - 2; t += 3.5) hair.push(k.segment([m.x + MODULE.w, m.y + t, MOD_Z0], [m.x + MODULE.w, m.y + t, MOD_Z0 + MOD_H], P));
    out.push(L(hair.join(""), { tone: "faint" }));
    const top = MOD_Z0 + MOD_H;
    const bars = [-1, 1].map((sign) => k.planOutline({ x: m.x + 4, y: m.y + MODULE.d / 2 + sign * 4.4 - 1.2, w: MODULE.w - 8, d: 2.4, r: 0.6 }, top, P, 2)).join("");
    out.push(L(bars, { tone: "lo" }));
    out.push(D([at([m.x + 2.2, m.y + MODULE.d / 2, top]), at([m.x + MODULE.w - 2.2, m.y + MODULE.d / 2, top])], { size: 0.55, tone: "mid" }));
  }
  // coolant / busbar line through the aisle, with terminal dots at both ends
  const aisleY = ROW_Y[0] + MODULE.d + 4;
  out.push(k.wireSvg(at([MOD_X0, aisleY, MOD_Z0 + MOD_H]), at([MOD_X0 + 4 * MODULE.w + 3 * MOD_GAP, aisleY, MOD_Z0 + MOD_H]), { tone: "mid", size: 1 }));
  // casing: translucent faces, then the full wireframe including the hidden back edges
  out.push(S(k.slabOf(PK, PK_Z0, PK_Z1 - PK_Z0, P, 2, 0), { tone: "hi", crease: "lo" }));
  const x0 = PK.x, x1 = PK.x + PK.w, y0 = PK.y, y1 = PK.y + PK.d;
  const hidden = [
    [[x0, y0, PK_Z0], [x1, y0, PK_Z0]], [[x0, y0, PK_Z0], [x0, y1, PK_Z0]],
    [[x0, y0, PK_Z0], [x0, y0, PK_Z1]],
  ];
  const shown = [
    [[x1, y0, PK_Z0], [x1, y1, PK_Z0]], [[x0, y1, PK_Z0], [x1, y1, PK_Z0]],
    [[x1, y0, PK_Z0], [x1, y0, PK_Z1]], [[x0, y1, PK_Z0], [x0, y1, PK_Z1]],
  ];
  out.push(`<g class="wire-hidden">${hidden.map((e) => L(k.segment(e[0], e[1], P), { tone: "lo" })).join("")}</g>`);
  out.push(`<g class="wire-shown">${shown.map((e) => L(k.segment(e[0], e[1], P), { tone: "lo" })).join("")}</g>`);
  // top rim inset: a second wire frame on the lid
  out.push(L(k.planOutline(k.insetPlan(PK, 4), PK_Z1, P, 2), { tone: "faint" }));
  out.push(D(k.corners(PK, 5).map(([x, y]) => at([x, y, PK_Z1])), { size: 0.5, tone: "mid" }));
  out.push(`</g>`);
  return out.join("");
}

// ---------------------------------------------------------------- charging cable
function cable() {
  const port = V(157, VW + 0.12, 37);
  const plug = [PK.x - 9 + 4.5, PK.y + PK.d / 2 - 5, 17];
  const bez = (t) => {
    const p = [port, [port[0] + 26, port[1] + 4, 44], [plug[0] - 2, plug[1] + 22, 30], plug];
    const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    return [0, 1, 2].map((i) => a * p[0][i] + b * p[1][i] + c * p[2][i] + d * p[3][i]);
  };
  const pts = Array.from({ length: 41 }, (_, i) => bez(i / 40));
  const d = line3(pts);
  return `<path class="cable-glow" d="${d}"/><path class="cable" d="${d}"/>` +
    `<circle class="cable-end" cx="${at(port)[0].toFixed(1)}" cy="${at(port)[1].toFixed(1)}" r="1.9"/>` +
    `<circle class="cable-end" cx="${at(plug)[0].toFixed(1)}" cy="${at(plug)[1].toFixed(1)}" r="1.9"/>`;
}

// ---------------------------------------------------------------- technical wireframe cage around the van
function cage() {
  const x0 = VX - 6, x1 = VX + VL + 6, y0 = -VW - 6, y1 = VW + 6, z0 = 0, z1 = 86;
  const c = (x, y, z) => [x, y, z];
  const edges = [
    [c(x0, y0, z0), c(x1, y0, z0)], [c(x1, y0, z0), c(x1, y1, z0)], [c(x1, y1, z0), c(x0, y1, z0)], [c(x0, y1, z0), c(x0, y0, z0)],
    [c(x0, y0, z1), c(x1, y0, z1)], [c(x1, y0, z1), c(x1, y1, z1)], [c(x1, y1, z1), c(x0, y1, z1)], [c(x0, y1, z1), c(x0, y0, z1)],
    [c(x0, y0, z0), c(x0, y0, z1)], [c(x1, y0, z0), c(x1, y0, z1)], [c(x1, y1, z0), c(x1, y1, z1)], [c(x0, y1, z0), c(x0, y1, z1)],
  ];
  return `<g class="cage">${edges.map(([a, b]) => `<path d="${k.segment(a, b, P)}"/>`).join("")}</g>`;
}

// ---------------------------------------------------------------- page
const centre = at([C[0], C[1], 0]);
const defs = `
<defs>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="softer" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="tight" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>
  <linearGradient id="glassfill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f1f8"/><stop offset="1" stop-color="#bfd1e2"/></linearGradient>
  <radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="${centre[0].toFixed(1)}" cy="${centre[1].toFixed(1)}" r="${W * 0.64}" gradientTransform="translate(${centre[0].toFixed(1)} ${centre[1].toFixed(1)}) scale(1 .6) translate(${(-centre[0]).toFixed(1)} ${(-centre[1]).toFixed(1)})">
    <stop offset="0.58" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
  </radialGradient>
  <mask id="envmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
</defs>`;

const css = `
svg.iso[data-theme="light"]{--anatomy-weight:.75px;--anatomy-paper:#ffffff;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#e1e9f1;--anatomy-shade-1:#e9eff5;--anatomy-shade-2:#f1f5f9;--anatomy-shade-3:#f8fafc;
  --anatomy-hi:#8097ae;--anatomy-mid:#a9b9ca;--anatomy-lo:#c4d0dc;--anatomy-faint:#dfe7ef;--anatomy-dot:#8097ae}
.ring{fill:none;stroke:#9fb5ca;stroke-width:.8px;vector-effect:non-scaling-stroke}
.ghost{--anatomy-paper:#ffffff;--anatomy-shade-0:#f1f5f9;--anatomy-shade-1:#f5f8fb;--anatomy-shade-2:#f8fafc;--anatomy-shade-3:#fbfcfd;--anatomy-top:#ffffff;
  --anatomy-hi:#bccbdb;--anatomy-mid:#c9d6e3;--anatomy-lo:#d4dfea;--anatomy-faint:#dde6ef;opacity:1}
.van{--anatomy-paper:#fcfdff;--anatomy-shade-0:#d5e0eb;--anatomy-shade-1:#e2eaf3;--anatomy-shade-2:#edf2f8;--anatomy-shade-3:#f6f9fc;--anatomy-top:#ffffff;
  --anatomy-hi:#8fa4bb;--anatomy-mid:#aebed0;--anatomy-lo:#c6d3df;--anatomy-faint:#dde6ee}
.tire{--anatomy-paper:#8ea1b7;--anatomy-shade-0:#7c8fa6;--anatomy-shade-1:#889bb1;--anatomy-shade-2:#94a6bb;--anatomy-shade-3:#a0b1c4;--anatomy-top:#a9b9cb;
  --anatomy-hi:#667d96;--anatomy-mid:#7f93aa;--anatomy-lo:#92a4b9}
.arch{fill:#c3d0de;stroke:none}
.glass{fill:url(#glassfill);stroke:#8fa4bb;stroke-width:.7px;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.lamp{fill:#c8f2ff;stroke:#2fbfee;stroke-width:.8px;vector-effect:non-scaling-stroke}
.halo-blue{fill:#6f88a4;opacity:.2;filter:url(#soft);transform:translateY(4px)}
.glow-ground{fill:#27c0f0;opacity:.3;filter:url(#softer)}
.batt-foot,.batt-conn{--anatomy-shade-0:#cfe9f4;--anatomy-shade-1:#dcf0f8;--anatomy-shade-2:#e8f6fb;--anatomy-shade-3:#f2fafd;--anatomy-hi:#3dbfe9;--anatomy-mid:#7fd3ef;--anatomy-lo:#a9e2f4;--anatomy-faint:#c8ecf8}
.batt .iso-fill{fill:rgba(110,222,250,.035)}
.batt .iso-shade[data-shade="0"]{fill:rgba(30,180,232,.12)}
.batt .iso-shade[data-shade="1"]{fill:rgba(46,190,238,.09)}
.batt .iso-shade[data-shade="2"]{fill:rgba(70,200,242,.07)}
.batt .iso-shade[data-shade="3"]{fill:rgba(96,212,246,.05)}
.batt .iso-top{fill:rgba(120,224,250,.09)}
.batt .mod .iso-fill{fill:rgba(110,222,250,.02)}
.batt .mod .iso-shade[data-shade="0"]{fill:rgba(30,180,232,.07)}
.batt .mod .iso-shade[data-shade="1"]{fill:rgba(46,190,238,.05)}
.batt .mod .iso-shade[data-shade="2"]{fill:rgba(70,200,242,.04)}
.batt .mod .iso-shade[data-shade="3"]{fill:rgba(96,212,246,.03)}
.batt .mod .iso-top{fill:rgba(140,230,252,.07)}
.batt .iso-edge{stroke:#25b8ea;stroke-opacity:.9}
.batt .iso-crease{stroke:#50ccf1;stroke-opacity:.55}
.batt .iso-line{stroke:#4cc9f0;stroke-opacity:.55}
.batt .iso-line[data-tone="faint"]{stroke-opacity:.45}
.batt .iso-line[data-tone="mid"]{stroke-opacity:.6}
.batt .wire-hidden .iso-line{stroke:#6fd5f4;stroke-opacity:.5;stroke-dasharray:2.5 2.5}
.batt .wire-shown .iso-line{stroke:#25b8ea;stroke-opacity:.8}
.batt .iso-wire-end{fill:#fff;stroke:#25b8ea}
.batt .iso-dots circle,.batt circle{fill:#25b8ea}
.sill{fill:none;stroke:#25b8ea;stroke-width:1.1px;stroke-linecap:round;vector-effect:non-scaling-stroke}
.sill-glow{fill:none;stroke:#2cc6f2;stroke-width:4px;stroke-linecap:round;opacity:.4;filter:url(#tight);vector-effect:non-scaling-stroke}
.foot{fill:none;stroke:#b4c5d6;stroke-width:.8px;stroke-dasharray:2 5;stroke-linecap:round;vector-effect:non-scaling-stroke}
.foot-cyan{fill:none;stroke:#62cdf0;stroke-width:.8px;stroke-dasharray:2 5;stroke-linecap:round;vector-effect:non-scaling-stroke}
.cage path{fill:none;stroke:#8fb4cf;stroke-width:.7px;stroke-opacity:.55;stroke-dasharray:1.6 4;stroke-linecap:round;vector-effect:non-scaling-stroke}
.cable{fill:none;stroke:#1fb4e8;stroke-width:1.3px;stroke-linecap:round;vector-effect:non-scaling-stroke}
.cable-glow{fill:none;stroke:#2cc6f2;stroke-width:5px;stroke-linecap:round;opacity:.5;filter:url(#tight);vector-effect:non-scaling-stroke}
.cable-end{fill:#fff;stroke:#1fb4e8;stroke-width:1px}
`;

const footprints = `<path class="foot" d="${k.planOutline({ x: VX - 14, y: -VW - 14, w: VL + 28, d: VW * 2 + 28, r: 16 }, 0, P, 8)}"/><path class="foot-cyan" d="${k.planOutline({ x: PK.x - 16, y: PK.y - 14, w: PK.w + 32, d: PK.d + 28, r: 14 }, 0, P, 8)}"/>`;

const body = [
  `<style>${css}</style>`,
  defs,
  `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
  `<g mask="url(#envmask)">${environment()}</g>`,
  footprints,
  van(),
  cage(),
  pack(),
  cable(),
].join("");

let svg = k.figureSvg({
  width: W,
  height: H,
  standalone: "light",
  label: "Minimalist isometric illustration: a white electric delivery van beside a transparent cyan EV battery pack, linked by a glowing charging cable, with faint buildings, trees and elliptical ground rings.",
  body,
});
svg = svg.replace("<svg ", `<svg width="${W}" height="${H}" `);
writeFileSync(join(HERE, "ev-van-battery.svg"), svg);
writeFileSync(join(HERE, "preview.html"), `<!doctype html><html><head><meta charset="utf-8"><title>EV van and battery</title><style>html,body{margin:0;background:#fff}#art{zoom:var(--z,1)}</style></head><body><div id="art">${svg}</div></body></html>`);
console.log("wrote ev-van-battery.svg", Math.round(svg.length / 1024) + " KB");
