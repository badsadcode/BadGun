/**
 * Crossbows: a tiller (body + flight rail), a prod (the bow), a stock, a
 * grip and an optional optic. Reuses the long-gun stocks, grips and sights.
 */
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { ArchetypeDef, Weights } from './archetype.js';
import { PRODS, TILLERS, stringAndBolt } from '../parts/crossbow.js';
import { STOCKS } from '../parts/stock.js';
import { GRIPS } from '../parts/lower.js';
import { EXTRA_GRIPS, EXTRA_STOCKS } from '../parts/extra.js';
import { VARIETY_STOCKS } from '../parts/variety.js';
import { SCRAP_GRIPS, SCRAP_STOCKS, plankTiller } from '../parts/scrap.js';
import { OPTIC_NAMES, buildOptic } from '../parts/sight.js';

const t = (on: boolean, yes: number, no: number) => (on ? yes : no);

export const crossbow: ArchetypeDef = {
  id: 'crossbow',
  name: 'Crossbow',
  description: 'Crossbows: recurve, compound and energy prods on a tiller.',
  parts: {
    tiller: { ...TILLERS, plank: plankTiller },
    prod: PRODS,
    stock: { ...STOCKS, ...EXTRA_STOCKS, thumbhole: VARIETY_STOCKS.thumbhole, none: VARIETY_STOCKS.none, ...SCRAP_STOCKS },
    grip: { ...GRIPS, ...EXTRA_GRIPS, ...SCRAP_GRIPS },
  },
  optics: ['none', ...OPTIC_NAMES],

  weights(style, kind): Weights | undefined {
    const { rails, plumbing, glow } = style.traits;
    const scrap = !!style.traits.scrap;
    if (kind === 'tiller') return { rail: t(rails, 3, 0.3), wood: t(plumbing, 3, 0.5), sleek: t(glow, 3, 0.3), plank: t(scrap, 4, 0.05) };
    if (kind === 'prod') return { compound: t(rails, 3, 0.3), recurve: t(plumbing, 3, 1), energy: t(glow, 3, 0.2), leafspring: t(scrap, 4, 0.05) };
    if (kind === 'stock') {
      const w = { ...style.parts.stock };
      delete w.wire;
      return w;
    }
    return undefined;
  },

  opticWeights: (style) => ({ ...style.optics, none: 0.5 }),

  layout(_chosen, p, rng): LongGunLayout {
    const { bulk, length } = p;
    const z0 = -0.12, z1 = 0.02;
    const top = 0.026 + bulk * 0.006, bottom = -0.034 - bulk * 0.006;
    const prodZ = z1 + 0.3 + length * 0.14 + rng.range(-0.01, 0.02);
    const trigZ = z0 + 0.07;
    return {
      rec: { z0, z1, top, bottom, width: 0.048 + bulk * 0.008 },
      magwell: { z0: trigZ + 0.03, z1: trigZ + 0.05, y: bottom, flare: false },
      magLength: 0,
      trigger: { z: trigZ, y: bottom + 0.004 },
      grip: { z: trigZ - 0.026, y: bottom + 0.004, angle: 0.3 + rng.range(-0.05, 0.05), length: 0.1 + bulk * 0.015 },
      handguard: { z0: z1, z1: prodZ - 0.03, radius: 0.02 },
      barrel: { z0: z1, z1: prodZ + 0.04, radius: 0.006 },
      stock: { z0, z1: z0 - (0.22 + length * 0.07), drop: rng.range(0, 0.015) },
      mountY: top,
      opticZ: z0 + 0.07,
      extra: {
        prodZ,
        prodY: -0.012,
        span: 0.27 + bulk * 0.05 + length * 0.05,
        latchZ: trigZ + 0.006,
      },
    };
  },

  build(ctx: BuildContext, chosen) {
    for (const kind of ['tiller', 'prod', 'stock', 'grip']) {
      const fn = crossbow.parts[kind][chosen[kind]];
      if (!fn) throw new Error(`Unknown ${kind} variant "${chosen[kind]}". Available: ${Object.keys(crossbow.parts[kind]).join(', ')}`);
      fn(ctx);
    }
    stringAndBolt(ctx);
    buildOptic(ctx, chosen.sight);
    const { L, b } = ctx;
    b.socket({
      name: 'SOCKET_Hand_Grip', parent: 'Grip',
      position: [0, L.grip.y - 0.03 * Math.cos(L.grip.angle), L.grip.z - 0.03 * Math.sin(L.grip.angle) - 0.016],
      forward: [0, 0, 1], description: 'Trigger hand on the grip.',
    });
    b.socket({
      name: 'SOCKET_Hand_Support', parent: 'Tiller',
      position: [0, -0.05, L.rec.z1 + (L.extra.prodZ - L.rec.z1) * 0.45], forward: [0, 0, 1],
      description: 'Support hand under the flight rail.',
    });
  },

  origin: (ctx) => ctx.b.sockets.find((s) => s.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0],
};
