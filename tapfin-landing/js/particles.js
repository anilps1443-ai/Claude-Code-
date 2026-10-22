import * as THREE from '../vendor/three.module.min.js';

// Formations in scroll order. Each is sampled from a bright-on-black image and given depth:
// 'slab' extrudes the silhouette evenly, 'dome' swells toward the middle (the brain).
const SHAPES = [
  { src: 'shapes/rupee.jpg', form: 'slab', depth: 0.22 },
  { src: 'shapes/brain.jpg', form: 'dome', depth: 0.9 },
  { src: 'shapes/ev-swap.jpg', form: 'slab', depth: 0.22 },
];
const BRAIN = 1;

// Normalised scroll progress (0..1) → hold and transition spans. Each transition covers
// dispersion, travel through the cloud, convergence and settling; the shader shapes those phases.
export const TIMELINE = [
  { at: 0.0, hold: 0 },
  { at: 0.08, from: 0, to: 1 },
  { at: 0.46, hold: 1 },
  { at: 0.54, from: 1, to: 2 },
  { at: 0.92, hold: 2 },
  { at: 1.0 },
];

const FOV = 36;
const CAM_Z = 5.2;
const SAMPLE_W = 480;          // resolution the source images are read at
const DOT_CSS_PX = 1.5;        // on-screen size of a particle sitting on the formation
const TURN_SECONDS = 22;       // one full idle revolution
const SCROLL_TURNS = 1;        // extra revolutions added across the whole scroll (reverses with it)
const FILL = 0.72;             // share of the stage height a formation may fill
const STAR_DENSITY = 0.0093;   // lit stars per CSS px² mid-transition (about 12k on a 1440×900 hero)

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

// Weighted percentile of a 1D histogram, used to find the formation's bounds while
// ignoring the stray specks scattered around the source images.
function percentile(hist, total, q) {
  let acc = 0;
  for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= total * q) return i; }
  return hist.length - 1;
}

