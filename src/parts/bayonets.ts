/**
 * Bayonets: a long-gun part kind ("bayonet") and a standalone attachment.
 *
 *   knife    modern knife bayonet: clip-point blade, saw-back spine, muzzle ring
 *   spike    WW-era socket bayonet: a long sleeve over the barrel and a square spike
 *   sword    WW1 sword bayonet: long blade, wooden grips, hooked quillon
 *   blade    WW2/Vietnam medium spear-point blade
 *   energy   sci-fi emitter clamped under the barrel, with a glowing blade
 *   rune     fantasy leaf blade with glowing runes and a curled golden guard
 *   kitchen  survivor: a kitchen knife and a wooden shim taped to the barrel
 *   saw      cyberpunk tanto with saw teeth, a neon edge and a cable
 *   cleaver  dieselpunk chrome cleaver on a riveted bar with a stepped guard
 *
 * Like attach.ts, every bayonet is drawn in its own *mount frame*: the
 * origin is the bayonet lug on the underside of the barrel (y = 0 touches
 * the barrel, the bore axis is at y = +R), the handle runs forward from the
 * lug to a muzzle ring at z = RING_Z, and the blade points toward +Z below
 * the muzzle. The lug sits a fixed distance behind the end of the barrel, so
 * every bayonet snaps onto the same weapon socket (SOCKET_Bayonet).
 *
 * The blade's spine stays below 2.7 barrel radii under the bore, so it
 * clears flash hiders, brakes and suppressors (the fattest muzzle devices
 * are kept apart by the long-gun fixup instead).
 */
import { Geometry, Vec2, Vec3, box, dome, extrudeFront, extrudeSide, lathe, ring, rod, smoothPolygon, tube } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { StyleProfile } from '../styles/style.js';
import type { MaterialSlot } from '../types.js';
import type { BuildContext } from './context.js';

/** How far behind the end of the barrel the lug sits. */
export const BAYONET_LUG_BACK = 0.085;
/** Bare barrel a long gun keeps in front of its handguard when it carries a bayonet. */
export const BAYONET_MIN_BARE = BAYONET_LUG_BACK + 0.016;
/** Muzzle devices too fat to fit a blade under. */
export const BAYONET_FAT_MUZZLES = ['bell', 'can', 'bottle', 'maw'];

/** Mount-frame z of the muzzle ring / crossguard. */
const RING_Z = BAYONET_LUG_BACK - 0.012;

type Add = (slot: MaterialSlot, geo: Geometry) => void;

/** What a bayonet builder reports: its tip (mount frame). */
interface Built {
  tip: Vec3;
}

type BayonetBuilder = (ctx: BuildContext, add: Add, f: Frame) => Built;

interface Frame {
  /** Radius of what the ring goes around (barrel, or a shotgun's magazine tube). */
  R: number;
  /** Depth of the blade's spine below the lug. */
  D: number;
}

function frame(ctx: BuildContext): Frame {
  const R = ctx.L.extra.tubeR ?? ctx.L.barrel.radius;
  return { R, D: 1.7 * R + 0.006 };
}

/** A closed outline around a polyline (a bent strip of constant thickness), [z, y]. */
function stroke(pts: Vec2[], t: number): Vec2[] {
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
    const n: Vec2 = [-dy / l, dz / l];
    left.push([pts[i][0] + (n[0] * t) / 2, pts[i][1] + (n[1] * t) / 2]);
    right.push([pts[i][0] - (n[0] * t) / 2, pts[i][1] - (n[1] * t) / 2]);
  }
  return [...left, ...right.reverse()];
}

const sideGeo = (profile: Vec2[], width: number, bevel = 0, x = 0) => extrudeSide(profile, { width, bevel, x });

/** The ring that slips over the barrel (or tube) at the crossguard. */
function muzzleRing(ctx: BuildContext, add: Add, f: Frame, z: number, slot: MaterialSlot = 'Detail'): void {
  add(slot, ring(f.R + 0.0022, 0.0022, z, ctx.seg(0.9), 5).transform({ t: [0, f.R, 0] }));
}

