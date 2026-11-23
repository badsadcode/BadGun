/**
 * The long-gun family: rifle, SMG, shotgun, sniper, LMG.
 *
 * They share one assembly line (receiver -> barrel -> handguard -> muzzle ->
 * stock -> grip -> magazine -> optic -> sockets) and one set of part
 * builders. What makes a shotgun a shotgun is (1) its proportions preset,
 * (2) which variants it allows (pump + tube magazine), and (3) accessories.
 */
import type { Rng } from '../core/rng.js';
import type { Vec3 } from '../core/geometry.js';
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { StyleProfile } from '../styles/style.js';
import type { ArchetypeId, Params } from '../types.js';
import { ArchetypeDef, PartBuilder, Weights, only, without } from './archetype.js';
import { RECEIVERS } from '../parts/receiver.js';
import { GRIPS, MAGAZINES } from '../parts/lower.js';
import { BARRELS, HANDGUARDS, MUZZLES } from '../parts/front.js';
import { STOCKS } from '../parts/stock.js';
import { EXTRA_BARRELS, EXTRA_GRIPS, EXTRA_HANDGUARDS, EXTRA_MAGAZINES, EXTRA_RECEIVERS, EXTRA_STOCKS } from '../parts/extra.js';
import { bipod, boltHandle, carryHandle, sideSaddle } from '../parts/accessory.js';
import { OPTIC_NAMES, buildOptic } from '../parts/sight.js';

export const LONGGUN_PARTS: Record<string, Record<string, PartBuilder>> = {
  receiver: { ...RECEIVERS, ...EXTRA_RECEIVERS },
  barrel: { ...BARRELS, ...EXTRA_BARRELS },
  handguard: { ...HANDGUARDS, ...EXTRA_HANDGUARDS },
  muzzle: MUZZLES,
  stock: { ...STOCKS, ...EXTRA_STOCKS },
  grip: { ...GRIPS, ...EXTRA_GRIPS },
  magazine: { ...MAGAZINES, ...EXTRA_MAGAZINES },
};

/** Proportions per archetype. Values are meters; `L` = length param, `B` = bulk param. */
interface Preset {
  recLen: number;
  handguard: (L: number) => number;
  barrelPastHandguard: (L: number) => number;
  stock: (L: number) => number;
  mag: (B: number) => number;
  barrelRadius: (B: number) => number;
  /** Multiplies receiver height/width. */
  heft: number;
  handguardRadius: (B: number) => number;
}

const PRESETS: Record<string, Preset> = {
  rifle: {
    recLen: 0.27, handguard: (L) => 0.16 + L * 0.2, barrelPastHandguard: (L) => 0.035 + L * 0.12, stock: (L) => 0.24 + L * 0.07,
    mag: (B) => 0.12 + B * 0.06, barrelRadius: (B) => 0.0085 + B * 0.003, heft: 1, handguardRadius: (B) => 0.02 + B * 0.006,
  },
  smg: {
    recLen: 0.22, handguard: (L) => 0.07 + L * 0.08, barrelPastHandguard: (L) => 0.02 + L * 0.05, stock: (L) => 0.17 + L * 0.06,
    mag: (B) => 0.14 + B * 0.05, barrelRadius: (B) => 0.0075 + B * 0.002, heft: 0.92, handguardRadius: (B) => 0.018 + B * 0.005,
  },
  shotgun: {
    recLen: 0.24, handguard: (L) => 0.17 + L * 0.05, barrelPastHandguard: (L) => 0.16 + L * 0.16, stock: (L) => 0.26 + L * 0.06,
    mag: () => 0, barrelRadius: (B) => 0.0105 + B * 0.003, heft: 1.05, handguardRadius: (B) => 0.024 + B * 0.004,
  },
  sniper: {
    recLen: 0.3, handguard: (L) => 0.22 + L * 0.12, barrelPastHandguard: (L) => 0.12 + L * 0.18, stock: (L) => 0.27 + L * 0.06,
    mag: (B) => 0.06 + B * 0.025, barrelRadius: (B) => 0.0095 + B * 0.003, heft: 1.05, handguardRadius: (B) => 0.022 + B * 0.006,
  },
  lmg: {
    recLen: 0.33, handguard: (L) => 0.2 + L * 0.12, barrelPastHandguard: (L) => 0.1 + L * 0.12, stock: (L) => 0.25 + L * 0.05,
    mag: (B) => 0.12 + B * 0.05, barrelRadius: (B) => 0.011 + B * 0.004, heft: 1.15, handguardRadius: (B) => 0.025 + B * 0.006,
  },
};

