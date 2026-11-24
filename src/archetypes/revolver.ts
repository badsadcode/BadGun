/**
 * Revolvers: a frame with a window for a turning cylinder, a barrel, a grip
 * and an exposed (or shrouded) hammer.
 *
 * Variants come from style traits like pistols do, mapped to a "flavor"
 * (modern, steam, scifi, cyber, diesel, scrap, magic, or an era), so a new
 * style still gets sensible revolvers. Swing-out frames reload by moving the
 * `Crane`, top-breaks by hinging the `Barrel` assembly (cylinder included).
 */
import type { Vec3 } from '../core/geometry.js';
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { StyleProfile } from '../styles/style.js';
import type { ArchetypeDef, Weights } from './archetype.js';
import { CHAMBERS, REVOLVER_BARRELS, REVOLVER_CYLINDERS, REVOLVER_FRAMES, REVOLVER_GRIPS, REVOLVER_HAMMERS } from '../parts/revolver.js';
import { buildOptic } from '../parts/sight.js';

type Flavor = 'modern' | 'steam' | 'scifi' | 'cyber' | 'diesel' | 'scrap' | 'magic' | 'ww1' | 'ww2' | 'vietnam';

function flavor(style: StyleProfile): Flavor {
  const t = style.traits;
  if (t.era) return t.era < 1930 ? 'ww1' : t.era < 1955 ? 'ww2' : 'vietnam';
  if (t.cyber) return 'cyber';
  if (t.diesel) return 'diesel';
  if (t.scrap) return 'scrap';
  if (t.magic) return 'magic';
  if (t.plumbing) return 'steam';
  if (t.glow) return 'scifi';
  return 'modern';
}

/** Variant weights per part kind and flavor. */
const TABLE: Record<string, Record<Flavor, Weights>> = {
  frame: {
    modern: { service: 2.5, magnum: 2.5, snub: 2 },
    steam: { classic: 2, pepperbox: 2, topbreak: 2 },
    scifi: { coil: 3, heavy: 3, magnum: 0.3 },
    cyber: { smart: 3, magnum: 1.5, coil: 0.4 },
    diesel: { deco: 3, magnum: 1.5, service: 0.4 },
    scrap: { junk: 4, classic: 0.4, snub: 0.4, pepperbox: 0.2 },
    magic: { ornate: 3, classic: 1.5, pepperbox: 0.3 },
    ww1: { topbreak: 2, classic: 1.2, service: 1 },
    ww2: { topbreak: 1.2, service: 2, classic: 0.4, snub: 0.3 },
    vietnam: { service: 2, snub: 1.6, magnum: 0.5 },
  },
  cylinder: {
    modern: { fluted: 3, plain: 1.5, eight: 1 },
    steam: { fluted: 2, engraved: 1.5, plain: 1 },
    scifi: { energy: 3, fluted: 1, eight: 1 },
    cyber: { energy: 2, eight: 2, fluted: 1 },
    diesel: { plain: 2, eight: 1.5, fluted: 1 },
    scrap: { plain: 2, fluted: 1.5 },
    magic: { engraved: 3, fluted: 1 },
    ww1: { fluted: 2, plain: 1.5 },
    ww2: { fluted: 2, plain: 1.5 },
    vietnam: { fluted: 2, plain: 1.5 },
  },
  barrel: {
    modern: { ribbed: 2, underlug: 2, round: 1, ported: 1.2, target: 0.5 },
    steam: { octagonal: 3, round: 1, target: 1 },
    scifi: { ported: 2, underlug: 2, ribbed: 1 },
    cyber: { ported: 2, underlug: 2, ribbed: 1.5 },
    diesel: { underlug: 1.5, ribbed: 1.5, round: 1, target: 0.5 },
    scrap: { round: 3, ported: 0.5 },
    magic: { octagonal: 2.5, target: 1, round: 1 },
    ww1: { round: 2.5, octagonal: 1.2 },
    ww2: { round: 2.5, octagonal: 0.4, ribbed: 0.3 },
    vietnam: { round: 2, ribbed: 1 },
  },
  grip: {
    modern: { rubber: 3, square: 1 },
    steam: { birdshead: 2, panel: 2, square: 1 },
    scifi: { skeletal: 3, rubber: 1 },
    cyber: { skeletal: 2.5, rubber: 1.5 },
    diesel: { panel: 2, square: 1.5 },
    scrap: { square: 2, rubber: 1, birdshead: 1 },
    magic: { panel: 3, birdshead: 1.5 },
    ww1: { birdshead: 1.5, square: 1.5, panel: 1 },
    ww2: { square: 2, panel: 1.5, birdshead: 0.5 },
    vietnam: { square: 1.5, panel: 1.5, rubber: 0.5 },
  },
  hammer: {
    modern: { spur: 1.5, bobbed: 1.5 },
    steam: { spur: 3, ornate: 1 },
    scifi: { block: 3, bobbed: 1 },
    cyber: { block: 3, bobbed: 1 },
    diesel: { spur: 1.5, bobbed: 1.5, block: 0.5 },
    scrap: { spur: 2, bobbed: 1 },
    magic: { ornate: 3, spur: 1 },
    ww1: { spur: 3, bobbed: 0.5 },
    ww2: { spur: 3, bobbed: 0.5 },
    vietnam: { spur: 2, bobbed: 1 },
  },
};

