// The particle field: one WebGL point cloud that stays behind the whole page
// and rebuilds itself into each chapter of the story. Every particle carries a
// position for every shape; the shader morphs between two of them with a
// per-particle stagger and a turbulent drift, so nothing ever cuts.
import * as THREE from "../vendor/three.module.min.js";
import * as CLOUDS from "../assets/shapes.js";

export const SHAPES = ["sphere", "car", "rupee", "database", "xchange", "shield", "rings", "silos", "stream", "wordmark"];
const INDEX = Object.fromEntries(SHAPES.map((name, i) => [name, i]));
const MORPH_SECONDS = 1.6;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1443);
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- shape generators: each fills out[i*3..] for N particles ---------- */

function sphere(out, n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const inner = rnd() < 0.22;
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    const R = inner ? 1.25 * Math.cbrt(rnd()) : 1.25 * (0.94 + rnd() * 0.12);
    out[i * 3] = Math.cos(th) * r * R;
    out[i * 3 + 1] = y * R;
    out[i * 3 + 2] = Math.sin(th) * r * R;
  }
}

// An EV, nose toward +x, wheels on y = 0. Side panels, roof and glass are
// sampled as surfaces; the beltline, glasshouse edges and wheels are denser.
function carRoof(x) {
  const k = [[-1.62, 0.6], [-1.38, 0.8], [-0.95, 1.03], [-0.15, 1.06], [0.5, 0.66], [1.2, 0.6], [1.62, 0.44]];
  for (let i = 0; i < k.length - 1; i++) {
    if (x <= k[i + 1][0]) {
      const t = (x - k[i][0]) / (k[i + 1][0] - k[i][0]);
      return lerp(k[i][1], k[i + 1][1], (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, t)))) / 2);
    }
  }
  return 0.44;
}
const BELT = 0.66, FLOOR = 0.2;
const halfWidth = (x, y) => {
  const body = 0.7 * (1 - 0.32 * Math.pow(Math.abs(x) / 1.62, 4));
  return y > BELT ? body * lerp(1, 0.74, Math.min(1, (y - BELT) / 0.4)) : body;
};
function car(out, n) {
  const wheels = [[1.02, 0.7], [1.02, -0.7], [-1.04, 0.7], [-1.04, -0.7]];
  const side = () => (rnd() < 0.5 ? -1 : 1);
  const archOpen = (x, y) => wheels.some(([wx]) => Math.hypot(x - wx, y - 0.32) < 0.4);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    let x, y, z;
    if (r < 0.26) { // side panels and glass, kept clear of the wheel arches
      do { x = lerp(-1.6, 1.6, rnd()); y = lerp(FLOOR, carRoof(x), rnd()); } while (archOpen(x, y));
      z = side() * halfWidth(x, y);
    } else if (r < 0.36) { // roof, bonnet and boot
      x = lerp(-1.6, 1.6, rnd()); y = carRoof(x); z = lerp(-1, 1, rnd()) * halfWidth(x, y);
    } else if (r < 0.62) { // the silhouette: roofline, sill, beltline and the window frame
      x = lerp(-1.6, 1.6, rnd());
      const line = Math.floor(rnd() * 4);
      if (line === 0) y = carRoof(x);
      else if (line === 1) { y = FLOOR; if (archOpen(x, y + 0.05)) { const [wx] = wheels.find(([w]) => Math.abs(x - w) < 0.42); const a = Math.acos(Math.max(-1, Math.min(1, (x - wx) / 0.4))); y = 0.32 + 0.4 * Math.sin(a); } }
      else if (line === 2) y = BELT;
      else { x = lerp(-1.3, 0.48, rnd()); y = BELT + (carRoof(x) - BELT) * (rnd() < 0.5 ? 0 : 0.92); if (Math.abs(x + 0.42) < 0.03) y = lerp(BELT, carRoof(x), rnd()); }
      z = side() * halfWidth(x, y) * 1.005;
    } else if (r < 0.7) { // light bars and the nose and tail profiles
      const front = rnd() < 0.5;
      if (rnd() < 0.55) { x = front ? 1.6 : -1.6; y = front ? 0.5 : 0.64; z = lerp(-0.62, 0.62, rnd()); }
      else { x = front ? 1.62 : -1.62; y = lerp(FLOOR, front ? 0.44 : 0.6, rnd()); z = side() * lerp(0.2, 0.55, rnd()); }
    } else if (r < 0.96) { // wheels: tyre torus and spokes
      const [wx, wz] = wheels[Math.floor(rnd() * 4)];
      const th = rnd() * Math.PI * 2;
      if (rnd() < 0.72) {
        const ph = rnd() * Math.PI * 2, R = 0.29 + 0.06 * Math.cos(ph);
        x = wx + R * Math.cos(th); y = 0.32 + R * Math.sin(th); z = wz + 0.07 * Math.sin(ph) * Math.sign(wz);
      } else {
        const spoke = Math.floor(rnd() * 5) * (Math.PI * 2 / 5), rr = rnd() * 0.24;
        x = wx + rr * Math.cos(spoke); y = 0.32 + rr * Math.sin(spoke); z = wz * 1.04;
      }
    } else { // a faint scan ring on the ground: the car as a data source
      const th = rnd() * Math.PI * 2, R = 1.95 + gauss() * 0.02;
      x = Math.cos(th) * R; y = 0; z = Math.sin(th) * R * 0.62;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y - 0.55;
    out[i * 3 + 2] = z;
  }
}