function longGunLayout(id: string, receiver: string, p: Params, rng: Rng): LongGunLayout {
  const pr = PRESETS[id];
  const { bulk, length } = p;
  const recLen = pr.recLen + bulk * 0.04 + rng.range(-0.012, 0.012);
  const z0 = -0.12;
  const z1 = z0 + recLen;
  const k = pr.heft;

  let top: number, bottom: number, width: number;
  if (receiver === 'cylindrical') {
    top = (0.027 + bulk * 0.01) * k;
    bottom = -top - 0.014;
    width = top * 2;
  } else if (receiver === 'sleek' || receiver === 'faceted') {
    top = (0.03 + bulk * 0.01) * k;
    bottom = (-0.036 - bulk * 0.01) * k;
    width = (0.052 + bulk * 0.012) * k;
  } else {
    top = (0.024 + bulk * 0.006) * k;
    bottom = (-0.03 - bulk * 0.008) * k;
    width = (0.046 + bulk * 0.008) * k;
  }

  const mw0 = z0 + recLen * 0.44;
  const mw1 = mw0 + 0.064 + bulk * 0.008;
  const trigZ = mw0 - 0.03;
  const hgStart = id === 'shotgun' ? z1 + 0.025 : z1;
  const hg1 = hgStart + pr.handguard(length) + rng.range(-0.01, 0.02);
  const barrelEnd = hg1 + pr.barrelPastHandguard(length) + rng.range(0, 0.03);
  const rb = pr.barrelRadius(bulk);

  return {
    rec: { z0, z1, top, bottom, width },
    magwell: { z0: mw0, z1: mw1, y: bottom, flare: id !== 'shotgun' },
    magLength: pr.mag(bulk) + rng.range(-0.01, 0.01),
    trigger: { z: trigZ, y: bottom + 0.004 },
    grip: { z: trigZ - 0.026, y: bottom + 0.004, angle: 0.3 + rng.range(-0.06, 0.06), length: 0.1 + bulk * 0.015 },
    handguard: { z0: hgStart, z1: hg1, radius: pr.handguardRadius(bulk) },
    barrel: { z0: z1 - 0.02, z1: barrelEnd, radius: rb },
    stock: { z0, z1: z0 - (pr.stock(length) + rng.range(-0.01, 0.01)), drop: rng.range(0, 0.02) },
    mountY: top,
    opticZ: z0 + recLen * 0.55,
    extra: id === 'shotgun' ? { tubeR: rb * 1.05, tubeY: -(rb * 2.05 + 0.003), tubeShort: 0, railEnd: z1 - 0.01, beadSight: 1 } : {},
  };
}

function buildLongGun(id: ArchetypeId, ctx: BuildContext, chosen: Record<string, string>): void {
  for (const kind of Object.keys(LONGGUN_PARTS)) {
    const builder = LONGGUN_PARTS[kind][chosen[kind]];
    if (!builder) throw new Error(`Unknown ${kind} variant "${chosen[kind]}". Available: ${Object.keys(LONGGUN_PARTS[kind]).join(', ')}`);
    builder(ctx);
    if (kind === 'receiver') adjustMount(ctx, chosen.receiver);
  }
  buildOptic(ctx, chosen.sight);

  // Archetype accessories.
  const rng = ctx.rng('accessories');
  const roll = rng.next();
  if (id === 'sniper') {
    boltHandle(ctx);
    if (roll < 0.35 + ctx.p.detail * 0.5) bipod(ctx);
  } else if (id === 'lmg') {
    bipod(ctx);
    if (ctx.style.traits.rails && roll < 0.7) carryHandle(ctx);
  } else if (id === 'shotgun') {
    if (roll < 0.25 + ctx.p.detail * 0.6) sideSaddle(ctx);
  }

  const { L, b } = ctx;
  const gripPoint: Vec3 = [0, L.grip.y - 0.03 * Math.cos(L.grip.angle), L.grip.z - 0.03 * Math.sin(L.grip.angle) - 0.016];
  b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Grip', position: gripPoint, forward: [0, 0, 1], description: 'Trigger hand on the pistol grip.' });
  b.socket({
    name: 'SOCKET_Hand_Support',
    parent: 'Handguard',
    position: [0, -L.handguard.radius - 0.012, L.handguard.z0 + (L.handguard.z1 - L.handguard.z0) * 0.55],
    forward: [0, 0, 1],
    description: id === 'shotgun' ? 'Support hand on the pump.' : 'Support hand under the handguard.',
  });
  b.socket({
    name: 'SOCKET_Magazine',
    parent: 'Receiver',
    position: [0, L.rec.bottom, (L.magwell.z0 + L.magwell.z1) / 2],
    forward: [0, -1, 0],
    description: id === 'shotgun' ? 'Loading port: shells go in here.' : 'Magazine well: magazine attaches here, pointing down.',
  });
  b.socket({
    name: 'SOCKET_Eject',
    parent: 'Receiver',
    position: [-L.rec.width / 2 - 0.004, 0.004, L.rec.z0 + (L.rec.z1 - L.rec.z0) * 0.55],
    forward: [-1, 0.3, -0.2],
    description: 'Ejection port on the right side: shell casings / heat vents.',
  });
}

