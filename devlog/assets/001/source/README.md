# How the Devlog #001 images were made

The images are real renders from the generator. Nothing is painted over.

1. `npm run build`
2. `node tools/render.mjs devlog/assets/001/source/render-jobs.json`
   renders each recipe with a transparent background (into `r/`, relative to where you run it).
3. Crop each render to its content (any image tool; we trimmed the transparent margins).
4. Open `cards.html` in headless Chromium and screenshot each `<section class="card">`
   at 2x, then scale to 1800 px wide and save as WebP.

Card fonts: Space Grotesk, JetBrains Mono and Caveat (Google Fonts).
