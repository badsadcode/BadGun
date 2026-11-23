/**
 * Public data types. A Recipe is everything needed to reproduce a weapon:
 * the same recipe always produces the same asset.
 */

/**
 * Semantic material slots. These describe *what a surface is for*, not what
 * it is made of: the style decides that "Stock" is walnut in steampunk and
 * polymer in modern. Names are stable, so texture assignments survive
 * regeneration. Exported as `MAT_<Slot>`.
 */
export const MATERIAL_SLOTS = [
  'Body', // receiver / central housing
  'Barrel', // barrel and front assembly metal
  'Grip', // pistol grip, rubber pads
  'Stock', // shoulder stock, forend furniture
  'Magazine', // magazine, drum, power cell shell
  'Sight', // optics and sights housing
  'Trim', // trim, bands, rings, accents of the main palette
  'Accent', // contrast pieces: pipes, decals, colored parts
  'Detail', // small hardware: rails, screws, triggers, pins
  'Glass', // lenses, gauge glass, windows
  'Emissive', // glowing parts
] as const;

export type MaterialSlot = (typeof MATERIAL_SLOTS)[number];

/** A PBR material (glTF metallic-roughness). Colors are sRGB hex like "#a07030". */
export interface MaterialDef {
  /** Human-friendly description of what this slot looks like, e.g. "aged brass". */
  label?: string;
  color: string;
  metallic: number;
  roughness: number;
  /** Emissive color (sRGB hex). */
  emissive?: string;
  /** Emissive strength multiplier (KHR_materials_emissive_strength). */
  emissiveStrength?: number;
  /** 1 = opaque. Below 1 the material is exported with alpha blending. */
  opacity?: number;
}

export type Palette = Record<MaterialSlot, MaterialDef>;

/** Recolor without regenerating geometry: a hex string or partial material per slot. */
export type PaletteOverrides = Partial<Record<MaterialSlot, string | Partial<MaterialDef>>>;

export type ArchetypeId = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'lmg' | 'pistol' | 'crossbow' | 'bow';
export type StyleId = 'modern' | 'steampunk' | 'scifi' | 'scrap' | 'fantasy' | 'ww1' | 'ww2' | 'vietnam';
export type OpticChoice = 'auto' | 'none' | 'irons' | 'reddot' | 'scope' | 'holo' | 'brass' | 'tube' | 'rune' | 'leaf';

/**
 * Art-direction controls. All are 0..1. Leave one undefined and the seed
 * picks a value within the style's preferred range.
 */
export interface Params {
  /** Overall length: compact (0) to long (1). */
  length: number;
  /** Chunkiness: slim (0) to beefy (1). */
  bulk: number;
  /** Decoration: clean (0) to ornate (1). */
  ornament: number;
  /** Small parts and greebles: simple (0) to busy (1). */
  detail: number;
  /** Mesh smoothness: chunky low-poly (0) to smooth (1). */
  smoothness: number;
  /** Surface wear: factory new (0) to battered (1). Affects materials only. */
  wear: number;
}

export interface Recipe {
  archetype: ArchetypeId;
  style: StyleId;
  seed: number | string;
  params?: Partial<Params>;
  /** Which optic to mount. Default "auto" lets the style decide. */
  optic?: OpticChoice;
  /** Index into the style's palette variants. Default: picked by seed. */
  paletteVariant?: number;
  /** Per-slot color/material overrides, applied on top of the palette. */
  palette?: PaletteOverrides;
  /** Force specific part variants, e.g. { stock: "classic", magazine: "drum" }. */
  parts?: Partial<Record<PartKind, string>>;
}

/**
 * Part kinds depend on the archetype: long guns use receiver/barrel/muzzle/
 * handguard/stock/grip/magazine, pistols use frame/grip/muzzle, crossbows use
 * tiller/prod/stock/grip. Every archetype also has "sight".
 */
export type PartKind = string;
