# Particle Scroll

A scroll-driven 3D particle animation on a black stage. One point cloud (80,000 particles, 40,000 on phones and low-core devices) turns a full 360° continuously. As you scroll, it moves through three formations in order: **₹ rupee → neural brain → EV, battery and exchange arrows**. Scrolling back plays the same states in reverse.

## Run

ES modules need HTTP, and the shape images are read through a canvas, which `file://` blocks:

```sh
npx http-server particle-scroll -p 8777 -c-1
# open http://localhost:8777/
```

Vendored in `vendor/`, so nothing loads from the network: Three.js r160 (MIT) and GSAP and ScrollTrigger 3.12.5 (GSAP standard no-charge licence). See the licence files.

## What the recording does, and how it is matched

Studied frame by frame from the reference screen recording:

| Recording | Implementation |
| --- | --- |
| The form turns on its vertical axis, thin and bright when edge-on | Each formation has real depth (`slab` extrusion, `dome` for the brain). Here it turns 360° on its own (one turn per 22 s), and scrolling adds one more turn across the page (removed again in reverse) |
| At rest the grain shivers, with specks around the outline | Ambient shiver in the shader, plus about 7% "halo" grains breathing in and out around the outline |
| Dissolve: the silhouette frays, grows slightly and dims, while stars and a few large bokeh dots appear | Each particle runs the transition on its own seeded clock (edge grains leave first). Body grains drift out along a seeded direction with a curving, turbulent path and fade to a ghost of the outline. About 30% of particles travel out into a starfield, and some pass the lens as bokeh |
| Midpoint: near-black, sparse stars, a faint cloud | Only some travellers stay lit as stars. The starfield moves toward the camera as you scroll |
| Reform: the next form condenses from a faint outline and brightens | The same particles switch target near the midpoint and converge on the next formation's sampled positions |

The brain's brightest grains (its network nodes) flicker gently and sit slightly larger. Its connecting lines come from sampling the source image at 480 px.

## Timeline (normalised scroll progress)

| Progress | State |
| --- | --- |
| 0 – 0.08 | Rupee, stable |
| 0.08 – 0.46 | Rupee disperses → cloud → brain converges |
| 0.46 – 0.54 | Brain, stable |
| 0.54 – 0.92 | Brain disperses → cloud → exchange converges |
| 0.92 – 1 | Exchange, stable, then the section unpins |

The section is pinned with CSS `position: sticky` (600vh of scroll), so no pin spacer reflows the layout. ScrollTrigger reports progress, with plain scroll maths as a fallback. Progress eases toward the scroll position (about 170 ms), and every particle position is a pure function of progress, seeds and time. Scrubbing back and forth never loses or reshuffles particles.

## Limits

- The rupee source image includes a dusty motion trail on its right, so the formation shows it too.
- With a full 360° turn the formations are seen from behind (mirrored) for part of each revolution.
- The recording's shapes sit right of centre next to headings. Without text, these are centred.
- Reduced motion: no idle turn, and shiver and travel distances drop to about a third. Scroll still drives the transitions.

To change the formations, replace the images in `shapes/` (white on black) and edit `SHAPES` in `js/main.js`.
