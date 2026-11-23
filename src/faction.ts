/**
 * Faction families: a matching arsenal from one seed.
 *
 * A faction shares, across all its weapons:
 *   - the style, palette variant and finish (bulk, ornament, detail, wear...)
 *   - a signature color and a "livery" (where that color goes)
 *   - a doctrine: preferred part variants, applied as soft preferences, so
 *     every archetype still follows its own rules (a shotgun keeps its pump)
 *   - shape genes (via the recipe `family` key), so proportions rhyme
 *   - an insignia badge
 */
import { Rng } from './core/rng.js';
import type { Vec3 } from './core/geometry.js';
import type { Weapon } from './core/weapon.js';
import { generate, resolveParams, resolveParts } from './generate.js';
import { getStyle } from './styles/index.js';
import { mixHex } from './materials/palette.js';
import { buildManifest } from './export/manifest.js';
import type { UvLayout } from './export/manifest.js';
import { toGLBArsenal } from './export/glb.js';
import type { ArchetypeId, Insignia, InsigniaShape, PaletteOverrides, Params, Recipe, StyleId } from './types.js';

export type Livery = 'accent' | 'trim' | 'body';

export interface FactionRecipe {
  style: StyleId;
  seed: number | string;
  /** Override the generated name. */
  name?: string;
  /** Which weapon types the faction fields (default depends on the style). */
  members?: ArchetypeId[];
  /** Shared art direction (length is left to each weapon type). */
  params?: Partial<Params>;
  paletteVariant?: number;
  /** Signature color (hex). Default: picked by seed. */
  color?: string;
  livery?: Livery;
  insignia?: Partial<Insignia>;
}

export interface Faction {
  name: string;
  style: StyleId;
  seed: number | string;
  color: string;
  livery: Livery;
  insignia: Insignia;
  paletteVariant: number;
  /** Shared params (no length). */
  params: Omit<Params, 'length'>;
  /** Preferred part variants per weapon family. */
  doctrine: Record<string, Record<string, string>>;
  members: { archetype: ArchetypeId; recipe: Recipe; weapon: Weapon }[];
}

const LONG_GUNS: ArchetypeId[] = ['rifle', 'smg', 'shotgun', 'sniper', 'lmg'];

const COLORS: Record<string, string[]> = {
  modern: ['#c8501e', '#2f6db5', '#b8323a', '#3f8f4a', '#d9b23a', '#7a4fb0'],
  steampunk: ['#8c2f2f', '#2f5c8c', '#2f6b4a', '#c9a24a', '#5a2f6b'],
  scifi: ['#2ee6ff', '#ff3ab0', '#ffb02e', '#7dff3a', '#ff5a3a', '#7a6bff'],
  scrap: ['#c8501e', '#a8322b', '#d9c23a', '#3b7a9a', '#5a8a3a'],
  fantasy: ['#3dffb0', '#ff7a1a', '#b46bff', '#5fd4ff', '#ff4a6a', '#ffd24a'],
  era: ['#7a2a1d', '#2f4f7a', '#5a6b3a', '#c9b28a', '#8a6a2a'],
  diesel: ['#b8323a', '#c9a24a', '#2f5c8c', '#d9b23a', '#5a6b3a'],
  cyber: ['#ff2a6d', '#05d9e8', '#d1f7ff', '#f9f002', '#7b2fff', '#00ff9f'],
};

const ADJECTIVES = ['Iron', 'Crimson', 'Silent', 'Northern', 'Black', 'Golden', 'Grey', 'Hollow', 'Burning', 'Seventh', 'Last', 'Broken', 'Ashen', 'Restless', 'Copper', 'Midnight'];
const NOUNS: Record<string, string[]> = {
  modern: ['Vanguard', 'Syndicate', 'Wolves', 'Company', 'Group', 'Watch'],
  steampunk: ['Brass Society', 'Guild', 'Consortium', 'Engineers', 'Rail Barons', 'Gentlemen'],
  scifi: ['Collective', 'Directive', 'Armada', 'Protocol', 'Coalition', 'Expanse'],
  scrap: ['Scavengers', 'Rust Riders', 'Junkers', 'Tribe', 'Raiders', 'Wreckers'],
  fantasy: ['Order', 'Circle', 'Covenant', 'Wardens', 'Court', 'Kingdom'],
  era: ['Fusiliers', 'Rangers', 'Regiment', 'Brigade', 'Battalion', 'Grenadiers'],
  diesel: ['Iron Legion', 'Motor Corps', 'Dieselworks', 'Armored Division', 'Steelworks', 'Expedition'],
  cyber: ['Syndicate', 'Netrunners', 'Corporation', 'Collective', 'Crew', 'Ghosts'],
};
const SHAPES: InsigniaShape[] = ['circle', 'shield', 'diamond', 'star', 'chevron', 'hex', 'triangle'];

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

function flavor(style: StyleId): string {
  return ['ww1', 'ww2', 'vietnam'].includes(style) ? 'era' : style in NOUNS ? style : 'modern';
}

export function factionName(style: StyleId, seed: number | string): string {
  const rng = Rng.stream(`${seed}:${style}`, 'faction:name');
  const f = flavor(style);
  const adj = rng.pick(ADJECTIVES), noun = rng.pick(NOUNS[f]);
  if (f === 'era') return `The ${ordinal(rng.int(1, 99))} ${adj} ${noun}`;
  if (f === 'scrap') return `The ${adj} ${noun}`;
  return rng.chance(0.5) ? `The ${adj} ${noun}` : `${noun} of the ${adj} ${rng.pick(['Star', 'Gate', 'Crown', 'Coast', 'Line', 'Tower'])}`;
}

