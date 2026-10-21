import * as THREE from '../vendor/three.module.min.js';
import * as G from './geometry.js';
import { WORLD, sampleCamera, sampleUniform, UNIFORM_KEYS, IS_MOBILE } from './beats.js';

// Device tier (0 low, 1 mid, 2 high) drives particle budgets, DPR and frame cap.
export const TIER = (() => {
  const c = navigator.hardwareConcurrency ?? 4, m = navigator.deviceMemory;
  if (c <= 2 || (m !== undefined && m <= 2)) return 0;
  if (c <= 4 || (m !== undefined && m <= 4)) return 1;
  return 2;
})();
const DENSITY = [0.4, 0.7, 1][TIER] * (IS_MOBILE ? 0.7 : 1);
const MAX_DPR = [1, 1.5, 2][TIER];
export const FPS_CAP = [30, 45, 60][TIER];

const FOV = 34;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LOGO_CAM = { pos: [0, 0, 2.9], tgt: [0, 0, 0] };
const POINT_WORLD = 0.0034;

/* ----------------------------------------------------------------- shaders */

const COMMON = /* glsl */ `
  uniform float uTime, uProj, uDpr, uRevealY, uRevealSoft, uMaskR, uDim, uFieldIn;
  varying vec3 vColor;
  varying float vAlpha;
  vec3 h3(float s) { return fract(sin(vec3(s * 127.1, s * 311.7, s * 74.7)) * 43758.5453); }
  float reveal(float y) { return smoothstep(uRevealY - uRevealSoft, uRevealY + uRevealSoft, y); }
  float voidMask(vec3 p) { return uMaskR < 0.001 ? 1.0 : smoothstep(uMaskR, uMaskR + 0.14, length(p.xz)); }
  void emit(vec3 world, float sizeWorld, float alpha) {
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = sizeWorld * uProj / max(0.001, -mv.z);
    float a = alpha * smoothstep(0.05, 0.3, -mv.z);
    if (px < uDpr) { a *= px / uDpr; px = uDpr; }
    gl_PointSize = min(px, 9.0 * uDpr);
    vAlpha = a;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.3, 1.0, d)));
  }
`;

const LINE_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uOpacity, uUseReveal, uUseMask, uUseDim, uScaleL;
  uniform vec3 uOffset;
  void main() {
    vec3 p = position * uScaleL + uOffset;
    vColor = aColor;
    float a = aAlpha * uOpacity;
    if (uUseReveal > 0.5) a *= reveal(p.y);
    if (uUseMask > 0.5) a *= voidMask(p);
    if (uUseDim > 0.5) a *= uDim;
    vAlpha = a;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const LINE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha); }
`;

const DUST_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor, aLogo;
  attribute float aSize, aSeed;
  uniform float uMorph, uIntro;
  uniform vec3 uLogoColor;
  void main() {
    vec3 jit = h3(aSeed) - 0.5;
    vec3 logo = aLogo + jit * (1.0 - uIntro) * vec3(1.4, 1.1, 1.4);
    logo += 0.003 * vec3(sin(uTime * 0.7 + aSeed * 61.0), cos(uTime * 0.5 + aSeed * 47.0), 0.0);
    float t = clamp(uMorph * 1.6 - aSeed * 0.6, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 mid = mix(logo, position, 0.5) + (h3(aSeed + 3.1) - 0.5) * vec3(0.9, 0.5, 0.9);
    vec3 p = mix(mix(logo, mid, t), mix(mid, position, t), t);
    float tw = 0.78 + 0.22 * sin(uTime * 1.3 + aSeed * 90.0);
    float field = voidMask(p) * uDim * tw * 0.5;
    float hero = (0.55 + 0.45 * aSeed) * uIntro;
    vColor = mix(uLogoColor, aColor, t);
    emit(p, ${POINT_WORLD} * aSize * mix(1.1, 0.8, t), mix(hero, field, t));
  }
`;

