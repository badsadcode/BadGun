/**
 * Shared context handed to every part builder.
 */
import { Rng } from '../core/rng.js';
import { Geometry, Vec2, Vec3, extrudeSide } from '../core/geometry.js';
import type { WeaponBuilder, Component } from '../core/weapon.js';
import type { StyleProfile } from '../styles/style.js';
import type { ArchetypeId, MaterialSlot, Params } from '../types.js';

/**
 * Key dimensions of a long-gun layout, in meters, weapon space.
 * The bore axis is y = 0 and the muzzle points toward +Z.
 */
export interface LongGunLayout {
  /** Receiver span and envelope. */
  rec: { z0: number; z1: number; top: number; bottom: number; width: number };
  /** Magazine well (where the magazine meets the receiver). `flare: false` hides the flared well. */
  magwell: { z0: number; z1: number; y: number; flare?: boolean };
  /** Magazine reach below the magwell. */
  magLength: number;
  /** Trigger pin position. */
  trigger: { z: number; y: number };
  /** Top-front point of the pistol grip, and its rake (radians, backward). */
  grip: { z: number; y: number; angle: number; length: number };
  /** Handguard / forend span and radius. */
  handguard: { z0: number; z1: number; radius: number };
  /** Barrel span and outer radius. */
  barrel: { z0: number; z1: number; radius: number };
  /** Stock: attaches at z0 and the butt ends at z1 (more negative). */
  stock: { z0: number; z1: number; drop: number };
  /** Height of the mounting surface for optics. */
  mountY: number;
  /** Where along Z the optic is centered. */
  opticZ: number;
  /** Archetype-specific extra dimensions (e.g. crossbow prod span). */
  extra: Record<string, number>;
}

export interface BuildContext {
  b: WeaponBuilder;
  archetype: ArchetypeId;
  style: StyleProfile;
  p: Params;
  seed: number | string;
  L: LongGunLayout;
  /** Variants chosen for every part kind (builders may adapt to each other). */
  chosen: Record<string, string>;
  /** Independent random stream for a named purpose. */
  rng(name: string): Rng;
  /** Radial segment count for round parts, scaled by smoothness. */
  seg(scale?: number): number;
  /** Bevel size, or 0 when the look is chunky low-poly. */
  bevel(size: number): number;
}

export function makeContext(
  archetype: ArchetypeId,
  b: WeaponBuilder,
  style: StyleProfile,
  p: Params,
  seed: number | string,
  L: LongGunLayout,
  chosen: Record<string, string> = {},
): BuildContext {
  return {
    archetype,
    b,
    style,
    p,
    seed,
    L,
    chosen,
    rng: (name) => Rng.stream(seed, name),
    seg: (scale = 1) => {
      const base = 5 + (style.traits.roundness - 5) * p.smoothness;
      return Math.max(4, Math.min(48, Math.round(base * scale)));
    },
    bevel: (size) => (p.smoothness < 0.15 ? 0 : size * (0.5 + p.smoothness * 0.5)),
  };
}

/** Shorthand: extrude a side profile and add it to a component slot. */
export function side(
  ctx: BuildContext,
  comp: Component,
  slot: MaterialSlot,
  profile: Vec2[],
  width: number,
  bevel = 0,
  x = 0,
): void {
  ctx.b.add(comp, slot, extrudeSide(profile, { width, bevel: ctx.bevel(bevel), x }));
}

/** Add a pre-built geometry with a transform. */
export function put(
  ctx: BuildContext,
  comp: Component,
  slot: MaterialSlot,
  geo: Geometry,
  t?: Vec3,
  r?: Vec3,
): void {
  if (t || r) geo.transform({ t, r });
  ctx.b.add(comp, slot, geo);
}

/**
 * Build a profile in a rotated frame: `origin` is the anchor, `angle` rotates
 * the frame backward (radians). Points are [down, forward] offsets.
 * Used for raked parts such as pistol grips.
 */
export function raked(origin: Vec2, angle: number, pts: [number, number][]): Vec2[] {
  const d: Vec2 = [-Math.sin(angle), -Math.cos(angle)]; // down and back
  const f: Vec2 = [Math.cos(angle), -Math.sin(angle)]; // forward, perpendicular
  return pts.map(([t, s]) => [origin[0] + d[0] * t + f[0] * s, origin[1] + d[1] * t + f[1] * s]);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