const OPTICS: Record<Flavor, Weights> = {
  modern: { none: 4, reddot: 1, scope: 0.3, minidot: 0.8 },
  steam: { none: 4, brass: 0.4 },
  scifi: { none: 4, reddot: 0.8, minidot: 0.5 },
  cyber: { none: 3, smart: 1.2, reddot: 0.6, minidot: 0.4 },
  diesel: { none: 4, scope: 0.4 },
  scrap: { none: 1 },
  magic: { none: 4, rune: 1 },
  ww1: { none: 1 },
  ww2: { none: 1 },
  vietnam: { none: 1 },
};

/** Per-frame proportions: cylinder radius/length, barrel length (base + length param), grip rake... */
interface FrameShape { cr: number; cl: number; bl: [number, number]; rake: number; w: number; strap: number; grip: number; rb: number }
const S = (o: Partial<FrameShape> & { bl: [number, number]; rake: number }): FrameShape => ({ cr: 1, cl: 1, w: 1, strap: 1, grip: 1, rb: 1, ...o });
const FRAMES: Record<string, FrameShape> = {
  classic: S({ bl: [0.09, 0.1], rake: 0.52 }),
  service: S({ bl: [0.06, 0.08], rake: 0.34 }),
  magnum: S({ cr: 1.1, cl: 1.12, bl: [0.08, 0.1], rake: 0.3, w: 1.15, strap: 1.3, rb: 1.15 }),
  snub: S({ cr: 0.9, cl: 0.9, bl: [0.035, 0.015], rake: 0.36, grip: 0.8 }),
  topbreak: S({ bl: [0.07, 0.07], rake: 0.5 }),
  pepperbox: S({ cr: 1.08, bl: [0.07, 0.05], rake: 0.58 }),
  heavy: S({ cr: 1.12, cl: 1.1, bl: [0.07, 0.07], rake: 0.24, w: 1.25, strap: 1.4, rb: 1.2 }),
  coil: S({ cr: 1.05, cl: 1.05, bl: [0.08, 0.07], rake: 0.28, w: 1.05 }),
  junk: S({ bl: [0.06, 0.09], rake: 0.38 }),
  ornate: S({ cl: 1.05, bl: [0.09, 0.09], rake: 0.48 }),
  deco: S({ cl: 1.05, bl: [0.08, 0.08], rake: 0.36 }),
  smart: S({ cr: 1.05, cl: 1.05, bl: [0.07, 0.07], rake: 0.26, w: 1.1, rb: 1.1 }),
};

