/**
 * Dieselpunk and cyberpunk parts.
 *
 * Dieselpunk: heavy 1930s-40s industrial retro-futurism. Streamlined art-deco
 * housings with chrome speed lines, riveted armor plate, radiator grilles,
 * exhaust stacks, jerrycans and searchlights.
 *
 * Cyberpunk: neon-lit corporate and street hardware. Angular chassis with
 * built-in displays, exposed cables, stickers and neon tape, smart sights and
 * magazines with LED counters.
 */
import { AXIS_X, Vec2, Vec3, box, cylinder, dome, lathe, ring, rod, smoothPolygon } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, raked, side } from './context.js';
import { RECEIVERS, rail, rivetRow, triggerAndGuard } from './receiver.js';
import { gripMagazine, pistolTrigger } from './pistol.js';

/** Chrome "speed lines": thin horizontal strips stepping back along a side face. */
function speedLines(ctx: BuildContext, c: Component, x: number, z0: number, z1: number, y: number, n = 3): void {
  for (let i = 0; i < n; i++) {
    const zz0 = z0 + i * 0.015, yy = y - i * 0.007;
    side(ctx, c, 'Trim', [[zz0, yy - 0.0012], [z1 - i * 0.03, yy - 0.0012], [z1 - i * 0.03 + 0.004, yy + 0.0012], [zz0, yy + 0.0012]], x * 2 + 0.002);
  }
}

/** A cable as a sagging chain of rods between two points. */
function cable(ctx: BuildContext, c: Component, a: Vec3, b: Vec3, sag: number, r: number, slot: MaterialSlot): void {
  const n = 6;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
    put(ctx, c, slot, rod(prev, p, r, 5));
    prev = p;
  }
  for (const p of [a, b]) put(ctx, c, 'Detail', cylinder(r * 1.8, -0.004, 0.004, 8), p);
}

// ===========================================================================
// DIESELPUNK
// ===========================================================================

/** Art-deco streamliner: a teardrop housing with chrome speed lines and a fin. */
const deco: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'deco', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const mid = (top + bottom) / 2;
  side(ctx, rec, 'Body', smoothPolygon([
    [z0 - 0.012, mid + 0.004], [z0 + 0.01, top - 0.004], [z0 + 0.08, top + 0.006], [z1 - 0.04, top], [z1 + 0.004, top * 0.3],
    [z1 + 0.006, -0.006], [z1 - 0.02, bottom + 0.006], [L.magwell.z1 + 0.01, bottom], [L.magwell.z0 - 0.01, bottom], [z0 + 0.03, bottom + 0.004],
    [z0 - 0.006, mid - 0.01],
  ], 2), w, 0.004);
  speedLines(ctx, rec, w / 2, z0 + 0.03, z1 - 0.02, mid + 0.006);
  side(ctx, rec, 'Trim', [[z0 + 0.03, top + 0.004], [z0 + 0.09, top + 0.006], [z0 + 0.075, top + 0.016], [z0 + 0.04, top + 0.012]], 0.005, 0.001);
  const pts: Vec3[] = [];
  for (let z = z0 + 0.03; z < z1 - 0.03; z += 0.018) for (const s of [1, -1]) pts.push([s * (w / 2 + 0.0003), bottom + 0.008, z]);
  rivetRow(ctx, rec, 'Detail', pts, 0.0018);
  L.mountY = top + 0.006;
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Riveted armor: a slab body with bolted plates, a hatch and a valve wheel. */
const riveted: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'riveted', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, rec, 'Body', [[z0, bottom + 0.01], [z0 + 0.01, bottom], [z1 - 0.01, bottom], [z1, bottom + 0.01], [z1, top - 0.008], [z1 - 0.008, top], [z0 + 0.008, top], [z0, top - 0.008]], w, 0.002);
  // Bolted-on side plates with a rivet border.
  const pz0 = z0 + 0.02, pz1 = z1 - 0.025, py0 = bottom + 0.008, py1 = top - 0.008;
  side(ctx, rec, 'Body', [[pz0, py0], [pz1, py0], [pz1, py1], [pz0, py1]], w + 0.004, 0.001);
  const pts: Vec3[] = [];
  for (let z = pz0 + 0.006; z < pz1; z += 0.014) for (const y of [py0 + 0.004, py1 - 0.004]) for (const s of [1, -1]) pts.push([s * (w / 2 + 0.0022), y, z]);
  rivetRow(ctx, rec, 'Detail', pts, 0.0019);
  put(ctx, rec, 'Detail', box([0, top + 0.002, (z0 + z1) / 2], [w * 0.6, 0.004, 0.05], ctx.bevel(0.001)));
  put(ctx, rec, 'Accent', box([w / 2 + 0.0026, (py0 + py1) / 2, pz1 - 0.03], [0.0008, 0.012, 0.026]));
  // Valve wheel on the left.
  const vz = z0 + (z1 - z0) * 0.35, vy = (top + bottom) / 2, vx = w / 2 + 0.008;
  const R = 0.011 + p.ornament * 0.004;
  put(ctx, rec, 'Trim', ring(R, 0.0018, 0, 14, 5), [vx, vy, vz], AXIS_X);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    put(ctx, rec, 'Trim', rod([vx, vy, vz], [vx, vy + Math.sin(a) * R, vz + Math.cos(a) * R], 0.0011, 5));
  }
  put(ctx, rec, 'Detail', cylinder(0.003, -0.006, 0.002, 8), [vx, vy, vz], [0, Math.PI / 2, 0]);
  L.mountY = top + 0.004;
  triggerAndGuard(ctx, 'Detail', 'square');
};

