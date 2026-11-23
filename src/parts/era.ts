/**
 * Historical parts (WW1 / WW2 / Vietnam era). Generic period shapes, not
 * replicas of particular models: bolt-action receivers, full-length military
 * stocks, internal and stick magazines, top-fed machine-gun magazines, leaf
 * sights, bayonets, a ribbed triangular handguard, and two early pistols.
 */
import { AXIS_X, AXIS_Y, Vec2, bezier, box, cylinder, extrudeFront, lathe, ring, smoothPolygon } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put, raked, side } from './context.js';
import { triggerAndGuard } from './receiver.js';
import { boltHandle } from './accessory.js';
import { pistolTrigger } from './pistol.js';

// ---------------------------------------------------------------------------
// Receivers
// ---------------------------------------------------------------------------

/** Bolt action: a round steel receiver with a bolt sleeve, handle and clip guide. */
const boltaction: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'boltaction', parent: null });
  const { z0, z1, bottom } = L.rec;
  const R = L.rec.top * 0.72;
  const seg = ctx.seg(1);
  put(ctx, rec, 'Body', lathe([[0, z0 + 0.02], [R * 0.9, z0 + 0.02], [R, z0 + 0.028], [R, z1 - 0.006], [R * 0.85, z1], [0, z1]], seg));
  // Bolt sleeve and cocking knob sticking out the back.
  put(ctx, rec, 'Detail', lathe([[0, z0 - 0.03], [R * 0.45, z0 - 0.03], [R * 0.6, z0 - 0.02], [R * 0.6, z0 + 0.02], [0, z0 + 0.02]], seg));
  put(ctx, rec, 'Detail', lathe([[0, z0 - 0.042], [R * 0.5, z0 - 0.04], [R * 0.5, z0 - 0.03], [0, z0 - 0.03]], 10));
  // Stripper-clip guide on top.
  put(ctx, rec, 'Detail', box([0, R + 0.003, z0 + 0.06], [0.014, 0.006, 0.012], ctx.bevel(0.001)));
  // Trigger housing under the round receiver (hidden when a full stock wraps it).
  side(ctx, rec, 'Barrel', [[z0 + 0.03, -R * 0.6], [z1 - 0.03, -R * 0.6], [z1 - 0.04, bottom + 0.004], [z0 + 0.04, bottom + 0.004]], R * 1.3, 0.001);
  L.mountY = R;
  L.rec.top = R;
  boltHandle(ctx);
  triggerAndGuard(ctx, 'Detail', 'round');
};

/** Tubular (stamped SMG): a long steel tube with a cocking slot and a magazine housing. */
const tubular: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'tubular', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const R = top * 0.82;
  const seg = ctx.seg(1);
  put(ctx, rec, 'Body', lathe([[0, z0 - 0.004], [R * 0.8, z0 - 0.004], [R, z0 + 0.004], [R, z1], [R * 0.8, z1 + 0.006], [0, z1 + 0.006]], seg));
  put(ctx, rec, 'Detail', box([-R - 0.0004, R * 0.2, (z0 + z1) / 2 - 0.02], [0.002, 0.005, (z1 - z0) * 0.55]));
  const ch = b.component('ChargingHandle', {
    kind: 'charging_handle', variant: 'knob', pivot: [-R, R * 0.2, z1 - 0.05],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.09], purpose: 'charge' },
  });
  put(ctx, ch, 'Detail', cylinder(0.004, 0, 0.014, 8), [-R, R * 0.2, z1 - 0.05], [0, -Math.PI / 2, 0]);
  put(ctx, ch, 'Detail', cylinder(0.006, 0, 0.004, 10, ctx.bevel(0.001)), [-R - 0.014, R * 0.2, z1 - 0.05], [0, -Math.PI / 2, 0]);
  // Lower: trigger frame + magazine housing.
  side(ctx, rec, 'Body', [[z0 + 0.03, -R * 0.5], [z1 - 0.02, -R * 0.5], [L.magwell.z1 + 0.006, bottom - 0.004], [L.magwell.z0 - 0.006, bottom - 0.004], [z0 + 0.04, bottom + 0.006]], w * 0.6, 0.0015);
  L.mountY = R;
  triggerAndGuard(ctx, 'Body', 'square');
};