function fromCloud(out, n, cloud, size) {
  const m = cloud.length / 3;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(rnd() * m) * 3;
    const b = cloud[j + 2] / 10000;
    out[i * 3] = (cloud[j] / 10000) * size + gauss() * 0.006;
    out[i * 3 + 1] = (cloud[j + 1] / 10000) * size + gauss() * 0.006;
    out[i * 3 + 2] = (rnd() - 0.5) * 0.26 + (b - 0.6) * 0.2;
  }
}

function rotate([x, y, z], ax, ay) {
  const cy = Math.cos(ax), sy = Math.sin(ax);
  [y, z] = [y * cy - z * sy, y * sy + z * cy];
  const cx = Math.cos(ay), sx = Math.sin(ay);
  return [x * cx + z * sx, y, -x * sx + z * cx];
}

// three interlocking rings: financing, intelligence and resale as one layer
function rings(out, n) {
  const tilt = [[1.2, 0], [1.2, (Math.PI * 2) / 3], [1.2, (Math.PI * 4) / 3]];
  for (let i = 0; i < n; i++) {
    const k = i % 3, th = rnd() * Math.PI * 2;
    const R = 1.05 + gauss() * 0.025;
    let p = [Math.cos(th) * R, Math.sin(th) * R, gauss() * 0.025];
    p = rotate(p, tilt[k][0], tilt[k][1]);
    const off = rotate([0.42, 0, 0], 0, tilt[k][1]);
    out[i * 3] = p[0] + off[0];
    out[i * 3 + 1] = p[1] * 0.92;
    out[i * 3 + 2] = p[2] + off[2];
  }
}

