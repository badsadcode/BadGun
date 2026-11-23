/**
 * generate(recipe) -> Weapon. The single entry point for building an asset.
 */
import { Rng } from './core/rng.js';
import { WeaponBuilder, finalizeWeapon, type Weapon } from './core/weapon.js';
import { applyOverrides, applyWear } from './materials/palette.js';
import { getStyle } from './styles/index.js';
import { makeContext } from './parts/context.js';
import { ROOT_NAMES, getArchetype, partKinds } from './archetypes/index.js';
import type { Params, PartKind, Recipe } from './types.js';

export const PARAM_KEYS: (keyof Params)[] = ['length', 'bulk', 'ornament', 'detail', 'smoothness', 'wear'];
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

/**
 * Pick part variants. Priority: recipe override > style.byArchetype >
 * archetype rules (which may read the style) > style generic weights >
 * every variant equally.
 */
export function resolveParts(recipe: Recipe): Record<PartKind, string> {
  const style = getStyle(recipe.style);
  const arch = getArchetype(recipe.archetype);
  const out: Record<PartKind, string> = {};
  for (const kind of partKinds(arch.id)) {
    const forced = recipe.parts?.[kind];
    if (forced) {
      out[kind] = forced;
      continue;
    }
    const rng = Rng.stream(recipe.seed, `part:${kind}`);
    if (kind === 'sight') {
      out[kind] = recipe.optic && recipe.optic !== 'auto' ? recipe.optic : rng.weighted(usable(style.byArchetype?.[arch.id]?.sight ?? arch.opticWeights(style), arch.optics));
      continue;
    }
    const table = arch.parts[kind];
    const weights = style.byArchetype?.[arch.id]?.[kind] ?? arch.weights(style, kind) ?? style.parts[kind];
    const ok = usable(weights, Object.keys(table));
    out[kind] = rng.weighted(ok);
  }
  return out;
}

/** Drop unknown/zero-weight variants; fall back to uniform if nothing is left. */
function usable(weights: Record<string, number> | undefined, available: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights ?? {})) if (available.includes(k) && v > 0) out[k] = v;
  if (Object.keys(out).length) return out;
  return Object.fromEntries(available.map((k) => [k, 1]));
}

export function generate(recipe: Recipe): Weapon {
  const arch = getArchetype(recipe.archetype);
  const style = getStyle(recipe.style);
  const params = resolveParams(recipe);
  const parts = resolveParts(recipe);

  const variant =
    recipe.paletteVariant !== undefined
      ? ((recipe.paletteVariant % style.palettes.length) + style.palettes.length) % style.palettes.length
      : Rng.stream(recipe.seed, 'palette').int(0, style.palettes.length - 1);
  const chosenPalette = style.palettes[variant];
  const palette = applyOverrides(applyWear(chosenPalette.materials, params.wear), recipe.palette);

  const builder = new WeaponBuilder(ROOT_NAMES[arch.id] ?? 'Receiver');
  const layout = arch.layout(parts, params, Rng.stream(recipe.seed, 'layout'), style);
  const ctx = makeContext(arch.id, builder, style, params, recipe.seed, layout);
  arch.build(ctx, parts);

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
  return finalizeWeapon(weapon, arch.origin(ctx));
}