/** Radiator housing: a box around the barrel with a grille of fins on each side. */
const radiator: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0, z1, radius } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'radiator', pivot: [0, 0, z0] });
  const w = radius * 2.1, hh = radius * 2.1;
  side(ctx, h, 'Body', smoothPolygon([[z0, -hh / 2], [z1 - 0.012, -hh / 2], [z1, -hh * 0.3], [z1, hh * 0.3], [z1 - 0.012, hh / 2], [z0, hh / 2]], 1), w, 0.004);
  const fins = Math.floor((z1 - z0 - 0.04) / (0.0055 + (1 - p.detail) * 0.003));
  for (let i = 0; i < fins; i++) {
    const z = z0 + 0.02 + i * ((z1 - z0 - 0.04) / fins);
    for (const s of [1, -1]) put(ctx, h, 'Detail', box([s * (w / 2 + 0.0008), 0, z], [0.0022, hh * 0.68, 0.0022]));
  }
  side(ctx, h, 'Trim', [[z0 + 0.01, hh / 2 - 0.001], [z1 - 0.02, hh / 2 - 0.001], [z1 - 0.024, hh / 2 + 0.003], [z0 + 0.01, hh / 2 + 0.003]], w * 0.3);
};

/** Exhaust-stack muzzle: a collar and three short pipes angled up. Returns length. */
export function exhaustMuzzle(ctx: BuildContext, c: Component, a: number, rb: number): number {
  const seg = ctx.seg(0.8);
  const R = rb * 1.8, len = 0.05;
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [R, a - 0.004], [R, a + len], [R * 0.75, a + len + 0.004], [rb * 0.7, a + len + 0.004], [rb * 0.7, a + len]], seg));
  put(ctx, c, 'Trim', lathe([[R, a + 0.002], [R + 0.001, a + 0.003], [R + 0.001, a + 0.007], [R, a + 0.008]], seg));
  // Three exhaust stacks rising from the collar, raked back like a hot rod's pipes.
  const pr = 0.0042 + ctx.p.bulk * 0.001;
  for (let i = 0; i < 3; i++) {
    const z = a + 0.014 + i * 0.013;
    const base: Vec3 = [0, R * 0.7, z];
    const tip: Vec3 = [0, R + 0.022 + ctx.p.ornament * 0.008, z - 0.008];
    put(ctx, c, 'Trim', rod(base, tip, pr, 10));
    put(ctx, c, 'Detail', lathe([[0, -0.002], [pr * 1.25, -0.002], [pr * 1.25, 0.003], [pr * 0.8, 0.003], [pr * 0.8, 0.001], [0, 0.001]], 10), tip, [-Math.PI / 2 + 0.33, 0, 0]);
  }
  return len + 0.004;
}