/** Pommel latch: the block that locks onto the lug, from the barrel down to yBottom. */
function latch(ctx: BuildContext, add: Add, yBottom: number, slot: MaterialSlot = 'Detail'): void {
  add(slot, sideGeo([[-0.006, 0], [0.012, 0], [0.012, yBottom + 0.004], [0.006, yBottom], [-0.006, yBottom + 0.002]], 0.012, ctx.bevel(0.0015)));
  add('Trim', box([0, -0.0035, -0.0075], [0.006, 0.004, 0.003]));
}

/** A blade outline from z0 forward: spine at yS, edge yS - h. */
function spearBlade(z0: number, len: number, yS: number, h: number): Vec2[] {
  return [[z0, yS], [z0 + len * 0.78, yS - h * 0.04], [z0 + len, yS - h * 0.5], [z0 + len * 0.78, yS - h * 0.96], [z0, yS - h]];
}
function clipBlade(z0: number, len: number, yS: number, h: number): Vec2[] {
  return [[z0, yS], [z0 + len * 0.6, yS], [z0 + len * 0.78, yS - h * 0.16], [z0 + len, yS - h * 0.5], [z0 + len * 0.9, yS - h * 0.82], [z0 + len * 0.62, yS - h], [z0, yS - h]];
}

/** Saw teeth standing on a straight edge from z0 to z1 at height y (pointing up when dir = 1). */
function teeth(z0: number, z1: number, y: number, size: number, dir: 1 | -1): Vec2[] {
  const n = Math.max(3, Math.round((z1 - z0) / (size * 1.2)));
  const step = (z1 - z0) / n;
  const pts: Vec2[] = [[z0, y - dir * size * 0.8]];
  for (let i = 0; i < n; i++) pts.push([z0 + i * step, y], [z0 + (i + 0.75) * step, y + dir * size]);
  pts.push([z1, y], [z1, y - dir * size * 0.8]);
  return dir === 1 ? pts : pts.reverse();
}

/** Handle with finger grooves along its underside, from z0 to z1, top at yT. */
function grooved(z0: number, z1: number, yT: number, h: number, grooves: number): Vec2[] {
  const pts: Vec2[] = [[z0, yT], [z1, yT], [z1, yT - h * 0.9]];
  const n = grooves * 2;
  for (let i = 1; i < n; i++) {
    const z = z1 - ((z1 - z0) * i) / n;
    pts.push([z, yT - h + (i % 2 ? 0.0025 : 0)]);
  }
  pts.push([z0 + 0.002, yT - h], [z0, yT - h * 0.6]);
  return pts;
}

// ---------------------------------------------------------------------------
// Builders (mount frame: lug at the origin, blade toward +Z)
// ---------------------------------------------------------------------------

const knife: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:knife');
  const len = 0.15 + r.range(0, 0.035) + ctx.p.length * 0.02, h = 0.026 + ctx.p.bulk * 0.004;
  const yS = -f.D, hh = 0.021;
  latch(ctx, add, yS - hh);
  add('Grip', sideGeo(grooved(0.012, RING_Z - 0.004, yS + 0.004, hh + 0.004, 3), 0.016, ctx.bevel(0.004)));
  // Crossguard from the ring down below the handle, with a short lower quillon.
  add('Detail', sideGeo([[RING_Z - 0.005, -0.001], [RING_Z + 0.004, -0.001], [RING_Z + 0.004, yS - hh - 0.004], [RING_Z + 0.008, yS - hh - 0.01], [RING_Z - 0.005, yS - hh - 0.008]], 0.014, ctx.bevel(0.0015)));
  muzzleRing(ctx, add, f, RING_Z);
  const z0 = RING_Z + 0.004;
  add('Barrel', sideGeo(clipBlade(z0, len, yS, h), 0.0045, ctx.bevel(0.0016)));
  // Saw-back spine (most of the time) and a dark fuller.
  if (r.chance(0.65)) add('Barrel', sideGeo(teeth(z0 + 0.012, z0 + len * 0.45, yS - 0.0002, 0.0032, 1), 0.003));
  add('Detail', box([0, yS - h * 0.32, z0 + len * 0.3], [0.0049, 0.0025, len * 0.4]));
  return { tip: [0, yS - h * 0.5, z0 + len] };
};

