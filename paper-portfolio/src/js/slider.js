/**
 * DragSlider — inertial drag-to-scroll strip (mouse, touch, pen, horizontal trackpad).
 * `smooth` is the lerp factor per frame, `dragSpeed` multiplies pointer travel.
 */
export default class DragSlider {
  constructor(container, inner, { smooth = 0.15, dragSpeed = 2.5 } = {}) {
    this.container = container;
    this.inner = inner;
    this.smooth = smooth;
    this.dragSpeed = dragSpeed;
    this.x = 0;
    this.target = 0;
    this.min = 0;
    this.dragging = false;
    this.moved = 0;
    this.raf = 0;

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onClick = this.onClick.bind(this);
    this.tick = this.tick.bind(this);

    container.addEventListener('pointerdown', this.onDown);
    container.addEventListener('wheel', this.onWheel, { passive: false });
    container.addEventListener('click', this.onClick, true);
    container.addEventListener('dragstart', (e) => e.preventDefault());
    window.addEventListener('resize', () => this.measure());
    this.measure();
  }

  measure() {
    const overflow = this.inner.scrollWidth - (this.container.clientWidth - this.padLeft());
    this.min = -Math.max(0, overflow);
    this.target = Math.min(0, Math.max(this.min, this.target));
  }

  padLeft() { return parseFloat(getComputedStyle(this.container).paddingLeft) || 0; }

  /** Centre `el` horizontally in the viewport (instantly). Uses layout offsets, so it is
   *  unaffected by any transform on the page (e.g. the intro's scale). */
  centerOn(el, fraction = 0.5) {
    let left = 0;
    for (let n = el; n && n !== this.inner; n = n.offsetParent) left += n.offsetLeft;
    const centre = this.padLeft() + left + el.offsetWidth / 2;
    this.jumpTo(window.innerWidth * fraction - centre);
  }

  jumpTo(x) {
    this.measure();
    this.target = this.x = Math.min(0, Math.max(this.min, x));
    this.apply();
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dragging = true;
    this.moved = 0;
    this.startX = e.clientX;
    this.startTarget = this.target;
    this.lastX = e.clientX;
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    this.start();
  }

  onMove(e) {
    if (!this.dragging) return;
    this.moved += Math.abs(e.clientX - this.lastX);
    this.lastX = e.clientX;
    const dx = (e.clientX - this.startX) * this.dragSpeed;
    this.target = Math.min(0, Math.max(this.min, this.startTarget + dx));
  }

  onUp() {
    this.dragging = false;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  onWheel(e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // let vertical scroll through
    e.preventDefault();
    this.target = Math.min(0, Math.max(this.min, this.target - e.deltaX * 1.2));
    this.start();
  }

  /** A drag must not trigger the link underneath it. */
  onClick(e) {
    if (this.moved > 6) { e.preventDefault(); e.stopPropagation(); this.moved = 0; }
  }

  start() { if (!this.raf) this.raf = requestAnimationFrame(this.tick); }

  tick() {
    this.x += (this.target - this.x) * this.smooth;
    if (Math.abs(this.target - this.x) < 0.05) this.x = this.target;
    this.apply();
    this.raf = (this.dragging || this.x !== this.target) ? requestAnimationFrame(this.tick) : 0;
  }

  apply() { this.inner.style.transform = `translate3d(${this.x}px,0,0)`; }
}
