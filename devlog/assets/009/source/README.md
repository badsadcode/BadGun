# How the Devlog #009 images were made

Same recipe as [#001](../../001/source/README.md). Every frame is the playground in screenshot mode with a frozen pose: `render-jobs.json` passes `"query": "pose=<Clip>@<seconds>"` to `node tools/render.mjs` (the camera is framed on the rest pose first, so frames line up). Each flipbook row is cropped to the union of its frames' bounds and saved as `c_<name>_<frame>.png`; `cards.html` expects those in a `renders/` folder next to it.
