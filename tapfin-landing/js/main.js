// TapFin landing: scroll story, scenes for the particle field, and the small
// interactions around them. GSAP and ScrollTrigger are loaded as globals.
import Lenis from "../vendor/lenis.mjs";
import { createField } from "./particles.js";

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => innerWidth < 900;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- scenes: where the particles go for each chapter ---------- */
const SCENES = {
  hero: { shape: "car", x: 0, y: -0.22, scale: 0.95, spin: 0.32, tilt: 0.16, opacity: 0.95 },
  "hero-rupee": { shape: "rupee", x: 0, y: 0, scale: 1, opacity: 0.85, tilt: 0 },
  "hero-database": { shape: "database", x: 0, y: 0, scale: 1, opacity: 0.85, tilt: 0 },
  "hero-xchange": { shape: "xchange", x: 0, y: 0, scale: 1.1, opacity: 0.85, tilt: 0 },
  stream: { shape: "stream", x: 0, y: -0.28, scale: 1.15, opacity: 0.8, tilt: 0.1 },
  "pillar-finance": { shape: "rupee", x: 0.5, y: 0, scale: 1.1, opacity: 0.95, tilt: 0 },
  "pillar-intel": { shape: "database", x: 0.5, y: 0, scale: 1.1, opacity: 0.95, tilt: 0 },
  "pillar-resale": { shape: "xchange", x: 0.56, y: 0.12, scale: 0.85, opacity: 0.9, tilt: 0 },
  rings: { shape: "rings", x: 0.5, y: 0, scale: 1.05, spin: 0.18, tilt: 0.45, opacity: 0.9 },
  "wn-car": { shape: "car", x: 0, y: -0.42, scale: 0.85, spin: 0.4, tilt: 0.18, opacity: 0.9 },
  "wn-data": { shape: "car", x: -0.5, y: -0.6, scale: 0.55, spin: 0.55, tilt: 0.2, opacity: 0.5 },
  "wn-silos": { shape: "silos", x: 0, y: 0.08, scale: 1.1, opacity: 0.8, tilt: 0.08 },
  "wn-stream": { shape: "stream", x: 0, y: 0, scale: 1.25, opacity: 0.55, tilt: 0.1 },
  "wn-shield": { shape: "shield", x: 0, y: 0.3, scale: 0.85, opacity: 0.9, tilt: 0 },
  people: { shape: "sphere", x: 0.55, y: 0.15, scale: 0.9, spin: 0.08, tilt: 0.2, opacity: 0.35 },
  contact: { shape: "wordmark", x: -0.45, y: 0.42, scale: 0.42, opacity: 0.6, tilt: 0 },
  footer: { shape: "wordmark", x: 0, y: -0.5, scale: 1, opacity: 0.6, tilt: 0 },
};
// on narrow screens the shapes sit behind the copy, so they centre and dim
function sceneFor(name) {
  const s = { ...SCENES[name] };
  if (isMobile()) {
    s.x = 0;
    if (name.startsWith("pillar")) { s.y = 0.42; s.scale *= 0.7; }
    else if (name === "contact") { s.y = 0.6; s.scale = 0.7; }
    else if (!name.startsWith("hero") && name !== "footer") s.opacity *= 0.55;
  }
  return s;
}

let field = null;
let current = "hero";
// ?scene=<name> holds the field on one scene, for reviewing a shape at rest
const lock = new URLSearchParams(location.search).get("scene");
function show(name) {
  if (lock && SCENES[lock]) name = lock;
  current = name;
  if (field && SCENES[name]) field.setScene(sceneFor(name));
}

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
  lenis.on("scroll", (e) => { ScrollTrigger.update(); field?.setVelocity(e.velocity / 45); });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
  const id = a.getAttribute("href");
  const el = id === "#top" ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  closeNav();
  if (lenis) lenis.scrollTo(el, { offset: id === "#top" ? 0 : -20, duration: 1.6 });
  else el.scrollIntoView();
}));

/* ---------- preloader, then the field ---------- */
const pctEl = $(".loader-pct");
let pct = 0;
const loading = setInterval(() => { pct = Math.min(pct + Math.random() * 9, 92); pctEl.textContent = Math.floor(pct) + "%"; }, 90);

async function boot() {
  const canvas = $("#field");
  const count = isMobile() ? 16000 : navigator.hardwareConcurrency <= 4 ? 24000 : 38000;
  try {
    field = await createField(canvas, { count, reduced, font: "Archivo" });
    field.setScene({ shape: "sphere", scale: 0.55, opacity: 0.9, spin: 0.6 });
  } catch (err) {
    console.warn("Particle field unavailable:", err);
    canvas.remove();
  }
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  clearInterval(loading);
  pctEl.textContent = "100%";
  setTimeout(() => {
    document.body.classList.remove("is-loading");
    lenis?.start();
    intro();
    heroOn(heroActive);
  }, reduced ? 0 : 450);
}

