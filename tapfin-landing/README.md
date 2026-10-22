# TapFin landing page

A single-page scroll story: one WebGL particle field sits behind the page and
rebuilds itself into each chapter (a 360° EV, the ₹, the database, the
car ⇄ battery swap, three rings, silos, a data stream, the shield and the
TAPFIN wordmark). The copy is the copy from the low-fidelity wireframe.

## Run it

Any static server from this folder, for example:

```
python3 -m http.server 8000
```

then open http://localhost:8000. (Opening `index.html` from disk won't work:
the particle shapes are fetched.)

`?scene=<name>` holds the particles on one scene for review, e.g.
`?scene=hero-xchange`. The names are the keys of `SCENES` in `js/main.js`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Markup and all content |
| `css/style.css` | Brand tokens (colour sheet), type scale per breakpoint, layout |
| `js/particles.js` | The Three.js particle field: shape generators, morph shader |
| `js/main.js` | Lenis smooth scroll, GSAP ScrollTrigger scenes, reveals, nav, form |
| `assets/img/` | The four supplied particle artworks |
| `assets/shapes/*.bin` | Point clouds sampled from those artworks (`tools/sample-shapes.py`) |
| `figures/swappack.html` | Hairline figure for the Resale pillar (source: `hairline/swappack.js`) |
| `figures/logger.html` | Anatomy figure for "Why now?" (source: `anatomy/logger/build.mjs`) |
| `vendor/` | three r160, GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.20 |

## Rebuilding the figures

```
node ../.claude/skills/hairline-create/build.mjs hairline/swappack.js figures/swappack.html
node anatomy/logger/build.mjs && mv anatomy/logger/logger.html figures/logger.html
python3 tools/sample-shapes.py   # after changing an artwork in assets/img
```

## Content notes

- Vision and Mission are removed for now, as agreed.
- The callback section's "[Short supporting line to be added]" placeholder is
  left out until the line is written.
- Internal pages from the sitemap (`/trust`, `/fleetforce`, `/xchange`,
  `/finance`, `/blogs`, `/careers`, `/news`, legal pages) are linked but not
  built yet. GoGreen Capital, TAP FinTech and Login go to their external sites.
- The forms validate in the browser but are not connected to a backend.
