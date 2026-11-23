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
import { bipod, boltHandle, carryHandle, foregrip, sideSaddle } from '../parts/accessory.js';
import { PLATED_GRIPS, PLATED_RECEIVERS } from '../parts/plated.js';
import { OPTIC_NAMES, buildOptic } from '../parts/sight.js';
import { VARIETY_BARRELS, VARIETY_GRIPS, VARIETY_HANDGUARDS, VARIETY_MAGAZINES, VARIETY_STOCKS } from '../parts/variety.js';
import { FANTASY_BARRELS, FANTASY_GRIPS, FANTASY_HANDGUARDS, FANTASY_MAGAZINES, FANTASY_RECEIVERS, FANTASY_STOCKS } from '../parts/fantasy.js';
import { SCRAP_BARRELS, SCRAP_GRIPS, SCRAP_HANDGUARDS, SCRAP_MAGAZINES, SCRAP_RECEIVERS, SCRAP_STOCKS } from '../parts/scrap.js';

/** "config" is the overall layout: standard, or bullpup (magazine behind the grip). */
const noop: PartBuilder = () => {};

export const LONGGUN_PARTS: Record<string, Record<string, PartBuilder>> = {
  config: { standard: noop, bullpup: noop, lever: noop, machinepistol: noop, boxfed: noop },
  receiver: { ...RECEIVERS, ...EXTRA_RECEIVERS, ...SCRAP_RECEIVERS, ...FANTASY_RECEIVERS, ...PLATED_RECEIVERS },
  barrel: { ...BARRELS, ...EXTRA_BARRELS, ...VARIETY_BARRELS, ...SCRAP_BARRELS, ...FANTASY_BARRELS },
  handguard: { ...HANDGUARDS, ...EXTRA_HANDGUARDS, ...VARIETY_HANDGUARDS, ...SCRAP_HANDGUARDS, ...FANTASY_HANDGUARDS },
  muzzle: MUZZLES,
  stock: { ...STOCKS, ...EXTRA_STOCKS, ...VARIETY_STOCKS, ...SCRAP_STOCKS, ...FANTASY_STOCKS },
  grip: { ...GRIPS, ...EXTRA_GRIPS, ...SCRAP_GRIPS, ...FANTASY_GRIPS, ...VARIETY_GRIPS, ...PLATED_GRIPS },
  magazine: { ...MAGAZINES, ...EXTRA_MAGAZINES, ...VARIETY_MAGAZINES, ...SCRAP_MAGAZINES, ...FANTASY_MAGAZINES },
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

/**
 * Proportions. Besides the archetype preset and the length/bulk params, each
 * weapon gets its own seeded "shape genes" (receiver length and height, grip
 * rake, magazine position, handguard vs. bare barrel, stock drop...), so two
 * rifles from the same style don't come out as twins.
 */
function longGunLayout(id: string, chosen: Record<string, string>, p: Params, rng: Rng): LongGunLayout {
  const pr = PRESETS[id];
  const { bulk, length } = p;
  const g = (lo: number, hi: number) => rng.range(lo, hi);
  const receiver = chosen.receiver;
  const bullpup = chosen.config === 'bullpup';
  const lever = chosen.config === 'lever';
  const machinePistol = chosen.config === 'machinepistol';
  const breakAction = chosen.magazine === 'none';
  const sawedOff = chosen.stock === 'none' && id === 'shotgun';

  // Shape genes.
  const recK = g(0.82, 1.22), hK = g(0.86, 1.24), magFrac = g(0.34, 0.56), hgK = g(0.65, 1.35);
  const bareK = g(0.45, 1.7), stockK = g(0.85, 1.15), rbK = g(0.85, 1.2), magK = g(0.85, 1.25);

  let recLen = (pr.recLen + bulk * 0.04) * recK;
  if (bullpup) recLen += 0.16;
  if (lever) recLen *= 0.78;
  if (machinePistol) recLen *= 0.8;
  if (breakAction) recLen *= 0.62;
  const z0 = -0.12;
  const z1 = z0 + recLen;
  const k = pr.heft;

  let top: number, bottom: number, width: number;
  if (receiver === 'cylindrical' || receiver === 'pipe') {
    // round bodies: height == half width
    top = (0.027 + bulk * 0.01) * k * hK;
    bottom = -top - 0.014;
    width = top * 2;
  } else if (receiver === 'sleek' || receiver === 'faceted') {
    top = (0.03 + bulk * 0.01) * k * hK;
    bottom = (-0.036 - bulk * 0.01) * k * hK;
    width = (0.052 + bulk * 0.012) * k;
  } else {
    top = (0.024 + bulk * 0.006) * k * hK;
    bottom = (-0.03 - bulk * 0.008) * k * hK;
    width = (0.046 + bulk * 0.008) * k;
  }

  let trigZ: number, mw0: number, mw1: number;
  const magDepth = 0.064 + bulk * 0.008;
  // Bullpups hold the grip more upright, with the magazine just behind it.
  // Machine pistols feed through a nearly vertical grip.
  const gripAngle = bullpup ? g(0.08, 0.22) : machinePistol ? g(0.0, 0.08) : g(0.16, 0.46);
  const gripLen = (0.1 + bulk * 0.015) * g(0.92, 1.1);
  if (bullpup) {
    trigZ = z0 + recLen * 0.7;
    mw1 = trigZ - 0.026 - 0.04 - gripLen * Math.sin(gripAngle) - 0.012;
    mw0 = mw1 - magDepth;
  } else if (machinePistol) {
    trigZ = z0 + recLen * 0.55;
    mw1 = trigZ - 0.026 - 0.006;
    mw0 = mw1 - 0.03;
  } else if (breakAction || lever) {
    trigZ = z0 + recLen * 0.6;
    mw0 = trigZ + 0.03;
    mw1 = mw0 + 0.02;
  } else {
    mw0 = z0 + recLen * magFrac;
    mw1 = mw0 + magDepth;
    trigZ = mw0 - 0.03;
  }
  const tubeFed = chosen.magazine === 'tube';
  const hgStart = id === 'shotgun' && tubeFed && !lever ? z1 + 0.025 : z1;
  let hgLen = pr.handguard(length) * hgK, bare = pr.barrelPastHandguard(length) * bareK;
  if (sawedOff) {
    hgLen *= 0.8;
    bare *= 0.25;
  }
  const hg1 = hgStart + hgLen + rng.range(-0.01, 0.02);
  const barrelEnd = hg1 + bare + rng.range(0, 0.03);
  const rb = pr.barrelRadius(bulk) * rbK;
  const gripZ = trigZ - 0.026;
  const boxMag = !['tube', 'none', 'pan'].includes(chosen.magazine);

  return {
    rec: { z0, z1, top, bottom, width },
    magwell: { z0: mw0, z1: mw1, y: bottom, flare: boxMag && !machinePistol && !(id === 'shotgun' && !chosen.config.startsWith('box')) },
    magLength: machinePistol ? gripLen + g(0.05, 0.11) : pr.mag(bulk) * magK,
    trigger: { z: trigZ, y: bottom + 0.004 },
    grip: { z: gripZ, y: bottom + 0.004, angle: gripAngle, length: gripLen },
    handguard: { z0: hgStart, z1: hg1, radius: pr.handguardRadius(bulk) * g(0.9, 1.15) },
    barrel: { z0: z1 - 0.02, z1: barrelEnd, radius: rb },
    stock: { z0, z1: z0 - pr.stock(length) * stockK, drop: g(0, 0.04) },
    mountY: top,
    opticZ: bullpup ? gripZ + 0.03 : z0 + recLen * 0.55,
    extra: tubeFed
      ? { tubeR: rb * (lever ? 0.9 : 1.05), tubeY: -(rb * (lever ? 1.9 : 2.05) + 0.003), tubeShort: lever ? g(0, 0.08) : 0, railEnd: z1 - 0.01, beadSight: id === 'shotgun' ? 1 : 0 }
      : breakAction ? { beadSight: 1, railEnd: z1 - 0.01 } : {},
  };
}

/** Keep linked choices consistent (double barrels -> break action, bullpup -> butt stock...). */
function longGunFixup(id: string, chosen: Record<string, string>, forced: Set<string>): void {
  const set = (k: string, v: string) => {
    if (!forced.has(k)) chosen[k] = v;
  };
  const breakAction = chosen.barrel === 'double' || chosen.barrel === 'overunder';
  // A one-piece stock replaces grip + handguard; it can't be a bullpup or wrap double barrels.
  if (chosen.stock === 'sporter') {
    if (breakAction || chosen.config === 'bullpup') set('stock', breakAction ? 'classic' : 'butt');
    else {
      set('handguard', 'bare');
      set('grip', 'integral');
    }
  } else {
    if (chosen.handguard === 'bare') set('handguard', 'slim');
    if (chosen.grip === 'integral') set('grip', 'polymer');
  }
  // Which layouts each archetype supports.
  const allowed: Record<string, string[]> = { rifle: ['standard', 'bullpup', 'lever'], smg: ['standard', 'bullpup', 'machinepistol'], shotgun: ['standard', 'bullpup', 'lever', 'boxfed'], sniper: ['standard', 'bullpup'], lmg: ['standard', 'bullpup'] };
  if (!(allowed[id] ?? ['standard']).includes(chosen.config)) set('config', 'standard');
  if (breakAction) {
    set('magazine', 'none');
    set('handguard', 'splinter');
    set('muzzle', 'none');
    set('config', 'standard');
  } else if (chosen.config === 'lever') {
    set('magazine', 'tube');
    if (!['forend', 'filigree', 'slim', 'plank', 'taped', 'cage'].includes(chosen.handguard)) set('handguard', id === 'shotgun' ? 'forend' : 'slim');
    if (['butt', 'collapsible', 'sporter', 'wire', 'thumbhole'].includes(chosen.stock)) set('stock', 'classic');
    if (chosen.grip === 'integral') set('grip', 'wood');
  } else if (chosen.config === 'boxfed') {
    if (['tube', 'none', 'pan', 'ammobox'].includes(chosen.magazine)) set('magazine', 'straight');
    if (['pump', 'splinter', 'bare'].includes(chosen.handguard)) set('handguard', 'slim');
  } else if (id === 'shotgun') {
    set('magazine', 'tube');
    set('handguard', 'pump');
  } else {
    if (chosen.magazine === 'none' || chosen.magazine === 'tube') set('magazine', 'straight');
    if (chosen.handguard === 'splinter' || chosen.handguard === 'pump') set('handguard', 'slim');
  }
  if (chosen.config === 'machinepistol') {
    if (chosen.magazine !== 'straight') set('magazine', 'straight');
    if (!['wire', 'collapsible', 'none', 'skeletal', 'pipe', 'frame'].includes(chosen.stock)) set('stock', 'wire');
  }
  if (id === 'shotgun' && chosen.stock === 'sporter') set('stock', 'fixed');
  // Final pass: earlier rules may have swapped the stock, so re-check the one-piece pairing.
  if (chosen.stock !== 'sporter') {
    if (chosen.handguard === 'bare') set('handguard', 'slim');
    if (chosen.grip === 'integral') set('grip', 'polymer');
  }
  // Loop grips don't hold a magazine and would hide a lever's finger loop.
  if (chosen.grip === 'loop' && (chosen.config === 'machinepistol' || chosen.config === 'lever')) set('grip', chosen.config === 'lever' ? 'wood' : 'polymer');
  if (chosen.config === 'bullpup') {
    set('stock', 'butt');
    if (chosen.magazine === 'pan') set('magazine', 'straight');
  } else if (chosen.stock === 'butt') set('stock', 'fixed');
  if (chosen.magazine === 'pan') set('sight', 'none');
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
    if (ctx.style.traits.rails && roll < 0.7 && ctx.chosen.magazine !== 'pan') carryHandle(ctx);
  } else if (id === 'shotgun') {
    if (roll < 0.25 + ctx.p.detail * 0.6) sideSaddle(ctx);
  }

  // Vertical foregrip on suitable handguards.
  let support: Vec3 | null = null;
  const fgOk = ['railed', 'quad', 'slim', 'shell', 'jacket', 'taped'].includes(chosen.handguard) && id !== 'lmg' && !(id === 'shotgun' && chosen.config !== 'boxfed');
  const t = ctx.style.traits;
  const fgChance = (t.rails ? 0.45 : t.glow ? 0.3 : t.scrap ? 0.2 : 0.05) * (id === 'smg' ? 1.4 : 1);
  if (fgOk && rng.next() < fgChance) support = foregrip(ctx);

  const { L, b } = ctx;
  const gripPoint: Vec3 = [0, L.grip.y - 0.03 * Math.cos(L.grip.angle), L.grip.z - 0.03 * Math.sin(L.grip.angle) - 0.016];
  b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Grip', position: gripPoint, forward: [0, 0, 1], description: 'Trigger hand on the pistol grip.' });
  b.socket({
    name: 'SOCKET_Hand_Support',
    parent: 'Handguard',
    position: support ?? [0, -L.handguard.radius - 0.012, L.handguard.z0 + (L.handguard.z1 - L.handguard.z0) * 0.55],
    forward: [0, 0, 1],
    description: support ? 'Support hand on the vertical foregrip.' : id === 'shotgun' ? 'Support hand on the pump.' : 'Support hand under the handguard.',
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
  magazine: ['tube', 'ammobox', 'none'],
  handguard: ['pump', 'splinter', 'bare'],
  stock: ['butt'],
  grip: ['integral'],
};

/** How likely each archetype is to come out as a bullpup (times a style factor). */
const BULLPUP_AFFINITY: Record<string, number> = { rifle: 1, smg: 1, sniper: 0.6, lmg: 0.3, shotgun: 0.4 };

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
    weights: (style, kind) => {
      if (kind === 'config') {
        const t = style.traits;
        const base = t.glow ? 0.5 : t.rails ? 0.3 : t.scrap ? 0.05 : 0.08;
        const lever = t.plumbing || t.magic ? 0.35 : t.scrap ? 0.2 : t.rails ? 0.08 : 0.04;
        const mp = t.rails || t.scrap ? 0.4 : t.glow ? 0.2 : 0.12;
        const box = t.rails || t.glow ? 0.5 : t.scrap ? 0.25 : 0.1;
        return {
          standard: 1,
          bullpup: base * (BULLPUP_AFFINITY[id] ?? 0),
          lever: id === 'rifle' ? lever : id === 'shotgun' ? lever * 0.5 : 0,
          machinepistol: id === 'smg' ? mp : 0,
          boxfed: id === 'shotgun' ? box : 0,
        };
      }
      return tweak(style, kind, without(style.parts[kind], SPECIALISTS[kind] ?? []));
    },
    opticWeights: optics,
    layout: (chosen, p, rng) => longGunLayout(id, chosen, p, rng),
    fixup: (chosen, forced) => longGunFixup(id, chosen, forced),
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
    if (kind === 'barrel') return { ...(without(w, ['double', 'overunder']) ?? {}), finned: (w?.finned ?? 0) + 0.3 };
    if (kind === 'magazine') return without(w, ['pan']) ?? w;
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
    if (kind === 'barrel') return { ...(without(w, ['coiled', 'rails', 'finned']) ?? {}), double: 0.9, overunder: 0.6 };
    if (kind === 'stock') return { ...(without(w, ['wire', 'sporter']) ?? {}), none: (w?.none ?? 0) + 0.15 };
    return w;
  },
  (s) => ({ ...(without(s.optics, ['scope', 'brass']) ?? {}), none: 0.6, irons: 0.6 }),
);