/* ---------- text splitting ---------- */
function wordsOf(el, cls) {
  const text = el.textContent.trim().split(/\s+/);
  el.innerHTML = text.map((w) => (cls === "ln" ? `<span class="ln"><span>${w}</span></span>` : `<span class="w">${w}</span>`)).join(" ");
  return $$(cls === "ln" ? ".ln > span" : ".w", el);
}
$$(".hero-word").forEach((el) => { el.innerHTML = [...el.textContent].map((c) => `<span class="ch">${c}</span>`).join(""); });

function intro() {
  if (reduced) { $$(".hero .reveal-up").forEach((el) => el.classList.add("is-in")); $$(".hero-word").forEach((w) => w.classList.add("is-on")); return; }
  gsap.from(".hero-word .ch", { yPercent: 110, opacity: 0, filter: "blur(10px)", duration: 1.3, ease: "expo.out", stagger: 0.035 });
  $$(".hero .reveal-up").forEach((el, i) => setTimeout(() => el.classList.add("is-in"), 450 + i * 160));
  gsap.from(".nav", { y: -90, opacity: 0, duration: 1.2, ease: "expo.out", delay: 0.2, clearProps: "transform,opacity" });
}

/* ---------- hero: the car turns, and each word re-forms the particles ---------- */
const heroWords = $$(".hero-word");
const CYCLE = [
  { scene: "hero", word: -1, ms: 4800 },
  { scene: "hero-rupee", word: 0, ms: 3000 },
  { scene: "hero-database", word: 1, ms: 3000 },
  { scene: "hero-xchange", word: 2, ms: 3000 },
];
let cycleAt = 0, cycleTimer = 0, heroActive = true;
function cycleStep() {
  const step = CYCLE[cycleAt % CYCLE.length];
  heroWords.forEach((w, i) => w.classList.toggle("is-on", step.word < 0 || step.word === i));
  if (heroActive) show(step.scene);
  cycleTimer = setTimeout(() => { cycleAt++; cycleStep(); }, step.ms);
}
function heroOn(on) {
  heroActive = on;
  clearTimeout(cycleTimer);
  if (on) { cycleAt = 0; cycleStep(); }
}
heroWords.forEach((w, i) => w.addEventListener("mouseenter", () => {
  if (!heroActive) return;
  clearTimeout(cycleTimer);
  cycleAt = i + 1;
  cycleStep();
}));

/* ---------- scene triggers ---------- */
function sceneTrigger(el, name, extra = {}) {
  ScrollTrigger.create({
    trigger: el, start: "top 55%", end: "bottom 45%", ...extra,
    onToggle: (self) => {
      if (!self.isActive) return;
      if (name === "hero") return heroOn(true);
      heroOn(false);
      show(name);
    },
  });
}

const mm = gsap.matchMedia();
mm.add("(min-width: 900px)", () => {
  const track = $(".pillars-track");
  const distance = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, {
    x: () => -distance(), ease: "none",
    scrollTrigger: { trigger: ".pillars", pin: true, scrub: reduced ? true : 1, end: () => "+=" + distance(), invalidateOnRefresh: true,
      onUpdate: (self) => gsap.set(".pillars-progress span", { scaleX: self.progress }) },
  });
  $$(".pillar").forEach((p) => sceneTrigger(p, p.dataset.scene, { containerAnimation: tween, start: "left center", end: "right center" }));
  return () => {};
});
mm.add("(max-width: 899px)", () => {
  $$(".pillar").forEach((p) => sceneTrigger(p, p.dataset.scene));
});
$$("[data-scene]").forEach((el) => { if (!el.classList.contains("pillar")) sceneTrigger(el, el.dataset.scene); });

/* the silo walls dissolve once the AI line arrives */
ScrollTrigger.create({ trigger: '[data-scene="wn-stream"]', start: "top 60%", onEnter: () => $(".beat-silos").classList.add("is-merged"), onLeaveBack: () => $(".beat-silos").classList.remove("is-merged") });

