import Lenis from '../vendor/lenis.mjs';
import {
  BEATS, COPY, STATS, STATION_LABELS, MODEL_LABELS, SCROLL_VH, IS_MOBILE,
  progressFromScroll, scrollFractionForBeat, neighbours, smoothstep, beatIndex,
} from './beats.js';
import { createScene, FPS_CAP } from './scene.js';

const $ = (s, el = document) => el.querySelector(s);
const root = $('#root');
const canvas = $('.fm-canvas');
const spacer = $('.fm-scroll');
const hero = $('.fm-hero');
const enterBtn = $('.fm-enter');
const pill = $('.fm-pill');
const copyLayer = $('.fm-copy');
const statsTrack = $('.fm-stats__track');
const tagLayer = $('.fm-tags');
const modal = $('.fm-modal');

const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarseMQ = window.matchMedia('(hover: none), (pointer: coarse)');
let reducedMotion = reducedMQ.matches;

const MORPH_SECONDS = 1.9;
const ARRIVE_MS = 1250;

/* ------------------------------------------------------------- page state */

const state = { phase: 'loading', morph: 0, intro: 0, progress: 0, time: 0, dt: 0, revealedAt: 0, pending: false, reducedMotion };
const phaseListeners = new Set();
function setPhase(p) {
  if (state.phase === p) return;
  state.phase = p;
  root.dataset.phase = p;
  phaseListeners.forEach((fn) => fn(p));
}

spacer.style.height = `${SCROLL_VH}vh`;
if (CSS.supports('height', '1lvh')) spacer.style.height = `${SCROLL_VH}lvh`;

/* ---------------------------------------------------------------- scroll */

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

let lenis = null;
function makeLenis() {
  if (reducedMotion || lenis) return;
  lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true });
  window.__lenis = lenis;
  if (state.phase !== 'revealed') lenis.stop();
}
function dropLenis() {
  if (!lenis) return;
  lenis.destroy();
  lenis = null;
  window.__lenis = null;
}
makeLenis();

function lockScroll(lock) {
  document.documentElement.classList.toggle('fm-locked', lock);
  if (lenis) (lock ? lenis.stop() : lenis.start());
}
lockScroll(true);

function scrollToFraction(f, immediate = false) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const y = Math.max(0, Math.min(max, f * max));
  if (lenis) lenis.scrollTo(y, { immediate });
  else window.scrollTo({ top: y, behavior: immediate || reducedMotion ? 'auto' : 'smooth' });
}

function readProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return progressFromScroll(max > 0 ? window.scrollY / max : 0);
}

/* --------------------------------------------------------- enter / morph */

const ENTER_KEYS = new Set([' ', 'PageDown', 'ArrowDown', 'End']);
function requestEnter() {
  if (state.phase === 'loading') { state.pending = true; return; }
  if (state.phase !== 'landing') return;
  if (reducedMotion) { state.morph = 1; reveal(); return; }
  state.morph = 0;
  setPhase('morphing');
}
function reveal() {
  setPhase('revealed');
  state.revealedAt = performance.now();
  lockScroll(false);
  enterBtn.dataset.gone = 'true';
  enterBtn.hidden = true;
  pill.dataset.on = 'false';
  removeEnterListeners();
  const target = hashBeat();
  if (target >= 0) scrollToFraction(scrollFractionForBeat(target), true);
}

const onWheel = () => requestEnter();
const onKey = (e) => { if (ENTER_KEYS.has(e.key) && !modal.open) requestEnter(); };
window.addEventListener('wheel', onWheel, { capture: true, passive: true });
window.addEventListener('touchmove', onWheel, { capture: true, passive: true });
window.addEventListener('keydown', onKey, { capture: true });
function removeEnterListeners() {
  window.removeEventListener('wheel', onWheel, { capture: true });
  window.removeEventListener('touchmove', onWheel, { capture: true });
  window.removeEventListener('keydown', onKey, { capture: true });
}
enterBtn.addEventListener('click', requestEnter);

