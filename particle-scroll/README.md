# Particle Scroll

A scroll-driven 3D particle animation on a black stage. Three forms (₹ rupee, brain, EV battery swap) are each built from 70,000 white points (36,000 on small screens). As you scroll, each form turns on its vertical axis from front-on to a thin edge-on profile and on to an angled view from the other side. It then breaks into a deep starfield, with a few points drifting past the lens as soft bokeh, and the next form gathers out of that field.

## Run

ES modules need HTTP, and the shape images are read through a canvas, which `file://` blocks:

```sh
npx http-server particle-scroll -p 8777 -c-1
# open http://localhost:8777/
```

Three.js r160 is vendored in `vendor/` (MIT, licence included). Nothing loads from the network.

## How it works

- **Shapes** (`shapes/*.jpg`): the source illustrations, kept bright-on-black. `sampleShape` in `js/main.js` places points in proportion to pixel brightness, so dense and glowing areas stay dense and glowing. It then gives the points depth: `slab` extrudes evenly, so the form turns into a thin bright bar edge-on, and `dome` swells toward the middle (used for the brain).
- **One GPU point cloud**: each particle carries a position for every shape plus a starfield position. A vertex shader blends them, so the CPU only updates a handful of uniforms per frame.
- **Scroll mapping** (`stateAt`): each shape gets 260vh of scroll. Within it, the form assembles over the first 20%, rotates (front → edge-on → angled), then disperses over the last 20%. The first shape starts already formed and the last one stays formed. The rotation never passes edge-on, so the symbol never reads mirrored.
- **Smoothness**: progress eases toward the scroll position (exponential, about 140ms), so motion stays tied to the scrollbar without jumps. Particles release on staggered schedules and bow out through a turbulent flow field, and a constant low shiver keeps the grain alive. The shiver grows with rotation speed.
- **Reduced motion**: the ambient shiver drops to a minimum. Scroll still drives the forms.

To change the forms, replace the images in `shapes/` (white on black, roughly square) and edit `SHAPES` in `js/main.js`.
