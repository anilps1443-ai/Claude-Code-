// Scroll storyline: one beat per narrative stop. Camera keyframes, uniform
// targets and pacing were measured from the reference page so that framing
// and timing line up when both are scrolled side by side.

export const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;

export const COPY = {
  hero: 'Step into the world of payments',
  ctaLabel: 'Get Started',
  ctaHref: 'https://razorpay.typeform.com/to/TuVwFZp4?utm_source=foundation-model',
  vulcanEyebrow: 'Introducing Razorpay Vulcan',
  vulcanLines: ["India's first transformer-based", 'AI Foundation Model for Payments'],
  compounding: 'Unlocking the power of compounding intelligence',
  closingEyebrow: 'Razorpay Vulcan',
  closing: "Built for India's scale. Powered for a billion Indians.",
};

export const STATS = [
  { id: 'success-rate', figure: ['8-10%', 'improvement'], label: 'in success rates', icon: 'trend' },
  { id: 'fraud-txn', figure: ['5X', 'more'], label: 'disputed transactions identified', icon: 'alert' },
  { id: 'checkout', figure: ['Millions of', 'Checkouts'], label: 'Hyper-Personalized', icon: 'cart' },
  { id: 'card-fraud', figure: ['8X', 'more'], label: 'international card fraud detected', icon: 'warn' },
];

export const STATION_LABELS = ['Payment Processor', 'Issuing Bank', 'Network', 'Acquiring Bank', 'Payment Gateway'];
export const MODEL_LABELS = ['Chargeback Protection', 'Success Rate Optimization', 'Fraud Detection', 'Checkout Personalisation'];

// World constants (units are scene units; canopy sits just above y = 0)
export const WORLD = {
  canopyY: 0.1,
  modelY: -0.74,
  ringY: 0.055,
  ringLiftEnd: 0.795,
};

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const SIDE = [0.801, 0, 0.598];
const shift = (p, t) => [p[0] + SIDE[0] * t, p[1] + SIDE[1] * t, p[2] + SIDE[2] * t];

const ISO_CAM = shift([0.718, -0.737, -1.529], IS_MOBILE ? 0.28 : 0);
const ISO_TGT = shift([-0.444, -0.522, 0.027], IS_MOBILE ? 0.28 : 0);
const DISSOLVE_CAM = [0.777, -0.679, 1.275];
const DISSOLVE_TGT = [-0.044, -0.591, -0.047];
const SEATED_CAM = [-0.943, 0.462, 0.644];
const SEATED_TGT = [0.077, 0.245, -0.005];
const SEATED_FROM = [-1.093, -0.902, 0.57];
const SEATED_TGT_FROM = [-0.012, -0.792, 0.024];