const spike: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:spike');
  const len = 0.19 + r.range(0, 0.06) + ctx.p.length * 0.02;
  const seg = ctx.seg(0.9);
  // Socket sleeve over the barrel, with a locking ring at the back.
  add('Barrel', tube(f.R + 0.003, f.R + 0.0004, 0, RING_Z + 0.004, seg).transform({ t: [0, f.R, 0] }));
  add('Detail', lathe([[f.R + 0.003, 0.002], [f.R + 0.0048, 0.003], [f.R + 0.0048, 0.011], [f.R + 0.003, 0.012], [f.R + 0.003, 0.002]], seg).transform({ t: [0, f.R, 0] }));
  add('Detail', box([0, f.R + f.R + 0.0045, 0.03], [0.003, 0.003, 0.03]));
  // Elbow down to the spike, then the spike itself: square, tapering to a point.
  const yC = -f.D - 0.004;
  add('Barrel', sideGeo([[RING_Z - 0.04, 0.0005], [RING_Z + 0.004, 0.0005], [RING_Z + 0.004, yC + 0.004], [RING_Z - 0.008, yC + 0.004]], 0.007, ctx.bevel(0.0015)));
  const z0 = RING_Z - 0.008;
  add('Barrel', lathe([[0, 0], [0.006, 0], [0.006, 0.01], [0.004, len * 0.55], [0, len]], 4, Math.PI / 4).transform({ t: [0, yC, z0] }));
  add('Detail', lathe([[0.0062, -0.002], [0.0072, -0.001], [0.0072, 0.006], [0.0062, 0.007], [0.0062, -0.002]], 4, Math.PI / 4).transform({ t: [0, yC, z0] }));
  return { tip: [0, yC, z0 + len] };
};

const sword: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:sword');
  const len = 0.34 + r.range(0, 0.08) + ctx.p.length * 0.04, h = 0.026;
  const yS = -f.D, hh = 0.024;
  // Steel pommel with a hooked back, wooden grip scales and two rivets.
  add('Detail', sideGeo([[-0.008, 0], [0.012, 0], [0.012, yS - hh], [-0.002, yS - hh - 0.002], [-0.01, yS - hh + 0.006], [-0.008, yS - hh * 0.4]], 0.013, ctx.bevel(0.002)));
  add('Stock', sideGeo(smoothPolygon([[0.012, yS + 0.005], [RING_Z - 0.004, yS + 0.004], [RING_Z - 0.004, yS - hh + 0.002], [0.04, yS - hh - 0.001], [0.012, yS - hh]], 1), 0.017, ctx.bevel(0.004)));
  for (const z of [0.03, RING_Z - 0.02]) {
    for (const s of [1, -1]) add('Trim', dome(0.0028, 0.0012, 6, 2).transform({ r: [0, (s * Math.PI) / 2, 0], t: [s * 0.0085, yS - hh * 0.45, z] }));
  }
  // Crossguard with the hooked quillon curling forward and down.
  add('Detail', sideGeo([[RING_Z - 0.004, -0.001], [RING_Z + 0.004, -0.001], [RING_Z + 0.004, yS - hh - 0.002], [RING_Z - 0.004, yS - hh - 0.002]], 0.014, ctx.bevel(0.0012)));
  const hook: Vec2[] = [[RING_Z, yS - hh], [RING_Z + 0.006, yS - hh - 0.016], [RING_Z + 0.02, yS - hh - 0.03], [RING_Z + 0.03, yS - hh - 0.026], [RING_Z + 0.032, yS - hh - 0.016], [RING_Z + 0.026, yS - hh - 0.012]];
  add('Detail', sideGeo(stroke(hook, 0.0045), 0.008, ctx.bevel(0.001)));
  add('Detail', dome(0.003, 0.003, 8, 2).transform({ r: [-Math.PI / 2, 0, 0], t: [0, yS - hh - 0.011, RING_Z + 0.026] }));
  muzzleRing(ctx, add, f, RING_Z);
  const z0 = RING_Z + 0.004;
  add('Barrel', sideGeo([[z0, yS], [z0 + len * 0.9, yS - 0.003], [z0 + len, yS - h * 0.55], [z0 + len * 0.9, yS - h * 0.95], [z0, yS - h]], 0.0045, ctx.bevel(0.0016)));
  add('Detail', box([0, yS - h * 0.34, z0 + len * 0.42], [0.005, 0.003, len * 0.72]));
  return { tip: [0, yS - h * 0.55, z0 + len] };
};