export const ERA_RECEIVERS: Record<string, PartBuilder> = { boltaction, tubular };

// ---------------------------------------------------------------------------
// Stock, handguards
// ---------------------------------------------------------------------------

/**
 * Full-length military stock: straight wrist, wood running almost to the
 * muzzle, an upper handguard over the barrel, barrel bands and a nose cap.
 */
const military: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rng = ctx.rng('military');
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'military', pivot: [0, 0, L.rec.z0] });
  const zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom, rb = L.barrel.radius;
  const tipZ = L.barrel.z1 - rng.range(0.05, 0.12);
  const fDepth = -(0.024 + p.bulk * 0.008);
  const heelY = top * 0.4 - drop * 0.4, toeY = -0.1 - drop;
  const lower = bezier([zb + 0.004, toeY], [zb + 0.1, toeY + 0.01], [L.grip.z - 0.12, bottom - 0.026], [L.grip.z - 0.02, bottom - 0.012], 8);
  const prof: Vec2[] = [
    [zb + 0.012, heelY], [L.rec.z0 - 0.01, top * 0.3], [L.rec.z0 + 0.02, -rb * 0.3], [tipZ - 0.012, -rb * 0.4], [tipZ, -rb - 0.006],
    [tipZ - 0.004, fDepth + 0.006], [L.trigger.z + 0.07, fDepth], [L.trigger.z + 0.04, bottom - 0.01], ...lower.reverse(), [zb, toeY + 0.004], [zb, heelY - 0.006],
  ];
  side(ctx, s, 'Stock', smoothPolygon(prof, ctx.p.smoothness > 0.3 ? 1 : 0), 0.038, 0.006);
  // Upper handguard on top of the barrel.
  const hz0 = L.rec.z1 + 0.012, hz1 = tipZ - 0.06;
  if (hz1 > hz0 + 0.04) side(ctx, s, 'Stock', [[hz0, rb * 0.2], [hz1, rb * 0.2], [hz1 - 0.004, rb + 0.007], [hz0 + 0.004, rb + 0.007]], rb * 2.2, 0.003);
  // Barrel bands, nose cap, butt plate, sling swivels.
  const seg = ctx.seg(0.9);
  for (const z of [hz0 + (hz1 - hz0) * 0.35, hz1 + 0.004]) {
    put(ctx, s, 'Detail', lathe([[rb * 1.9, z - 0.006], [rb * 2.15, z - 0.005], [rb * 2.15, z + 0.005], [rb * 1.9, z + 0.006]], seg), [0, -rb * 0.6, 0]);
  }
  put(ctx, s, 'Detail', box([0, (-rb - 0.006 + fDepth) / 2, tipZ - 0.006], [0.03, -fDepth - rb, 0.014], ctx.bevel(0.002)));
  side(ctx, s, 'Detail', [[zb + 0.004, heelY + 0.001], [zb - 0.004, heelY - 0.003], [zb - 0.003, toeY + 0.002], [zb + 0.005, toeY]], 0.04, 0.0015);
  put(ctx, s, 'Detail', ring(0.008, 0.0015, 0, 8, 4), [0, fDepth - 0.006, tipZ - 0.09], AXIS_X);
  L.extra.stockBottom = fDepth;
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (heelY + toeY) / 2, zb - 0.004], forward: [0, 0, -1], description: 'Steel butt plate.' });
};

export const ERA_STOCKS: Record<string, PartBuilder> = { military };

/** Ribbed triangular handguard (late-sixties style). */
const triangle: PartBuilder = (ctx) => {
  const { L } = ctx;
  const { z0, z1, radius } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'triangle', pivot: [0, 0, z0] });
  const R = radius * 1.25;
  put(ctx, h, 'Stock', lathe([[L.barrel.radius + 0.003, z0], [R * 0.85, z0], [R, z0 + 0.012], [R, z1 - 0.012], [R * 0.8, z1], [L.barrel.radius + 0.003, z1]], 3, -Math.PI / 2));
  for (let z = z0 + 0.02; z < z1 - 0.02; z += 0.012) {
    put(ctx, h, 'Stock', lathe([[R, z - 0.002], [R * 1.05, z - 0.0015], [R * 1.05, z + 0.0015], [R, z + 0.002]], 3, -Math.PI / 2));
  }
  put(ctx, h, 'Detail', lathe([[R * 0.7, z0 - 0.008], [R * 0.95, z0 - 0.006], [R * 0.95, z0], [R * 0.7, z0 + 0.002]], ctx.seg(0.9)));
};

