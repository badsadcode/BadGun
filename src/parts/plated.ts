/**
 * Sci-fi shape language: layered plated bodies and loop grips (the grip
 * reconnects to the body, forming a closed hand loop).
 */
import { Vec2, box } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import { BuildContext, put, raked, side } from './context.js';
import { triggerAndGuard } from './receiver.js';

/** Plated: a dark core with stacked, offset armor plates and glowing slots. */
const plated: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'plated', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const rng = ctx.rng('receiver');
  const k = rng.range(0.3, 0.6);
  // Core block.
  side(ctx, rec, 'Detail', [
    [z0, bottom + 0.01], [z0 + 0.012, bottom], [L.magwell.z0 - 0.004, bottom], [L.magwell.z0 - 0.004, bottom - 0.008],
    [L.magwell.z1 + 0.006, bottom - 0.008], [z1 - 0.01, bottom + 0.004], [z1 + 0.008, -0.004], [z1, top - 0.006], [z0, top - 0.006],
  ], w, 0.002);
  // Big side plate (angled front), slightly proud of the core.
  const mid = bottom + (top - bottom) * k;
  side(ctx, rec, 'Body', [
    [z0 + 0.01, bottom + 0.006], [z1 - 0.04, bottom + 0.006], [z1 + 0.004, mid], [z1 - 0.012, top - 0.004], [z0 + 0.03, top - 0.004], [z0 + 0.01, top - 0.016],
  ], w + 0.006, 0.0025);
  // Top plate, narrower and offset forward.
  side(ctx, rec, 'Trim', [[z0 + 0.04, top - 0.008], [z1 - 0.02, top - 0.008], [z1 - 0.004, top + 0.002], [z1 - 0.03, top + 0.009], [z0 + 0.06, top + 0.009]], w * 0.72, 0.002);
  // Glowing slots and panel cut-lines.
  const glow = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  const n = 2 + Math.round(p.detail * 3);
  for (let i = 0; i < n; i++) {
    put(ctx, rec, glow, box([0, mid - 0.006 - i * 0.006, z0 + 0.05], [w + 0.0072, 0.0022, 0.02 + i * 0.008]));
  }
  put(ctx, rec, 'Detail', box([0, (mid + top) / 2, (z0 + z1) / 2 + 0.03], [w + 0.0068, 0.0012, (z1 - z0) * 0.45]));
  L.mountY = top + 0.009;
  triggerAndGuard(ctx, 'Body', 'square');
};

export const PLATED_RECEIVERS: Record<string, PartBuilder> = { plated };

/** Loop grip: the grip's bottom sweeps forward and back up into the body. */
const loop: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'loop', pivot: [0, L.grip.y, L.grip.z] });
  const D = 0.032 + p.bulk * 0.006, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', raked(o, L.grip.angle, [[-0.006, 0.002], [Lg, 0.004], [Lg + 0.008, -0.004], [Lg + 0.004, -D], [-0.004, -D - 0.006], [-0.008, -D * 0.5]]), 0.028, 0.004);
  // The bar running forward from the bottom of the grip back up to the body.
  const [bz, by] = raked(o, L.grip.angle, [[Lg - 0.004, 0.006]])[0];
  const frontZ = L.magwell.z0 > L.grip.z ? L.magwell.z0 - 0.004 : L.trigger.z + 0.07;
  const y0 = L.rec.bottom;
  const t = 0.01;
  side(ctx, g, 'Grip', [[bz - 0.004, by - 0.002], [frontZ - 0.012, by + 0.012], [frontZ, y0 + 0.002], [frontZ - t, y0 + 0.002], [frontZ - t - 0.006, by + 0.012 + t], [bz, by + t]], 0.02, 0.003);
  if (ctx.style.traits.glow) {
    side(ctx, g, 'Emissive', [[bz + 0.006, by + 0.003], [frontZ - 0.014, by + 0.014], [frontZ - 0.014, by + 0.016], [bz + 0.006, by + 0.005]], 0.0215);
  }
};

export const PLATED_GRIPS: Record<string, PartBuilder> = { loop };

/** Exposed so pistols can reuse the plate look. */
export function platedBlock(ctx: BuildContext, c: ReturnType<BuildContext['b']['component']>, z0: number, z1: number, yTop: number, yBot: number, w: number): void {
  side(ctx, c, 'Body', [[z0, yBot], [z1, yBot], [z1 + 0.006, (yTop + yBot) / 2], [z1, yTop], [z0 + 0.01, yTop], [z0, yTop - 0.01]], w, 0.003);
  side(ctx, c, 'Trim', [[z0 + 0.02, yTop - 0.004], [z1 - 0.01, yTop - 0.004], [z1 - 0.004, yTop + 0.006], [z0 + 0.03, yTop + 0.006]], w * 0.7, 0.0015);
}
