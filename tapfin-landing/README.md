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
- **Hero, landscape at 900px and wider.** Two columns at 5:7. The copy holds the left column, left-aligned and vertically centred: the headline set one word per line (Finance. / Analyse. / Resale.), then the subtitle, the CTA and the stage rail. The particle formation is centred in the right column.
- **Hero, phones and portrait tablets.** Left-aligned copy on top, the formation centred in the space below, and the stage rail on a dark backing at the foot, so it stays readable over the bright glow. Under 380px each stage shows its icon above its label.
- **Following the formation.** The horizon lines and a soft brand-blue halo are positioned from the stage's measured centre, so they always meet the formation. In two columns, the lines fade out behind the copy.
- **Pinned scroll.** The hero is pinned with CSS `position: sticky` for 520vh. ScrollTrigger turns that scroll into progress from 0 to 1, and the hero releases after the last formation. The headline word and the rail step for the current formation light up, and the rail fills in green to blue.

## Particle animation

The engine is the same one as in `../particle-scroll`, adapted for this hero:

- **Placement.** It draws on a transparent canvas over the whole hero. Each formation is centred and sized to the stage, at no more than 72% of its height and 80% of its width.
- **Left to right.** Each form turns continuously with its front face moving right. On the way out, the left side lets go first and drifts right. The next form fills in from its left side, and the starfield streams left to right while you scroll.
- **Sequence.** Rupee, then brain, then EV and battery exchange. Scrolling up reverses it.
- **Readability.** Star density is scaled to the screen area. Stars inside the measured box of the copy and rail are dimmed, in either layout, and bokeh size is capped on small screens.
- **Reduced motion.** No idle turn, and drift drops to about a third.

## Placeholders to confirm

The dropdown items are placeholders until the real ones are supplied:

| Menu | Items |
| --- | --- |
| Finance | EV Asset Finance, Fleet Leasing, Battery Finance |
| Data Analytics | Asset Health, Residual Value, Risk Scoring |
| Insights | Blog, Case Studies, Reports |

All links point to `#` for now.