// Cursor pill follows the pointer on desktop and is pinned on touch screens
let pointerSeen = false;
function syncPillMode() {
  pill.dataset.pinned = coarseMQ.matches ? 'true' : 'false';
  if (coarseMQ.matches && state.phase === 'landing') pill.dataset.on = 'true';
}
coarseMQ.addEventListener?.('change', syncPillMode);
window.addEventListener('pointermove', (e) => {
  scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  if (coarseMQ.matches || state.phase !== 'landing') return;
  pill.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(18px, 10px)`;
  if (!pointerSeen) {
    pointerSeen = true;
    pill.dataset.on = 'true';
    enterBtn.dataset.pointer = 'true';
  }
}, { passive: true });

phaseListeners.add((p) => {
  hero.dataset.hidden = p === 'morphing' || p === 'revealed' ? 'true' : 'false';
  if (p !== 'landing') pill.dataset.on = 'false';
  if (p === 'landing') syncPillMode();
});

// Deep links (#overview, #complexity, #vulcan, #results) jump to their beat after entering
const HASH_BEATS = { overview: 'treeTop', complexity: 'signals', vulcan: 'coreField', results: 'proof' };
function hashBeat() {
  const id = HASH_BEATS[location.hash.slice(1)];
  return id ? beatIndex(id) : -1;
}
window.addEventListener('hashchange', () => {
  const i = hashBeat();
  if (i < 0) return;
  if (state.phase !== 'revealed') { requestEnter(); return; }
  scrollToFraction(scrollFractionForBeat(i));
});

/* ---------------------------------------------------------------- copy */

const EYEBROW_FADE = 0.45;
const REVEAL_DELAY = [0.18, 0.6];

// An eyebrow is (re)announced only when it differs from the one already showing
const eyebrowFresh = (() => {
  let current = null;
  return BEATS.map((b) => {
    if (b.clearsCopy) { current = null; return false; }
    if (!b.copy) return false;
    const e = b.copy.eyebrow ?? null;
    if (e === current) return false;
    current = e;
    return e !== null;
  });
})();
const nextIndex = (i, pred) => BEATS.findIndex((b, k) => k > i && pred(b));

const headlineWindows = BEATS.map((b, i) => {
  if (!b.copy) return null;
  const { at, prev } = neighbours(i);
  const a = Math.max(1e-6, (at - prev) * EYEBROW_FADE);
  const inStart = eyebrowFresh[i] ? at - 0.55 * a : at - a;
  const j = nextIndex(i, (n) => Boolean(n.copy || n.clearsCopy));
  if (j < 0) return { inStart, inEnd: at, outStart: 2, outEnd: 3 };
  const nj = neighbours(j);
  return { inStart, inEnd: at, outStart: nj.prev, outEnd: nj.prev + Math.max(1e-6, (nj.at - nj.prev) * EYEBROW_FADE) };
});
const eyebrowWindows = BEATS.map((b, i) => {
  if (!eyebrowFresh[i]) return null;
  const { at, prev } = neighbours(i);
  const a = Math.max(1e-6, (at - prev) * EYEBROW_FADE);
  const j = nextIndex(i, (n) => Boolean(n.clearsCopy) || (Boolean(n.copy) && n.copy.eyebrow !== b.copy.eyebrow));
  if (j < 0) return { inStart: at - a, inEnd: at - 0.55 * a, outStart: 2, outEnd: 3 };
  const nj = neighbours(j);
  return { inStart: at - a, inEnd: at - 0.55 * a, outStart: nj.prev, outEnd: nj.prev + Math.max(1e-6, (nj.at - nj.prev) * EYEBROW_FADE) };
});

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const copyRefs = BEATS.map((b) => {
  if (!b.copy) return null;
  const align = b.copy.align ?? 'centre';
  const wrap = el('div', `fm-beat fm-beat--${align}`);
  const h2 = el('h2', 'fm-beat__heading');
  h2.setAttribute('aria-hidden', 'true');
  let eyebrow = null;
  if (b.copy.eyebrow) {
    eyebrow = el('span', 'fm-beat__eyebrow', b.copy.eyebrow);
    h2.append(eyebrow);
  }
  const lines = el('span', 'fm-beat__lines');
  const raw = IS_MOBILE && b.copy.mobile ? b.copy.mobile : b.copy.headline;
  (Array.isArray(raw) ? raw : [raw]).forEach((t) => lines.append(el('span', 'fm-beat__line', t)));
  h2.append(lines);
  wrap.append(h2);
  let cta = null;
  if (b.cta) {
    cta = el('a', 'fm-cta fm-beat__cta', COPY.ctaLabel);
    cta.href = COPY.ctaHref;
    cta.dataset.cta = '';
    wrap.append(cta);
  }
  copyLayer.append(wrap);
  return { eyebrow, lines, cta };
});

function fade(node, v, hide = true) {
  if (!node) return;
  const o = v < 0.002 ? 0 : v;
  node.style.opacity = String(o);
  node.style.transform = `translate3d(0, ${22 * (1 - v)}px, 0)`;
  if (hide) node.style.visibility = o > 0.01 ? 'visible' : 'hidden';
}

function revealGate() {
  if (state.phase !== 'revealed') return 0;
  if (reducedMotion) return 1;
  return smoothstep(REVEAL_DELAY[0], REVEAL_DELAY[1], (performance.now() - state.revealedAt) / 1000);
}

const win = (p, w) => smoothstep(w.inStart, w.inEnd, p) * (1 - smoothstep(w.outStart, w.outEnd, p));

function updateCopy(p, gate) {
  copyRefs.forEach((r, i) => {
    if (!r) return;
    const h = headlineWindows[i] ? win(p, headlineWindows[i]) * gate : 0;
    fade(r.lines, h);
    if (r.cta) fade(r.cta, h);
    if (r.eyebrow) fade(r.eyebrow, eyebrowWindows[i] ? win(p, eyebrowWindows[i]) * gate : 0);
  });
}

/* --------------------------------------------------------------- stats */

const ICONS = {
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5v.01"/>',
  cart: '<circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/><path d="M2.5 3.5h3l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2l1.6-7.3H6.4"/>',
  warn: '<path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5"/><path d="M12 17v.01"/>',
};
const cards = STATS.map((s) => {
  const card = el('div', 'fm-stat');
  card.setAttribute('aria-hidden', 'true');
  card.innerHTML = `<svg class="fm-stat__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[s.icon]}</svg>`;
  const p = el('p', 'fm-stat__text');
  s.figure.forEach((f) => p.append(el('span', 'fm-stat__figure', f)));
  p.append(el('span', 'fm-stat__label', s.label));
  card.append(p);
  statsTrack.append(card);
  return card;
});
let hovered = -1;
cards.forEach((c, i) => {
  c.addEventListener('pointerenter', () => { hovered = i; });
  c.addEventListener('pointerleave', () => { hovered = -1; });
});
const cardScale = cards.map(() => 1);
const PROOF = beatIndex('proof');

