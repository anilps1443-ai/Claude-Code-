# TapFin landing: hero

The first section of the TapFin landing page, rebuilt from the supplied design, with the scroll-driven particle animation set into the empty space under the call to action.

## Run

```sh
npx http-server tapfin-landing -p 8778 -c-1
# open http://localhost:8778/
```

It needs HTTP: ES modules, and the particle shapes are read through a canvas, which `file://` blocks. Fonts (Archivo, Poppins) come from Google Fonts. Everything else is vendored: Three.js r160, GSAP and ScrollTrigger 3.12.5, and the Lucide icons inlined in `index.html`. Licences are in `vendor/`.

## Brand

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#010101` | Page, header and hero ground. No `#000000` anywhere |
| `--white` | `#FFFFFF` | Text, buttons, particles |
| `--green` | `#339D52` | Logo, focus ring, active step, progress rail |
| `--blue` | `#07699E` | Logo, active step, progress rail, button glow |
| Horizon glow | `#020C1F` → `#0B3A78` → `#3F72BD` → `#B3CDF0` | Hero background, sampled from the supplied background image |

Headings use Archivo 700; body and navigation use Poppins 400/500. Icons come from Lucide: chevron-down, arrow-right, menu, x, indian-rupee, brain-circuit and repeat-2.

## Layout

- **Mobile first.** Under 768px: logo and menu button, with a full-height menu panel whose dropdowns become accordions. 768–1099px (tablet): adds "Request a Demo" to the bar. From 1100px (desktop): the full inline navigation with hover and click dropdowns, plus Login and Request a Demo.
- **Hero.** The headline, subtitle and CTA are centred as in the design. The particle stage fills the remaining height, and a three-step rail (Finance · Analyse · Resale) sits at the foot. The converging horizon lines are drawn in SVG and always meet at the formation's centre, so they line up at every size.
- **Pinned scroll.** The hero is pinned with CSS `position: sticky` for 520vh. ScrollTrigger turns that scroll into progress from 0 to 1, and the hero releases after the last formation. The headline word and the rail step for the current formation light up, and the rail fills in green to blue.

## Particle animation

The engine is the same one as in `../particle-scroll`, adapted for this hero:

- **Placement.** It draws on a transparent canvas over the glow, centred and sized to the stage, at no more than 72% of its height and 80% of its width.
- **Left to right.** Each form turns continuously with its front face moving right. On the way out, the left side lets go first and drifts right. The next form fills in from its left side, and the starfield streams left to right while you scroll.
- **Sequence.** Rupee, then brain, then EV and battery exchange. Scrolling up reverses it.
- **Readability.** Star density is scaled to the screen area, stars that pass behind the headline are dimmed, and bokeh size is capped on small screens.
- **Reduced motion.** No idle turn, and drift drops to about a third.

## Placeholders to confirm

The dropdown items are placeholders until the real ones are supplied:

| Menu | Items |
| --- | --- |
| Finance | EV Asset Finance, Fleet Leasing, Battery Finance |
| Data Analytics | Asset Health, Residual Value, Risk Scoring |
| Insights | Blog, Case Studies, Reports |

All links point to `#` for now.
