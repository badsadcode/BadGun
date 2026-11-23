/**
 * Rifle / carbine archetype.
 *
 * The archetype owns *proportions and assembly order*; the style owns *which
 * part variants and materials*. That split is what lets one rifle layout
 * read as modern, steampunk or sci-fi.
 */
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import { Rng } from '../core/rng.js';
import type { Params } from '../types.js';
import { RECEIVERS, PartBuilder } from '../parts/receiver.js';
import { GRIPS, MAGAZINES } from '../parts/lower.js';
import { BARRELS, HANDGUARDS, MUZZLES } from '../parts/front.js';
import { STOCKS } from '../parts/stock.js';
import { buildOptic } from '../parts/sight.js';
import type { PartKind } from '../types.js';

export const RIFLE_PARTS: Record<Exclude<PartKind, 'sight'>, Record<string, PartBuilder>> = {
  receiver: RECEIVERS,
  barrel: BARRELS,
  muzzle: MUZZLES,
  handguard: HANDGUARDS,
  stock: STOCKS,
  grip: GRIPS,
  magazine: MAGAZINES,
};

/** Proportions, driven by params and a seeded stream. */
export function rifleLayout(receiver: string, p: Params, rng: Rng): LongGunLayout {
  const { bulk, length } = p;
  const recLen = 0.27 + bulk * 0.04 + rng.range(-0.012, 0.012);
  const z0 = -0.12;
  const z1 = z0 + recLen;

  let top: number, bottom: number, width: number;
  if (receiver === 'cylindrical') {
    top = 0.027 + bulk * 0.01;
    bottom = -top - 0.014;
    width = top * 2;
  } else if (receiver === 'sleek') {
    top = 0.03 + bulk * 0.01;
    bottom = -0.036 - bulk * 0.01;
    width = 0.052 + bulk * 0.012;
  } else {
    top = 0.024 + bulk * 0.006;
    bottom = -0.03 - bulk * 0.008;
    width = 0.046 + bulk * 0.008;
  }

  const mw0 = z0 + recLen * 0.44;
  const mw1 = mw0 + 0.064 + bulk * 0.008;
  const trigZ = mw0 - 0.03;
  const hg0 = z1;
  const hg1 = z1 + 0.16 + length * 0.2 + rng.range(-0.01, 0.02);
  const barrelEnd = hg1 + 0.035 + length * 0.12 + rng.range(0, 0.03);

  return {
    rec: { z0, z1, top, bottom, width },
    magwell: { z0: mw0, z1: mw1, y: bottom },
    magLength: 0.12 + bulk * 0.06 + rng.range(-0.01, 0.01),
    trigger: { z: trigZ, y: bottom + 0.004 },
    grip: { z: trigZ - 0.026, y: bottom + 0.004, angle: 0.3 + rng.range(-0.06, 0.06), length: 0.1 + bulk * 0.015 },
    handguard: { z0: hg0, z1: hg1, radius: 0.02 + bulk * 0.006 },
    barrel: { z0: z1 - 0.02, z1: barrelEnd, radius: 0.0085 + bulk * 0.003 },
    stock: { z0, z1: z0 - (0.24 + length * 0.07 + rng.range(-0.01, 0.01)), drop: rng.range(0, 0.02) },
    mountY: top,
    opticZ: z0 + recLen * 0.55,
  };
}

/** Assemble the rifle. `chosen` holds the part variant for every kind. */
export function buildRifle(ctx: BuildContext, chosen: Record<PartKind, string>): void {
  const order: Exclude<PartKind, 'sight'>[] = ['receiver', 'barrel', 'handguard', 'muzzle', 'stock', 'grip', 'magazine'];
  for (const kind of order) {
    const builder = RIFLE_PARTS[kind][chosen[kind]];
    if (!builder) {
      throw new Error(`Unknown ${kind} variant "${chosen[kind]}". Available: ${Object.keys(RIFLE_PARTS[kind]).join(', ')}`);
    }
    builder(ctx);
    if (kind === 'receiver') adjustMount(ctx, chosen.receiver);
  }
  buildOptic(ctx, chosen.sight);

  const { L, b } = ctx;
  const gripPoint: [number, number, number] = [0, L.grip.y - 0.03 * Math.cos(L.grip.angle), L.grip.z - 0.03 * Math.sin(L.grip.angle) - 0.016];
  b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Grip', position: gripPoint, forward: [0, 0, 1], description: 'Trigger hand on the pistol grip.' });
  b.socket({
    name: 'SOCKET_Hand_Support',
    parent: 'Handguard',
    position: [0, -L.handguard.radius - 0.012, L.handguard.z0 + (L.handguard.z1 - L.handguard.z0) * 0.55],
    forward: [0, 0, 1],
    description: 'Support hand under the handguard.',
  });
  b.socket({
    name: 'SOCKET_Magazine',
    parent: 'Receiver',
    position: [0, L.rec.bottom, (L.magwell.z0 + L.magwell.z1) / 2],
    forward: [0, -1, 0],
    description: 'Magazine well: magazine attaches here, pointing down.',
  });
  b.socket({
    name: 'SOCKET_Eject',
    parent: 'Receiver',
    position: [-L.rec.width / 2 - 0.004, 0.004, L.rec.z0 + (L.rec.z1 - L.rec.z0) * 0.55],
    forward: [-1, 0.3, -0.2],
    description: 'Ejection port on the right side: shell casings / heat vents.',
  });
}

/** Some receivers are taller than the layout's base envelope; keep optics on top. */
function adjustMount(ctx: BuildContext, receiver: string): void {
  const { L } = ctx;
  if (receiver === 'angular' && ctx.style.traits.rails) L.mountY = L.rec.top + 0.0075;
  if (receiver === 'sleek') L.mountY = L.rec.top + 0.006;
}

/** Where the asset origin goes: the trigger hand on the grip. */
export function rifleOrigin(ctx: BuildContext): [number, number, number] {
  const s = ctx.b.sockets.find((x) => x.name === 'SOCKET_Hand_Grip');
  return s ? s.position : [0, 0, 0];
}
