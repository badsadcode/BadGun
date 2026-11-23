#!/usr/bin/env node
// Regenerates examples/: the three "success criteria" rifles from the project brief.
//   npm run examples
import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, toGLB, buildManifest } from '../dist/index.js';

const examples = {
  'modern-rifle': { archetype: 'rifle', style: 'modern', seed: 2 },
  'steampunk-rifle': { archetype: 'rifle', style: 'steampunk', seed: 4 },
  'scifi-rifle': { archetype: 'rifle', style: 'scifi', seed: 4 },
};

const dir = new URL('../examples/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, recipe] of Object.entries(examples)) {
  const weapon = generate(recipe);
  writeFileSync(new URL(`${name}.recipe.json`, dir), JSON.stringify(recipe, null, 2) + '\n');
  writeFileSync(new URL(`${name}.glb`, dir), toGLB(weapon));
  writeFileSync(new URL(`${name}.manifest.json`, dir), JSON.stringify(buildManifest(weapon), null, 2) + '\n');
  console.log(`examples/${name}.glb`);
}
