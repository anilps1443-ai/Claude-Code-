// Fig: the EV journey logger. An eight-channel strip-chart recorder: fanfold
// paper feeds across a platen, under a bridge of eight pens, one per data
// channel, and drops into a take-up tray. Every trace on the paper is drawn
// from the same signal model that moves its pen.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../../.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 380;

const PLATE = { x: -150, y: -62, w: 300, d: 124, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const STACK = { x: -140, y: -34, w: 38, d: 68, r: 1.5 };
const STACK_H = 22;
const PLATEN = { x: -96, y: -38, w: 170, d: 76, r: 3 };
const PLATEN_H = 8;
const PAPER_Z = PLATEN_H + 0.4;
const PAPER = { x: -94, y: -33, w: 166, d: 66, r: 0.4 };
const TRAY = { x: 80, y: -32, w: 58, d: 64, r: 3 };
const TRAY_H = 6;
const BOX = { x: 86, y: -60, w: 50, d: 22, r: 2 };
const BOX_H = 16;

const CHANNELS = ["GPS", "Mileage", "Battery health", "Utilisation", "Charging pattern", "Driving behaviour", "Trip completion", "Revenue"];
const LANE = 8;
const LANE0 = PAPER.y + 1 + LANE / 2;
const SWING = 3;
const BX = -12;
const POST_Y = 50;
const BAR_Z = 40;
const BAR_H = 7;
const PEN_X = BX + 8;
const SPEED = 14;
const RATE = 20;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BX, -POST_Y - 4, BAR_Z + BAR_H], [BX, POST_Y + 4, BAR_Z + BAR_H]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 40 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const laneY = (i) => LANE0 + i * LANE;

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 22).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H / 2, P), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "faint" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a ruler strip along the front edge: one tick per second of paper travel
  const strip = { x: -138, y: PLATE.y + PLATE.d - 15, w: 276, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, SPEED / 2, 2, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

function stack() {
  const out = [];
  // fanfold: each fold is a seam round the stack's sides
  const folds = [];
  for (let z = 2.2; z < STACK_H; z += 2.2) folds.push(k.sideSeam(STACK, z, P, 3));
  out.push(S(k.slabOf(STACK, 0, STACK_H, P, 3, 0.4), { tone: "hi", crease: "lo", inner: L(folds.join(""), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(STACK, 3), STACK_H, P, 3), { tone: "faint" }));
  // sprocket holes along both edges of the top sheet
  const holes = [];
  for (let x = STACK.x + 4; x < STACK.x + STACK.w - 2; x += 4) holes.push(at([x, STACK.y + 1.6, STACK_H]), at([x, STACK.y + STACK.d - 1.6, STACK_H]));
  out.push(D(holes, { size: 0.35, tone: "lo" }));
  // the sheet running down from the stack to the platen
  const a = [STACK.x + STACK.w, PAPER.y, STACK_H], b = [STACK.x + STACK.w, PAPER.y + PAPER.d, STACK_H];
  const c = [PAPER.x, PAPER.y + PAPER.d, PAPER_Z], d = [PAPER.x, PAPER.y, PAPER_Z];
  const sheet = [a, b, c, d].map(at);
  out.push(`<g class="iso-solid"><path class="iso-fill" d="${k.pathOf(sheet, true)}"/><path class="iso-top" d="${k.pathOf(sheet, true)}"/><path class="iso-line iso-edge" data-tone="hi" d="${k.pathOf([sheet[1], sheet[2]])}${k.pathOf([sheet[0], sheet[3]])}"/></g>`);
  return out.join("");
}

function controlBox() {
  const out = [];
  out.push(S(k.slabOf(BOX, 0, BOX_H, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, 4, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BOX, 2.4), BOX_H, P, 6), { tone: "faint" }));
  // label plate with three rule lines
  const label = { x: BOX.x + 5, y: BOX.y + 5, w: 22, d: 12, r: 1 };
  out.push(S(k.slabOf(label, BOX_H, 0.5, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([3, 6, 9].map((dy) => k.lineOnTop([label.x + 3, label.y + dy], [label.x + label.w - 3, label.y + dy], BOX_H + 0.5, P)).join(""), { tone: "lo", free: true }));
  // chart-speed knob, knurled, with its index line
  const knob = [BOX.x + 38, BOX.y + 11];
  out.push(S(k.cylinder(knob[0], knob[1], 5.5, BOX_H, 4, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 5.5, BOX_H, BOX_H + 4, 34, P), { tone: "lo" }));
  out.push(L(k.lineOnTop(knob, [knob[0] + 4, knob[1] - 3], BOX_H + 4, P), { tone: "hi" }));
  const ticks = k.radialTicks(knob[0], knob[1], 7.4, 12, 4, BOX_H, [0.8, 1.6], P, -Math.PI * 0.8, Math.PI * 1.6);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([BOX.x + 3, BOX.y + 3, BOX_H]), at([BOX.x + BOX.w - 3, BOX.y + 3, BOX_H]), at([BOX.x + 3, BOX.y + BOX.d - 3, BOX_H]), at([BOX.x + BOX.w - 3, BOX.y + BOX.d - 3, BOX_H])], { size: 0.45 }));
  return out.join("");
}

