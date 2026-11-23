# How the Devlog #008 images were made

Same recipe as [#001](../../001/source/README.md), plus:

- Checker renders: `render-jobs.json` through `node tools/render.mjs` (the jobs use `"query": "checker"`).
- The texture maps come from `bakeTexture()` for the dieselpunk rifle in `render-jobs.json`, exported with `toGLB(weapon, { uv: 'atlas', texture: 1024 })`.
- The camo test: `camo.py` paints the base color map using the ID map as a stencil, and `textured-view.html?glb=gun.glb&paint=camo_tex.png` renders it (swapping the embedded texture in three.js).
- `cards.html` expects those images in a `renders/` folder next to it.