/* ---------- reveals ---------- */
$$(".scrub").forEach((el) => {
  const words = wordsOf(el, "w");
  if (reduced) return words.forEach((w) => w.classList.add("on"));
  ScrollTrigger.create({
    trigger: el, start: "top 82%", end: "bottom 50%", scrub: true,
    onUpdate: (self) => { const n = Math.round(self.progress * words.length); words.forEach((w, i) => w.classList.toggle("on", i < n)); },
  });
});
$$(".split-up").forEach((el) => {
  const inner = wordsOf(el, "ln");
  if (reduced) return;
  gsap.from(inner, { yPercent: 115, rotate: 4, duration: 1.2, ease: "expo.out", stagger: 0.06, scrollTrigger: { trigger: el, start: "top 85%" } });
});
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px" });
$$(".reveal-up").forEach((el) => { if (!el.closest(".hero")) io.observe(el); });

if (!reduced) {
  gsap.from(".chips li", { opacity: 0, y: 18, scale: 0.9, duration: 0.8, ease: "back.out(2)", stagger: 0.06, scrollTrigger: { trigger: ".chips", start: "top 85%" } });
  gsap.from(".silo", { opacity: 0, y: 40, duration: 1, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".silos", start: "top 80%" } });
  gsap.from(".outcome", { opacity: 0, y: 40, duration: 1, ease: "expo.out", stagger: 0.14, scrollTrigger: { trigger: ".outcomes", start: "top 85%" } });
  gsap.from(".person", { opacity: 0, y: 40, duration: 1, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: ".founders", start: "top 85%" } });
  gsap.from(".form", { opacity: 0, y: 60, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".form", start: "top 85%" } });
  gsap.from(".figure-logger", { opacity: 0, y: 60, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: ".figure-logger", start: "top 85%" } });
  gsap.fromTo(".footer-mark", { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });
  gsap.to(".about-orbit", { "--spin": "120deg", ease: "none", scrollTrigger: { trigger: ".about", start: "top bottom", end: "bottom top", scrub: true } });
}

/* counters */
$$(".stat-num").forEach((el) => {
  const to = parseFloat(el.dataset.count), dec = +el.dataset.decimals, suf = el.dataset.suffix;
  const stat = el.closest(".stat");
  ScrollTrigger.create({
    trigger: el, start: "top 88%", once: true,
    onEnter: () => {
      stat.classList.add("is-in");
      if (reduced) return;
      const o = { v: 0 };
      gsap.to(o, { v: to, duration: 2.2, ease: "expo.out", onUpdate: () => (el.textContent = o.v.toFixed(dec) + suf) });
    },
  });
});

/* the eight data chips light one by one, like channels being sampled */
const chips = $$(".chips li");
let chipAt = 0;
setInterval(() => { chips.forEach((c, i) => c.classList.toggle("is-hot", i === chipAt)); chipAt = (chipAt + 1) % chips.length; }, 1100);

/* ---------- nav ---------- */
const nav = $(".nav");
let lastY = 0;
ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => {
  const y = self.scroll();
  nav.classList.toggle("is-hidden", y > lastY && y > 300 && !nav.classList.contains("is-open"));
  lastY = y;
  const p = Math.round(self.progress * 100);
  $(".charge-fill").style.height = p + "%";
  $(".charge-pct").textContent = p + "%";
} });
function closeNav() { nav.classList.remove("is-open"); $(".nav-burger").setAttribute("aria-expanded", "false"); $$(".nav-link[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false")); }
$(".nav-burger").addEventListener("click", () => {
  const open = !nav.classList.contains("is-open");
  nav.classList.toggle("is-open", open);
  $(".nav-burger").setAttribute("aria-expanded", String(open));
});
$$(".has-menu > .nav-link").forEach((b) => b.addEventListener("click", () => {
  const open = b.getAttribute("aria-expanded") !== "true";
  $$(".has-menu > .nav-link").forEach((o) => o.setAttribute("aria-expanded", "false"));
  b.setAttribute("aria-expanded", String(open));
}));
document.addEventListener("click", (e) => { if (!e.target.closest(".nav")) $$(".has-menu > .nav-link").forEach((o) => o.setAttribute("aria-expanded", "false")); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });

/* ---------- pointer: cursor, magnets, and the field ---------- */
const hudDeg = $(".hud-deg");
const cursor = $(".cursor"), dot = $(".cursor-dot"), ring = $(".cursor-ring");
let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
addEventListener("pointermove", (e) => {
  mx = e.clientX; my = e.clientY;
  field?.setPointer((mx / innerWidth) * 2 - 1, -(my / innerHeight) * 2 + 1, e.pointerType === "mouse");
});
document.addEventListener("pointerleave", () => field?.setPointer(9, 9, false));
gsap.ticker.add(() => {
  rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
  dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
  if (field && heroActive) hudDeg.textContent = String(Math.floor(field.angle())).padStart(3, "0");
});
$$("a, button, input, select, .hero-word, iframe").forEach((el) => {
  el.addEventListener("pointerenter", () => cursor.classList.add("is-hover"));
  el.addEventListener("pointerleave", () => cursor.classList.remove("is-hover"));
});
if (!reduced) $$(".magnetic").forEach((el) => {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty("--mx", x + "px"); el.style.setProperty("--my", y + "px");
    gsap.to(el, { x: (x - r.width / 2) * 0.25, y: (y - r.height / 2) * 0.35, duration: 0.5, ease: "power3.out" });
  });
  el.addEventListener("pointerleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" }));
});