function adjustMount(ctx: BuildContext, receiver: string): void {
  const { L } = ctx;
  if (receiver === 'angular' && ctx.style.traits.rails) L.mountY = L.rec.top + 0.0075;
  if (receiver === 'sleek') L.mountY = L.rec.top + 0.006;
}

function gripOrigin(ctx: BuildContext): Vec3 {
  return ctx.b.sockets.find((x) => x.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0];
}

/** Variants that only make sense on one archetype. */
const SPECIALISTS: Record<string, string[]> = {
  magazine: ['tube', 'ammobox'],
  handguard: ['pump'],
};

function longGun(
  id: ArchetypeId,
  name: string,
  description: string,
  tweak: (style: StyleProfile, kind: string, w: Weights | undefined) => Weights | undefined,
  optics: (style: StyleProfile) => Weights,
): ArchetypeDef {
  return {
    id,
    name,
    description,
    parts: LONGGUN_PARTS,
    optics: ['none', ...OPTIC_NAMES],
    weights: (style, kind) => tweak(style, kind, without(style.parts[kind], SPECIALISTS[kind] ?? [])),
    opticWeights: optics,
    layout: (chosen, p, rng) => longGunLayout(id, chosen.receiver, p, rng),
    build: (ctx, chosen) => buildLongGun(id, ctx, chosen),
    origin: gripOrigin,
  };
}

const keep = (_s: StyleProfile, _k: string, w: Weights | undefined) => w;

export const rifle = longGun('rifle', 'Rifle', 'Assault rifles and carbines.', keep, (s) => s.optics);

export const smg = longGun(
  'smg',
  'SMG',
  'Compact submachine guns: short barrel, long magazine, light stock.',
  (_s, kind, w) => {
    if (kind === 'stock') return { ...w, wire: (w?.wire ?? 0) + 0.6 };
    if (kind === 'muzzle') return { ...w, suppressor: (w?.suppressor ?? 0) + 0.4 };
    if (kind === 'handguard') return without(w, ['cage']) ?? w;
    return w;
  },
  (s) => without(s.optics, ['scope', 'brass']) ?? { irons: 1 },
);

export const shotgun = longGun(
  'shotgun',
  'Shotgun',
  'Pump-action shotguns: tube magazine, sliding forend, big bore.',
  (_s, kind, w) => {
    if (kind === 'magazine') return { tube: 1 };
    if (kind === 'handguard') return { pump: 1 };
    if (kind === 'muzzle') return { ...only(w, ['crown', 'bell', 'brake', 'compensator', 'emitter'], {}), none: 1.2 };
    if (kind === 'barrel') return without(w, ['coiled', 'rails']) ?? w;
    if (kind === 'stock') return without(w, ['wire']) ?? w;
    return w;
  },
  (s) => ({ ...(without(s.optics, ['scope', 'brass']) ?? {}), none: 0.6, irons: 0.6 }),
);

export const sniper = longGun(
  'sniper',
  'Sniper',
  'Bolt-action marksman rifles: long heavy barrel, scope, bipod.',
  (_s, kind, w) => {
    if (kind === 'magazine') return only(w, ['straight', 'cell', 'canister'], { straight: 1 });
    if (kind === 'barrel') return { ...only(w, ['heavy', 'fluted', 'bull', 'banded', 'shrouded', 'rails'], { heavy: 1 }), fluted: 0.8 };
    if (kind === 'muzzle') return { ...(without(w, ['bell', 'flash']) ?? {}), suppressor: 0.6 };
    if (kind === 'stock') return without(w, ['wire', 'collapsible']) ?? w;
    return w;
  },
  (s) => only(s.optics, ['scope', 'brass'], { scope: 1 }),
);

export const lmg = longGun(
  'lmg',
  'LMG',
  'Light machine guns: heavy barrel, big magazine or ammo box, bipod.',
  (_s, kind, w) => {
    if (kind === 'magazine') return { ...only(w, ['drum', 'canister', 'cell'], {}), ammobox: 1 };
    if (kind === 'barrel') return { ...(without(w, ['fluted']) ?? {}), heavy: 1 };
    if (kind === 'stock') return without(w, ['wire']) ?? w;
    return w;
  },
  (s) => without(s.optics, ['scope']) ?? { irons: 1 },
);

export { PRESETS as LONGGUN_PRESETS };
