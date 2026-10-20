/**
 * Navigation: burger ↔ full-screen menu, torn-paper page transitions, mobile nav hide.
 *
 * Menu open  — a dark sheet rises over the page; the nav controls recolour; the three
 *              titles slide up out of their masks one after another; the current page
 *              gets a red strike; social links fade in.
 * Link click — leaving via the menu peels the sheet away over solid paper, leaving via
 *              any other link drops a sheet from the top; the next page reveals it.
 */
import gsap from 'gsap';
import PaperCurtain from './curtain.js';

const INK = '#1d1d1b';
const PAPER = '#cdc6be';
const STORE = 'pp:arrive';

const dur = (n) => n / 1000;

export function initNav({ loco }) {
  const nav = document.querySelector('nav.nav');
  const menu = document.getElementById('menu');
  const burger = nav.querySelector('.nav-link');
  const canvas = document.getElementById('above-canvas');
  const glWrap = nav.querySelector('.gl-canvas');
  const titles = [...menu.querySelectorAll('.menu-title')];
  const actives = [...menu.querySelectorAll('.m-active')];
  const social = menu.querySelector('.f-block.li');
  const fade = nav.querySelectorAll('.nav-head, .nav-block, .menu-line, .nav-inner > .paper-background');

  const curtain = new PaperCurtain(canvas, { color: INK, direction: 'up', duration: 2 });
  gsap.set(titles, { yPercent: 100 });
  let open = false;
  let busy = false;

  /* ---------- menu ---------- */
  function openMenu() {
    if (busy || open) return;
    open = true; busy = true;
    nav.classList.add('menu-open');
    menu.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    if (loco) loco.stop();

    curtain.setDirection('up');
    curtain.setColor(INK);
    curtain.in();

    gsap.killTweensOf([...titles, social, ...actives]);
    titles.forEach((t, i) => gsap.fromTo(t, { yPercent: 100 }, { yPercent: 0, delay: dur(1000 + i * 50), duration: dur(1000 + i * 100), ease: 'expo.out' }));
    gsap.fromTo(social, { y: '2vh', opacity: 0 }, { y: 0, opacity: 1, delay: dur(1100), duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(actives, { scaleX: 0 }, { scaleX: 1, delay: dur(1100), duration: 0.9, ease: 'expo.inOut' });
    setTimeout(() => { busy = false; }, 1400);
  }

  function closeMenu({ keepCovered = false } = {}) {
    if (busy || !open) return Promise.resolve();
    open = false; busy = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');

    gsap.killTweensOf([...titles, social, ...actives]);
    titles.forEach((t) => gsap.to(t, { yPercent: 100, delay: 0.2, duration: 0.75, ease: 'expo.out' }));
    gsap.to(social, { y: '3vh', opacity: 0, delay: 0.2, duration: 0.5, ease: 'power2.out' });
    gsap.to(actives, { scaleX: 0, duration: 0.8, ease: 'expo.inOut' });

    const done = keepCovered ? Promise.resolve() : curtain.out();
    setTimeout(() => nav.classList.remove('menu-open'), 1100);
    return done.then(() => {
      menu.classList.remove('open');
      if (loco) loco.start();
      busy = false;
    });
  }

  burger.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeMenu(); });

  /* ---------- internal links → page transitions ---------- */
  let leaving = false;
  const internal = [...document.querySelectorAll('a[href]')].filter((a) => {
    if (a.target === '_blank' || a.hasAttribute('download')) return false;
    const url = new URL(a.href, location.href);
    return url.origin === location.origin && !a.getAttribute('href').startsWith('#') && !a.getAttribute('href').startsWith('mailto:');
  });

  internal.forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (leaving) return;
      const href = link.href;
      const same = new URL(href).pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '');
      if (same) { if (open) closeMenu(); return; }

      leaving = true;
      const color = link.dataset.color || INK;
      const go = () => { location.href = href; };
      const safety = setTimeout(go, 2800);
      const finish = () => { clearTimeout(safety); go(); };

      if (open) {
        // peel the dark sheet away over solid paper, then load the next page already uncovered
        remember({ mode: 'none' });
        curtain.setBackground(color, 1);
        fadeOut(fade);
        busy = false;
        closeMenu().then(finish);
      } else {
        // drop a sheet from the top; the next page starts covered and uncovers it
        remember({ mode: 'cover', color });
        glWrap.classList.add('front');
        curtain.setDirection('down');
        curtain.setColor(color);
        fadeOut(fade);
        curtain.in().then(finish);
      }
    });
  });

  // returning via the back button restores the page from bfcache in a stale state
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false; busy = false; open = false;
    curtain.set(0);
    glWrap.classList.remove('front');
    nav.classList.remove('menu-open');
    menu.classList.remove('open');
    gsap.set(fade, { clearProps: 'opacity' });
    if (loco) loco.start();
  });

  /* ---------- phones: hide nav while scrolling down ---------- */
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (window.innerWidth > 479) { nav.classList.remove('hide'); return; }
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 6) return;
    nav.classList.toggle('hide', y > lastY && y > 80);
    lastY = y;
  }, { passive: true });

  window.paperCurtain = curtain;   // handy for tweaking / debugging in the console
  return { curtain, openMenu, closeMenu };
}

function remember(info) { try { sessionStorage.setItem(STORE, JSON.stringify(info)); } catch { /* storage unavailable (private mode / sandbox) — transitions still play */ } }

function fadeOut(els) { gsap.to(els, { opacity: 0, duration: 0.6, ease: 'expo.out' }); }

/** Read (and clear) how we got here so the page can reveal itself accordingly. */
export function consumeArrival() {
  let info = null;
  try { info = JSON.parse(sessionStorage.getItem(STORE) || 'null'); sessionStorage.removeItem(STORE); } catch { /* ignore */ }
  return info;
}

/** Start covered by the previous page's sheet, then peel it away. */
export function revealArrival(info) {
  const wrap = document.querySelector('.gl-canvas.below');
  const canvas = document.getElementById('below-canvas');
  if (!wrap || !canvas) return Promise.resolve();
  const c = new PaperCurtain(canvas, { color: info.color || INK, direction: 'up', duration: 2 });
  c.set(1);
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      c.out({ delay: 0.15 }).then(() => { wrap.remove(); c.destroy(); resolve(); });
    });
  });
}