/* ---------- monograms: each person's initials as a small particle cloud ---------- */
function monogram(canvas) {
  const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  const off = document.createElement("canvas"); off.width = W; off.height = H;
  const o = off.getContext("2d");
  o.fillStyle = "#fff"; o.font = `700 ${Math.round(W * 0.42)}px Archivo, sans-serif`; o.textAlign = "center"; o.textBaseline = "middle";
  o.fillText(canvas.dataset.initials, W / 2, H / 2 + W * 0.03);
  const data = o.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (data[(y * W + x) * 4 + 3] > 120) pts.push({ tx: x, ty: y, sx: Math.random() * W, sy: Math.random() * H, p: Math.random() * 6.28, c: Math.random() < 0.18 });
  let t = 0.2, want = 0.78, raf = 0, on = false, clock = 0;
  const card = canvas.closest(".person");
  card.addEventListener("pointerenter", () => { want = 1; run(); });
  card.addEventListener("pointerleave", () => { want = 0.78; run(); });
  function draw() {
    clock += 0.016;
    t += (want - t) * 0.08;
    g.clearRect(0, 0, W, H);
    const e = 1 - Math.pow(1 - t, 3);
    for (const q of pts) {
      const j = (1 - e) * 6;
      const x = q.sx + (q.tx - q.sx) * e + Math.sin(clock * 1.4 + q.p) * j;
      const y = q.sy + (q.ty - q.sy) * e + Math.cos(clock * 1.2 + q.p) * j;
      g.fillStyle = q.c ? "rgba(52,199,89,0.95)" : `rgba(249,250,251,${0.5 + 0.5 * e})`;
      g.fillRect(x, y, 1.6, 1.6);
    }
    raf = on && !reduced ? requestAnimationFrame(draw) : 0;
  }
  function run() { if (!raf) raf = requestAnimationFrame(draw); }
  new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) run(); }).observe(canvas);
  if (reduced) { t = want = 1; draw(); }
}
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => $$(".monogram").forEach(monogram));

/* ---------- embedded figures: dress them for this page ---------- */
const EMBED_CSS = {
  hairline: `html,body{background:#0c0d0f!important}:root{--ground:#0c0d0f!important;--line:transparent!important}
    body{padding:0!important;min-height:0!important;display:block!important}main{max-width:none!important}
    .plate{border:0!important;border-radius:0!important}.controls,#means,#rules,#error,#name{display:none!important}`,
  anatomy: `html,body{background:transparent!important}.iso-page{width:100%!important;margin:0!important}
    .iso-legend{display:none!important}.iso-figure{margin:0!important}`,
};
$$("iframe[data-embed]").forEach((f) => {
  const dress = () => {
    try {
      const d = f.contentDocument;
      if (!d || d.getElementById("embed-css")) return;
      const s = d.createElement("style"); s.id = "embed-css"; s.textContent = EMBED_CSS[f.dataset.embed];
      d.head.appendChild(s);
    } catch (_) { /* cross-origin: leave as is */ }
  };
  f.addEventListener("load", dress);
  dress();
});

/* ---------- forms ---------- */
$(".form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  let ok = true;
  [["f-name", (v) => v.trim().length > 1], ["f-email", (v) => /\S+@\S+\.\S+/.test(v)]].forEach(([id, test]) => {
    const input = $("#" + id), bad = !test(input.value);
    input.closest(".field").classList.toggle("is-invalid", bad);
    if (bad && ok) input.focus();
    ok = ok && !bad;
  });
  const status = $(".form-status", form);
  status.style.color = ok ? "" : "var(--danger)";
  status.textContent = ok ? "Thank you. Our team will get back to you shortly." : "Please add your full name and a valid work email.";
  if (ok) form.reset();
});
$(".newsletter").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#n-email");
  if (/\S+@\S+\.\S+/.test(input.value)) { input.value = ""; input.placeholder = "Subscribed ✓"; }
  else input.focus();
});

addEventListener("resize", () => { if (SCENES[current]) show(current); });
boot();