export const ERA_HANDGUARDS: Record<string, PartBuilder> = { triangle };

// ---------------------------------------------------------------------------
// Magazines
// ---------------------------------------------------------------------------

/** Internal magazine: only a flush floor plate shows (loaded with stripper clips). */
const internal: PartBuilder = (ctx) => {
  const { L } = ctx;
  const zc = (L.magwell.z0 + L.magwell.z1) / 2;
  const y = L.extra.stockBottom ?? L.rec.bottom - 0.006;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'internal', pivot: [0, y, zc],
    motion: { type: 'translate', axis: [0, 1, 0], range: [0, 0.03], purpose: 'reload (stripper clip pushed in from the top)' },
  });
  put(ctx, m, 'Detail', box([0, y - 0.001, zc], [0.024, 0.005, L.magwell.z1 - L.magwell.z0 + 0.02], ctx.bevel(0.0015)));
};

/** Long, thin, straight "stick" magazine (wartime SMGs). */
const stick: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0: m0, z1: m1 } = L.magwell;
  const yT = L.rec.bottom + 0.008, len = L.magLength * 1.45 + p.length * 0.02;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'stick', pivot: [0, L.rec.bottom, (m0 + m1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.3], purpose: 'reload' },
  });
  const zc = (m0 + m1) / 2, d = Math.min(0.036, m1 - m0);
  side(ctx, m, 'Magazine', [[zc - d / 2, yT], [zc + d / 2, yT], [zc + d / 2 + 0.003, yT - len], [zc - d / 2 + 0.003, yT - len]], 0.02, 0.0015);
  put(ctx, m, 'Detail', box([0, yT - len - 0.002, zc + 0.003], [0.023, 0.005, d + 0.006], ctx.bevel(0.001)));
  for (let i = 1; i < 4; i++) put(ctx, m, 'Magazine', box([0, yT - len * (i / 4), zc + 0.0015], [0.0215, 0.003, d * 0.6]));
};

/** Curved box magazine on top of the receiver (top-fed machine guns). */
const top: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0: m0, z1: m1 } = L.magwell;
  const y0 = L.rec.top - 0.004, len = L.magLength * 0.9 + p.bulk * 0.02;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'top', pivot: [0, L.rec.top, (m0 + m1) / 2],
    motion: { type: 'translate', axis: [0, 1, 0], range: [0, 0.2], purpose: 'reload' },
  });
  const curve = 0.03 + p.bulk * 0.01;
  const back = bezier([m0 + 0.004, y0], [m0 + 0.004, y0 + len * 0.5], [m0 + curve * 0.6, y0 + len * 0.85], [m0 + curve, y0 + len], 8);
  const front = bezier([m1 - 0.004, y0], [m1 - 0.004, y0 + len * 0.45], [m1 + curve * 0.6, y0 + len * 0.8], [m1 + curve + 0.004, y0 + len - 0.006], 8);
  side(ctx, m, 'Magazine', [[m0 + 0.004, y0], ...back, ...front.reverse()], 0.026, 0.002);
};

export const ERA_MAGAZINES: Record<string, PartBuilder> = { internal, stick, top };

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

/** Bayonet under the muzzle: a ring around the barrel, a handle and a blade. */
export function bayonet(ctx: BuildContext, length: number): void {
  const { L } = ctx;
  const rb = L.barrel.radius, z = L.barrel.z1 - 0.012;
  const c = ctx.b.component('Bayonet', { kind: 'bayonet', variant: 'blade', parent: 'Barrel', pivot: [0, -rb, z] });
  const yb = -rb - 0.009;
  put(ctx, c, 'Detail', lathe([[rb, z - 0.006], [rb + 0.003, z - 0.005], [rb + 0.003, z + 0.005], [rb, z + 0.006]], ctx.seg(0.8)));
  side(ctx, c, 'Stock', [[z - 0.1, yb + 0.005], [z - 0.004, yb + 0.005], [z - 0.004, yb - 0.006], [z - 0.1, yb - 0.005]], 0.012, 0.002);
  side(ctx, c, 'Barrel', [[z, yb + 0.006], [z + length * 0.9, yb + 0.004], [z + length, yb - 0.001], [z + length * 0.9, yb - 0.006], [z, yb - 0.005]], 0.0035, 0.0006);
  ctx.b.socket({ name: 'SOCKET_Bayonet', parent: 'Bayonet', position: [0, yb, z + length], forward: [0, 0, 1], description: 'Bayonet tip.' });
}