function updateStats(p) {
  const { at, prev, next } = neighbours(PROOF);
  const n = cards.length;
  const exitStart = at + (next - at) * 0.72;
  if (IS_MOBILE) {
    const v = smoothstep(at, exitStart, p) * (n - 1);
    const g = Math.min(n - 2, Math.floor(v));
    const b = n > 1 ? g + smoothstep(0.3, 0.7, v - g) : 0;
    statsTrack.style.transform = `translate3d(${-b * 74}vw, 0, 0)`;
  }
  cards.forEach((c, i) => {
    const lag = i * 0.12;
    const fin = smoothstep(prev + (at - prev) * lag, at, p);
    const fout = IS_MOBILE ? smoothstep(exitStart, next, p) : smoothstep(at + (next - at) * lag, at + (next - at) * (lag + 0.55), p);
    const x = (1 - fin) * 1.25 - fout * 1.25;
    const o = state.phase === 'revealed' ? fin * (1 - fout) : 0;
    const target = hovered === i ? 1.12 : 1;
    cardScale[i] += 0.18 * (target - cardScale[i]);
    c.style.opacity = String(o);
    c.style.transform = `translate3d(${x * 100}vw, 0, 0) scale(${cardScale[i].toFixed(4)})`;
    c.style.pointerEvents = !IS_MOBILE && o > 0.9 ? 'auto' : 'none';
    c.style.visibility = o > 0.005 ? 'visible' : 'hidden';
  });
}

/* ---------------------------------------------------------------- tags */

const tagWindow = (ids) => {
  const a = neighbours(beatIndex(ids[0]));
  const b = neighbours(beatIndex(ids[1]));
  return { from: a.at, to: b.at, in: a.at - 0.35 * (a.at - a.prev), out: b.at + 0.35 * (b.next - b.at) };
};
const STATION_WIN = tagWindow(['treeTop', 'whatIf']);
const MODEL_WIN = tagWindow(['isoRisk', 'whatIf']);
const winOpacity = (p, w) => (w.from <= w.in ? (p >= w.from ? 1 : 0) : smoothstep(w.in, w.from, p)) * (1 - smoothstep(w.to, w.out, p));

