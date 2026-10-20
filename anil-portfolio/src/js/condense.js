/**
 * Display type is set in a free condensed Didone and squeezed a little further with
 * `scale: var(--cx) 1`. A CSS transform doesn't change layout width, so this gives
 * every squeezed element a matching negative right margin: neighbours, flex rows and
 * shrink-wrapped black boxes then sit exactly where the visual ink ends.
 */
const SELECTOR = '.cx:not(.cx-c), .head.set2, .m-head.shape';

export function initCondense() {
  const root = document.documentElement;
  let raf = 0;

  const run = () => {
    raf = 0;
    const cx = parseFloat(getComputedStyle(root).getPropertyValue('--cx')) || 1;
    const els = document.querySelectorAll(SELECTOR);
    els.forEach((el) => { el.style.marginRight = ''; });
    els.forEach((el) => {
      const base = parseFloat(getComputedStyle(el).marginRight) || 0;   // keep any margin the stylesheet gave it
      el.style.marginRight = `${base - (1 - cx) * el.offsetWidth}px`;
    });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };

  run();
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  return { update: schedule };
}