function platen() {
  const out = [];
  out.push(S(k.slabOf(PLATEN, 0, PLATEN_H, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(PLATEN, 3, P, 6), { tone: "faint" }) }));
  // the paper on the platen, its lane rules, and the live grid and traces
  out.push(S(k.slabOf(PAPER, PLATEN_H, 0.4, P, 2), { tone: "hi", crease: "none" }));
  const rules = [];
  for (let i = 1; i < CHANNELS.length; i++) rules.push(k.lineOnTop([PAPER.x, laneY(i) - LANE / 2], [PAPER.x + PAPER.w, laneY(i) - LANE / 2], PAPER_Z, P));
  out.push(L(rules.join(""), { tone: "faint" }));
  out.push(`<path data-part="grid" class="iso-line" data-tone="faint" d=""/>`);
  out.push(`<g data-part="traces">${CHANNELS.map((_, i) => `<path class="iso-line" data-tone="mid" data-free="" data-lane="${i}" d=""/>`).join("")}</g>`);
  return out.join("");
}

function tray() {
  const out = [];
  out.push(S(k.slabOf(TRAY, 0, TRAY_H, P, 6, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(TRAY, 2.2), TRAY_H - 0.2, 0.2, P, 6), { tone: "lo", flat: true, crease: "none" }));
  // logged paper folded into the tray
  const pile = { x: TRAY.x + 6, y: PAPER.y + 1, w: 40, d: PAPER.d - 2, r: 0.5 };
  out.push(S(k.slabOf(pile, TRAY_H, 3.4, P, 2), { tone: "hi", crease: "lo", inner: L(k.sideSeam(pile, TRAY_H + 1.7, P, 2), { tone: "faint" }) }));
  // the sheet leaving the platen and folding down onto the pile
  const sheet = [[PAPER.x + PAPER.w, PAPER.y, PAPER_Z], [PAPER.x + PAPER.w, PAPER.y + PAPER.d, PAPER_Z], [pile.x, PAPER.y + PAPER.d, TRAY_H + 3.4], [pile.x, PAPER.y, TRAY_H + 3.4]].map(at);
  out.push(`<g class="iso-solid"><path class="iso-fill" d="${k.pathOf(sheet, true)}"/><path class="iso-top" d="${k.pathOf(sheet, true)}"/><path class="iso-line iso-edge" data-tone="hi" d="${k.pathOf([sheet[1], sheet[2]])}${k.pathOf([sheet[0], sheet[3]])}"/></g>`);
  return out.join("");
}

