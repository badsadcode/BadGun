/**
 * A style profile is a design language, independent of weapon archetype.
 * It answers: which part variants fit this world, which colors and
 * materials, and what range of art-direction params feels right.
 *
 * Archetypes ask the style for part variants by kind ("which stock?"), so
 * adding a style never requires touching an archetype, and vice versa.
 */
import type { Palette, Params, PartKind } from '../types.js';

export type Range = [number, number];

export interface StyleProfile {
  id: string;
  name: string;
  description: string;
  /** Named palettes. One is picked by seed unless the recipe chooses. */
  palettes: { name: string; materials: Palette }[];
  /** Preferred param ranges when the recipe leaves a param unset. */
  params: Record<keyof Params, Range>;
  /** Weighted part variants per part kind. */
  parts: Record<PartKind, Record<string, number>>;
  /** Optic weights for optic: "auto". */
  optics: Record<string, number>;
  /** Style flavor switches read by part builders. */
  traits: {
    /** Visible fasteners. */
    rivets: boolean;
    /** Copper/brass piping and gauges. */
    plumbing: boolean;
    /** Glowing strips and cores. */
    glow: boolean;
    /** Accessory rails. */
    rails: boolean;
    /** Base radial segment count for round parts at smoothness 1. */
    roundness: number;
  };
}