// count points (height normalised to 2) placed in proportion to pixel brightness, plus the
// brightness each one came from, so dense and glowing areas of the source stay dense and glowing.
function sampleShape(img, shape, count, rand) {
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

  const pos = new Float32Array(count * 3);
  const bright = new Float32Array(count);
  for (let n = 0; n < count; n++) {
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

// Starfield slots, relative to the camera (x, y in -1..1 of the view, z as distance) so the
// field fills the hero at any aspect ratio. A few sit right at the lens and read as bokeh.
function starField(count, rand) {
  const out = new Float32Array(count * 3);
  for (let n = 0; n < count; n++) {
    const near = rand() < 0.03;
    out[n * 3] = rand() * 2 - 1;
    out[n * 3 + 1] = rand() * 2 - 1;
    out[n * 3 + 2] = near ? 0.5 + rand() * 2.5 : 2.5 + Math.pow(rand(), 0.8) * 22;
  }
  return out;
}

// Seeded unit direction per particle: where it heads when it leaves a formation.
function directions(count, rand) {
  const out = new Float32Array(count * 3);
  for (let n = 0; n < count; n++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    out[n * 3] = r * Math.cos(a);
    out[n * 3 + 1] = r * Math.sin(a);
    out[n * 3 + 2] = u;
  }
  return out;
}

const vertexShader = /* glsl */ `
  attribute vec3 aS1;
  attribute vec3 aS2;
  attribute vec3 aLum;
  attribute vec3 aStar;
  attribute vec3 aDir;
  attribute vec4 aSeed;   // x: timing, y: size, z: role (traveller / halo / body), w: reach
  uniform float uFrom, uTo, uT, uTime, uMotion, uAgitate;
  uniform float uCamZ, uTanHalf, uAspect, uPx, uSize, uScale;
  uniform vec3 uCenter;
  uniform float uKeep, uMaxPx, uCopyY;
  uniform mat3 uRot;
  varying float vAlpha;
  varying float vSoft;

  vec3 shapeAt(float i) { return i < 0.5 ? position : (i < 1.5 ? aS1 : aS2); }
  float lumAt(float i) { return i < 0.5 ? aLum.x : (i < 1.5 ? aLum.y : aLum.z); }

  vec3 flow(vec3 p, float t) {
    return 0.5 * vec3(
      sin(p.y * 3.1 + t * 0.7) + sin(p.z * 4.3 - t * 0.5),
      sin(p.z * 3.7 + t * 0.6) + sin(p.x * 2.9 + t * 0.8),
      sin(p.x * 3.3 - t * 0.9) + sin(p.y * 4.1 + t * 0.4));
  }

  void main() {
    vec3 A = shapeAt(uFrom);
    vec3 B = shapeAt(uTo);

    // Left-to-right sweep: the left side of a formation lets go first and drifts right,
    // and the next formation fills in from its left side. Seeded jitter keeps it from moving in lockstep.
    float xA = clamp(A.x / 1.35, -1.0, 1.0) * 0.5 + 0.5;
    float xB = clamp(B.x / 1.35, -1.0, 1.0) * 0.5 + 0.5;
    float leadA = xA * 0.13 + aSeed.x * 0.07;
    float leadB = xB * 0.13 + aSeed.x * 0.07;
    float dep = smoothstep(leadA, leadA + 0.3, uT);
    float arr = smoothstep(0.5 + leadB, 0.8 + leadB, uT);
    float env = dep * (1.0 - arr);                    // how far out of formation it is
    float tl = 0.5 * (dep + arr);                     // the particle's own transition clock
    float m = smoothstep(0.42, 0.58, uT);             // which formation it belongs to

    // Formation the particle belongs to, swelling slightly while it is diffuse (as in the recording).
    vec3 local = mix(A, B, m) * (1.0 + 0.12 * env);
    float lum = mix(lumAt(uFrom), lumAt(uTo), m);

    // Living surface: a shared slow current plus each grain's own shiver, more while turning fast.
    vec3 jit = flow(local * 1.7 + aSeed.x * 6.0, uTime * 0.8)
      + 0.6 * vec3(sin(uTime * 2.3 + aSeed.x * 91.0), sin(uTime * 1.9 + aSeed.y * 77.0), sin(uTime * 2.1 + aSeed.w * 53.0));
    local += jit * (0.0045 * uMotion + uAgitate * (0.4 + aSeed.y));

    vec3 world = uRot * local * uScale + uCenter;

    // Halo grains (about 7%) breathe in and out around the outline even when the form is at rest.
    float halo = step(0.3, aSeed.z) * step(aSeed.z, 0.37);
    world += aDir * uScale * halo * (0.03 + aSeed.w * 0.32) * (0.55 + 0.45 * sin(uTime * 0.35 + aSeed.x * 31.0)) * uMotion;

    // Body grains fray into a ghost of the outline: seeded direction and reach, a sideways curve,
    // turbulence, and a rightward drift on the way out that becomes an approach from the left on the way in.
    float reach = (0.06 + pow(aSeed.w, 2.0) * 0.75) * uScale * uMotion;
    vec3 side = normalize(cross(aDir, vec3(0.0, 1.0, 0.001)));
    float drift = (0.18 + aSeed.w * 0.5) * uScale * uMotion * (1.0 - 2.0 * m);
    vec3 cloud = aDir * reach * env
      + side * reach * 0.5 * sin(6.2832 * tl)
      + vec3(drift * env, 0.0, 0.0)
      + flow(world * 0.8 + aSeed.y * 3.0, uTime * 0.25 + aSeed.x * 2.0) * 0.35 * env * uScale * uMotion;

    // Travellers (30%) leave for a starfield that streams left to right as you scroll;
    // it also comes toward the camera, so a few grains pass the lens as bokeh.
    float traveller = step(aSeed.z, 0.3);
    float out_ = smoothstep(0.0, 0.42, tl) * (1.0 - smoothstep(0.58, 1.0, tl)) * uMotion;
    float dist = 0.4 + mod(aStar.z - 0.4 - uT * 3.0, 24.0);
    float sx = mod(aStar.x + 1.0 + uT * 0.9 + uTime * 0.004, 2.0) - 1.0;
    vec3 star = vec3(sx * dist * uTanHalf * uAspect * 1.15, aStar.y * dist * uTanHalf * 1.15, uCamZ - dist);
    star.y += 0.02 * dist * cos(uTime * 0.04 + aSeed.y * 6.283);

    vec3 p = world + cloud * (1.0 - traveller);
    p = mix(p, star, traveller * out_);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = max(-mv.z, 0.05);

    // Brain nodes: the brightest grains of the brain flicker gently and sit a little larger.
    float brainW = (uFrom == ${BRAIN}.0 ? 1.0 - m : 0.0) + (uTo == ${BRAIN}.0 ? m : 0.0);
    float node = brainW * smoothstep(0.78, 0.92, lum);
    float flicker = 1.0 + node * 0.55 * sin(uTime * (1.8 + aSeed.w * 4.0) + aSeed.x * 40.0) * uMotion;

    float sparkle = step(0.975, aSeed.y);
    float sizeW = uSize * (0.65 + aSeed.y * 0.7 + sparkle * 1.1 + node * 0.7);
    sizeW *= mix(1.0, 0.6 + fract(aSeed.x * 13.7) * 1.4, traveller * out_);
    float px = sizeW * uPx / depth;
    gl_PointSize = clamp(px, 1.0, uMaxPx);

    vSoft = smoothstep(3.0, 14.0, px);
    vAlpha = (0.45 + 0.55 * lum) * flicker * min(1.0, 3.0 / max(px, 1.0) + 0.22) * min(px, 1.0);
    vAlpha *= 1.0 - 0.9 * env * (1.0 - traveller);    // the form fades to a ghost of its outline
    float lit = step(1.0 - uKeep, fract(aSeed.x * 7.31 + aSeed.y * 3.17));
    vAlpha *= mix(1.0, lit, traveller * out_);        // only some travellers stay lit, scaled to screen area
    vAlpha *= smoothstep(0.25, 0.9, depth);
    gl_Position = projectionMatrix * mv;
    // Stars passing behind the headline and copy are dimmed so the text stays readable.
    float overCopy = smoothstep(uCopyY - 0.06, uCopyY + 0.1, gl_Position.y / gl_Position.w);
    vAlpha *= 1.0 - 0.72 * overCopy * traveller * out_;
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

// Progress → { from, to, t }. During a hold from === to and t is 0.
export function stateAt(p) {
  for (let i = 0; i < TIMELINE.length - 1; i++) {
    const a = TIMELINE[i], b = TIMELINE[i + 1];
    if (p <= b.at || i === TIMELINE.length - 2) {
      if (a.hold !== undefined) return { from: a.hold, to: a.hold, t: 0 };
      return { from: a.from, to: a.to, t: clamp((p - a.at) / (b.at - a.at)) };
    }
  }
  return { from: 0, to: 0, t: 0 };
}

// Draws the particle sequence into `canvas`, centring each formation on `stage` (an element
// inside the canvas's box). Call setProgress(0..1) from scroll; the render loop eases toward it.
export async function startParticles({ canvas, stage, reduceMotion }) {
  const lowPower = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  const count = lowPower ? 40000 : 80000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x010101, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  camera.position.set(0, 0, CAM_Z);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const rand = mulberry32(1443);
  const images = await Promise.all(SHAPES.map((s) => loadImage(s.src)));
  const sampled = images.map((img, i) => sampleShape(img, SHAPES[i], count, rand));

  const lum = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let n = 0; n < count; n++) {
    for (let k = 0; k < 3; k++) lum[n * 3 + k] = sampled[k].bright[n];
    for (let k = 0; k < 4; k++) seed[n * 4 + k] = rand();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(sampled[0].pos, 3));
  geo.setAttribute('aS1', new THREE.BufferAttribute(sampled[1].pos, 3));
  geo.setAttribute('aS2', new THREE.BufferAttribute(sampled[2].pos, 3));
  geo.setAttribute('aLum', new THREE.BufferAttribute(lum, 3));
  geo.setAttribute('aStar', new THREE.BufferAttribute(starField(count, rand), 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(directions(count, rand), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

  const uniforms = {
    uFrom: { value: 0 }, uTo: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 },
    uMotion: { value: reduceMotion ? 0.35 : 1 }, uAgitate: { value: 0 },
    uCamZ: { value: CAM_Z }, uTanHalf: { value: tanHalf }, uAspect: { value: 1 },
    uPx: { value: 1 }, uSize: { value: 0.01 }, uScale: { value: 1 },
    uCenter: { value: new THREE.Vector3() },
    uKeep: { value: 0.5 }, uMaxPx: { value: 64 }, uCopyY: { value: 1 },
    uRot: { value: new THREE.Matrix3() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);

  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, lowPower ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
    uniforms.uPx.value = (h * dpr) / (2 * tanHalf);
    uniforms.uSize.value = ((lowPower ? DOT_CSS_PX + 0.25 : DOT_CSS_PX) * 2 * tanHalf * CAM_Z) / h;

    // Centre and size the formation on the stage element, in world units at z = 0.
    const c = canvas.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const toWorld = (2 * CAM_Z * tanHalf) / h;
    uniforms.uCenter.value.set((s.left + s.width / 2 - c.left - w / 2) * toWorld, -(s.top + s.height / 2 - c.top - h / 2) * toWorld, 0);
    // A formation is 2 units tall and at most 2.7 wide before scaling.
    uniforms.uScale.value = Math.max(0.15, Math.min((FILL * s.height * toWorld) / 2, (0.8 * s.width * toWorld) / 2.7));
    uniforms.uCopyY.value = 1 - (2 * (s.top - c.top)) / h;                  // stage top in clip space
    uniforms.uKeep.value = clamp((STAR_DENSITY * w * h) / (count * 0.3), 0.08, 0.5);
    uniforms.uMaxPx.value = Math.min(64, h * 0.045) * dpr;
  }
  const ro = new ResizeObserver(layout);
  ro.observe(canvas);
  ro.observe(stage);
  layout();

  let target = 0, current = 0, primed = false;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const m4 = new THREE.Matrix4();
  const idleSpeed = reduceMotion ? 0 : (Math.PI * 2) / TURN_SECONDS;
  let idleAngle = 0, agitate = 0, last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const prev = current;
    current += (target - current) * (1 - Math.exp(-dt * 6));
    if (Math.abs(target - current) < 1e-5) current = target;

    // Turns left to right (the front face travels toward the right) a full 360° on its own;
    // scrolling adds turn on top, and takes it back when scrolling up.
    idleAngle = (idleAngle + idleSpeed * dt) % (Math.PI * 2);
    const yaw = 0.35 + idleAngle + current * Math.PI * 2 * SCROLL_TURNS;
    const pitch = 0.09 + 0.04 * Math.sin((now / 1000) * 0.3) * (reduceMotion ? 0 : 1);
    if (dt > 0) {
      const spin = (Math.abs(current - prev) * Math.PI * 2 * SCROLL_TURNS) / dt;
      agitate += (clamp(spin * 0.012, 0, 0.03) - agitate) * (1 - Math.exp(-dt * 6));
    }

    const r = canvas.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;   // hero scrolled away: nothing to draw

    const s = stateAt(current);
    euler.set(pitch, yaw, 0);
    uniforms.uRot.value.setFromMatrix4(m4.makeRotationFromEuler(euler));
    uniforms.uFrom.value = s.from;
    uniforms.uTo.value = s.to;
    uniforms.uT.value = s.t;
    uniforms.uAgitate.value = reduceMotion ? agitate * 0.3 : agitate;
    uniforms.uTime.value = now / 1000;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    setProgress(p) {
      target = clamp(p);
      if (!primed) { current = target; primed = true; }
    },
    relayout: layout,
  };
}
