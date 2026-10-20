/** Smooth scrolling (Locomotive Scroll 4) on pointer devices; native scrolling on touch. */
import LocomotiveScroll from 'locomotive-scroll';
import 'locomotive-scroll/dist/locomotive-scroll.css';

const isTouch = () => {
  try { document.createEvent('TouchEvent'); return true; } catch { return false; }
};

export function initScroll() {
  const el = document.querySelector('[data-scroll-container]');
  if (!el || isTouch()) return null;
  const loco = new LocomotiveScroll({ el, smooth: true, direction: 'vertical', gestureDirection: 'vertical' });

  // keep scroll bounds correct as fonts, images and viewport change
  let t = 0;
  const update = () => { clearTimeout(t); t = setTimeout(() => loco.update(), 120); };
  new ResizeObserver(update).observe(el);
  window.addEventListener('load', update);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  window.locomotive = loco;
  return loco;
}
