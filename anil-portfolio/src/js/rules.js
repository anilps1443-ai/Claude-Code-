/**
 * Hairline rules under the big display lines. Each rule sits on the baseline of its
 * line of type, so it keeps tracking the text whatever the font, size or viewport.
 * Markup: a [data-rules] container holding N `.h-head` lines and a `.divs` with N `.div-2`.
 */
export function initRules() {
  const blocks = [...document.querySelectorAll('[data-rules]')];
  if (!blocks.length) return { update() {} };

  const probes = new Map();
  const probeFor = (head) => {
    let p = probes.get(head);
    if (!p) {
      p = document.createElement('i');
      p.className = 'bl-probe';
      p.setAttribute('aria-hidden', 'true');
      head.appendChild(p);
      probes.set(head, p);
    }
    return p;
  };

  /** y of `el`'s baseline probe relative to `ancestor`, from layout offsets only
   *  (immune to transforms such as the intro's scale), plus the display-face lift. */
  const baselineY = (probe, ancestor, head) => {
    let y = 0;
    for (let n = probe; n && n !== ancestor; n = n.offsetParent) y += n.offsetTop;
    const lift = parseFloat(getComputedStyle(head).translate.split(' ')[1]) || 0;   // CSS `translate: 0 -.0486em` → px
    return y + lift;
  };

  const run = () => {
    blocks.forEach((block) => {
      const heads = [...block.querySelectorAll(':scope > .h-head')];
      const lines = [...block.querySelectorAll(':scope > .divs > .div-2')];
      heads.forEach((h, i) => {
        if (lines[i]) lines[i].style.top = `${baselineY(probeFor(h), block, h)}px`;
      });
    });
  };

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run(); }); };
  run();
  window.addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  return { update: schedule };
}
