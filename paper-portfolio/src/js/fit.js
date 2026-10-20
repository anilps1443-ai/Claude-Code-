/**
 * Fit the giant black-block words to the width of their box, whatever the word is.
 * Measures the word at 100px, then scales the font-size so the (condensed) ink spans
 * the block. Paddings/line-height are em-based in CSS, so the block grows with it.
 */
export function initFit() {
  const els = [...document.querySelectorAll('.head.h[data-fit]')];
  if (!els.length) return { update() {} };

  const run = () => {
    const cx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cx')) || 1;
    els.forEach((el) => {
      const word = el.querySelector('.blk');
      if (!word) return;
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const target = el.clientWidth - padX;           // layout width available (pre-scale)
      el.style.fontSize = '100px';
      const natural = word.getBoundingClientRect().width / (cx || 1) * (1 / 1);
      // getBoundingClientRect is post-scale; offsetWidth is the layout width we want
      const layout = word.offsetWidth;
      const size = (100 * target) / layout;
      el.style.fontSize = `${size}px`;
      void natural;
    });
  };

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run(); }); };
  run();
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  return { update: schedule };
}