/** Streamlined deco stock with chrome speed lines. */
const decoStock: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'deco', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const bt = top - 0.004 - drop * 0.4, bb = -0.1 - drop;
  side(ctx, s, 'Stock', smoothPolygon([[z0 + 0.01, top - 0.002], [zb + 0.04, bt + 0.004], [zb, bt - 0.006], [zb + 0.004, bb], [zb + 0.05, bb + 0.012], [z0 - 0.05, bottom - 0.006], [z0 + 0.01, bottom + 0.006]], 2), 0.04, 0.008);
  speedLines(ctx, s, 0.02, zb + 0.03, z0 - 0.02, (bt + bb) / 2 + 0.012, 3);
  side(ctx, s, 'Detail', [[zb + 0.002, bt - 0.004], [zb - 0.01, bt - 0.006], [zb - 0.008, bb + 0.002], [zb + 0.004, bb]], 0.042, 0.003);
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (bt + bb) / 2, zb - 0.008], forward: [0, 0, -1], description: 'Butt of the stock.' });
};

/** Jerrycan magazine: a flat-sided can with an embossed X, under the receiver. */
const jerrycan: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0: m0, z1: m1 } = L.magwell;
  const yB = L.rec.bottom;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'jerrycan', pivot: [0, yB, (m0 + m1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.25], purpose: 'reload' },
  });
  side(ctx, m, 'Magazine', [[m0 + 0.006, yB + 0.008], [m1 - 0.006, yB + 0.008], [m1 - 0.008, yB - 0.024], [m0 + 0.008, yB - 0.024]], 0.026, 0.001);
  const hgt = 0.09 + p.bulk * 0.03, len = 0.1 + p.bulk * 0.02, wid = 0.05 + p.bulk * 0.012;
  const zc = (m0 + m1) / 2 + 0.008, yc = yB - 0.022 - hgt / 2;
  put(ctx, m, 'Magazine', box([0, yc, zc], [wid, hgt, len], ctx.bevel(0.008)));
  for (const a of [0.7, -0.7]) put(ctx, m, 'Magazine', box([0, 0, 0], [wid + 0.003, 0.006, Math.hypot(hgt, len) * 0.7], ctx.bevel(0.0015)), [0, yc, zc], [a, 0, 0]);
  put(ctx, m, 'Detail', box([0, yB - 0.02, zc - len * 0.3], [0.012, 0.01, 0.02], ctx.bevel(0.002)));
};

export const DIESEL_RECEIVERS: Record<string, PartBuilder> = { deco, riveted };
export const DIESEL_HANDGUARDS: Record<string, PartBuilder> = { radiator };
export const DIESEL_STOCKS: Record<string, PartBuilder> = { deco: decoStock };
export const DIESEL_MAGAZINES: Record<string, PartBuilder> = { jerrycan };

/** Searchlight on top: lamp housing, warm bulb, glass front. */
export function lampOptic(ctx: BuildContext, c: Component, y: number, z: number): { eyeY: number; rearZ: number } {
  const seg = ctx.seg(1);
  const R = 0.028, yc = y + R + 0.01;
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.014, 0.008, 0.03], ctx.bevel(0.001)));
  put(ctx, c, 'Sight', lathe([[0, z - 0.03], [R * 0.6, z - 0.03], [R, z - 0.01], [R, z + 0.025], [R * 1.08, z + 0.028], [R * 0.9, z + 0.028], [R * 0.9, z + 0.022]], seg), [0, yc, 0]);
  put(ctx, c, 'Emissive', cylinder(R * 0.85, z + 0.018, z + 0.02, seg), [0, yc, 0]);
  put(ctx, c, 'Glass', cylinder(R * 0.9, z + 0.022, z + 0.024, seg), [0, yc, 0]);
  for (let i = 0; i < 3; i++) put(ctx, c, 'Trim', box([0, yc - R * 0.5 + i * R * 0.5, z + 0.025], [R * 1.7, 0.0016, 0.0016]));
  return { eyeY: y + 0.012, rearZ: z - 0.05 };
}