// Orbit path: rotate around the axis while rising from the dissolve view to the seated view
function orbitTarget(t) { return lerp3(DISSOLVE_TGT, SEATED_TGT, t); }
function orbitCam(t) {
  const ang = (a, b) => Math.atan2(a[2] - b[2], a[0] - b[0]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const a0 = ang(DISSOLVE_CAM, DISSOLVE_TGT);
  let da = ang(SEATED_CAM, SEATED_TGT) - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const a = a0 + da * t;
  const r = dist(DISSOLVE_CAM, DISSOLVE_TGT) + (dist(SEATED_CAM, SEATED_TGT) - dist(DISSOLVE_CAM, DISSOLVE_TGT)) * t;
  const c = orbitTarget(t);
  return [c[0] + Math.cos(a) * r, DISSOLVE_CAM[1] + (SEATED_CAM[1] - DISSOLVE_CAM[1]) * t, c[2] + Math.sin(a) * r];
}

const SHORT = Math.round(85 / 3);
const ringLiftEnd = WORLD.ringLiftEnd;
const models = (lit) => Object.fromEntries([0, 1, 2, 3].map((i) => ['mdl' + (i + 1), i === lit ? 2.6 : 0.12]));

const RAW = [
  { id: 'treeTop', cam: [0, 1.5, 0.35], tgt: [0, 0.05, 0], u: { revealY: -0.15, maskR: 0.26 }, copy: { headline: 'Payments are complex' } },
  { id: 'signals', cam: [0.314, -0.029, 0.046], tgt: [-1.964, -0.571, -0.09], u: { revealY: -1.679, maskR: 0, revModels: 0, revWires: 0, revInflow: 0, dim: 1 }, copy: { headline: 'Thousands of variables. Billions of signals. Intricate connections.' } },
  { id: 'isoRisk', cam: ISO_CAM, tgt: ISO_TGT, u: { revealY: -2.417, revModels: 1, revWires: 1, revInflow: 1, dim: 0.22, ...models(IS_MOBILE ? 2 : 0) },
    copy: { headline: ['For years, we built ML models to make sense of those signals.', 'But they existed in isolation.'], align: 'right',
      mobile: 'For years, we built ML models to make sense of those signals. But they existed in isolation.' } },
  { id: 'isoFraud', cam: ISO_CAM, tgt: ISO_TGT, u: { settle: 0, revMerge: 0, revInflow: 1, dim: 0.22, ...models(3) } },
  { id: 'whatIf', cam: [2.723, -0.227, -0.419], tgt: [-0.119, -0.408, 0.003], travel: SHORT,
    u: { dim: 1, mdl1: 1, mdl2: 1, mdl3: 1, mdl4: 1, settle: 0, revMerge: 0, mdlDissolve: 1, mdlMorph: 0, coreLock: 0, cfReveal: 0, cfScale: 0.55, mgscale: 0.92, revInflow: 1, revealY: -1.3, ringLift: 0 },
    copy: { headline: ['What if one model could understand', 'payments as a whole?'], align: 'narrative', mobile: 'What if one model could understand payments as a whole?' } },
  { id: 'dissolve', cam: DISSOLVE_CAM, tgt: DISSOLVE_TGT, u: { mdlMorph: 1, revModels: 0, revWires: 0, revInflow: 0, dim: 0.5, mdlLand: 0 } },
  { id: 'orbit1', clearsCopy: true, cam: orbitCam(1 / 3), tgt: orbitTarget(1 / 3), hold: 0, travel: SHORT,
    u: { revealY: -0.55, settle: 0.34, ringLift: 0.34 * ringLiftEnd, mgscale: 0.837, coreLock: 0.34, revInflow: 0, cfReveal: 0.2, cfScale: 0.72, cfIgnite: 0 } },
  { id: 'orbit2', cam: orbitCam(2 / 3), tgt: orbitTarget(2 / 3), hold: 0, travel: SHORT,
    u: { revealY: 0.4, settle: 0.72, ringLift: 0.72 * ringLiftEnd, mgscale: 0.837, coreLock: 0.72, revInflow: 0, cfReveal: 0.7, cfScale: 0.9, cfIgnite: 0, revMerge: 0 } },
  { id: 'seated', cam: lerp3(SEATED_FROM, SEATED_CAM, 1), tgt: lerp3(SEATED_TGT_FROM, SEATED_TGT, 1),
    u: { mdlLand: 1, settle: 1, revMerge: 1, ringLift: ringLiftEnd, mgscale: 0.837, cfReveal: 1, cfScale: 0.99, coreLock: 1, cfIgnite: 0 } },
  { id: 'coreField', cam: SEATED_CAM, tgt: SEATED_TGT, copy: { eyebrow: COPY.vulcanEyebrow, headline: COPY.vulcanLines, align: 'introduce' },
    u: { mdlLand: 1, settle: 1, revMerge: 1, ringLift: ringLiftEnd, mgscale: 0.837, cfReveal: 1, cfScale: 0.99, coreLock: 1, cfIgnite: 1 } },
  { id: 'compounding', cam: SEATED_CAM, tgt: SEATED_TGT, copy: { eyebrow: COPY.vulcanEyebrow, headline: COPY.compounding, align: 'introduce' } },
  { id: 'proof', cam: [-2.267, 1.092, 1.54], tgt: [0.127, 0.328, -0.01], clearsCopy: true },
  { id: 'scale', cam: [-1.535, 0.713, 0.968], tgt: [0.055, 0.206, -0.061], copy: { eyebrow: COPY.closingEyebrow, headline: COPY.closing, align: 'introduce' } },
  { id: 'signoff', cam: [-1.535, 0.713, 0.968], tgt: [0.055, 0.206, -0.061], copy: { eyebrow: COPY.closingEyebrow, headline: COPY.vulcanLines, align: 'introduce' }, cta: true },
];

export const BEATS = RAW.map((b, i) => ({ ...b, at: i / (RAW.length - 1) }));
export const beatIndex = (id) => BEATS.findIndex((b) => b.id === id);

// Pacing: each beat holds (progress plateaus) and then travels to the next one.
const HOLD = 45;
const TRAVEL = 85;
const hold = (i) => Math.max(0, BEATS[i].hold ?? HOLD);
const travel = (i) => (i >= BEATS.length - 1 ? 0 : Math.max(0, BEATS[i].travel ?? TRAVEL));
export const SCROLL_VH = BEATS.reduce((s, _, i) => s + hold(i) + travel(i), 0);

export const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3 - 2 * t);
};
const smooth01 = (t) => t * t * (3 - 2 * t);