const bladeB: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:blade');
  const len = 0.17 + r.range(0, 0.07) + ctx.p.length * 0.02, h = 0.024 + ctx.p.bulk * 0.004;
  const yS = -f.D, hh = 0.022;
  const wood = (ctx.style.traits.era ?? 2000) < 1955 || ctx.style.traits.plumbing;
  latch(ctx, add, yS - hh);
  add(wood ? 'Stock' : 'Grip', sideGeo([[0.012, yS + 0.004], [RING_Z - 0.004, yS + 0.004], [RING_Z - 0.004, yS - hh], [0.012, yS - hh]], 0.016, ctx.bevel(0.004)));
  // Grip grooves across the handle.
  const n = 5;
  for (let i = 0; i < n; i++) add('Detail', box([0, yS - hh * 0.4, 0.02 + ((RING_Z - 0.032) * i) / (n - 1)], [0.0168, hh * 0.8, 0.002]));
  add('Detail', sideGeo([[RING_Z - 0.004, -0.001], [RING_Z + 0.004, -0.001], [RING_Z + 0.004, yS - hh - 0.008], [RING_Z - 0.004, yS - hh - 0.006]], 0.014, ctx.bevel(0.0012)));
  muzzleRing(ctx, add, f, RING_Z);
  const z0 = RING_Z + 0.004;
  add('Barrel', sideGeo(spearBlade(z0, len, yS, h), 0.0045, ctx.bevel(0.0016)));
  add('Detail', box([0, yS - h * 0.5, z0 + len * 0.36], [0.0049, 0.0022, len * 0.56]));
  return { tip: [0, yS - h * 0.5, z0 + len] };
};

const energy: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:energy');
  const len = 0.19 + r.range(0, 0.07) + ctx.p.length * 0.02, h = 0.017;
  const yS = -f.D;
  // Emitter housing under the barrel, held by two clamp bands.
  for (const z of [0.008, RING_Z - 0.004]) muzzleRing(ctx, add, f, z, 'Trim');
  const yb = yS - 0.016;
  add('Body', sideGeo(smoothPolygon([[0, -0.001], [RING_Z + 0.004, -0.001], [RING_Z + 0.016, yS + 0.002], [RING_Z + 0.016, yb + 0.004], [RING_Z + 0.004, yb], [0.006, yb], [-0.004, yb + 0.008]], 1), 0.018, ctx.bevel(0.003)));
  add('Accent', box([0, yb + 0.006, RING_Z * 0.5], [0.0186, 0.003, RING_Z * 0.7]));
  add('Emissive', box([0, yb + 0.0105, RING_Z * 0.45], [0.019, 0.0016, RING_Z * 0.5]));
  // Emitter prongs top and bottom, and the blade of light between them.
  const z0 = RING_Z + 0.014;
  add('Trim', sideGeo([[z0, yS + 0.001], [z0 + 0.03, yS], [z0 + 0.026, yS - 0.003], [z0, yS - 0.003]], 0.008, ctx.bevel(0.001)));
  add('Trim', sideGeo([[z0, yS - h - 0.001], [z0 + 0.02, yS - h], [z0 + 0.016, yS - h - 0.004], [z0, yS - h - 0.005]], 0.008, ctx.bevel(0.001)));
  add('Emissive', sideGeo([[z0, yS - 0.002], [z0 + len * 0.85, yS - 0.002], [z0 + len, yS - h * 0.45], [z0 + len * 0.85, yS - h], [z0, yS - h]], 0.002, ctx.bevel(0.0008)));
  return { tip: [0, yS - h * 0.45, z0 + len] };
};