/** Deco pistol: a streamlined body with fins, speed lines and a finned barrel. */
export const decoPistol: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = b.component('Frame', { kind: 'frame', variant: 'deco', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, f, 'Body', smoothPolygon([
    [z0 - 0.008, 0.002], [z0 + 0.01, top], [z1 - 0.05, top + 0.004], [z1 - 0.02, top * 0.5], [z1 - 0.024, -0.008],
    [L.grip.z + 0.06, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.004], [z0 - 0.004, -0.008],
  ], 2), w * 1.05, 0.004);
  speedLines(ctx, f, w * 0.525, z0 + 0.02, z1 - 0.06, top - 0.006, 2);
  side(ctx, f, 'Trim', [[z0 + 0.02, top + 0.002], [z0 + 0.07, top + 0.005], [z0 + 0.06, top + 0.014], [z0 + 0.03, top + 0.01]], 0.004, 0.001);
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'finned', pivot: [0, 0, z1 - 0.03] });
  const rb = L.barrel.radius;
  put(ctx, bar, 'Barrel', lathe([[rb * 0.5, z1 - 0.03], [rb * 1.2, z1 - 0.03], [rb * 1.2, L.barrel.z1], [rb * 0.5, L.barrel.z1]], ctx.seg(0.8)));
  for (let z = z1 - 0.02; z < L.barrel.z1 - 0.005; z += 0.006) put(ctx, bar, 'Barrel', lathe([[rb * 1.2, z], [rb * 2.1, z + 0.0005], [rb * 2.1, z + 0.0025], [rb * 1.2, z + 0.003]], ctx.seg(0.8)));
  pistolTrigger(ctx, 'Trim', true);
  gripMagazine(ctx);
  L.mountY = top + 0.004;
};

// ===========================================================================
// CYBERPUNK
// ===========================================================================

const neon = (ctx: BuildContext): MaterialSlot => (ctx.style.traits.glow ? 'Emissive' : 'Accent');

/** Corporate chassis: angular layers, a neon edge and a built-in ammo display. */
const chassis: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'chassis', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, rec, 'Detail', [[z0, bottom + 0.008], [z0 + 0.02, bottom], [L.magwell.z1 + 0.006, bottom], [z1 - 0.01, -0.004], [z1 + 0.006, -0.004], [z1, top - 0.004], [z0, top - 0.004]], w * 0.9, 0.0015);
  side(ctx, rec, 'Body', [
    [z0 + 0.012, bottom + 0.004], [z0 + 0.05, bottom + 0.002], [z1 - 0.05, -0.008], [z1 - 0.012, -0.004], [z1 - 0.02, top - 0.002], [z0 + 0.06, top + 0.002], [z0 + 0.012, top - 0.012],
  ], w + 0.004, 0.002);
  side(ctx, rec, neon(ctx), [[z0 + 0.06, top + 0.002], [z1 - 0.02, top - 0.002], [z1 - 0.022, top + 0.0005], [z0 + 0.06, top + 0.0045]], w + 0.0045);
  // Side display: a bezel and a glowing screen.
  const sz = z0 + (z1 - z0) * 0.42, sy = (top + bottom) / 2;
  for (const s of [1, -1]) {
    put(ctx, rec, 'Detail', box([s * (w / 2 + 0.0025), sy, sz], [0.0015, 0.016, 0.036], ctx.bevel(0.0005)));
    put(ctx, rec, 'Emissive', box([s * (w / 2 + 0.0034), sy, sz], [0.0008, 0.011, 0.03]));
  }
  for (let i = 0; i < 3; i++) put(ctx, rec, 'Detail', box([0, 0, 0], [w + 0.005, 0.0018, 0.012]), [0, top - 0.008 - i * 0.004, z1 - 0.035], [0.5, 0, 0]);
  if (ctx.style.traits.rails) {
    rail(ctx, rec, z0 + 0.02, L.handguard.z1 - 0.01, top + 0.002);
    L.extra.topRail = 1;
    L.mountY = top + 0.0095;
  } else L.mountY = top + 0.004;
  triggerAndGuard(ctx, 'Body', 'square');
};

