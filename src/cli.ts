#!/usr/bin/env node
/**
 * badgun CLI
 *
 *   badgun --style steampunk --seed 42                 -> out/BadGun_rifle_steampunk_42.glb (+ .json)
 *   badgun --recipe my-gun.json --out exports/
 *   badgun --style modern --seed 1 --count 10          -> 10 variants, seeds 1..10
 *   badgun --style scifi --seed 7 --param bulk=0.9 --optic scope --color Body=#ff3366
 *   badgun --style diesel --seed 3 --maps 2048 --uv atlas  -> + texture maps, atlas UVs first
 *   badgun --attachment optic --style steampunk --seed 2     -> one standalone attachment
 *   badgun --kit --style cyber --seed 5                   -> every attachment that suits the world
 *   badgun --list
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './generate.js';
import { toGLB } from './export/glb.js';
import { factionToGLB, generateFaction, summary as factionSummary } from './faction.js';
import { ATTACHMENT_TYPES, attachmentVariants, generateAttachment, generateAttachmentKit, kitToGLB } from './attachment.js';
import type { AttachmentType } from './attachment.js';
import { buildManifest, weaponName } from './export/manifest.js';
import type { UvLayout } from './export/manifest.js';
import { bakeTexture } from './texture/bake.js';
import { encodePNG } from './texture/png.js';
import type { Weapon } from './core/weapon.js';
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
  --attachment <type>   a standalone attachment: ${ATTACHMENT_TYPES.join(' | ')}
                        (pick one with --variant, otherwise the style decides)
  --kit                 every attachment that suits the style, as separate files
                        plus one *_kit.glb
  --uv <set>            tiling | atlas: which UV set is TEXCOORD_0 (default: tiling;
                        the other set is TEXCOORD_1)
  --texture [size]      embed a base color texture in the .glb (default size 1024)
  --no-anim             leave the animation clips out of the .glb
  --maps [size]         also write texture maps: _BaseColor, _ID (one color per
                        material slot) and _UVTemplate .png (default size 1024)
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
  console.log('\nStandalone attachments (--attachment <type> --variant <name>):');
  for (const t of ATTACHMENT_TYPES) console.log(`  ${t.padEnd(12)} ${Object.keys(attachmentVariants(t)).join(', ')}`);
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

  const uv = (o.uv?.[0] ?? 'tiling') as UvLayout;
  if (uv !== 'tiling' && uv !== 'atlas') throw new Error(`--uv must be "tiling" or "atlas", not "${uv}"`);
  const sizeOf = (v: string[] | undefined) => (v ? (v[0] === 'true' ? 1024 : Number(v[0])) : 0);
  const textureSize = sizeOf(o.texture), mapSize = sizeOf(o.maps);
  for (const n of [textureSize, mapSize]) if (n && !(n >= 64 && n <= 8192)) throw new Error('texture sizes must be between 64 and 8192');
  const glb = (w: Weapon) => toGLB(w, { uv, texture: textureSize || undefined, animations: !o['no-anim'] });
  const maps = (w: Weapon, dir: string) => {
    if (!mapSize) return;
    for (const [mode, suffix] of [['basecolor', 'BaseColor'], ['id', 'ID'], ['layout', 'UVTemplate']] as const) {
      const img = bakeTexture(w, mode, { size: mapSize });
      writeFileSync(join(dir, `${weaponName(w)}_${suffix}.png`), encodePNG(img.data, img.width, img.height));
    }
  };

  const outDir = o.out?.[0] ?? 'out';
  mkdirSync(outDir, { recursive: true });

  if (o.attachment || o.kit) {
    const save = (w: ReturnType<typeof generateAttachment>, dir: string) => {
      writeFileSync(join(dir, `${weaponName(w)}.glb`), glb(w));
      writeFileSync(join(dir, `${weaponName(w)}.json`), JSON.stringify(buildManifest(w, uv), null, 2));
      maps(w, dir);
      console.log(`${weaponName(w)}.glb  ${buildManifest(w).stats.triangles} tris  [${w.attachment!.type}: ${w.attachment!.variant}]`);
    };
    if (o.kit) {
      const kit = generateAttachmentKit({ style: recipe.style, seed: recipe.seed, paletteVariant: recipe.paletteVariant, params: recipe.params });
      const dir = join(outDir, `BadGun_kit_${recipe.style}_${recipe.seed}`);
      mkdirSync(dir, { recursive: true });
      for (const w of kit.items) save(w, dir);
      writeFileSync(join(dir, `BadGun_kit_${recipe.style}_${recipe.seed}.glb`), kitToGLB(kit));
      console.log(`-> ${dir}/`);
      return;
    }
    const type = o.attachment[0] as AttachmentType;
    if (!ATTACHMENT_TYPES.includes(type)) throw new Error(`--attachment must be one of ${ATTACHMENT_TYPES.join(', ')}`);
    save(generateAttachment({ type, variant: o.variant?.[0], style: recipe.style, seed: recipe.seed, params: recipe.params, paletteVariant: recipe.paletteVariant, palette: recipe.palette, host: o.archetype ? recipe.archetype : undefined }), outDir);
    return;
  }
  if (o.faction) {
    const { length: _l, ...shared } = recipe.params ?? {};
    void _l;
    const f = generateFaction({ style: recipe.style, seed: recipe.seed, params: shared, paletteVariant: recipe.paletteVariant });
    const slug = f.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const dir = join(outDir, slug);
    mkdirSync(dir, { recursive: true });
    for (const m of f.members) {
      writeFileSync(join(dir, `${weaponName(m.weapon)}.glb`), glb(m.weapon));
      maps(m.weapon, dir);
    }
    writeFileSync(join(dir, `${slug}_arsenal.glb`), factionToGLB(f, { uv }));
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
    const manifest = buildManifest(weapon, uv);
    writeFileSync(join(outDir, `${name}.glb`), glb(weapon));
    maps(weapon, outDir);
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