// three closed boxes and the walls between them: decisions made in silos
function silos(out, n) {
  const xs = [-1.75, 0, 1.75], W = 0.42, H = 0.85;
  for (let i = 0; i < n; i++) {
    const r = rnd();
    let x, y, z;
    if (r < 0.86) {
      const cx = xs[Math.floor(rnd() * 3)];
      const onEdge = rnd() < 0.45;
      const u = lerp(-1, 1, rnd()), v = lerp(-1, 1, rnd());
      const face = Math.floor(rnd() * 6);
      let p;
      if (onEdge) {
        const e = Math.floor(rnd() * 12), s = [Math.sign(u) || 1, Math.sign(v) || 1];
        p = e < 4 ? [u, s[0], s[1]] : e < 8 ? [s[0], u, s[1]] : [s[0], s[1], u];
      } else {
        p = [[1, u, v], [-1, u, v], [u, 1, v], [u, -1, v], [u, v, 1], [u, v, -1]][face];
      }
      x = cx + p[0] * W; y = p[1] * H; z = p[2] * W;
    } else { // dashed walls between the silos
      const wall = rnd() < 0.5 ? -0.875 : 0.875;
      let yy = lerp(-1.25, 1.25, rnd());
      if (Math.floor((yy + 2) / 0.12) % 2) yy += 0.06;
      x = wall; y = yy; z = lerp(-0.7, 0.7, rnd()) * 0.15;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
}

// the stream is parametric: the shader animates it from (u, y offset, z offset)
function stream(out, n) {
  for (let i = 0; i < n; i++) {
    out[i * 3] = lerp(-3.4, 3.4, rnd());
    const strand = Math.floor(rnd() * 5) - 2;
    out[i * 3 + 1] = strand * 0.09 + gauss() * 0.05;
    out[i * 3 + 2] = gauss() * 0.12;
  }
}

function wordmark(out, n, text, font) {
  const c = document.createElement("canvas");
  const W = 1200, H = 300;
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.font = `700 220px ${font}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = "18px";
  g.fillText(text, W / 2, H / 2 + 8);
  const data = g.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
  if (!pts.length) return sphere(out, n);
  const m = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(rnd() * m) * 2;
    out[i * 3] = ((pts[j] - W / 2) / W) * 5.2 + gauss() * 0.004;
    out[i * 3 + 1] = (-(pts[j + 1] - H / 2) / W) * 5.2 + gauss() * 0.004;
    out[i * 3 + 2] = (rnd() - 0.5) * 0.2;
  }
}

/* ---------- shaders ---------- */

const pick = SHAPES.map((_, i) => `${i ? "else " : ""}if (i < ${i}.5) return ${i === INDEX.stream ? "streamAt(s" + i + ")" : "s" + i};`).join("\n    ");

const VERT = /* glsl */ `
  ${SHAPES.map((_, i) => `attribute vec3 s${i};`).join("\n  ")}
  attribute vec4 aRand;
  attribute vec3 aColor;
  uniform float uA, uB, uMix, uTime, uSize, uPixel, uOpacity, uWarp, uAspect, uMouseOn;
  uniform vec2 uMouse;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 streamAt(vec3 s) {
    float u = mod(s.x + uTime * 0.45 + 3.4, 6.8) - 3.4;
    float y = sin(u * 1.05 + uTime * 0.5) * 0.42 + sin(u * 2.3 - uTime * 0.3) * 0.12 + s.y;
    float z = cos(u * 0.8 + uTime * 0.35) * 0.3 + s.z;
    return vec3(u, y, z);
  }
  vec3 shapeAt(float i) {
    ${pick}
    return s0;
  }

  void main() {
    float d = aRand.x * 0.42;
    float m = smoothstep(d, d + 0.58, uMix);
    vec3 a = shapeAt(uA);
    vec3 b = shapeAt(uB);
    vec3 p = mix(a, b, m);

    // the journey between shapes: a burst outwards and a curl, zero at both ends
    float turb = sin(m * 3.14159);
    vec3 swirl = vec3(
      sin(aRand.y * 31.0 + uTime * 1.3 + p.y * 2.1),
      cos(aRand.z * 27.0 + uTime * 1.1 + p.x * 1.7),
      sin(aRand.w * 23.0 + uTime * 0.9 + p.z * 1.9));
    p += swirl * 0.42 * turb + normalize(p + 0.0001) * turb * 0.55 * aRand.y;

    // breathing at rest, and a stretch with scroll speed
    p += vec3(sin(uTime * 0.7 + aRand.y * 6.28), cos(uTime * 0.6 + aRand.z * 6.28), sin(uTime * 0.5 + aRand.w * 6.28)) * 0.012 * (1.0 + aRand.x * 2.0);
    p.y += (aRand.y - 0.5) * uWarp * 0.9;

    // dust: a few particles never take a shape and drift through the space
    float dust = step(0.935, aRand.w);
    vec3 drift = vec3((aRand.x - 0.5) * 10.0 + sin(uTime * 0.05 + aRand.z * 9.0) * 0.6,
                      (aRand.y - 0.5) * 6.5 + cos(uTime * 0.04 + aRand.x * 9.0) * 0.4,
                      (aRand.z - 0.5) * 5.0 - 1.0);
    p = mix(p, drift, dust);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / clip.w;
    vec2 dd = (ndc - uMouse) * vec2(uAspect, 1.0);
    float near = uMouseOn * smoothstep(0.32, 0.0, length(dd)) * (1.0 - dust);
    mv.xy += normalize(dd + 1e-5) * near * 0.32 * (0.6 + aRand.x);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.72 + 0.28 * sin(uTime * (1.2 + aRand.z * 2.0) + aRand.x * 40.0);
    gl_PointSize = uSize * uPixel * (0.55 + aRand.y * 0.9) * (10.0 / -mv.z) * (1.0 + near * 0.8);
    vAlpha = uOpacity * (0.5 + 0.5 * aRand.z) * twinkle * mix(1.0, 0.35, dust) * (1.0 + near);
    vColor = mix(aColor, vec3(1.0), near * 0.6);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * 0.85 + smoothstep(0.18, 0.0, d) * 0.6;
    gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
  }
`;

/* ---------- the field ---------- */

function decodeCloud(b64) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export async function createField(canvas, { count = 36000, reduced = false, font = "Archivo, sans-serif" } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const N = count;
  const geo = new THREE.BufferGeometry();
  const clouds = ["database", "rupee", "xchange", "shield"].map((n) => decodeCloud(CLOUDS[n]));
  const [cDb, cRupee, cX, cShield] = clouds;
  const buffers = SHAPES.map(() => new Float32Array(N * 3));
  sphere(buffers[INDEX.sphere], N);
  car(buffers[INDEX.car], N);
  fromCloud(buffers[INDEX.rupee], N, cRupee, 1.45);
  fromCloud(buffers[INDEX.database], N, cDb, 1.4);
  fromCloud(buffers[INDEX.xchange], N, cX, 1.75);
  fromCloud(buffers[INDEX.shield], N, cShield, 1.45);
  rings(buffers[INDEX.rings], N);
  silos(buffers[INDEX.silos], N);
  stream(buffers[INDEX.stream], N);
  sphere(buffers[INDEX.wordmark], N);
  SHAPES.forEach((_, i) => geo.setAttribute(`s${i}`, new THREE.BufferAttribute(buffers[i], 3)));
  // position is required by three; s0 doubles as it, and bounds are effectively infinite
  geo.setAttribute("position", geo.getAttribute("s0"));

  const rand = new Float32Array(N * 4), color = new Float32Array(N * 3);
  const palette = [[0.96, 0.97, 0.98], [0.2, 0.78, 0.35], [0.2, 0.62, 0.32], [0.0, 0.53, 1.0]];
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 4; k++) rand[i * 4 + k] = rnd();
    const r = rnd();
    const c = r < 0.76 ? palette[0] : r < 0.86 ? palette[1] : r < 0.91 ? palette[2] : palette[3];
    color.set(c, i * 3);
  }
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

  const uniforms = {
    uA: { value: 0 }, uB: { value: 0 }, uMix: { value: 1 }, uTime: { value: 0 },
    uSize: { value: 4.4 }, uPixel: { value: dpr }, uOpacity: { value: 0 }, uWarp: { value: 0 },
    uAspect: { value: 1 }, uMouse: { value: new THREE.Vector2(9, 9) }, uMouseOn: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // the wordmark is sampled once the brand font has loaded
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    wordmark(buffers[INDEX.wordmark], N, "TAPFIN", font);
    geo.getAttribute(`s${INDEX.wordmark}`).needsUpdate = true;
  });

  /* state, all damped toward targets each frame */
  let queued = null;
  const target = { x: 0, y: 0, scale: 1, opacity: 0.9, spin: 0.25, tilt: 0.18 };
  const now = { x: 0, y: 0, scale: 0.6, opacity: 0, rotY: 0, tilt: 0.18, px: 0, py: 0 };
  const pointer = { x: 0, y: 0, on: 0, onT: 0 };
  let warp = 0, warpT = 0, halfW = 1, halfH = 1, running = true, last = performance.now(), time = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
    halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfW = halfH * camera.aspect;
  }
  resize();
  window.addEventListener("resize", resize);

  function setScene(s) {
    const idx = INDEX[s.shape];
    Object.assign(target, { x: s.x ?? 0, y: s.y ?? 0, scale: s.scale ?? 1, opacity: s.opacity ?? 0.9, spin: s.spin ?? 0, tilt: s.tilt ?? 0.12 });
    if (idx === undefined) return;
    if (reduced) { uniforms.uA.value = uniforms.uB.value = idx; uniforms.uMix.value = 1; return; }
    queued = idx === uniforms.uB.value && uniforms.uMix.value >= 1 ? null : idx;
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 1 / 20);
    last = t;
    time += reduced ? 0 : dt;
    uniforms.uTime.value = time;

    // morph: finish the current journey, then take the next queued shape
    if (uniforms.uMix.value < 1) uniforms.uMix.value = Math.min(1, uniforms.uMix.value + dt / MORPH_SECONDS);
    else if (queued !== null) {
      if (queued !== uniforms.uB.value) { uniforms.uA.value = uniforms.uB.value; uniforms.uB.value = queued; uniforms.uMix.value = 0; }
      queued = null;
    }

    const k = 1 - Math.exp(-dt * 2.6);
    const narrow = camera.aspect < 0.9;
    now.x = lerp(now.x, target.x * halfW, k);
    now.y = lerp(now.y, target.y * halfH, k);
    const fitScale = narrow ? Math.max(0.5, camera.aspect * 1.05) : Math.min(1.15, camera.aspect / 1.6 + 0.2);
    now.scale = lerp(now.scale, target.scale * fitScale, k);
    now.opacity = lerp(now.opacity, target.opacity, k);
    now.tilt = lerp(now.tilt, target.tilt, k);
    if (target.spin && !reduced) now.rotY += target.spin * dt;
    else {
      const home = Math.round(now.rotY / (Math.PI * 2)) * Math.PI * 2 + (reduced ? 0 : Math.sin(time * 0.35) * 0.22);
      now.rotY = lerp(now.rotY, home, k);
    }
    pointer.on = lerp(pointer.on, pointer.onT, 1 - Math.exp(-dt * 4));
    now.px = lerp(now.px, pointer.x, 1 - Math.exp(-dt * 2));
    now.py = lerp(now.py, pointer.y, 1 - Math.exp(-dt * 2));
    warp = lerp(warp, warpT, 1 - Math.exp(-dt * 6));
    warpT *= Math.exp(-dt * 3);

    group.position.set(now.x, now.y, 0);
    group.scale.setScalar(now.scale);
    group.rotation.set(now.tilt - now.py * 0.12, now.rotY + now.px * 0.25, 0);
    uniforms.uOpacity.value = now.opacity;
    uniforms.uWarp.value = warp;
    uniforms.uMouse.value.set(pointer.x, pointer.y);
    uniforms.uMouseOn.value = pointer.on;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setScene,
    setPointer(nx, ny, on = true) { pointer.x = nx; pointer.y = ny; pointer.onT = on ? 1 : 0; },
    angle() { return (((now.rotY * 180) / Math.PI) % 360 + 360) % 360; },
    setVelocity(v) { warpT = Math.max(-1, Math.min(1, v)); },
    pause() { running = false; },
    resume() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } },
    resize,
  };
}
