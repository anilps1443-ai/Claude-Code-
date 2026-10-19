# Razorpay Vulcan — foundation-model page recreation

A standalone recreation of <https://razorpay.com/foundation-model/>. It lives in its own folder and leaves the existing `index.html` at the repo root untouched.

## Run

It's a static site with ES modules and no build step. Serve the folder over HTTP, because modules don't load from `file://`:

```sh
npx http-server razorpay-vulcan -p 8765 -c-1
# open http://localhost:8765/
```

Three.js r160 and Lenis 1.1.20 are vendored in `vendor/` (MIT, licences included). Only the Google Fonts stylesheet (Instrument Serif and Inter Tight, the same fonts the reference uses) and the Typeform embed load from the network.

## Structure

| File | Role |
| --- | --- |
| `index.html` | Chrome: header, hero, enter button and cursor pill, modal, plus a readable version of all copy |
| `css/styles.css` | Tokens and layout taken from the reference's computed styles, with mobile overrides at ≤767px |
| `js/beats.js` | The storyline: 14 beats, camera keyframes, per-beat scene uniforms, hold/travel pacing, Catmull-Rom camera path |
| `js/scene.js` | WebGL scene: custom point and line shaders, morphs, reveal and dim, labels projection |
| `js/geometry.js` | Seeded procedural geometry: starfield, brand mark, canopy, chips, stations, funnel, models, core |
| `js/main.js` | Phases (loading → landing → morphing → revealed), Lenis, scroll→progress, captions, stat cards, labels, modal, fallbacks |

## What was matched from the reference

- **Pacing:** each beat holds for 45vh (the scene "pins") and then travels for 85vh. The `whatIf` and orbit beats travel for 28vh, and the orbits don't hold. That totals the reference's `1474lvh` scroll track, eased with smoothstep, so reverse scrolling scrubs back exactly.
- **Intro:** the brand mark is drawn in particles and assembles on load. The headline arrives after 1250ms with a 900ms ease. A "Click to enter" pill follows the cursor (it's pinned at the bottom on touch). Clicking, using the wheel or touch, or pressing Space/PageDown/↓/End triggers a 1.9s ease-in-out-cubic morph of the mark into the canopy while the camera flies to the top view.
- **Captions:** fade windows and the 22px rise come from the reference's own formulas. Eyebrows only re-announce when they change. Caption alignments are centre, right, narrative and introduce, each with its own measured clamp sizes.
- **Scene beats:** canopy tunnel, then the signal volume, then four isolated models (with labels), "what if", the models dissolving into a band, an orbit rise, and the ring seated around the core. After that the core ignites, then the compounding beat, then the proof cards, the scale shot, and the sign-off with a CTA.
- **Stat cards:** cards fly in from 125vw with a 0.12 stagger, scale to 1.12 on hover, and become a 74vw-step carousel on mobile.
- **CTA:** "Get Started" opens the Typeform in a blurred modal. Escape, the ✕ button and a backdrop click close it, focus is trapped and then restored, and scrolling pauses while it's open. A modifier-click opens the link normally.

## Deliberate differences and limitations

- **Geometry is procedural.** The reference streams proprietary assets (`field.bin`, `core-field.bin`, `models_draco.glb`). Those weren't reused, so the canopy, stations, models and ring are rebuilt from seeded procedural geometry. Shapes and silhouettes are close but not vertex-identical.
- **Icons and wordmark are redrawn.** The stat icons are new line icons, and the header wordmark is the mark plus set type rather than the reference's SVG file. The Razorpay name, mark and copy are Razorpay trademarks and content. Before publishing this anywhere other than as an internal study, swap `MARK` in `js/geometry.js`, the header logo and the copy in `js/beats.js`.
- **Comparison was done in software WebGL** (headless Chromium with SwiftShader) at 1440×900 and 390×844. Exact frame-time behaviour, GPU-specific blending and real-device touch feel were not measured.
- **Portrait lens is a measured approximation.** In portrait the camera lens widens by up to 1.35× so the ring fits, matching the reference's mobile framing.

## Accessibility and fallbacks

- `prefers-reduced-motion` skips the morph, disables smooth scrolling, twinkle and parallax, and reveals the content immediately.
- Without WebGL (or after a lost context) the page switches to the readable document version. With JS disabled, `<noscript>` shows that version.
- The header, the enter button, the sign-off CTA and the modal are all keyboard reachable with visible focus.
- `#overview`, `#complexity`, `#vulcan` and `#results` deep-link to their beats.