/** Perforated heat shield over a shotgun barrel. */
export function heatShield(ctx: BuildContext): void {
  const { L } = ctx;
  const rb = L.barrel.radius;
  const z0 = L.handguard.z1 + 0.01, z1 = L.barrel.z1 - 0.03;
  if (z1 - z0 < 0.08) return;
  const c = ctx.b.component('HeatShield', { kind: 'heat_shield', variant: 'perforated', parent: 'Barrel', pivot: [0, rb, z0] });
  const R = rb + 0.006, t = 0.0018;
  const arc: Vec2[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = 0.15 * Math.PI + (i / 8) * 0.7 * Math.PI;
    arc.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  const inner = arc.map(([x, y]) => [x * (1 - t / R), y * (1 - t / R)] as Vec2).reverse();
  put(ctx, c, 'Body', extrudeFront([...arc, ...inner], z0, z1, 0));
  for (let z = z0 + 0.015; z < z1 - 0.01; z += 0.018) put(ctx, c, 'Detail', cylinder(0.0035, 0, 0.0012, 8), [0, R + 0.0002, z], AXIS_Y);
}

// ---------------------------------------------------------------------------
// Leaf sight (optic builder lives here to keep era bits together)
// ---------------------------------------------------------------------------

/** Tangent leaf rear sight on the barrel and a hooded front blade. */
export function leafSight(ctx: BuildContext, c: Component, y: number): { eyeY: number; rearZ: number } {
  const { L } = ctx;
  const rb = L.barrel.radius;
  const z = L.rec.z1 + 0.012;
  const base = Math.max(y, rb + 0.008);
  put(ctx, c, 'Detail', box([0, base - 0.003, z], [0.016, 0.008, 0.03], ctx.bevel(0.0015)));
  put(ctx, c, 'Detail', box([0, 0, 0], [0.014, 0.0025, 0.03]), [0, base + 0.003, z + 0.004], [-0.12, 0, 0]);
  put(ctx, c, 'Detail', box([0, base + 0.007, z - 0.009], [0.014, 0.006, 0.002]));
  const front = ctx.b.component('FrontSight', { kind: 'sight', variant: 'hooded', parent: 'Barrel', pivot: [0, rb, L.barrel.z1 - 0.014] });
  const fz = L.barrel.z1 - 0.014;
  put(ctx, front, 'Detail', box([0, rb + 0.003, fz], [0.008, 0.006, 0.014], ctx.bevel(0.001)));
  put(ctx, front, 'Detail', box([0, rb + 0.009, fz], [0.002, 0.008, 0.003]));
  const hood: Vec2[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    hood.push([Math.cos(a) * 0.008, rb + 0.006 + Math.sin(a) * 0.008]);
  }
  const hoodIn = hood.map(([x, yy]) => [x * 0.8, rb + 0.006 + (yy - rb - 0.006) * 0.8] as Vec2).reverse();
  put(ctx, front, 'Detail', extrudeFront([...hood, ...hoodIn], fz - 0.008, fz + 0.008));
  return { eyeY: base + 0.008, rearZ: z - 0.03 };
}

// ---------------------------------------------------------------------------
// Pistols
// ---------------------------------------------------------------------------

/** Broomhandle-style pistol: magazine housing ahead of the trigger, long barrel, round grip. */
export const broomhandle: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = b.component('Frame', { kind: 'frame', variant: 'broomhandle', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const mz0 = L.grip.z + 0.045, mz1 = mz0 + 0.05;
  side(ctx, f, 'Body', [[z0, top], [mz1 + 0.01, top], [mz1 + 0.02, -0.006], [mz1 + 0.006, -0.012], [mz1 + 0.006, bottom - 0.03], [mz0 - 0.002, bottom - 0.03], [mz0 - 0.002, bottom], [L.grip.z - 0.04, bottom + 0.004], [z0 - 0.004, top - 0.012]], w, 0.002);
  put(ctx, f, 'Detail', box([0, bottom - 0.031, (mz0 + mz1) / 2], [w + 0.002, 0.004, mz1 - mz0 + 0.004], ctx.bevel(0.001)));
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'long', pivot: [0, 0, mz1] });
  const rb = L.barrel.radius;
  put(ctx, bar, 'Barrel', lathe([[rb * 0.5, mz1], [rb * 1.4, mz1], [rb * 1.4, mz1 + 0.02], [rb, mz1 + 0.026], [rb, z1], [rb * 0.5, z1]], ctx.seg(0.8)));
  put(ctx, bar, 'Detail', box([0, rb + 0.003, z1 - 0.01], [0.002, 0.006, 0.006]));
  put(ctx, f, 'Detail', box([0, top + 0.004, z0 + 0.04], [0.012, 0.008, 0.03], ctx.bevel(0.001)));
  const hammer = b.component('Hammer', { kind: 'hammer', variant: 'ring', pivot: [0, top - 0.006, z0], motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.6], purpose: 'cock' } });
  put(ctx, hammer, 'Detail', ring(0.006, 0.0018, 0, 10, 4), [0, top + 0.003, z0 - 0.006], AXIS_X);
  pistolTrigger(ctx, 'Detail', true);
  L.mountY = top + 0.008;
  L.extra.revolver = 1;
};

