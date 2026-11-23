#!/usr/bin/env node
// Builds the static playground into site/ (what GitHub Pages serves).
//   npm run site      (then: PORT=5173 node tools/serve.mjs, and open /site/)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const out = new URL('site/', root);
rmSync(out, { recursive: true, force: true });
mkdirSync(new URL('dist/', out), { recursive: true });

// The library: only the runtime JavaScript is needed in the browser.
const copyJs = (from, to) => {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      mkdirSync(new URL(`${entry.name}/`, to), { recursive: true });
      copyJs(new URL(`${entry.name}/`, from), new URL(`${entry.name}/`, to));
    } else if (entry.name.endsWith('.js') && entry.name !== 'cli.js') {
      cpSync(new URL(entry.name, from), new URL(entry.name, to));
    }
  }
};
copyJs(new URL('dist/', root), new URL('dist/', out));

// The page: same file as the local preview, with the library path adjusted.
const html = readFileSync(new URL('tools/preview/index.html', root), 'utf8');
if (!html.includes("'../../dist/index.js'")) throw new Error('preview import path changed; update build-site.mjs');
writeFileSync(new URL('index.html', out), html.replace("'../../dist/index.js'", "'./dist/index.js'"));
writeFileSync(new URL('.nojekyll', out), '');
console.log('site/ ready');
