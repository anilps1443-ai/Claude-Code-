# Paper Portfolio

An editorial, paper-textured portfolio template: giant condensed display type on black blocks,
a draggable featured strip, a stack of quote cards that fans open on hover, a full-screen menu,
and torn-paper page transitions. Every word and image is placeholder content.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # → dist/  (static files, host anywhere)
npm run preview   # serve dist/ at http://localhost:4173
```

Pages: `index.html` (home) · `work.html` · `about.html`.

## What's in it

| Piece | Where | Notes |
|---|---|---|
| Design tokens (colour, type, easing) | `src/styles/main.css` `:root` | paper `#cdc6be`, ink `#1d1d1b`, accent `#c03f13` |
| Layout + components | `src/styles/main.css` | everything is sized in `vw`, so it scales like a printed broadsheet |
| Loader (page rises, spins two turns, lands) | `src/js/intro.js` | ~5 s, desktop only, skipped for reduced motion |
| Torn-paper curtain (menu + page transitions) | `src/js/curtain.js` | 2D canvas: ripped edge, curve, fibre strip, shadow, grain |
| Menu, link transitions, phone nav-hide | `src/js/nav.js` | |
| Draggable inertial strip | `src/js/slider.js` | mouse, touch, trackpad |
| Quote-card fan-out on hover | `src/js/cards.js` | offsets are in `vw` |
| Giant-word auto-fit | `src/js/fit.js` | any word fills its black block |
| Baseline hairlines under display lines | `src/js/rules.js` | rules track the text baseline |
| Condensed-type margin fix | `src/js/condense.js` | see "Fonts" |
| Smooth scrolling | `src/js/scroll.js` | Locomotive Scroll 4 (pointer devices only) |
| Paper grain | `src/assets/paper.jpg` | generated procedurally, tiles seamlessly |

## Make it yours

* **Words**: edit the three `.html` files. The giant hero word is `<h1 class="head h" data-fit>`; it fits itself to the box.
* **Images**: replace any `<div class="ph …" data-ph="…">` placeholder with an `<img>` (or a `background-image`) of the same box.
* **Colours**: change the tokens at the top of `main.css`.
* **Motion**: durations and easings live in the JS modules; the card fan offsets are at the top of `cards.js`.

## Fonts

The look is set in two licensed typefaces that are not bundled here. This template ships free,
self-hosted stand-ins (all SIL OFL):

| Role | Stand-in | File |
|---|---|---|
| Display (condensed Didone) | Noto Serif Display, width 62.5, weight 850 | `src/fonts/display.woff2` |
| Text | Instrument Serif | `src/fonts/text*.woff2` |
| Logotype | UnifrakturCook | `src/fonts/logo.woff2` |
| Stamp / labels | Special Elite | `src/fonts/typewriter.woff2` |

The display stand-in is not quite as narrow as the original face, so display text is squeezed a
little further with `scale: var(--cx) 1` (`--cx: .62`) and `condense.js` corrects the layout
widths. **If you license a truly condensed display face**: add its `@font-face`, point
`--f-display` at it, set `--cx: 1` and `--w-display` to its weight. Nothing else changes.

## Browser support

Modern evergreen browsers. Uses the individual CSS `scale` / `translate` properties, `clip-path`,
`aspect-ratio` and `mix-blend-mode`.
