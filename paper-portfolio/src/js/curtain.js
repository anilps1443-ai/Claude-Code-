/**
 * PaperCurtain — a sheet of torn paper that wipes across the viewport.
 *
 * Rendered with a plain 2D canvas. Progress 0 = nothing covered, 1 = fully covered.
 * Canonical direction is "up" (the sheet rises from the bottom edge); "down" mirrors it.
 *
 *   curtain.in()   → progress 0 → 1   (cover)
 *   curtain.out()  → progress 1 → 0   (reveal)
 */
import gsap from 'gsap';
import paperUrl from '../assets/paper.jpg';

const TAU = Math.PI * 2;

/** Small seeded PRNG so every curtain tears the same way. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1-D value noise with cosine interpolation, returns f(x) in [-1, 1]. */
function valueNoise(rand, size = 256) {
  const lattice = Array.from({ length: size }, () => rand() * 2 - 1);
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = lattice[((i % size) + size) % size];
    const b = lattice[(((i + 1) % size) + size) % size];
    const t = (1 - Math.cos(f * Math.PI)) / 2;
    return a + (b - a) * t;
  };
}

let grainCanvas = null;
function getGrain() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 256;
  const img = new Image();
  img.onload = () => {
    const g = grainCanvas.getContext('2d');
    g.drawImage(img, 0, 0, 256, 256);
    const d = g.getImageData(0, 0, 256, 256);
    // Invert + stretch so the paper fibres read as faint light speckle on the dark sheet.
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.max(0, 255 - d.data[i] - 18) * 3.2;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.min(255, v);
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    grainCanvas.ready = true;
  };
  img.src = paperUrl;
  return grainCanvas;
}

export default class PaperCurtain {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = {
      color: '#1d1d1b',
      background: null,        // solid colour drawn under the sheet (revealed as it peels away)
      backgroundOpacity: 0,
      ease: 'power3.inOut',
      duration: 2,
      curveAmplitude: 0.1,
      curveFrequency: 1,
      rippedAmplitude: 0.05,
      rippedFrequency: 3.5,
      rippedHeight: 0.07,
      direction: 'up',
      seed: 7,
      ...options,
    };
    this.progress = 0;
    this.tween = null;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rand = rng(this.opts.seed);
    this.n1 = valueNoise(rand);
    this.n2 = valueNoise(rand);
    this.n3 = valueNoise(rand);
    this.n4 = valueNoise(rand);
    this.grain = getGrain();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  /* ---- public API -------------------------------------------------------- */

  setColor(color) { this.opts.color = color; this.render(); }
  setBackground(color, opacity = 1) { this.opts.background = color; this.opts.backgroundOpacity = opacity; this.render(); }
  setDirection(dir) { this.opts.direction = dir; this.render(); }
  set(progress) { this.kill(); this.progress = progress; this.render(); }

  in(overrides = {}) { return this.to(1, overrides); }
  out(overrides = {}) { return this.to(0, overrides); }

  to(target, { duration = this.opts.duration, ease = this.opts.ease, delay = 0 } = {}) {
    this.kill();
    return new Promise((resolve) => {
      this.tween = gsap.to(this, {
        progress: target, duration, ease, delay,
        onUpdate: () => this.render(),
        onComplete: () => {
          this.render();
          document.body.dispatchEvent(new CustomEvent('paper-curtain', { detail: { progress: target } }));
          resolve();
        },
      });
    });
  }

  kill() { if (this.tween) { this.tween.kill(); this.tween = null; } }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.render();
  }

  destroy() { this.kill(); window.removeEventListener('resize', this._onResize); }

  /* ---- drawing ----------------------------------------------------------- */

  /** y of the tear at normalised x (0..1), before progress is applied. */
  _edgeOffset(xn, H, bow) {
    const o = this.opts;
    const f = o.rippedFrequency;
    const jag =
      this.n1(xn * f * 2.3) * 0.55 +
      this.n2(xn * f * 7.1) * 0.28 +
      this.n3(xn * f * 31) * 0.17;
    const curve = Math.sin(Math.PI * xn * o.curveFrequency);
    return jag * o.rippedAmplitude * H - curve * bow;
  }

  render() {
    const { ctx, w: W, h: H, opts: o } = this;
    const p = this.progress;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // solid colour under the sheet
    if (o.background && o.backgroundOpacity > 0) {
      ctx.globalAlpha = o.backgroundOpacity;
      ctx.fillStyle = o.background;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (p <= 0.0004) return;
    if (p >= 0.9996) { ctx.fillStyle = o.color; ctx.fillRect(0, 0, W, H); return; }

    ctx.save();
    if (o.direction === 'down') { ctx.translate(0, H); ctx.scale(1, -1); }

    const margin = (o.curveAmplitude + o.rippedAmplitude + o.rippedHeight) * H * 1.35;
    const base = H + margin + (-margin - (H + margin)) * p;       // edge height at this progress
    const bow = o.curveAmplitude * H * Math.sin(Math.PI * p);      // sheet billows mid-transition
    const step = Math.max(4, Math.round(W / 220));

    const edge = [];
    const strip = [];
    for (let x = 0; x <= W + step; x += step) {
      const xn = Math.min(1, x / W);
      const y = base + this._edgeOffset(xn, H, bow);
      const stripH = H * o.rippedHeight * (0.1 + 0.26 * (this.n4(xn * 38) * 0.5 + 0.5)) * Math.min(1, p * 6);
      edge.push([x, y]);
      strip.push([x, y - stripH]);
    }

    const trace = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], H + margin * 2);
      for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[pts.length - 1][0], H + margin * 2);
      ctx.closePath();
    };

    // 1) torn fibres — the pale core of the paper showing along the tear, casting a soft shadow upward
    ctx.save();
    trace(strip);
    ctx.shadowColor = 'rgba(0,0,0,.38)';
    ctx.shadowBlur = 26 * this.dpr;
    ctx.shadowOffsetY = -5 * this.dpr;
    ctx.fillStyle = '#e6e0d6';
    ctx.fill();
    ctx.restore();

    // 2) the sheet itself
    trace(edge);
    ctx.fillStyle = o.color;
    ctx.fill();

    // 3) paper grain on the sheet
    if (this.grain && this.grain.ready) {
      ctx.save();
      trace(edge);
      ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = ctx.createPattern(this.grain, 'repeat');
      ctx.fillRect(0, 0, W, H + margin * 2);
      ctx.restore();
    }

    // 4) faint crease where the sheet bends
    ctx.save();
    trace(edge);
    ctx.clip();
    const g = ctx.createLinearGradient(0, base - H * 0.04, 0, base + H * 0.22);
    g.addColorStop(0, 'rgba(255,255,255,.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H + margin * 2);
    ctx.restore();

    ctx.restore();
  }
}
