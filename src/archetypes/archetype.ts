/**
 * An archetype is a *kind of weapon* (rifle, pistol, crossbow...). It owns
 * proportions, which part kinds exist, how they're assembled, and where the
 * origin goes. Styles decide which variants and colors; archetypes decide
 * what a "shotgun" is.
 */
import type { Rng } from '../core/rng.js';
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { StyleProfile } from '../styles/style.js';
import type { ArchetypeId, Params } from '../types.js';
import type { Vec3 } from '../core/geometry.js';

export type PartBuilder = (ctx: BuildContext) => void;
export type Weights = Record<string, number>;

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  description: string;
  /** Builder tables per part kind (not including "sight"). Order = build order. */
  parts: Record<string, Record<string, PartBuilder>>;
  /** Optics this archetype can mount ("none" is always allowed). */
  optics: string[];
  /**
   * Variant weights for a kind, given the style. Used when the style has no
   * explicit `byArchetype` entry. Return undefined to fall back to the style's
   * generic weights, then to "all variants equally".
   */
  weights(style: StyleProfile, kind: string): Weights | undefined;
  /** Optic weights for optic: "auto". */
  opticWeights(style: StyleProfile): Weights;
  layout(chosen: Record<string, string>, p: Params, rng: Rng, style: StyleProfile): LongGunLayout;
  /** Build everything (parts, accessories, sockets). */
  build(ctx: BuildContext, chosen: Record<string, string>): void;
  /** Weapon-space point that becomes the asset origin. */
  origin(ctx: BuildContext): Vec3;
}

/** Keep only the listed variants (with the style's weights); fall back if none survive. */
export function only(w: Weights | undefined, allowed: string[], fallback: Weights): Weights {
  const out: Weights = {};
  for (const [k, v] of Object.entries(w ?? {})) if (allowed.includes(k)) out[k] = v;
  return Object.keys(out).length ? out : fallback;
}

/** Remove variants from a weight table. */
export function without(w: Weights | undefined, banned: string[]): Weights | undefined {
  if (!w) return w;
  const out: Weights = {};
  for (const [k, v] of Object.entries(w)) if (!banned.includes(k)) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}
