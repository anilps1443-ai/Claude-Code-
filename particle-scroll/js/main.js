import * as THREE from '../vendor/three.module.min.js';

// Each shape is sampled from a bright-on-black image and given depth: 'slab' extrudes
// the silhouette evenly (thin when edge-on), 'dome' swells toward the middle.
const SHAPES = [
  { src: 'shapes/rupee.jpg', form: 'slab', depth: 0.2 },
  { src: 'shapes/brain.jpg', form: 'dome', depth: 0.85 },
  { src: 'shapes/ev-swap.jpg', form: 'slab', depth: 0.2 },
];

const SEGMENT_VH = 260;    // scroll length given to each shape
const FOV = 36;
const CAM_Z = 5.2;
const SAMPLE_W = 360;      // resolution the source images are read at
const DOT_CSS_PX = 1.6;    // on-screen size of a particle sitting on the shape

const canvas = document.getElementById('stage');
const track = document.getElementById('track');
const cue = document.getElementById('cue');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = Math.min(innerWidth, innerHeight) < 700;
const COUNT = small ? 36000 : 70000;

track.style.height = `${SHAPES.length * SEGMENT_VH + 100}vh`;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

// Weighted percentile of a 1D histogram, used to find the shape's bounds while
// ignoring the stray specks scattered around the source images.
function percentile(hist, total, q) {
  let acc = 0;
  for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= total * q) return i; }
  return hist.length - 1;
}

// Returns COUNT points (xyz, height normalised to 2) and the source brightness of each.
function sampleShape(img, shape, rand) {
  const W = SAMPLE_W;
  const H = Math.round((W * img.naturalHeight) / img.naturalWidth);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;

  const cdf = new Float64Array(W * H);
  const lum = new Float32Array(W * H);
  const colW = new Float64Array(W), rowW = new Float64Array(H);
  let sum = 0;
  for (let i = 0; i < W * H; i++) {
    const l = px[i * 4] / 255;
    lum[i] = l;
    const w = l > 0.14 ? Math.pow(l - 0.1, 1.5) : 0;
    sum += w;
    cdf[i] = sum;
    colW[i % W] += w; rowW[(i / W) | 0] += w;
  }
  const x0 = percentile(colW, sum, 0.01), x1 = percentile(colW, sum, 0.99);
  const y0 = percentile(rowW, sum, 0.01), y1 = percentile(rowW, sum, 0.99);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const s = Math.min(2 / bh, 2.7 / bw);

  const pos = new Float32Array(COUNT * 3);
  const bright = new Float32Array(COUNT);
  for (let n = 0; n < COUNT; n++) {
    const r = rand() * sum;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
    const ix = (lo % W) + rand(), iy = ((lo / W) | 0) + rand();
    let zr = 1;
    if (shape.form === 'dome') {
      const ex = (ix - cx) / (bw / 2), ey = (iy - cy) / (bh / 2);
      zr = Math.sqrt(Math.max(0.04, 1 - ex * ex - ey * ey));
    }
    pos[n * 3] = (ix - cx) * s;
    pos[n * 3 + 1] = -(iy - cy) * s;
    pos[n * 3 + 2] = (rand() * 2 - 1) * (shape.depth / 2) * zr;
    bright[n] = lum[lo];
  }
  return { pos, bright };
}

// Starfield positions, stored relative to the camera (x, y in -1..1 of the view, z as distance)
// so the field fills the screen at any aspect ratio. A few land right in front of the lens as bokeh.
function scatterField(rand) {
  const out = new Float32Array(COUNT * 3);
  for (let n = 0; n < COUNT; n++) {
    const near = rand() < 0.025;
    out[n * 3] = rand() * 2 - 1;
    out[n * 3 + 1] = rand() * 2 - 1;
    out[n * 3 + 2] = near ? 0.6 + rand() * 2.4 : 2.5 + Math.pow(rand(), 0.8) * 28;
  }
  return out;
}

