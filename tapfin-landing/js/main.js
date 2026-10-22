import { startParticles } from './particles.js';

const header = document.getElementById('header');
const toggle = document.getElementById('menuToggle');
const hero = document.getElementById('hero');
const scrub = document.getElementById('scrub');
const stage = document.getElementById('stage');
const lines = document.getElementById('lines');
const words = [...document.querySelectorAll('.word')];
const steps = [...document.querySelectorAll('.step')];
const trackFill = document.getElementById('trackFill');
const desktop = matchMedia('(min-width: 1100px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Navigation ---------- */

function setMenu(open) {
  header.classList.toggle('open', open);
  document.documentElement.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
toggle.addEventListener('click', () => setMenu(!header.classList.contains('open')));

const subButtons = [...document.querySelectorAll('.has-sub > .menu-link')];
function closeSubs(except) {
  for (const b of subButtons) if (b !== except) b.setAttribute('aria-expanded', 'false');
}
for (const b of subButtons) {
  b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    if (desktop.matches) closeSubs(b);
    b.setAttribute('aria-expanded', String(open));
  });
}
document.addEventListener('click', (e) => {
  if (desktop.matches && !e.target.closest('.has-sub')) closeSubs();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openSub = subButtons.find((b) => b.getAttribute('aria-expanded') === 'true');
  closeSubs();
  if (openSub && desktop.matches) openSub.focus();
  if (header.classList.contains('open')) { setMenu(false); toggle.focus(); }
});
desktop.addEventListener('change', () => { setMenu(false); closeSubs(); });

/* ---------- Horizon lines, converging on the formation's centre ---------- */

// Start heights on each side, as fractions of the hero height above/below the convergence point.
const LINE_OFFSETS = [-0.25, -0.15, -0.06, 0.056, 0.144, 0.25];

function drawLines() {
  const h = hero.clientHeight, w = hero.clientWidth;
  const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const cx = sr.left + sr.width / 2 - hr.left;
  const cy = sr.top + sr.height / 2 - hr.top;
  lines.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const d = [];
  for (const o of LINE_OFFSETS) {
    const y = cy + o * h;
    d.push(`<path d="M0 ${y.toFixed(1)}Q${(cx * 0.55).toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}"/>`);
    d.push(`<path d="M${w} ${y.toFixed(1)}Q${(w - (w - cx) * 0.55).toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}"/>`);
  }
  lines.innerHTML = d.join('');
}
new ResizeObserver(drawLines).observe(hero);
drawLines();

/* ---------- Stage rail and headline, following the formation on screen ---------- */

let shownStep = -1;
function showProgress(p) {
  // Switch at the middle of each transition, when the next formation starts to take shape.
  const step = p < 0.27 ? 0 : p < 0.73 ? 1 : 2;
  trackFill.style.setProperty('--p', (p * 1).toFixed(4));
  hero.classList.toggle('is-playing', p > 0.015);
  if (step === shownStep) return;
  shownStep = step;
  words.forEach((el, i) => el.classList.toggle('on', i === step));
  steps.forEach((el, i) => {
    el.classList.toggle('on', i === step);
    if (i === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
}

/* ---------- Scroll → progress ---------- */

// The hero is pinned with CSS sticky (no pin spacer, so nothing reflows). ScrollTrigger measures
// progress through the tall section; plain scroll maths stands in if the GSAP scripts did not load.
function trackProgress(onChange) {
  const { gsap, ScrollTrigger } = window;
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      trigger: scrub,
      start: () => `top ${header.offsetHeight}px`,
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => onChange(self.progress),
      onRefresh: (self) => onChange(self.progress),
    });
    return;
  }
  const read = () => {
    const top = scrub.getBoundingClientRect().top - header.offsetHeight;
    const span = scrub.offsetHeight - (innerHeight - header.offsetHeight);
    onChange(Math.min(1, Math.max(0, -top / Math.max(1, span))));
  };
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', read);
  read();
}

let particles = null;
let pending = 0;
trackProgress((p) => {
  pending = p;
  showProgress(p);
  particles?.setProgress(p);
});

startParticles({ canvas: document.getElementById('particles'), stage, reduceMotion })
  .then((api) => { particles = api; api.setProgress(pending); })
  .catch((err) => {
    // No WebGL: the hero still reads as designed, with the lines and the glow.
    console.warn('Particle animation unavailable:', err);
  });