function post(y) {
  const out = [];
  const foot = { x: BX - 7, y: y - 7, w: 14, d: 14, r: 2.5 };
  out.push(S(k.slabOf(foot, 0, 3, P, 4, 0.5), { tone: "mid" }));
  out.push(D(k.corners(foot, 2.4).map(([x, yy]) => at([x, yy, 3])), { size: 0.4 }));
  out.push(S(k.cylinder(BX, y, 3.4, 3, BAR_Z - 3, P, 24), { tone: "mid", crease: "none", inner: L([14, 28].map((z) => k.sideArc(BX, y, 3.4, z, P, 12)).join(""), { tone: "faint" }) }));
  return out.join("");
}

function bar() {
  const out = [];
  const plan = { x: BX - 4, y: -POST_Y - 4, w: 8, d: POST_Y * 2 + 8, r: 2 };
  out.push(S(k.slabOf(plan, BAR_Z, BAR_H, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, BAR_Z + 2.4, P, 4), { tone: "faint" }) }));
  out.push(D([-POST_Y, POST_Y].map((y) => at([BX, y, BAR_Z + BAR_H])), { size: 0.5 }));
  // the pen guide rail along the bar's front face, with a tick per lane
  const rail = { x: BX + 4, y: PAPER.y, w: 1.6, d: PAPER.d, r: 0.6 };
  out.push(S(k.slabOf(rail, BAR_Z + 1, 2.4, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}

function pen(i) {
  const y = laneY(i);
  const out = [];
  const carriage = { x: BX + 4, y: y - 2.6, w: 6.4, d: 5.2, r: 1.2 };
  out.push(S(k.cylinder(PEN_X, y, 0.7, PAPER_Z + 1.4, BAR_Z - 4 - PAPER_Z - 1.4, P, 12), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(PEN_X, y, 1.4, PAPER_Z, 1.4, P, 14), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf(carriage, BAR_Z - 4, 9, P, 3, 0.4), { tone: "hi", crease: "lo" }));
  out.push(D([at([PEN_X, y, BAR_Z + 5])], { size: 0.45, tone: "lo" }));
  return `<g data-part="pen" data-lane="${i}">${out.join("")}</g>`;
}

const pens = CHANNELS.map((_, i) => i).sort((a, b) => laneY(a) - laneY(b)).map(pen);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "An eight-channel strip-chart recorder. Fanfold paper feeds from a stack across a platen and into a take-up tray. A bridge over the paper carries eight pens, one per lane, each tracing one data channel of an EV journey: GPS, mileage, battery health, utilisation, charging pattern, driving behaviour, trip completion and revenue.",
  body: [base(), stack(), post(-POST_Y), controlBox(), platen(), tray(), bar(), ...pens, post(POST_Y)],
});

