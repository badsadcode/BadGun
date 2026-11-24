# How the Devlog #010 images were made

Same recipe as [#001](../../001/source/README.md). `render-jobs.json` renders kits through the playground's Kit mode (`"archetype": "kit"`), and the exploded view with `"query": "explode"`. Each render is cropped to its contents and saved as `c_<name>.png`; `cards.html` expects those in a `renders/` folder next to it.
