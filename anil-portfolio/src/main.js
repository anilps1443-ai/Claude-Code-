import './styles/main.css';
import { initCondense } from './js/condense.js';
import { initFit } from './js/fit.js';
import { initRules } from './js/rules.js';
import { initScroll } from './js/scroll.js';
import { initNav, consumeArrival, revealArrival } from './js/nav.js';
import { initCards } from './js/cards.js';
import { playIntro } from './js/intro.js';
import DragSlider from './js/slider.js';

const root = document.documentElement;
const page = document.body.dataset.page;
const stage = document.getElementById('stage');

function boot() {
  const arrival = consumeArrival();
  const fit = initFit();
  const condense = initCondense();
  const rules = initRules();
  const loco = initScroll();
  initNav({ loco });
  initCards();

  // featured strip (home only)
  const strip = document.querySelector('[data-drag-strip]');
  if (strip) {
    const slider = new DragSlider(strip, strip.querySelector('[data-drag-inner]'), { smooth: 0.15, dragSpeed: 2.5 });
    const headline = strip.querySelector('.headline');
    const place = () => slider.centerOn(headline, 0.505);
    place();
    document.fonts && document.fonts.ready.then(place);
    window.sliders = [slider];
  }

  if (arrival && arrival.mode === 'cover') {
    root.classList.remove('intro');
    revealArrival(arrival);
  } else if (page === 'index' && root.classList.contains('intro')) {
    const start = () => playIntro(stage, loco).then(() => { fit.update(); condense.update(); rules.update(); });
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(() => { fit.update(); condense.update(); rules.update(); requestAnimationFrame(start); });
  } else {
    root.classList.remove('intro');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