const vertexShader = /* glsl */ `
  attribute vec3 aS1;
  attribute vec3 aS2;
  attribute vec3 aScatter;
  attribute vec3 aLum;
  attribute vec2 aSeed;
  uniform float uShape, uMix, uTime, uAmbient, uAgitate;
  uniform float uCamZ, uTanHalf, uAspect, uPx, uSize, uScale;
  uniform mat3 uRot;
  varying float vAlpha;
  varying float vSoft;

  vec3 flow(vec3 p, float t) {
    return 0.5 * vec3(
      sin(p.y * 3.1 + t * 0.7) + sin(p.z * 4.3 - t * 0.5),
      sin(p.z * 3.7 + t * 0.6) + sin(p.x * 2.9 + t * 0.8),
      sin(p.x * 3.3 - t * 0.9) + sin(p.y * 4.1 + t * 0.4));
  }

  void main() {
    vec3 sp = uShape < 0.5 ? position : (uShape < 1.5 ? aS1 : aS2);
    float lum = uShape < 0.5 ? aLum.x : (uShape < 1.5 ? aLum.y : aLum.z);

    // Living grain: a slow shared current plus each particle's own shiver,
    // stronger while the form is turning quickly.
    vec3 jit = flow(sp * 1.7 + aSeed.x * 6.0, uTime * 0.8)
      + 0.6 * vec3(sin(uTime * 2.3 + aSeed.x * 91.0), sin(uTime * 1.9 + aSeed.y * 77.0), sin(uTime * 2.1 + aSeed.x * 53.0));
    sp += jit * (uAmbient + uAgitate * (0.4 + aSeed.y));
    vec3 wp = uRot * sp * uScale;

    float dist = aScatter.z;
    vec3 sc = vec3(aScatter.x * dist * uTanHalf * uAspect * 1.15, aScatter.y * dist * uTanHalf * 1.15, uCamZ - dist);
    sc.xy += 0.02 * dist * vec2(sin(uTime * 0.05 + aSeed.x * 6.283), cos(uTime * 0.04 + aSeed.y * 6.283));

    // Staggered release: each particle leaves (or arrives) on its own schedule,
    // bowing out through a turbulent arc and briefly drifting toward the viewer.
    float e = smoothstep(aSeed.x * 0.45, aSeed.x * 0.45 + 0.55, uMix);
    float arc = sin(3.14159 * e);
    vec3 p = mix(wp, sc, e);
    p += flow(wp * 0.9 + aSeed.y * 3.0, uTime * 0.3 + aSeed.x * 2.0) * arc * 0.55;
    p.z += arc * (0.4 + aSeed.y * 1.4);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = max(-mv.z, 0.05);
    float sparkle = step(0.975, aSeed.y);
    float sizeW = uSize * (0.65 + aSeed.y * 0.7 + sparkle * 1.2);
    sizeW *= mix(1.0, 0.6 + fract(aSeed.x * 13.7) * 1.4, e);
    float px = sizeW * uPx / depth;
    gl_PointSize = clamp(px, 1.0, 64.0);

    vSoft = smoothstep(3.0, 14.0, px);
    vAlpha = (0.5 + 0.5 * lum) * min(1.0, 3.0 / max(px, 1.0) + 0.22) * min(px, 1.0);
    // Once scattered, only part of the cloud stays lit so the field reads as sparse stars.
    float lit = step(0.58, fract(aSeed.x * 7.31 + aSeed.y * 3.17));
    vAlpha *= mix(1.0, 0.75 * lit, e) * smoothstep(0.25, 0.9, depth);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float crisp = 1.0 - smoothstep(0.55, 1.0, d);
    float glow = exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d));
    float a = mix(crisp, glow, vSoft) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(1.0), a);
  }
`;