/** Street-built: a stock rifle body, plus cables, stickers and neon tape. */
const street: PartBuilder = (ctx) => {
  RECEIVERS.angular(ctx);
  const { L, b } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'street' });
  rec.variant = 'street';
  const { z0, z1, top, bottom, width: w } = L.rec;
  const rng = ctx.rng('street');
  // Stickers: little flat rectangles in the accent color.
  for (let i = 0; i < 3; i++) {
    const z = z0 + rng.range(0.03, (z1 - z0) - 0.03), y = rng.range(bottom + 0.01, top - 0.008);
    put(ctx, rec, i === 0 ? 'Emissive' : 'Accent', box([0, 0, 0], [0.0008, rng.range(0.006, 0.012), rng.range(0.01, 0.02)]), [w / 2 + 0.0012, y, z], [rng.range(-0.3, 0.3), 0, 0]);
  }
  // Neon tape wrapped around the front of the receiver.
  put(ctx, rec, neon(ctx), box([0, (top + bottom) / 2, z1 - 0.025], [w + 0.003, top - bottom + 0.003, 0.008]));
  // A cable from the back of the receiver down to the magazine well.
  cable(ctx, rec, [-w / 2 - 0.004, top - 0.008, z0 + 0.02], [-w / 2 - 0.004, bottom, L.magwell.z0 - 0.004], 0.012, 0.0022, 'Accent');
};

/** Hex handguard with two exposed cables and LED dots. */
const cabled: PartBuilder = (ctx) => {
  const { L } = ctx;
  const { z0, z1, radius } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'cabled', pivot: [0, 0, z0] });
  const R = radius * 1.02;
  put(ctx, h, 'Body', lathe([[L.barrel.radius + 0.003, z0], [R * 0.9, z0], [R, z0 + 0.006], [R, z1 - 0.008], [R * 0.85, z1], [L.barrel.radius + 0.003, z1]], 6, Math.PI / 6));
  for (const s of [1, -1]) cable(ctx, h, [s * R * 0.95, -R * 0.4, z0 + 0.012], [s * R * 0.95, -R * 0.4, z1 - 0.014], 0.008, 0.0024, s > 0 ? 'Accent' : neon(ctx));
  for (let z = z0 + 0.03; z < z1 - 0.02; z += 0.03) put(ctx, h, 'Emissive', box([R * 0.88, R * 0.45, z], [0.0012, 0.003, 0.003]));
};

/** Smart muzzle: an angular brake with a neon ring and a sensor eye. Returns length. */
export function smartMuzzle(ctx: BuildContext, c: Component, a: number, rb: number): number {
  const W = rb * 3.6, H = rb * 3, len = 0.06;
  put(ctx, c, 'Barrel', box([0, 0, a + len / 2], [W, H, len], ctx.bevel(0.003)));
  put(ctx, c, neon(ctx), box([0, 0, a + len * 0.3], [W + 0.002, H + 0.002, 0.004]));
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * (W / 2 + 0.0004), 0, a + len * 0.65], [0.0016, H * 0.6, len * 0.35]));
  put(ctx, c, 'Emissive', dome(0.0022, 0.0018, 8, 2), [0, H / 2 + 0.0002, a + len * 0.8], [-Math.PI / 2, 0, 0]);
  return len;
}