const live = `
const P = ${JSON.stringify(P)};
const CHANNELS = ${JSON.stringify(CHANNELS)};
const PAPER = ${JSON.stringify(PAPER)}, PAPER_Z = ${PAPER_Z}, LANE = ${LANE}, LANE0 = ${LANE0}, SWING = ${SWING};
const PEN_X = ${PEN_X}, SPEED = ${SPEED}, RATE = ${RATE};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const grid = svg.querySelector('[data-part="grid"]');
const traces = [...svg.querySelectorAll('[data-part="traces"] path')];
const pens = [...svg.querySelectorAll('[data-part="pen"]')].sort((a, b) => a.dataset.lane - b.dataset.lane);
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tri = (u) => 1 - 4 * Math.abs(((u % 1) + 1) % 1 - 0.5);
// one signal per channel, each in -1..1: the model the pens and the traces share
const SIGNAL = [
  (t) => (Math.sin(0.9 * t) + 0.4 * Math.sin(2.3 * t + 1)) / 1.4,
  (t) => ((((t * 0.22) % 1) + 1) % 1) * 2 - 1,
  (t) => 0.55 * Math.sin(0.16 * t) + 0.25 * Math.sin(1.1 * t),
  (t) => Math.tanh(4 * Math.sin(0.7 * t)) * 0.85,
  (t) => tri(t * 0.12) * 0.9,
  (t) => (Math.sin(3.1 * t) * 0.5 + Math.sin(5.7 * t + 2) * 0.3 + Math.sin(1.3 * t) * 0.2),
  (t) => (Math.floor(((t * 0.3) % 4 + 4) % 4) / 3) * 2 - 1,
  (t) => (Math.floor(((t * 0.5) % 6 + 6) % 6) / 5) * 1.8 - 0.9,
];
const laneY = (i) => LANE0 + i * LANE;
const onPaper = (pts) => onTop(pts, PAPER_Z + 0.05, P);
function unproject(sx, sy, z) {
  const c = cameraOf(P);
  const u = (sx - P.origin[0]) / c.k, v = ((sy - P.origin[1]) / c.k + z * c.cosE) / c.sinE;
  return [u * c.sinA + v * c.cosA, -u * c.cosA + v * c.sinA];
}
let t = 0, last = 0, frame = 0, visible = false, active = 0, touring = true, idle = 0, tourClock = 0, logged = 0;
const fmt = (n) => Math.floor(n).toLocaleString("en-US");
function light(i) {
  pens.forEach((p, k) => p.querySelectorAll(".iso-edge").forEach((e) => (e.dataset.tone = k === i ? "lit" : "mid")));
  traces.forEach((p, k) => (p.dataset.tone = k === i ? "lit" : "mid"));
  traces.forEach((p, k) => p.style.strokeWidth = k === i ? "1.1" : "");
}
function draw() {
  const lines = [];
  const step = 10, shift = (t * SPEED) % step;
  for (let x = PAPER.x + shift; x < PAPER.x + PAPER.w; x += step) lines.push(onPaper([[x, PAPER.y], [x, PAPER.y + PAPER.d]]));
  grid.setAttribute("d", lines.join(""));
  traces.forEach((path, i) => {
    const pts = [];
    for (let x = PEN_X; x <= PAPER.x + PAPER.w; x += 2) pts.push([x, laneY(i) + SWING * clamp(SIGNAL[i](t - (x - PEN_X) / SPEED), -1, 1)]);
    path.setAttribute("d", onPaper(pts));
    pens[i].setAttribute("transform", translateAlong(P, [0, SWING * clamp(SIGNAL[i](t), -1, 1), 0]));
  });
  const text = CHANNELS[active] + " · " + fmt(logged) + " pts";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  t += dt; logged += dt * RATE;
  if (touring) { tourClock += dt; const next = Math.floor(tourClock / 2.4) % CHANNELS.length; if (next !== active) { active = next; light(active); } }
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const pick = (i) => { touring = false; if (i !== active) { active = i; light(i); } draw(); clearTimeout(idle); idle = setTimeout(() => { touring = true; tourClock = active * 2.4; run(); }, 3600); };
stage.addEventListener("pointermove", (ev) => {
  const box = svg.getBoundingClientRect();
  const sx = ((ev.clientX - box.left) / box.width) * ${WIDTH}, sy = ((ev.clientY - box.top) / box.height) * ${HEIGHT};
  const [, y] = unproject(sx, sy, PAPER_Z);
  pick(clamp(Math.round((y - LANE0) / LANE), 0, CHANNELS.length - 1));
});
stage.addEventListener("keydown", (ev) => {
  const d = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
  if (!d) return;
  ev.preventDefault();
  pick((active + d + CHANNELS.length) % CHANNELS.length);
});
light(active);
draw();
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "EV journey logger",
  hint: "Hover a lane to follow its pen",
  readout: `${CHANNELS[0]} · 0 pts`,
  keys: [
    { mark: "lit", label: "The pen and trace you are following" },
    { mark: "raised", label: "Eight pens, one per data channel, logging at 20 Hz" },
  ],
  caption:
    "A modern EV journey generates millions of data points. Each pen writes one channel as the paper runs at 14 units a second; the readout counts the samples that channel has logged since you arrived.",
  body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Eight-channel journey logger: arrow keys pick a channel">${svg}</div>`,
});

const name = theme === "light" ? "logger-light.html" : "logger.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "EV journey logger", theme, body, script: kitScript() + live }));
console.log("wrote", name);