const rune: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:rune');
  const len = 0.2 + r.range(0, 0.07) + ctx.p.length * 0.02, h = 0.032 + ctx.p.ornament * 0.006;
  const yS = -f.D - 0.002, hh = 0.02;
  latch(ctx, add, yS - hh, 'Trim');
  // Wrapped grip with golden bands, a gem in the pommel.
  add('Grip', sideGeo([[0.012, yS + 0.003], [RING_Z - 0.006, yS + 0.002], [RING_Z - 0.006, yS - hh + 0.002], [0.012, yS - hh]], 0.015, ctx.bevel(0.004)));
  for (let i = 0; i < 4; i++) add('Trim', box([0, yS - hh * 0.5 + 0.001, 0.018 + i * ((RING_Z - 0.032) / 3)], [0.0158, hh + 0.003, 0.002]));
  add('Emissive', dome(0.0035, 0.0025, 8, 2).transform({ r: [0, Math.PI / 2, 0], t: [0.0062, yS - hh * 0.5, 0.003] }));
  // Curled guard (a crescent) and ring.
  const curl: Vec2[] = [[RING_Z + 0.012, 0.002], [RING_Z + 0.002, -0.006], [RING_Z, yS - hh * 0.5], [RING_Z + 0.002, yS - hh - 0.006], [RING_Z + 0.014, yS - hh - 0.014], [RING_Z + 0.02, yS - hh - 0.008]];
  add('Trim', sideGeo(stroke(curl, 0.006), 0.012, ctx.bevel(0.0015)));
  muzzleRing(ctx, add, f, RING_Z, 'Trim');
  const z0 = RING_Z + 0.005;
  const leaf: Vec2[] = smoothPolygon([[z0, yS - h * 0.2], [z0 + len * 0.4, yS + 0.001], [z0 + len * 0.75, yS - h * 0.12], [z0 + len, yS - h * 0.5], [z0 + len * 0.75, yS - h * 0.88], [z0 + len * 0.4, yS - h - 0.001], [z0, yS - h * 0.8]], 2);
  add('Barrel', sideGeo(leaf, 0.0045, ctx.bevel(0.0016)));
  // Glowing runes down the middle of the blade, on both faces.
  const n = 4 + Math.round(ctx.p.ornament * 2);
  for (let i = 0; i < n; i++) {
    const z = z0 + len * (0.12 + (0.62 * i) / (n - 1)), y = yS - h * 0.5;
    const kind = r.int(0, 2);
    add('Emissive', box([0, y, z], [0.0052, 0.009, 0.0016]));
    if (kind === 0) add('Emissive', box([0, y + 0.002, z + 0.002], [0.0052, 0.0016, 0.004]));
    else if (kind === 1) add('Emissive', box([0, y - 0.003, z - 0.002], [0.0052, 0.0016, 0.004]));
    else add('Emissive', box([0, y, z + 0.002], [0.0052, 0.0016, 0.004]));
  }
  return { tip: [0, yS - h * 0.5, z0 + len] };
};

const kitchen: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:kitchen');
  const len = 0.17 + r.range(0, 0.05), h = 0.038 + ctx.p.bulk * 0.006;
  const yS = -f.D, hh = 0.018;
  // A wooden shim wedged between barrel and handle.
  add('Stock', box([0, (yS + 0.002) / 2, RING_Z * 0.5], [0.014, -yS - 0.002, RING_Z * 0.85], ctx.bevel(0.001)));
  // Handle with three rivets, a steel bolster, the blade.
  add('Grip', sideGeo(smoothPolygon([[0.004, yS + 0.001], [RING_Z - 0.002, yS + 0.001], [RING_Z - 0.002, yS - hh + 0.002], [0.01, yS - hh - 0.001], [0.004, yS - hh * 0.6]], 1), 0.015, ctx.bevel(0.003)));
  for (let i = 0; i < 3; i++) {
    for (const s of [1, -1]) add('Trim', dome(0.0024, 0.001, 6, 2).transform({ r: [0, (s * Math.PI) / 2, 0], t: [s * 0.0075, yS - hh * 0.48, 0.014 + i * ((RING_Z - 0.03) / 2)] }));
  }
  add('Barrel', sideGeo([[RING_Z - 0.002, yS + 0.0015], [RING_Z + 0.008, yS + 0.0015], [RING_Z + 0.01, yS - h * 0.6], [RING_Z - 0.002, yS - hh - 0.001]], 0.009, ctx.bevel(0.0015)));
  const z0 = RING_Z + 0.008;
  const edge: Vec2[] = [[z0 + len, yS - h * 0.12]];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    edge.push([z0 + len * (1 - t), yS - h * Math.sin((Math.PI / 2) * Math.min(1, t * 1.6)) * (0.88 + 0.12 * t)]);
  }
  add('Barrel', sideGeo([[z0, yS], [z0 + len * 0.72, yS - 0.001], ...edge, [z0, yS - h]], 0.0028, ctx.bevel(0.001)));
  // Two loops of tape around barrel, shim and handle.
  const hw = Math.max(0.0095, f.R + 0.0014);
  const outline: Vec2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    outline.push([Math.cos(a) * hw, f.R + Math.sin(a) * (f.R + 0.0014)]);
  }
  outline.push([-hw, yS - hh - 0.0012], [hw, yS - hh - 0.0012]);
  for (const z of [0.018, RING_Z - 0.022]) add('Accent', extrudeFront(outline, z - 0.007 - r.range(0, 0.003), z + 0.007));
  return { tip: [0, yS - h * 0.12, z0 + len] };
};