/** Smart magazine: a glass window over the rounds and an LED ammo counter. */
const smartmag: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0: m0, z1: m1 } = L.magwell;
  const yT = L.rec.bottom + 0.008, len = L.magLength;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'smart', pivot: [0, L.rec.bottom, (m0 + m1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.25], purpose: 'reload' },
  });
  const bz = m0 + 0.003, fz = m1 - 0.003, tilt = 0.012;
  const width = 0.024 + p.bulk * 0.004;
  side(ctx, m, 'Magazine', [[bz, yT], [fz, yT], [fz + tilt, yT - len], [bz + tilt, yT - len]], width, 0.002);
  const wz0 = bz + 0.008, wz1 = fz - 0.008;
  side(ctx, m, 'Glass', [[wz0, yT - 0.025], [wz1, yT - 0.025], [wz1 + tilt * 0.8, yT - len + 0.02], [wz0 + tilt * 0.8, yT - len + 0.02]], width + 0.002, 0.0008);
  side(ctx, m, 'Trim', [[wz0 + 0.002, yT - 0.03], [wz1 - 0.002, yT - 0.03], [wz1 + tilt * 0.75, yT - len + 0.025], [wz0 + tilt * 0.75 + 0.004, yT - len + 0.025]], width - 0.004);
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs, y = yT - 0.02 - t * (len - 0.04);
    put(ctx, m, i < 4 ? 'Emissive' : 'Detail', box([0, y, fz + tilt * t + 0.0008], [width * 0.5, 0.004, 0.0016]));
  }
  put(ctx, m, 'Detail', box([0, yT - len - 0.002, (bz + fz) / 2 + tilt], [width + 0.003, 0.006, fz - bz + 0.006], ctx.bevel(0.0015)));
};

/** Neon grip: a slim grip with a light strip down the back and a wrap. */
const neonGrip: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'neon', pivot: [0, L.grip.y, L.grip.z] });
  const D = 0.032 + p.bulk * 0.006, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', raked(o, L.grip.angle, [[-0.006, 0.002], [Lg, 0.004], [Lg + 0.006, -D * 0.4], [Lg, -D - 0.002], [0.01, -D - 0.002], [-0.004, -D - 0.008], [-0.008, -D * 0.5]]), 0.028, 0.0025);
  side(ctx, g, neon(ctx), raked(o, L.grip.angle, [[0.012, -D - 0.0015], [Lg - 0.008, -D - 0.0015], [Lg - 0.008, -D - 0.004], [0.012, -D - 0.004]]), 0.012);
  side(ctx, g, 'Accent', raked(o, L.grip.angle, [[Lg * 0.3, 0.0016], [Lg * 0.45, 0.0016], [Lg * 0.45, -D - 0.0016], [Lg * 0.3, -D - 0.0016]]), 0.0295);
};

/** Blade stock: an angular open frame with a neon edge. */
const blade: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'blade', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const bt = top - drop * 0.3, bb = -0.09 - drop, t = 0.012;
  side(ctx, s, 'Stock', [
    [z0 + 0.006, top - 0.002], [zb + 0.03, bt + 0.004], [zb, bt - 0.01], [zb + 0.006, bb], [z0 - 0.02, bottom - 0.002], [z0 + 0.006, bottom + 0.008],
    [z0 - 0.02, bottom + 0.008 + t * 0.5], [zb + t + 0.008, bb + t], [zb + t + 0.004, bt - t * 0.6], [z0 - 0.012, top - 0.002 - t],
  ], 0.026, 0.002);
  side(ctx, s, 'Stock', [[z0 - 0.02, top - t], [z0 + 0.006, top - t], [z0 + 0.006, bottom + 0.008], [z0 - 0.02, bottom + 0.008]], 0.028, 0.002);
  side(ctx, s, neon(ctx), [[z0 - 0.01, top + 0.0005], [zb + 0.03, bt + 0.0045], [zb + 0.03, bt + 0.0065], [z0 - 0.01, top + 0.0025]], 0.0265);
  side(ctx, s, 'Grip', [[zb + 0.002, bt - 0.008], [zb - 0.008, bt - 0.01], [zb - 0.004, bb], [zb + 0.006, bb]], 0.03, 0.002);
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (bt + bb) / 2, zb - 0.006], forward: [0, 0, -1], description: 'Butt of the blade stock.' });
};