/** Map raw scroll fraction (0..1 of the spacer) onto beat-space progress (0..1). */
export function progressFromScroll(raw) {
  let s = Math.min(1, Math.max(0, raw)) * SCROLL_VH;
  for (let i = 0; i < BEATS.length; i++) {
    const h = hold(i);
    if (s <= h) return BEATS[i].at;
    s -= h;
    if (i === BEATS.length - 1) break;
    const tr = travel(i);
    if (s <= tr) return BEATS[i].at + (BEATS[i + 1].at - BEATS[i].at) * (tr > 0 ? smooth01(s / tr) : 1);
    s -= tr;
  }
  return BEATS[BEATS.length - 1].at;
}

/** Scroll fraction at which a beat's hold is centred (used for anchor jumps and QA). */
export function scrollFractionForBeat(i) {
  let s = 0;
  for (let k = 0; k < i; k++) s += hold(k) + travel(k);
  return (s + hold(i) / 2) / SCROLL_VH;
}

export function neighbours(i) {
  return {
    at: BEATS[i].at,
    prev: BEATS[Math.max(0, i - 1)].at,
    next: BEATS[Math.min(BEATS.length - 1, i + 1)].at,
  };
}

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return (-0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3) * t3 + (p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3) * t2 + (-0.5 * p0 + 0.5 * p2) * t + p1;
};

function segment(p) {
  const n = BEATS.length;
  if (p <= BEATS[0].at) return { i: 0, t: 0 };
  if (p >= BEATS[n - 1].at) return { i: n - 1, t: 0 };
  for (let i = 0; i < n - 1; i++) {
    if (p < BEATS[i + 1].at) return { i, t: (p - BEATS[i].at) / (BEATS[i + 1].at - BEATS[i].at) };
  }
  return { i: n - 1, t: 0 };
}

function splineInto(key, i, t, out) {
  const n = BEATS.length - 1;
  const p1 = BEATS[i][key];
  if (i >= n) { out[0] = p1[0]; out[1] = p1[1]; out[2] = p1[2]; return out; }
  const p2 = BEATS[i + 1][key];
  if (p1[0] === p2[0] && p1[1] === p2[1] && p1[2] === p2[2]) { out[0] = p1[0]; out[1] = p1[1]; out[2] = p1[2]; return out; }
  const p0 = BEATS[Math.max(0, i - 1)][key];
  const p3 = BEATS[Math.min(n, i + 2)][key];
  for (let k = 0; k < 3; k++) out[k] = catmull(p0[k], p1[k], p2[k], p3[k], t);
  return out;
}

/** Camera position and target along a Catmull-Rom path through the beat keyframes. */
export function sampleCamera(p, pos, tgt) {
  const { i, t } = segment(p);
  splineInto('cam', i, t, pos);
  splineInto('tgt', i, t, tgt);
}

export const UNIFORM_KEYS = [...new Set(BEATS.flatMap((b) => Object.keys(b.u || {})))];

/** Smoothstep between the nearest beats that define `key`, holding the end values outside. */
export function sampleUniform(key, p) {
  let lo = -1, hi = -1;
  for (let i = 0; i < BEATS.length; i++) {
    const u = BEATS[i].u;
    if (!u || u[key] === undefined) continue;
    if (BEATS[i].at <= p) lo = i;
    if (BEATS[i].at >= p && hi === -1) hi = i;
  }
  if (lo === -1 && hi === -1) return undefined;
  if (lo === -1) return BEATS[hi].u[key];
  if (hi === -1 || hi === lo) return BEATS[lo].u[key];
  const a = BEATS[lo], b = BEATS[hi];
  const t = smooth01((p - a.at) / (b.at - a.at));
  return a.u[key] + (b.u[key] - a.u[key]) * t;
}