const saw: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:saw');
  const len = 0.16 + r.range(0, 0.05) + ctx.p.length * 0.02, h = 0.03 + ctx.p.bulk * 0.004;
  const yS = -f.D - 0.002, yb = yS - 0.02;
  // Angular housing with a neon strip and a power cable.
  for (const z of [0.006, RING_Z - 0.006]) muzzleRing(ctx, add, f, z, 'Detail');
  add('Body', sideGeo([[-0.004, -0.001], [RING_Z + 0.006, -0.001], [RING_Z + 0.012, yS + 0.004], [RING_Z + 0.012, yb + 0.004], [RING_Z + 0.004, yb], [0.008, yb], [-0.004, yb + 0.01]], 0.02, ctx.bevel(0.002)));
  add('Emissive', box([0, yb + 0.004, RING_Z * 0.5], [0.0206, 0.0018, RING_Z * 0.75]));
  // Power cell on the left with a short cable looping into the housing.
  add('Accent', box([0.0125, (yS + yb) / 2 + 0.002, RING_Z * 0.4], [0.005, 0.012, 0.03], ctx.bevel(0.0012)));
  add('Accent', rod([0.0125, yS + 0.002, RING_Z * 0.4 + 0.015], [0.0125, yS + 0.004, RING_Z * 0.8], 0.0018, 6));
  add('Accent', rod([0.0125, yS + 0.004, RING_Z * 0.8], [0.0095, yS - 0.002, RING_Z + 0.004], 0.0018, 6));
  const z0 = RING_Z + 0.012;
  add('Barrel', sideGeo([[z0, yS], [z0 + len * 0.8, yS], [z0 + len, yS - h * 0.38], [z0 + len * 0.84, yS - h], [z0, yS - h]], 0.005, ctx.bevel(0.0012)));
  add('Barrel', sideGeo(teeth(z0 + 0.008, z0 + len * 0.62, yS - 0.0002, 0.0042, 1), 0.0036));
  // Neon cutting edge.
  add('Emissive', sideGeo([[z0, yS - h + 0.0025], [z0 + len * 0.84, yS - h + 0.0025], [z0 + len * 0.995, yS - h * 0.39], [z0 + len * 0.98, yS - h * 0.37], [z0 + len * 0.83, yS - h - 0.0006], [z0, yS - h - 0.0006]], 0.0056));
  return { tip: [0, yS - h * 0.38, z0 + len] };
};

const cleaver: BayonetBuilder = (ctx, add, f) => {
  const r = ctx.rng('bayonet:cleaver');
  const len = 0.14 + r.range(0, 0.04) + ctx.p.length * 0.02, h = 0.042 + ctx.p.bulk * 0.008;
  const yS = -f.D, yb = yS - 0.016;
  // Riveted mounting bar and a stepped art-deco guard.
  muzzleRing(ctx, add, f, RING_Z - 0.002, 'Trim');
  add('Body', sideGeo([[-0.006, -0.001], [RING_Z, -0.001], [RING_Z, yb], [0.004, yb], [-0.006, yb + 0.008]], 0.016, ctx.bevel(0.002)));
  if (ctx.style.traits.rivets) {
    for (let i = 0; i < 3; i++) for (const s of [1, -1]) add('Trim', dome(0.0022, 0.0011, 6, 2).transform({ r: [0, (s * Math.PI) / 2, 0], t: [s * 0.008, (yS + yb) / 2 + 0.002, 0.008 + i * ((RING_Z - 0.02) / 2)] }));
  }
  for (let i = 0; i < 3; i++) add('Trim', box([0, yS - 0.006 - i * 0.002, RING_Z + 0.003 + i * 0.004], [0.018 - i * 0.004, 0.024 + 0.012 * (2 - i), 0.004], ctx.bevel(0.001)));
  const z0 = RING_Z + 0.012;
  add('Barrel', sideGeo([[z0, yS], [z0 + len, yS], [z0 + len + 0.006, yS - 0.008], [z0 + len + 0.002, yS - h], [z0 + 0.01, yS - h], [z0, yS - h + 0.012]], 0.0045, ctx.bevel(0.0014)));
  // Speed lines along the spine.
  for (const dy of [0.006, 0.011]) add('Accent', box([0, yS - dy, z0 + len * 0.42], [0.005, 0.0016, len * (0.7 - dy * 20)]));
  return { tip: [0, yS - h * 0.5, z0 + len + 0.004] };
};