/** Round, grooved "broomhandle" pistol grip. */
export const broomGrip: PartBuilder = (ctx) => {
  const { L } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'broom', pivot: [0, L.grip.y, L.grip.z] });
  const D = L.extra.gripDepth * 0.85, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', smoothPolygon(raked(o, L.grip.angle, [[-0.004, 0], [Lg, 0], [Lg + 0.012, -D * 0.5], [Lg, -D], [-0.004, -D]]), 2), 0.028, 0.008);
  for (let i = 1; i < 8; i++) {
    const t = (i / 8) * Lg;
    side(ctx, g, 'Grip', raked(o, L.grip.angle, [[t - 0.002, 0.0012], [t + 0.002, 0.0012], [t + 0.002, -D - 0.0012], [t - 0.002, -D - 0.0012]]), 0.03);
  }
  const [z, y] = raked(o, L.grip.angle, [[Lg + 0.008, -D * 0.5]])[0];
  put(ctx, g, 'Detail', ring(0.006, 0.0015, 0, 10, 4), [0, y - 0.006, z], AXIS_X);
};

/** Toggle-lock pistol: slim barrel, a jointed toggle on top, steeply raked grip. */
export const toggle: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = b.component('Frame', { kind: 'frame', variant: 'toggle', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, f, 'Body', [[z0 + 0.01, top - 0.008], [z0 + 0.1, top - 0.008], [z0 + 0.11, -0.01], [L.grip.z + 0.05, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.004], [z0, top - 0.016]], w * 0.95, 0.002);
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'slim', pivot: [0, 0, z0 + 0.1] });
  const rb = L.barrel.radius;
  put(ctx, bar, 'Barrel', lathe([[rb * 0.5, z0 + 0.1], [rb * 1.5, z0 + 0.1], [rb * 1.5, z0 + 0.115], [rb, z0 + 0.12], [rb, z1], [rb * 0.5, z1]], ctx.seg(0.8)));
  put(ctx, bar, 'Detail', box([0, rb + 0.004, z1 - 0.008], [0.002, 0.007, 0.006]));
  const tg = b.component('Toggle', {
    kind: 'toggle', variant: 'knee', pivot: [0, top - 0.004, z0 + 0.012],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.9], purpose: 'fire (the toggle folds up) / rack' },
  });
  side(ctx, tg, 'Detail', [[z0 + 0.005, top - 0.008], [z0 + 0.1, top - 0.008], [z0 + 0.1, top], [z0 + 0.05, top + 0.004], [z0 + 0.005, top]], w * 0.6, 0.0015);
  for (const zz of [z0 + 0.004, z0 + 0.05]) put(ctx, tg, 'Detail', cylinder(0.007, -w * 0.4, w * 0.4, 10), [0, top - 0.002, zz], [0, Math.PI / 2, 0]);
  pistolTrigger(ctx, 'Detail', true);
  L.mountY = top + 0.004;
};