const makeTag = (text, kind) => {
  const t = el('div', `fm-tag fm-tag--${kind}`);
  const label = el('span', 'fm-tag__text', text);
  t.append(label, el('span', 'fm-tag__corners'));
  tagLayer.append(t);
  return t;
};
const stationTags = STATION_LABELS.map((s) => makeTag(s, 'station'));
const modelTags = MODEL_LABELS.map((s) => makeTag(s, 'model'));

function placeTags(tags, anchors, opacity, centred) {
  tags.forEach((t, i) => {
    const pr = scene.project(anchors[i]);
    const o = pr.visible ? opacity : 0;
    t.style.opacity = String(o);
    t.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    if (o > 0.01) {
      const dx = centred ? -t.offsetWidth / 2 : -t.offsetWidth / 2;
      t.style.transform = `translate3d(${(pr.x + dx).toFixed(1)}px, ${(pr.y - t.offsetHeight - 6).toFixed(1)}px, 0)`;
    }
  });
}
function updateTags(p, gate) {
  placeTags(stationTags, scene.anchors.stations, winOpacity(p, STATION_WIN) * gate * 0.95, false);
  placeTags(modelTags, scene.anchors.models, winOpacity(p, MODEL_WIN) * gate, true);
}

/* --------------------------------------------------------------- modal */

const frame = $('.fm-modal__frame');
const closeBtn = $('.fm-modal__close');
let lastFocus = null;
function openModal() {
  if (modal.open) return;
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const sep = COPY.ctaHref.includes('?') ? '&' : '?';
  frame.src = `${COPY.ctaHref}${sep}typeform-embed=popup-blank&typeform-medium-version=next&typeform-embed-no-heading=true`;
  modal.showModal();
  lenis?.stop();
  document.documentElement.classList.add('fm-modal-open');
  closeBtn.focus();
}
function closeModal() {
  if (!modal.open) return;
  modal.close();
}
modal.addEventListener('close', () => {
  frame.src = 'about:blank';
  document.documentElement.classList.remove('fm-modal-open');
  if (state.phase === 'revealed') lenis?.start();
  lastFocus?.focus();
});
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('[data-cta]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  openModal();
});

/* -------------------------------------------------------------- motion */

reducedMQ.addEventListener?.('change', (e) => {
  reducedMotion = e.matches;
  state.reducedMotion = reducedMotion;
  if (reducedMotion) dropLenis();
  else { makeLenis(); if (state.phase === 'revealed') lenis?.start(); }
  if (reducedMotion && state.phase === 'morphing') { state.morph = 1; reveal(); }
});

/* ----------------------------------------------------------------- boot */

const scene = createScene(canvas);
if (!scene) {
  // No WebGL: fall back to the readable document version of the page.
  root.classList.add('fm-no-webgl');
  $('.fm-readable__cta').removeAttribute('tabindex');
  lockScroll(false);
  dropLenis();
  enterBtn.hidden = true;
  removeEnterListeners();
} else {
  window.addEventListener('resize', () => scene.resize());
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); root.classList.add('fm-no-webgl'); lockScroll(false); });
  syncPillMode();
  setPhase('landing');
  setTimeout(() => { hero.dataset.arrived = 'true'; }, reducedMotion ? 0 : ARRIVE_MS);
  if (state.pending || hashBeat() >= 0) requestEnter();

  const landedAt = performance.now();
  let last = performance.now();
  let lastRender = 0;
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    lenis?.raf(now);
    state.time += dt;
    state.dt = dt;
    state.reducedMotion = reducedMotion;
    const t = reducedMotion ? 1 : Math.min(1, (now - landedAt) / 2200);
    state.intro = 1 - (1 - t) ** 3;
    if (state.phase === 'morphing') {
      state.morph = Math.min(1, state.morph + dt / MORPH_SECONDS);
      if (state.morph >= 1) reveal();
    }
    state.progress = state.phase === 'revealed' ? readProgress() : 0;
    const gate = revealGate();
    updateCopy(state.progress, gate);
    updateStats(state.progress);
    updateTags(state.progress, gate);
    if (now - lastRender >= 1000 / FPS_CAP - 2) {
      lastRender = now;
      scene.update(state);
    }
  };
  requestAnimationFrame(tick);

  // QA hook: jump straight to a beat (used by the screenshot harness)
  window.__fm = { state, beats: BEATS, enter: requestEnter, goToBeat: (i) => scrollToFraction(scrollFractionForBeat(i), true) };
}