export const BAYONET_BUILDERS: Record<string, BayonetBuilder> = { knife, spike, sword, blade: bladeB, energy, rune, kitchen, saw, cleaver };

/** Where the bayonet lug is on a long gun (weapon space): under the barrel, or under a shotgun's magazine tube. */
export function bayonetMount(ctx: BuildContext): { at: Vec3; parent: string | null } {
  const { L } = ctx;
  const tubeFed = L.extra.tubeR !== undefined && L.extra.tubeY !== undefined;
  const y = tubeFed ? L.extra.tubeY - L.extra.tubeR : -L.barrel.radius;
  return { at: [0, y, L.barrel.z1 - BAYONET_LUG_BACK], parent: ctx.b.has('Barrel') ? 'Barrel' : null };
}

/** Build one bayonet as its own component at a mount (the lug). */
export function buildBayonet(ctx: BuildContext, variant: string, mount: { at: Vec3; parent: string | null }): Component {
  const fn = BAYONET_BUILDERS[variant];
  if (!fn) throw new Error(`Unknown bayonet "${variant}". Available: none, ${Object.keys(BAYONET_BUILDERS).join(', ')}`);
  const c = ctx.b.component('Bayonet', { kind: 'bayonet', variant, parent: mount.parent, pivot: mount.at });
  const at = mount.at;
  const built = fn(ctx, (slot, geo) => ctx.b.add(c, slot, geo.transform({ t: at })), frame(ctx));
  ctx.b.socket({ name: 'SOCKET_Bayonet_Tip', parent: 'Bayonet', position: [built.tip[0] + at[0], built.tip[1] + at[1], built.tip[2] + at[2]], forward: [0, 0, 1], description: 'Bayonet point: melee trace / stab origin.' });
  return c;
}

const noop: PartBuilder = () => {};

/** Long-gun part builders for the "bayonet" kind. */
export const BAYONET_PARTS: Record<string, PartBuilder> = {
  none: noop,
  ...Object.fromEntries(Object.keys(BAYONET_BUILDERS).map((v) => [v, (ctx: BuildContext) => void buildBayonet(ctx, v, bayonetMount(ctx))])),
};

/**
 * Bayonet odds from style traits (a style can override them with its own
 * `parts.bayonet`). `traits.bayonet` is the chance of any bayonet at all;
 * the era or world decides which kind. Only rifles and shotguns get one.
 */
export function bayonetWeights(style: StyleProfile, archetype: string): Record<string, number> {
  if (style.parts.bayonet) return style.parts.bayonet;
  if (!['rifle', 'shotgun'].includes(archetype)) return { none: 1 };
  const t = style.traits, era = t.era ?? 2100;
  let mix: Record<string, number>;
  if (era < 1925) mix = { sword: 0.6, spike: 0.4 };
  else if (era < 1950) mix = { blade: 0.55, spike: 0.3, sword: 0.15 };
  else if (era < 1990) mix = { blade: 0.6, knife: 0.4 };
  else if (t.magic) mix = { rune: 1 };
  else if (t.scrap) mix = { kitchen: 1 };
  else if (t.cyber) mix = { saw: 1 };
  else if (t.diesel) mix = { cleaver: 1 };
  else if (t.glow) mix = { energy: 1 };
  else if (t.plumbing) mix = { sword: 0.7, spike: 0.3 };
  else mix = { knife: 0.75, blade: 0.25 };
  const chance = t.bayonet ?? (t.magic ? 0.18 : t.scrap ? 0.15 : t.plumbing ? 0.15 : t.cyber || t.diesel ? 0.12 : t.glow ? 0.1 : 0.06);
  return { none: 1 - chance, ...Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, v * chance])) };
}