export const sniper = longGun(
  'sniper',
  'Sniper',
  'Bolt-action marksman rifles: long heavy barrel, scope, bipod.',
  (_s, kind, w) => {
    if (kind === 'magazine') return only(w, ['straight', 'cell', 'canister', 'crystal'], { straight: 1 });
    if (kind === 'barrel') return { ...only(w, ['heavy', 'fluted', 'bull', 'banded', 'shrouded', 'rails'], { heavy: 1 }), fluted: 0.8 };
    if (kind === 'muzzle') return { ...(without(w, ['bell', 'flash']) ?? {}), suppressor: 0.6, heavybrake: _s.traits.rails ? 0.6 : 0.15 };
    if (kind === 'stock') return { ...(without(w, ['wire', 'collapsible']) ?? {}), sporter: 1.4 };
    return w;
  },
  (s) => only(s.optics, ['scope', 'brass', 'rune'], { scope: 1 }),
);

export const lmg = longGun(
  'lmg',
  'LMG',
  'Light machine guns: heavy barrel, big magazine or ammo box, bipod.',
  (_s, kind, w) => {
    if (kind === 'magazine') return { ...only(w, ['drum', 'canister', 'cell', 'can', 'orb', 'crystal'], {}), ammobox: 1, pan: 0.5 };
    if (kind === 'handguard') return { ...w, jacket: (w?.jacket ?? 0) + 0.7 };
    if (kind === 'barrel') return { ...(without(w, ['fluted', 'double', 'overunder']) ?? {}), heavy: 1 };
    if (kind === 'stock') return without(w, ['wire', 'sporter']) ?? w;
    return w;
  },
  (s) => without(s.optics, ['scope']) ?? { irons: 1 },
);

export { PRESETS as LONGGUN_PRESETS };
