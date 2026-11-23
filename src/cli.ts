#!/usr/bin/env node
/**
 * badgun CLI
 *
 *   badgun --style steampunk --seed 42                 -> out/BadGun_rifle_steampunk_42.glb (+ .json)
 *   badgun --recipe my-gun.json --out exports/
 *   badgun --style modern --seed 1 --count 10          -> 10 variants, seeds 1..10
 *   badgun --style scifi --seed 7 --param bulk=0.9 --optic scope --color Body=#ff3366
 *   badgun --list
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './generate.js';
import { toGLB } from './export/glb.js';
import { factionToGLB, generateFaction, summary as factionSummary } from './faction.js';
import { buildManifest, weaponName } from './export/manifest.js';
import { STYLES } from './styles/index.js';
import { ARCHETYPES } from './archetypes/index.js';
import { OPTIC_NAMES } from './parts/sight.js';
import type { Recipe, MaterialSlot, PartKind, OpticChoice, StyleId } from './types.js';

const HELP = `badgun - procedural weapon generator

Options:
  --style <id>          ${Object.keys(STYLES).join(' | ')}   (default: modern)
  --archetype <id>      ${Object.keys(ARCHETYPES).join(' | ')}   (default: rifle)
  --seed <n|text>       any number or word                     (default: 1)
  --count <n>           generate n variants with consecutive seeds
  --param key=value     length, bulk, ornament, detail, smoothness, wear (0..1)
  --optic <id>          auto | none | ${OPTIC_NAMES.join(' | ')}
  --part kind=variant   force a part, e.g. --part magazine=drum
  --palette <n>         palette variant index
  --color Slot=#hex     recolor a material slot, e.g. --color Body=#336699
  --recipe <file>       load a recipe JSON (other flags override it)
  --out <dir>           output folder                          (default: out)
  --faction             generate a whole matching arsenal (uses --style and --seed)
  --list                show styles, parts and optics
  --help`;

function parseArgs(argv: string[]) {
  const opts: Record<string, string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    (opts[key] ??= []).push(val);
  }
  return opts;
}

function list(): void {
  console.log('Styles:');
  for (const s of Object.values(STYLES)) {
    console.log(`  ${s.id.padEnd(10)} ${s.description}`);
    console.log(`  ${''.padEnd(10)} palettes: ${s.palettes.map((p, i) => `${i}=${p.name}`).join(', ')}`);
  }
  for (const a of Object.values(ARCHETYPES)) {
    console.log(`\n${a.name} (--archetype ${a.id}): ${a.description}`);
    for (const [kind, table] of Object.entries(a.parts)) console.log(`  ${kind.padEnd(10)} ${Object.keys(table).join(', ')}`);
    console.log(`  ${'sight'.padEnd(10)} ${a.optics.join(', ')}`);
  }
}

function main(): void {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) return console.log(HELP);
  if (o.list) return list();

  let recipe: Recipe = { archetype: 'rifle', style: 'modern', seed: 1 };
  if (o.recipe) recipe = { ...recipe, ...JSON.parse(readFileSync(o.recipe[0], 'utf8')) };
  if (o.style) recipe.style = o.style[0] as StyleId;
  if (o.archetype) recipe.archetype = o.archetype[0] as Recipe['archetype'];
  if (o.seed) recipe.seed = /^-?\d+$/.test(o.seed[0]) ? Number(o.seed[0]) : o.seed[0];
  if (o.optic) recipe.optic = o.optic[0] as OpticChoice;
  if (o.palette) recipe.paletteVariant = Number(o.palette[0]);
  for (const kv of o.param ?? []) {
    const [k, v] = kv.split('=');
    recipe.params = { ...recipe.params, [k]: Number(v) };
  }
  for (const kv of o.part ?? []) {
    const [k, v] = kv.split('=');
    recipe.parts = { ...recipe.parts, [k as PartKind]: v };
  }
  for (const kv of o.color ?? []) {
    const [k, v] = kv.split('=');
    recipe.palette = { ...recipe.palette, [k as MaterialSlot]: v };
  }

  const outDir = o.out?.[0] ?? 'out';
  mkdirSync(outDir, { recursive: true });

  if (o.faction) {
    const { length: _l, ...shared } = recipe.params ?? {};
    void _l;
    const f = generateFaction({ style: recipe.style, seed: recipe.seed, params: shared, paletteVariant: recipe.paletteVariant });
    const slug = f.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const dir = join(outDir, slug);
    mkdirSync(dir, { recursive: true });
    for (const m of f.members) writeFileSync(join(dir, `${weaponName(m.weapon)}.glb`), toGLB(m.weapon));
    writeFileSync(join(dir, `${slug}_arsenal.glb`), factionToGLB(f));
    writeFileSync(join(dir, `${slug}.faction.json`), JSON.stringify(factionSummary(f), null, 2));
    console.log(`${f.name}  (${f.style}, ${f.livery} livery in ${f.color}, ${f.insignia.shape} insignia)`);
    for (const m of f.members) console.log(`  ${m.archetype.padEnd(9)} ${Object.entries(m.weapon.parts).map(([k, v]) => `${k}:${v}`).join(' ')}`);
    console.log(`-> ${dir}/`);
    return;
  }
  const count = Math.max(1, Number(o.count?.[0] ?? 1));
  for (let i = 0; i < count; i++) {
    const r: Recipe = { ...recipe, seed: typeof recipe.seed === 'number' ? recipe.seed + i : count > 1 ? `${recipe.seed}-${i}` : recipe.seed };
    const weapon = generate(r);
    const name = weaponName(weapon);
    const manifest = buildManifest(weapon);
    writeFileSync(join(outDir, `${name}.glb`), toGLB(weapon));
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(manifest, null, 2));
    const parts = Object.entries(weapon.parts).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`${name}.glb  ${manifest.stats.triangles} tris, ${manifest.stats.materials} materials, palette "${weapon.paletteName}"  [${parts}]`);
  }
}

try {
  main();
} catch (err) {
  console.error(`badgun: ${(err as Error).message}`);
  process.exit(1);
}