export const CYBER_RECEIVERS: Record<string, PartBuilder> = { chassis, street };
export const CYBER_HANDGUARDS: Record<string, PartBuilder> = { cabled };
export const CYBER_STOCKS: Record<string, PartBuilder> = { blade };
export const CYBER_GRIPS: Record<string, PartBuilder> = { neon: neonGrip };
export const CYBER_MAGAZINES: Record<string, PartBuilder> = { smartmag };

/** Smart-link sight: an angled housing with a lens in front and a screen facing the shooter. */
export function smartOptic(ctx: BuildContext, c: Component, y: number, z: number): { eyeY: number; rearZ: number } {
  const yc = y + 0.022;
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.022, 0.008, 0.04], ctx.bevel(0.001)));
  side(ctx, c, 'Sight', [[z - 0.03, y + 0.006], [z + 0.03, y + 0.006], [z + 0.034, yc + 0.012], [z - 0.02, yc + 0.016], [z - 0.034, yc]], 0.032, 0.003);
  put(ctx, c, 'Glass', box([0, yc + 0.002, z + 0.033], [0.024, 0.02, 0.0015]));
  put(ctx, c, 'Emissive', box([0, 0, 0], [0.024, 0.016, 0.0012]), [0, yc + 0.004, z - 0.031], [-0.35, 0, 0]);
  put(ctx, c, ctx.style.traits.glow ? 'Emissive' : 'Accent', box([0.0165, yc + 0.006, z], [0.0008, 0.002, 0.05]));
  cable(ctx, c, [-0.016, yc, z - 0.02], [-ctx.L.rec.width / 2 - 0.003, ctx.L.rec.top - 0.01, z - 0.06], 0.006, 0.0018, 'Accent');
  return { eyeY: yc + 0.004, rearZ: z - 0.034 };
}

/** Smartgun pistol: an angular slab with a side display and a slotted shroud. */
export const smartgun: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = b.component('Frame', { kind: 'frame', variant: 'smartgun', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, f, 'Body', [[z0 - 0.004, top - 0.008], [z0 + 0.012, top + 0.004], [z1 - 0.012, top + 0.002], [z1, top - 0.006], [z1, -0.012], [L.grip.z + 0.05, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.004], [z0, -0.006]], w * 1.1, 0.002);
  side(ctx, f, 'Trim', [[z0 + 0.02, top - 0.002], [z1 - 0.03, top - 0.002], [z1 - 0.024, 0.0], [z0 + 0.03, 0.0]], w * 1.1 + 0.004, 0.0015);
  for (const s of [1, -1]) put(ctx, f, 'Emissive', box([s * (w * 0.55 + 0.0026), (top) / 2, z0 + 0.04], [0.0008, 0.008, 0.024]));
  side(ctx, f, neon(ctx), [[z0 + 0.03, -0.004], [z1 - 0.01, -0.006], [z1 - 0.01, -0.0035], [z0 + 0.03, -0.0015]], w * 1.1 + 0.005);
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'shroud', pivot: [0, 0, z1] });
  put(ctx, bar, 'Barrel', box([0, 0.002, (z1 + L.barrel.z1) / 2], [w * 0.8, 0.018, L.barrel.z1 - z1], ctx.bevel(0.002)));
  put(ctx, bar, 'Emissive', box([0, 0.0115, (z1 + L.barrel.z1) / 2], [0.003, 0.001, (L.barrel.z1 - z1) * 0.7]));
  pistolTrigger(ctx, 'Body', false);
  gripMagazine(ctx);
  L.mountY = top + 0.004;
};