const FIELD_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor;
  attribute float aSize, aSeed;
  uniform float uOpacity, uUseReveal, uUseMask, uUseDim;
  void main() {
    vec3 p = position;
    float a = uOpacity * uFieldIn * (0.8 + 0.2 * sin(uTime * 1.7 + aSeed * 70.0));
    if (uUseReveal > 0.5) a *= reveal(p.y);
    if (uUseMask > 0.5) a *= voidMask(p);
    if (uUseDim > 0.5) a *= uDim;
    vColor = aColor;
    emit(p, ${POINT_WORLD} * aSize, a);
  }
`;

const GALAXY_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor;
  attribute float aSize, aSeed;
  uniform float uTwinkle;
  void main() {
    vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 1.0 - uTwinkle * 0.5 * (1.0 + sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0));
    vColor = aColor;
    vAlpha = (0.35 + 0.5 * aSeed) * tw;
    gl_PointSize = max(uDpr, aSize * 0.9 * uDpr);
  }
`;

const MODEL_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor, aBand;
  attribute float aSize, aSeed, aWhich;
  uniform vec4 uGain;
  uniform float uMorph, uLift, uScale, uSettle, uDissolve, uLand, uModelY;
  uniform vec3 uRingColor;
  void main() {
    float g = aWhich < 0.5 ? uGain.x : aWhich < 1.5 ? uGain.y : aWhich < 2.5 ? uGain.z : uGain.w;
    float gain = mix(0.35, 0.8, min(g, 1.0)) + max(g - 1.0, 0.0) * 0.25;
    vec3 p0 = position + (h3(aSeed + 7.0) - 0.5) * 0.014 * uDissolve * sin(uTime * 1.7 + aSeed * 30.0);
    float S = uScale / 0.92;
    float a = aBand.x + uTime * (0.03 + 0.07 * uSettle);
    float b = aBand.y;
    float R = 0.312 * S, tube = 0.12 * S * aBand.z;
    float tr = tube * mix(1.0, 0.55, uSettle);
    float baseY = uModelY - 0.16 * (1.0 - uSettle);
    vec3 p1 = vec3(cos(a) * (R + cos(b) * tr), baseY + uLift + sin(b) * tube * mix(1.0, 0.35, uSettle), sin(a) * (R + cos(b) * tr));
    float t = clamp(uMorph * 1.5 - aSeed * 0.5, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float arc = sin(3.14159 * t);
    vec3 p = mix(p0, p1, t) + (h3(aSeed + 1.7) - 0.5) * 0.32 * arc;
    vColor = mix(aColor, uRingColor, t * 0.45);
    float a2 = mix(reveal(p.y) * gain, 0.5 - 0.06 * uSettle, t);
    emit(p, ${POINT_WORLD} * aSize, a2);
  }
`;

const INFLOW_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor, aP1, aP2, aP3;
  attribute float aSize, aSeed;
  uniform float uOpacity;
  void main() {
    float t = fract(aSeed * 7.31 + uTime * (0.05 + 0.07 * aSeed));
    float u = 1.0 - t;
    vec3 p = u * u * u * position + 3.0 * u * u * t * aP1 + 3.0 * u * t * t * aP2 + t * t * t * aP3;
    vColor = aColor;
    emit(p, ${POINT_WORLD} * aSize, uOpacity * reveal(p.y) * sin(3.14159 * t));
  }
`;

const CORE_VERT = /* glsl */ `
  ${COMMON}
  attribute vec3 aColor;
  attribute float aSize, aSeed;
  uniform float uOpacity, uScaleC, uIgnite;
  uniform vec3 uOffset;
  void main() {
    float pulse = 1.0 + 0.04 * sin(uTime * 2.0 + aSeed * 6.0) * uIgnite;
    vec3 p = position * uScaleC * pulse + uOffset;
    vColor = mix(aColor, vec3(1.0), uIgnite * 0.4);
    emit(p, ${POINT_WORLD} * aSize, uOpacity * (0.32 + 0.22 * uIgnite));
  }
`;

const GLOW_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * exp(-d * d * 5.0));
  }
