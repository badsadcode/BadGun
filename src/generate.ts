/**
 * generate(recipe) -> Weapon. The single entry point for building an asset.
 */
import { Rng } from './core/rng.js';
import { WeaponBuilder, finalizeWeapon, type Weapon } from './core/weapon.js';
import { applyOverrides, applyWear } from './materials/palette.js';
import { getStyle } from './styles/index.js';
import { makeContext } from './parts/context.js';
import { buildRifle, rifleLayout, rifleOrigin } from './archetypes/rifle.js';
import type { Params, PartKind, Recipe } from './types.js';

export const PARAM_KEYS: (keyof Params)[] = ['length', 'bulk', 'ornament', 'detail', 'smoothness', 'wear'];
export const PART_KINDS: PartKind[] = ['receiver', 'barrel', 'muzzle', 'handguard', 'stock', 'grip', 'magazine', 'sight'];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Fill in any params the recipe leaves out, using the style's preferred ranges. */
export function resolveParams(recipe: Recipe): Params {
  const style = getStyle(recipe.style);
  const out = {} as Params;
  for (const key of PARAM_KEYS) {
    const given = recipe.params?.[key];
    if (typeof given === 'number' && Number.isFinite(given)) out[key] = clamp01(given);
    else {
      const [lo, hi] = style.params[key];
      out[key] = Rng.stream(recipe.seed, `param:${key}`).range(lo, hi);
    }
  }
  return out;
}

/** Pick part variants: recipe overrides first, then style weights by seed. */
export function resolveParts(recipe: Recipe): Record<PartKind, string> {
  const style = getStyle(recipe.style);
  const out = {} as Record<PartKind, string>;
  for (const kind of PART_KINDS) {
    const forced = recipe.parts?.[kind];
    if (forced) {
      out[kind] = forced;
      continue;
    }
    if (kind === 'sight') {
      const optic = recipe.optic && recipe.optic !== 'auto' ? recipe.optic : Rng.stream(recipe.seed, 'part:sight').weighted(style.optics);
      out[kind] = optic;
    } else {
      out[kind] = Rng.stream(recipe.seed, `part:${kind}`).weighted(style.parts[kind]);
    }
  }
  return out;
}

export function generate(recipe: Recipe): Weapon {
  if (recipe.archetype !== 'rifle') throw new Error(`Unknown archetype "${recipe.archetype}". Available: rifle`);
  const style = getStyle(recipe.style);
  const params = resolveParams(recipe);
  const parts = resolveParts(recipe);

  const variant =
    recipe.paletteVariant !== undefined
      ? ((recipe.paletteVariant % style.palettes.length) + style.palettes.length) % style.palettes.length
      : Rng.stream(recipe.seed, 'palette').int(0, style.palettes.length - 1);
  const chosenPalette = style.palettes[variant];
  const palette = applyOverrides(applyWear(chosenPalette.materials, params.wear), recipe.palette);

  const builder = new WeaponBuilder();
  const layout = rifleLayout(parts.receiver, params, Rng.stream(recipe.seed, 'layout'));
  const ctx = makeContext(builder, style, params, recipe.seed, layout);
  buildRifle(ctx, parts);

  const weapon: Weapon = {
    recipe: { ...recipe },
    params,
    parts,
    paletteName: chosenPalette.name,
    palette,
    components: builder.list(),
    sockets: builder.sockets,
    finalized: false,
  };
  return finalizeWeapon(weapon, rifleOrigin(ctx));
}