function defaultMembers(style: StyleId): ArchetypeId[] {
  const t = getStyle(style).traits;
  const m: ArchetypeId[] = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'lmg'];
  if (t.magic || t.scrap || t.plumbing) m.push('crossbow');
  if (t.magic || t.scrap) m.push('bow');
  return m;
}

/** A faction's doctrine, minus picks that don't suit this weapon type (no bolt-action machine guns). */
function memberPrefs(a: ArchetypeId, d: Record<string, string>): Record<string, string> {
  const out = { ...d };
  if (out.receiver === 'boltaction' && !['rifle', 'sniper'].includes(a)) delete out.receiver;
  return out;
}

/** Which "doctrine family" an archetype belongs to. */
const familyOf = (a: ArchetypeId) => (LONG_GUNS.includes(a) ? 'longgun' : a);

export function generateFaction(f: FactionRecipe): Faction {
  const style = getStyle(f.style);
  const rng = Rng.stream(`${f.seed}:${f.style}`, 'faction');
  const paletteVariant = f.paletteVariant ?? rng.int(0, style.palettes.length - 1);
  const color = f.color ?? rng.pick(COLORS[flavor(f.style)] ?? COLORS.modern);
  const livery: Livery = f.livery ?? rng.weighted({ accent: 0.55, trim: 0.25, body: 0.2 });
  const ins: Insignia = { shape: f.insignia?.shape ?? rng.pick(SHAPES), emblem: f.insignia?.emblem ?? rng.int(3, 6) };

  // Shared finish (length stays per weapon type).
  const full = resolveParams({ archetype: 'rifle', style: f.style, seed: `${f.seed}:finish`, params: f.params });
  const { length: _len, ...params } = full;
  void _len;

  // Signature color -> palette overrides.
  const base = style.palettes[paletteVariant].materials;
  const palette: PaletteOverrides = { Accent: color };
  if (base.Emissive.emissive && (style.traits.glow || style.traits.magic)) palette.Emissive = { emissive: mixHex(color, '#ffffff', 0.25) };
  if (livery === 'trim') palette.Trim = mixHex(base.Trim.color, color, 0.7);
  if (livery === 'body') palette.Body = mixHex(base.Body.color, color, 0.55);

  // Doctrine: one pick per part kind per weapon family, made once for the faction.
  const members = f.members ?? defaultMembers(f.style);
  const doctrine: Record<string, Record<string, string>> = {};
  for (const a of members) {
    const fam = familyOf(a);
    if (doctrine[fam]) continue;
    const probe = fam === 'longgun' ? 'rifle' : a;
    doctrine[fam] = resolveParts({ archetype: probe, style: f.style, seed: `${f.seed}:doctrine:${fam}` });
  }

  const out: Faction['members'] = members.map((archetype) => {
    const recipe: Recipe = {
      archetype,
      style: f.style,
      seed: `${f.seed}-${archetype}`,
      family: f.seed,
      params: { ...params },
      paletteVariant,
      palette,
      prefer: memberPrefs(archetype, doctrine[familyOf(archetype)]),
      insignia: ins,
    };
    return { archetype, recipe, weapon: generate(recipe) };
  });

  return { name: f.name ?? factionName(f.style, f.seed), style: f.style, seed: f.seed, color, livery, insignia: ins, paletteVariant, params, doctrine, members: out };
}

/**
 * The whole arsenal as one .glb, laid out for a side view: guns stacked in
 * one column (pistol on top), crossbows and bows in a second column to the
 * right. Each weapon keeps its own root node; materials are shared.
 */
export function factionToGLB(faction: Faction, opts: { uv?: UvLayout; gap?: number } = {}): Uint8Array {
  const gap = opts.gap ?? 0.08;
  const items: { weapon: Weapon; translation: Vec3 }[] = [];
  const columns: Faction['members'][] = [
    faction.members.filter((m) => m.archetype !== 'bow' && m.archetype !== 'crossbow'),
    faction.members.filter((m) => m.archetype === 'bow' || m.archetype === 'crossbow'),
  ];
  let zShift = 0;
  for (const col of columns) {
    if (!col.length) continue;
    const bounds = col.map((m) => buildManifest(m.weapon).bounds);
    const minZ = Math.min(...bounds.map((b) => b.min[2]));
    const maxZ = Math.max(...bounds.map((b) => b.max[2]));
    const dz = zShift - minZ;
    let y = 0;
    col.forEach((m, i) => {
      y -= bounds[i].max[1];
      items.push({ weapon: m.weapon, translation: [0, y, dz] });
      y += bounds[i].min[1] - gap;
    });
    zShift += maxZ - minZ + 0.25;
  }
  return toGLBArsenal(items, faction.name, { badgun: { faction: summary(faction) } }, { uv: opts.uv });
}

/** JSON-friendly description of a faction (recipes included, weapons not). */
export function summary(faction: Faction) {
  return {
    name: faction.name,
    style: faction.style,
    seed: faction.seed,
    color: faction.color,
    livery: faction.livery,
    insignia: faction.insignia,
    paletteVariant: faction.paletteVariant,
    params: faction.params,
    doctrine: faction.doctrine,
    members: faction.members.map((m) => ({ archetype: m.archetype, recipe: m.recipe, parts: m.weapon.parts })),
  };
}