`;
const GLOW_VERT = /* glsl */ `
  ${COMMON}
  uniform float uOpacity, uSize;
  uniform vec3 uOffset;
  void main() {
    vec4 mv = viewMatrix * vec4(uOffset, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uProj / max(0.001, -mv.z);
    vColor = vec3(0.75, 0.88, 1.0);
    vAlpha = uOpacity;
  }
`;

/* ------------------------------------------------------------------- scene */

function pointsGeometry(buf, extra = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(buf.position, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(buf.color, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(buf.size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(buf.seed, 1));
  for (const [k, [arr, n]] of Object.entries(extra)) g.setAttribute(k, new THREE.BufferAttribute(arr, n));
  g.computeBoundingSphere();
  return g;
}

function linesGeometry(l) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(l.position, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(l.color, 3));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(l.alpha, 1));
  g.computeBoundingSphere();
  return g;
}

export function createScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: TIER === 0 ? 'low-power' : 'high-performance' });
  } catch (err) {
    return null;
  }
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
  camera.position.fromArray(LOGO_CAM.pos);

  const common = {
    uTime: { value: 0 },
    uProj: { value: 1000 },
    uDpr: { value: 1 },
    uRevealY: { value: -0.15 },
    uRevealSoft: { value: 0.25 },
    uMaskR: { value: 0 },
    uDim: { value: 1 },
    uFieldIn: { value: 0 },
  };

  const mat = (vert, frag, uniforms = {}) => new THREE.ShaderMaterial({
    uniforms: { ...common, ...uniforms },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const flags = (o = {}) => ({
    uOpacity: { value: o.opacity ?? 1 },
    uUseReveal: { value: o.reveal ? 1 : 0 },
    uUseMask: { value: o.mask ? 1 : 0 },
    uUseDim: { value: o.dim ? 1 : 0 },
  });
  const lineObj = (data, o, extra = {}) => {
    const m = mat(LINE_VERT, LINE_FRAG, { ...flags(o), uScaleL: { value: 1 }, uOffset: { value: new THREE.Vector3() }, ...extra });
    const obj = new THREE.LineSegments(linesGeometry(data), m);
    obj.frustumCulled = false;
    scene.add(obj);
    return obj;
  };
  const pointObj = (geo, m) => {
    const obj = new THREE.Points(geo, m);
    obj.frustumCulled = false;
    scene.add(obj);
    return obj;
  };

  // starfield
  const gal = G.galaxy(Math.round(9000 * DENSITY));
  const galaxy = pointObj(pointsGeometry(gal), mat(GALAXY_VERT, POINT_FRAG, { uTwinkle: { value: 0.55 } }));

  // under-canopy field
  const sig = G.signals(Math.round(360 * DENSITY), 42);
  const signals = pointObj(pointsGeometry(sig), mat(FIELD_VERT, POINT_FRAG, flags({ opacity: 0.7, reveal: true, dim: true })));

  const fun = G.funnel(Math.round(120 * Math.max(0.6, DENSITY)), G.MODELS);
  const funnel = lineObj(fun.lines, { opacity: 0.5, reveal: true, dim: true });
  const inf = G.inflow(fun.curves, Math.round(18 * DENSITY) + 4);
  const inflow = pointObj(
    pointsGeometry(inf, { aP1: [inf.ctrl[1], 3], aP2: [inf.ctrl[2], 3], aP3: [inf.ctrl[3], 3] }),
    mat(INFLOW_VERT, POINT_FRAG, { uOpacity: { value: 0 } }),
  );

  // canopy
  const rg = lineObj(G.rings(), { opacity: 0.6, mask: true, dim: true });
  const sp = lineObj(G.spokes(), { opacity: 0 });
  const ch = G.chips(Math.round(110 * Math.max(0.6, DENSITY)));
  const chipLines = lineObj(ch.lines, { opacity: 0.65, mask: true, dim: true });
  const chipPts = pointObj(pointsGeometry(ch.points), mat(FIELD_VERT, POINT_FRAG, flags({ opacity: 0.9, mask: true, dim: true })));
  const st = G.stations();
  const stationLines = lineObj(st.lines, { opacity: 0.75, dim: true });
  const stationPts = pointObj(pointsGeometry(st.points), mat(FIELD_VERT, POINT_FRAG, flags({ opacity: 0.6, dim: true })));

  // hero mark → canopy dust
  const du = G.dust(Math.round(46000 * DENSITY));
  const dust = pointObj(
    pointsGeometry(du, { aLogo: [du.logo, 3] }),
    mat(DUST_VERT, POINT_FRAG, { uMorph: { value: 0 }, uIntro: { value: 0 }, uLogoColor: { value: new THREE.Vector3(...G.PALETTE.logo) } }),
  );

  // isolated models → merged ring
  const mp = G.modelPoints(Math.round(5200 * DENSITY));
  const models = pointObj(
    pointsGeometry(mp, { aBand: [mp.band, 3], aWhich: [mp.which, 1] }),
    mat(MODEL_VERT, POINT_FRAG, {
      uGain: { value: new THREE.Vector4(1, 1, 1, 1) },
      uMorph: { value: 0 }, uLift: { value: 0 }, uScale: { value: 0.92 }, uSettle: { value: 0 },
      uDissolve: { value: 0 }, uLand: { value: 0 }, uModelY: { value: WORLD.modelY },
      uRingColor: { value: new THREE.Vector3(0.62, 0.8, 1.0) },
    }),
  );
  const modelWires = lineObj(G.modelWires(), { opacity: 0, reveal: true });

  // core
  const corePts = pointObj(pointsGeometry(G.corePoints(Math.round(1100 * DENSITY))), mat(CORE_VERT, POINT_FRAG, {
    uOpacity: { value: 0 }, uScaleC: { value: 1 }, uIgnite: { value: 0 }, uOffset: { value: new THREE.Vector3(0, WORLD.ringY, 0) },
  }));
  const coreWire = lineObj(G.coreWires(), { opacity: 0 }, {});
  coreWire.material.uniforms.uOffset.value.set(0, WORLD.ringY, 0);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const glow = pointObj(glowGeo, mat(GLOW_VERT, GLOW_FRAG, { uOpacity: { value: 0 }, uSize: { value: 0.22 }, uOffset: { value: new THREE.Vector3(0, WORLD.ringY, 0) } }));

  void stationPts; void chipPts; void galaxy;

  /* -------------------------------------------------------------- per frame */

  const U = {};
  const camPos = [0, 0, 0], camTgt = [0, 0, 0], fromPos = [0, 0, 0], fromTgt = [0, 0, 0];
  const tgtV = new THREE.Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const lerpA = (a, b, t, out) => { for (let k = 0; k < 3; k++) out[k] = a[k] + (b[k] - a[k]) * t; return out; };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // portrait screens get a wider lens so the canopy and ring still fit the width
    const widen = 1 + 0.35 * Math.min(1, Math.max(0, (1 - camera.aspect) / 0.54));
    camera.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) * widen) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    common.uDpr.value = dpr;
    common.uProj.value = (h * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }

  /**
   * state: { time, dt, intro (0..1), morph (0..1), progress (0..1 beat-space), phase, reducedMotion }
   */
  function update(state) {
    const { progress, morph, intro } = state;
    common.uTime.value = state.reducedMotion ? 0 : state.time;
    for (const k of UNIFORM_KEYS) U[k] = sampleUniform(k, progress);

    // camera
    sampleCamera(progress, camPos, camTgt);
    if (state.phase !== 'revealed') {
      const e = easeInOutCubic(morph);
      lerpA(LOGO_CAM.pos, camPos, e, fromPos);
      lerpA(LOGO_CAM.tgt, camTgt, e, fromTgt);
      camPos.splice(0, 3, ...fromPos);
      camTgt.splice(0, 3, ...fromTgt);
    }
    const k = 1 - Math.exp(-3 * (state.dt || 0.016));
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;
    const par = state.reducedMotion ? 0 : state.phase === 'landing' ? 0.06 : 0.012;
    camera.position.set(camPos[0] + pointer.sx * par, camPos[1] + pointer.sy * par * 0.6, camPos[2]);
    camera.lookAt(tgtV.set(camTgt[0], camTgt[1], camTgt[2]));

    // global field
    const fieldIn = state.phase === 'revealed' ? 1 : Math.min(1, Math.max(0, (morph - 0.4) / 0.6));
    common.uFieldIn.value = fieldIn;
    common.uRevealY.value = U.revealY;
    common.uMaskR.value = U.maskR;
    common.uDim.value = U.dim;

    dust.material.uniforms.uMorph.value = state.phase === 'revealed' ? 1 : morph;
    dust.material.uniforms.uIntro.value = intro;

    const mu = models.material.uniforms;
    mu.uGain.value.set(U.mdl1, U.mdl2, U.mdl3, U.mdl4);
    mu.uMorph.value = U.mdlMorph;
    mu.uLift.value = U.ringLift;
    mu.uScale.value = U.mgscale;
    mu.uSettle.value = U.settle;
    mu.uDissolve.value = U.mdlDissolve * (1 - U.mdlMorph);
    mu.uLand.value = U.mdlLand;
    models.visible = fieldIn > 0.001;

    // the signal volume belongs to the 'signals'/iso beats and clears before 'whatIf'
    signals.material.uniforms.uOpacity.value = 0.95 * (1 - smoothstep(-1.55, -1.35, U.revealY));
    modelWires.material.uniforms.uOpacity.value = 0.55 * U.revWires * fieldIn;
    funnel.material.uniforms.uOpacity.value = (0.32 + 0.3 * U.revInflow) * fieldIn;
    inflow.material.uniforms.uOpacity.value = 0.55 * U.revInflow * fieldIn;
    sp.material.uniforms.uOpacity.value = (0.12 * U.revMerge + 0.5 * U.cfIgnite) * fieldIn;
    rg.material.uniforms.uOpacity.value = 0.85 * fieldIn;
    chipLines.material.uniforms.uOpacity.value = 0.8 * fieldIn;
    stationLines.material.uniforms.uOpacity.value = 0.95 * fieldIn;

    const cu = corePts.material.uniforms;
    cu.uOpacity.value = U.cfReveal * fieldIn;
    cu.uScaleC.value = U.cfScale;
    cu.uIgnite.value = U.cfIgnite;
    coreWire.material.uniforms.uOpacity.value = 0.5 * U.cfReveal * fieldIn;
    coreWire.material.uniforms.uScaleL.value = U.cfScale;
    glow.material.uniforms.uOpacity.value = 0.08 * U.cfIgnite * fieldIn;

    galaxy.rotation.y = state.reducedMotion ? 0 : state.time * 0.006;
    galaxy.material.uniforms.uTwinkle.value = state.reducedMotion ? 0 : 0.55;

    renderer.render(scene, camera);
  }

  const v = new THREE.Vector3();
  /** Project a world point to CSS pixels; `visible` is false when behind the camera. */
  function project(p) {
    v.set(p[0], p[1], p[2]).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, visible: v.z < 1 && v.z > -1 };
  }

  function setPointer(nx, ny) { pointer.x = nx; pointer.y = ny; }

  resize();
  return {
    renderer,
    resize,
    update,
    project,
    setPointer,
    uniforms: U,
    anchors: {
      stations: G.STATION_NODES.slice(0, 5).map((n, i) => [n[0], st.tops[i] + 0.02, n[2]]),
      models: G.MODELS.map((m) => [m.pos[0], m.pos[1] + 0.13, m.pos[2]]),
    },
  };
}