const ORDER = ['frame', 'cylinder', 'barrel', 'grip', 'hammer'];

export const revolver: ArchetypeDef = {
  id: 'revolver',
  name: 'Revolver',
  description: 'Revolvers: single and double action, snubs, magnums, top-breaks, pepperboxes and energy wheel-guns.',
  parts: { frame: REVOLVER_FRAMES, cylinder: REVOLVER_CYLINDERS, barrel: REVOLVER_BARRELS, grip: REVOLVER_GRIPS, hammer: REVOLVER_HAMMERS },
  optics: ['none', 'reddot', 'scope', 'brass', 'rune', 'smart', 'minidot'],

  weights: (style, kind): Weights | undefined => TABLE[kind]?.[flavor(style)],
  opticWeights: (style): Weights => OPTICS[flavor(style)],

  layout(chosen, p, rng): LongGunLayout {
    const { bulk, length } = p;
    const F = FRAMES[chosen.frame] ?? FRAMES.classic;
    const pepper = chosen.frame === 'pepperbox';
    const n = CHAMBERS[chosen.cylinder] ?? 6;
    const cr = (0.0185 + bulk * 0.004) * F.cr * rng.range(0.97, 1.03);
    const rc = cr * (n >= 8 ? 0.64 : n === 5 ? 0.56 : 0.58);
    const yc = -rc;
    const cl = (0.038 + bulk * 0.008) * F.cl * rng.range(0.96, 1.05);
    const zc0 = 0;
    const strapY0 = yc + cr + 0.001;
    const top = pepper ? yc + cr + 0.003 : strapY0 + (0.0055 + bulk * 0.002) * F.strap;
    const low = yc - cr - 0.001;
    const bottom = low - (0.007 + bulk * 0.002);
    const w = (0.024 + bulk * 0.004) * F.w;
    const rb = (0.0072 + bulk * 0.0018) * F.rb;
    let bl = F.bl[0] + length * F.bl[1];
    if (chosen.barrel === 'target') bl *= chosen.frame === 'snub' ? 2 : 1.45;
    if (chosen.barrel === 'snub' && chosen.frame !== 'snub') bl = Math.max(0.035, bl * 0.45);
    bl *= rng.range(0.95, 1.06);
    const lug = 0.012 + bulk * 0.003;
    let zc1 = zc0 + cl, frontZ = zc1 + lug, z1 = frontZ + bl;
    if (pepper) {
      // The barrel cluster is the cylinder: it runs all the way to the muzzle.
      z1 = zc0 + 0.03 + bl;
      zc1 = z1;
      frontZ = z1;
    }
    const gz = zc0 - 0.012 - bulk * 0.002;
    const gripDepth = 0.034 + bulk * 0.006;
    const angle = F.rake + rng.range(-0.04, 0.05);
    const gripLength = (0.085 + bulk * 0.012) * F.grip;
    const hz = zc0 - (chosen.frame === 'topbreak' ? 0.016 : 0.011);
    return {
      rec: { z0: hz - 0.02, z1: frontZ, top, bottom, width: w },
      magwell: { z0: gz - gripDepth, z1: gz, y: bottom, flare: false },
      magLength: 0,
      trigger: { z: gz + 0.022, y: bottom },
      grip: { z: gz, y: bottom, angle, length: gripLength },
      handguard: { z0: frontZ, z1, radius: rb },
      barrel: { z0: zc1 + 0.004, z1, radius: rb },
      stock: { z0: hz, z1: hz, drop: 0 },
      mountY: top,
      opticZ: zc0 + cl * 0.5,
      extra: { zc0, zc1, yc, cr, rc, chambers: n, strapY0, low, frontZ, hz, gripDepth, revolver: 1 },
    };
  },

  build(ctx: BuildContext, chosen) {
    const { L, b } = ctx;
    for (const kind of ORDER) {
      const fn = revolver.parts[kind][chosen[kind]];
      if (!fn) throw new Error(`Unknown ${kind} variant "${chosen[kind]}". Available: ${Object.keys(revolver.parts[kind]).join(', ')}`);
      // A pepperbox's barrels are its cylinder.
      if (kind === 'barrel' && chosen.frame === 'pepperbox') continue;
      fn(ctx);
    }
    buildOptic(ctx, chosen.sight);
    // Top-breaks carry the optic on the hinged strap.
    if (L.extra.topbreak && b.has('Optic')) b.component('Optic', { kind: 'optic', variant: '-' }).parent = 'Barrel';
    // No optic: aim along the notch and blade.
    const ads = b.sockets.find((s) => s.name === 'SOCKET_ADS');
    if (ads && chosen.sight === 'none') ads.position = [0, L.rec.top + 0.0015, L.opticZ - 0.12];

    const e = L.extra;
    const a = L.grip.angle;
    const D = e.gripDepth;
    const hand: Vec3 = [0, L.grip.y - 0.035 * Math.cos(a), L.grip.z - D * 0.45 - 0.035 * Math.sin(a)];
    b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Grip', position: hand, forward: [0, 0, 1], description: 'Shooting hand on the grip.' });
    b.socket({ name: 'SOCKET_Hand_Support', parent: 'Grip', position: [0.02, hand[1] - 0.01, hand[2] + 0.005], forward: [0, 0, 1], description: 'Support hand wrapped around the shooting hand (left side).' });
    b.socket({ name: 'SOCKET_Muzzle', parent: b.has('Barrel') ? 'Barrel' : 'Frame', position: [0, 0, L.barrel.z1], forward: [0, 0, 1], description: 'Muzzle tip: projectiles, flashes, tracers.' });
    // Loading and ejecting happen at the cylinder (on whatever carries it).
    const carrier = b.has('Crane') ? 'Crane' : e.topbreak ? 'Barrel' : 'Frame';
    const la = Math.PI / 2 + (Math.round(e.chambers / 3) / e.chambers) * Math.PI * 2;
    b.socket({
      name: 'SOCKET_Magazine', parent: carrier, position: [Math.cos(la) * e.rc, e.yc + Math.sin(la) * e.rc, e.zc0 - 0.002], forward: [0, 0, -1],
      description: 'Chamber loading point at the back of the cylinder (revolvers load through the cylinder, not a magazine).',
    });
    b.socket({
      name: 'SOCKET_Eject', parent: carrier, position: [-e.cr - 0.002, e.yc, e.zc0 + 0.006], forward: [-1, 0.5, -0.4],
      description: 'Where spent casings come out (right side of the cylinder).',
    });
  },

  fixup: (chosen, forced) => {
    const keep = (k: string) => !forced.has(k);
    if (chosen.frame === 'pepperbox') {
      if (keep('barrel')) chosen.barrel = 'none';
      if (keep('sight')) chosen.sight = 'none';
    } else if (chosen.barrel === 'none' && keep('barrel')) chosen.barrel = 'round';
    if (chosen.frame === 'snub') {
      if (keep('barrel')) chosen.barrel = 'snub';
      if (keep('hammer') && chosen.hammer !== 'block') chosen.hammer = 'bobbed';
      if (keep('cylinder') && chosen.cylinder === 'eight') chosen.cylinder = 'plain';
      if (keep('sight') && chosen.sight !== 'smart') chosen.sight = 'none';
    } else if (chosen.barrel === 'snub' && keep('barrel')) chosen.barrel = 'round';
    // A full underlug would swing through the frame on a top-break.
    if (chosen.frame === 'topbreak' && chosen.barrel === 'underlug' && keep('barrel')) chosen.barrel = 'ribbed';
  },
  origin: (ctx) => ctx.b.sockets.find((s) => s.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0],
};