async function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    document.getElementById('fallback').hidden = false;
    cue.hidden = true;
    return;
  }
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 60);
  camera.position.set(0, 0, CAM_Z);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const rand = mulberry32(1443);
  const images = await Promise.all(SHAPES.map((s) => loadImage(s.src)));
  const sampled = images.map((img, i) => sampleShape(img, SHAPES[i], rand));

  const lum = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT * 2);
  for (let n = 0; n < COUNT; n++) {
    for (let k = 0; k < 3; k++) lum[n * 3 + k] = sampled[k].bright[n];
    seed[n * 2] = rand();
    seed[n * 2 + 1] = rand();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(sampled[0].pos, 3));
  geo.setAttribute('aS1', new THREE.BufferAttribute(sampled[1].pos, 3));
  geo.setAttribute('aS2', new THREE.BufferAttribute(sampled[2].pos, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatterField(rand), 3));
  geo.setAttribute('aLum', new THREE.BufferAttribute(lum, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));

  const uniforms = {
    uShape: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 },
    uAmbient: { value: reduceMotion ? 0.0015 : 0.0045 }, uAgitate: { value: 0 },
    uCamZ: { value: CAM_Z }, uTanHalf: { value: tanHalf }, uAspect: { value: 1 },
    uPx: { value: 1 }, uSize: { value: 0.01 }, uScale: { value: 1 },
    uRot: { value: new THREE.Matrix3() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  function resize() {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * CAM_Z * tanHalf;
    uniforms.uAspect.value = w / h;
    uniforms.uPx.value = (h * dpr) / (2 * tanHalf);
    // World size that projects to DOT_CSS_PX at the shape's distance.
    uniforms.uSize.value = ((small ? DOT_CSS_PX + 0.3 : DOT_CSS_PX) * 2 * tanHalf * CAM_Z) / h;
    // Shape is 2 units tall and at most 2.7 wide before scaling.
    uniforms.uScale.value = Math.min((0.62 * viewH) / 2, (0.86 * viewH * (w / h)) / 2.7);
  }
  addEventListener('resize', resize);
  resize();

  // Scroll position → which shape, how far it has turned, how dispersed it is.
  const N = SHAPES.length;
  const A0 = 0.12, A1 = -0.62, EDGE = Math.PI / 2;
  function stateAt(P) {
    const k = Math.min(N - 1, Math.floor(P));
    const t = P - k;
    const first = k === 0, last = k === N - 1;
    let mix = 0, yawExtra = 0;
    if (!first && t < 0.2) { const a = ease(1 - t / 0.2); mix = a; yawExtra -= 0.6 * a; }
    if (!last && t > 0.8) { const a = ease((t - 0.8) / 0.2); mix = a; yawExtra += 0.6 * a; }
    const u = clamp((t - (first ? 0.04 : 0.14)) / ((last ? 0.96 : 0.84) - (first ? 0.04 : 0.14)));
    // Front → edge-on → an angled view from the other side, never past edge-on so nothing reads mirrored.
    const yaw = (u < 0.5 ? A0 + (EDGE - A0) * ease(u * 2) : EDGE + (A1 - EDGE) * ease(u * 2 - 1)) + yawExtra;
    const pitch = 0.05 + 0.09 * Math.sin(Math.PI * u);
    return { k, mix, yaw, pitch };
  }

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const m4 = new THREE.Matrix4();
  let target = 0, current = 0, lastYaw = null, agitate = 0, last = performance.now();

  function readScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    target = clamp(scrollY / max) * N;
    cue.classList.toggle('gone', scrollY > 40);
  }
  addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  current = target;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    current += (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 1e-5) current = target;

    const s = stateAt(Math.min(current, N - 1e-6));
    if (lastYaw !== null && dt > 0) {
      const speed = Math.abs(s.yaw - lastYaw) / dt;
      agitate += (clamp(speed * 0.012, 0, 0.035) - agitate) * (1 - Math.exp(-dt * 6));
    }
    lastYaw = s.yaw;

    euler.set(s.pitch, s.yaw, 0);
    uniforms.uRot.value.setFromMatrix4(m4.makeRotationFromEuler(euler));
    uniforms.uShape.value = s.k;
    uniforms.uMix.value = s.mix;
    uniforms.uAgitate.value = reduceMotion ? agitate * 0.3 : agitate;
    uniforms.uTime.value = now / 1000;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start().catch((err) => {
  console.error(err);
  document.getElementById('fallback').hidden = false;
});
