# Anil Suryawanshi — Portfolio

UI/UX and product designer portfolio. Three pages (Home, Work, About), built as a static site with Vite.
Content comes from Anil's resume (experience, skills, tools, education) and Behance profile (case studies and covers).

## Publish it (no build needed)

The finished site is already built in **`dist/`**. Upload that folder to any static host:

* **Netlify**: drag the `dist` folder onto app.netlify.com/drop
* **Vercel**: `npx vercel dist --prod`
* **GitHub Pages / Cloudflare Pages**: publish the contents of `dist/`

## Edit it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # rebuilds dist/
```

| To change | Edit |
|---|---|
| Hero line ("UX/UI Designer") | `index.html` → `<h1 class="head h" data-fit>` (the text fits itself to the block) |
| Copy, experience, skills, links | `index.html`, `work.html`, `about.html` |
| Case-study covers | `src/assets/work/*.jpg` (808px wide) |
| Colours, type, spacing | tokens at the top of `src/styles/main.css` |
| Motion | `src/js/` (`intro.js` loader, `curtain.js` page transitions, `cards.js` card fan-out) |

## Notes

* **Fonts** are free, self-hosted stand-ins for the licensed faces of the reference design (see `src/fonts`). To use licensed fonts, add your `@font-face`, point `--f-display` / `--f-text` at them and set `--cx: 1` (and the hero's `.head.h { --cx }`).
* **Product work** (TRUST, FleetForce, Agenda ONE, …) is shown as expandable summaries with typographic covers. Add screenshots by replacing a `tcover` block with an `<img>` where you are free to show the work.
* **Behance case-study blurbs** restate the project titles only; add your own case-study text where you like.
* **Contact**: email, phone, LinkedIn, Behance and the resume link are in the Contact block, the footer and the menu. Remove the phone line in `about.html` (`.contact-note`) if you prefer not to publish it.
