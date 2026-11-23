/**
 * Silhouette-changing variants for the long-gun family: double barrels,
 * break-action forends, finned barrels, cooling jackets, thumbhole and
 * bullpup stocks, stockless rears and top-mounted pan magazines.
 */
import { AXIS_Y, Vec2, box, cylinder, dome, lathe, ring, smoothPolygon, tube } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import { BuildContext, put, raked, side } from './context.js';

function barrelComp(ctx: BuildContext, variant: string, pivot?: [number, number, number], breakOpen = false) {
  return ctx.b.component('Barrel', {
    kind: 'barrel', variant, pivot: pivot ?? [0, 0, ctx.L.barrel.z0],
    motion: breakOpen ? { type: 'rotate', axis: [1, 0, 0], range: [0, 0.55], purpose: 'break open to reload' } : undefined,
  });
}

// ---------------------------------------------------------------------------
// Barrels
// ---------------------------------------------------------------------------

/** Side-by-side double barrel (break action: the barrels tip down on a hinge). */
const double: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const rb = L.barrel.radius;
  const off = rb + 0.0012;
  L.extra.barrelBottom = -rb;
  L.extra.barrelHalfWidth = off + rb;
  const c = barrelComp(ctx, 'double', [0, -rb, L.rec.z1], true);
  const seg = ctx.seg(0.9);
  for (const x of [off, -off]) put(ctx, c, 'Barrel', tube(rb, rb * 0.72, L.barrel.z0, L.barrel.z1, seg), [x, 0, 0]);
  // Rib on top and filler underneath, joining the pair.
  put(ctx, c, 'Detail', box([0, rb * 0.72, (L.barrel.z0 + L.barrel.z1) / 2 + 0.005], [rb * 0.7, 0.003, L.barrel.z1 - L.barrel.z0 - 0.01]));
  put(ctx, c, 'Barrel', box([0, -rb * 0.55, (L.barrel.z0 + L.barrel.z1) / 2], [rb * 0.5, rb * 0.5, L.barrel.z1 - L.barrel.z0 - 0.004]));
  put(ctx, c, 'Trim', cylinder(0.0022, 0, 0.004, 8), [0, rb * 0.72 + 0.0015, L.barrel.z1 - 0.01], AXIS_Y);
  L.extra.muzzleX = off;
  b.socket({ name: 'SOCKET_Muzzle_2', parent: 'Barrel', position: [-off, 0, L.barrel.z1], forward: [0, 0, 1], description: 'Second barrel muzzle.' });
};

/** Over-under double barrel: one barrel stacked on the other. */
const overunder: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const rb = L.barrel.radius;
  const lowY = -(rb * 2 + 0.0015);
  L.extra.barrelBottom = lowY - rb;
  L.extra.barrelHalfWidth = rb;
  const c = barrelComp(ctx, 'overunder', [0, lowY - rb, L.rec.z1], true);
  const seg = ctx.seg(0.9);
  for (const y of [0, lowY]) put(ctx, c, 'Barrel', tube(rb, rb * 0.72, L.barrel.z0, L.barrel.z1, seg), [0, y, 0]);
  put(ctx, c, 'Barrel', box([0, lowY / 2, (L.barrel.z0 + L.barrel.z1) / 2], [rb * 0.45, -lowY - rb, L.barrel.z1 - L.barrel.z0 - 0.004]));
  put(ctx, c, 'Detail', box([0, rb + 0.0015, (L.barrel.z0 + L.barrel.z1) / 2 + 0.005], [rb * 0.8, 0.003, L.barrel.z1 - L.barrel.z0 - 0.01]));
  put(ctx, c, 'Trim', cylinder(0.0022, 0, 0.004, 8), [0, rb + 0.0028, L.barrel.z1 - 0.01], AXIS_Y);
  b.socket({ name: 'SOCKET_Muzzle_2', parent: 'Barrel', position: [0, lowY, L.barrel.z1], forward: [0, 0, 1], description: 'Lower barrel muzzle.' });
};

/** Barrel with a stack of cooling fins near the receiver. */
const finned: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = barrelComp(ctx, 'finned');
  const rb = L.barrel.radius;
  const seg = ctx.seg(0.9);
  put(ctx, c, 'Barrel', tube(rb, rb * 0.45, L.barrel.z0, L.barrel.z1, ctx.seg(0.8)));
  const z0 = Math.max(L.handguard.z1, L.barrel.z0) + 0.006;
  const count = 6 + Math.round(p.detail * 6);
  const R = rb * (1.9 + p.bulk * 0.4);
  for (let i = 0; i < count; i++) {
    const z = z0 + i * 0.008;
    if (z > L.barrel.z1 - 0.02) break;
    put(ctx, c, 'Barrel', lathe([[rb, z], [R, z + 0.0005], [R, z + 0.0028], [rb, z + 0.0033]], seg));
  }
};

export const VARIETY_BARRELS: Record<string, PartBuilder> = { double, overunder, finned };

// ---------------------------------------------------------------------------
// Handguards
// ---------------------------------------------------------------------------

/** Short wooden forend under break-action barrels, plus the hinge. */
const splinter: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const bottom = L.extra.barrelBottom ?? -L.barrel.radius;
  const hw = L.extra.barrelHalfWidth ?? L.barrel.radius;
  const z0 = L.handguard.z0 + 0.004, z1 = Math.min(L.handguard.z1, z0 + 0.16 + p.length * 0.06);
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'splinter', parent: 'Barrel', pivot: [0, bottom, z0] });
  const depth = 0.022 + p.bulk * 0.008;
  side(ctx, h, 'Stock', smoothPolygon([
    [z0, bottom + L.barrel.radius * 0.6], [z1 - 0.012, bottom + L.barrel.radius * 0.6], [z1, bottom - 0.004], [z1 - 0.008, bottom - depth],
    [z0 + 0.02, bottom - depth - 0.003], [z0, bottom - depth + 0.006],
  ], 1), hw * 2 + 0.01, 0.006);
  put(ctx, h, 'Detail', box([0, bottom - depth + 0.002, z1 - 0.02], [0.008, 0.004, 0.016], ctx.bevel(0.001)));
  // Hinge pin on the receiver front.
  const rec = ctx.b.component(ctx.b.rootName, { kind: 'receiver', variant: '-' });
  put(ctx, rec, 'Detail', cylinder(0.005, -hw - 0.004, hw + 0.004, 10), [0, bottom, L.rec.z1 + 0.002], [0, Math.PI / 2, 0]);
  // Top lever behind the breech.
  put(ctx, rec, 'Detail', box([0, 0, 0], [0.01, 0.004, 0.026], ctx.bevel(0.0012)), [0, L.rec.top + 0.002, L.rec.z1 - 0.03], [0, 0.4, 0]);
};

/** Perforated cooling jacket around the barrel (classic machine-gun look). */
const jacket: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0, z1, radius } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'jacket', pivot: [0, 0, z0] });
  const R = radius * 1.12;
  const seg = ctx.seg(1);
  put(ctx, h, 'Body', lathe([[L.barrel.radius + 0.002, z0], [R, z0], [R, z1 - 0.02], [R * 0.6, z1], [L.barrel.radius + 0.002, z1]], seg));
  const cols = Math.floor((z1 - z0 - 0.04) / 0.022);
  const angles = [0.5, 0, -0.5].flatMap((a) => [a, Math.PI - a]);
  for (let i = 0; i < cols; i++) {
    const z = z0 + 0.025 + i * 0.022;
    for (const a of angles) {
      put(ctx, h, 'Detail', box([0, 0, 0], [0.0012, 0.0085, 0.012], ctx.bevel(0.0008)), [Math.cos(a) * (R - 0.0002), Math.sin(a) * (R - 0.0002), z], [0, 0, a]);
    }
  }
  if (p.ornament > 0.3) put(ctx, h, 'Trim', ring(R, 0.0022, z0 + 0.008, seg, 6));
};

/** No handguard: used when a one-piece (sporter) stock already runs under the barrel. */
const bare: PartBuilder = () => {};

export const VARIETY_HANDGUARDS: Record<string, PartBuilder> = { splinter, jacket, bare };

// ---------------------------------------------------------------------------
// Stocks
// ---------------------------------------------------------------------------

function shoulder(ctx: BuildContext, z: number, y: number, description = 'Butt of the stock, where it meets the shoulder.') {
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, y, z], forward: [0, 0, -1], description });
}

/** Thumbhole stock: the lower edge sweeps down to meet the bottom of the grip. */
const thumbhole: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'thumbhole', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const buttTop = top - 0.006 - drop * 0.4, buttBot = -0.105 - drop;
  const [gz, gy] = raked([L.grip.z, L.grip.y], L.grip.angle, [[L.grip.length - 0.004, -0.04]])[0];
  side(ctx, s, 'Stock', [
    [z0 + 0.006, top - 0.004], [zb + 0.014, buttTop], [zb, buttTop - 0.012], [zb, buttBot], [zb + 0.035, buttBot - 0.004],
    [gz - 0.004, gy - 0.008], [gz + 0.01, gy + 0.004], [zb + 0.07, buttBot + 0.022], [zb + 0.06, buttTop - 0.034],
    [z0 - 0.05, bottom - 0.004], [z0 + 0.006, bottom + 0.008],
  ], 0.04, 0.006);
  side(ctx, s, 'Grip', [[zb + 0.002, buttTop - 0.01], [zb - 0.011, buttTop - 0.012], [zb - 0.011, buttBot + 0.002], [zb + 0.002, buttBot]], 0.042, 0.003);
  shoulder(ctx, zb - 0.011, (buttTop + buttBot) / 2);
};

/** Bullpup butt: the receiver *is* the stock, so just a pad and a cheek rest. */
const butt: PartBuilder = (ctx) => {
  const { L } = ctx;
  const z0 = L.rec.z0;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'butt', pivot: [0, 0, z0] });
  const top = L.rec.top, bottom = L.rec.bottom - 0.02;
  side(ctx, s, 'Stock', [[z0 + 0.004, top], [z0 - 0.018, top - 0.004], [z0 - 0.018, bottom], [z0 + 0.004, bottom + 0.006]], L.rec.width * 0.95, 0.004);
  side(ctx, s, 'Grip', [[z0 - 0.016, top - 0.005], [z0 - 0.028, top - 0.007], [z0 - 0.028, bottom + 0.002], [z0 - 0.016, bottom]], L.rec.width * 0.97, 0.003);
  side(ctx, s, 'Stock', [[z0 + 0.004, top - 0.004], [z0 + 0.13, top - 0.004], [z0 + 0.11, top + 0.012], [z0 + 0.012, top + 0.016]], L.rec.width * 0.7, 0.004);
  shoulder(ctx, z0 - 0.028, (top + bottom) / 2);
};

/** No stock at all: a cap on the back of the receiver (sawed-offs, machine pistols). */
const none: PartBuilder = (ctx) => {
  const { L } = ctx;
  const z0 = L.rec.z0;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'none', pivot: [0, 0, z0] });
  put(ctx, s, 'Detail', box([0, (L.rec.top + L.rec.bottom) / 2, z0 - 0.004], [L.rec.width * 0.8, (L.rec.top - L.rec.bottom) * 0.7, 0.008], ctx.bevel(0.003)));
  shoulder(ctx, z0 - 0.008, (L.rec.top + L.rec.bottom) / 2, 'No stock: rear of the receiver (fired from the hip or one-handed).');
};

/**
 * One-piece "sporter" stock (hunting and bolt-action rifles): the wood runs
 * from the butt, through a carved pistol grip, all the way under the barrel.
 * The receiver sits *in* it, so the archetype drops the separate grip and
 * handguard when this is chosen.
 */
const sporter: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rng = ctx.rng('sporter');
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'sporter', pivot: [0, 0, L.rec.z0] });
  const zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom, rb = L.barrel.radius;
  const tipZ = Math.max(L.handguard.z1 - rng.range(0, 0.06), L.rec.z1 + 0.08);
  const fDepth = -(0.024 + p.bulk * 0.01) * rng.range(0.9, 1.25);
  const heelY = top * 0.5 - drop * 0.5, toeY = -0.095 - drop - p.bulk * 0.01;
  // Pistol-grip bulge, following the grip rake.
  const [gz, gy] = raked([L.grip.z, L.grip.y], L.grip.angle, [[L.grip.length * rng.range(0.7, 0.95), -0.012]])[0];
  const [bz, by] = raked([L.grip.z, L.grip.y], L.grip.angle, [[L.grip.length * 0.75, -0.045]])[0];
  const prof: Vec2[] = [
    [zb + 0.012, heelY], [L.rec.z0 + 0.01, top * 0.35], [L.rec.z0 + 0.02, -rb * 0.2], [tipZ - 0.012, -rb * 0.4], [tipZ, -rb - 0.006],
    [tipZ - 0.006, fDepth], [L.magwell.z1 + 0.01, fDepth - 0.002], [L.grip.z + 0.05, bottom - 0.004],
    [gz + 0.008, gy], [gz - 0.012, gy - 0.006], [bz - 0.008, by + 0.004], [zb + 0.12, toeY + 0.02], [zb + 0.004, toeY], [zb, heelY - 0.008],
  ];
  side(ctx, s, 'Stock', smoothPolygon(prof, ctx.p.smoothness > 0.3 ? 1 : 0), 0.04, 0.007);
  side(ctx, s, 'Grip', [[zb + 0.002, heelY - 0.004], [zb - 0.011, heelY - 0.006], [zb - 0.009, toeY + 0.002], [zb + 0.004, toeY]], 0.042, 0.003);
  // Barrel bands and a sling swivel.
  for (const z of [tipZ - 0.02]) put(ctx, s, 'Detail', lathe([[rb * 1.05, z - 0.005], [rb * 1.35, z - 0.004], [rb * 1.35, z + 0.004], [rb * 1.05, z + 0.005]], ctx.seg(0.8)));
  put(ctx, s, 'Detail', box([0, fDepth - 0.004, tipZ - 0.05], [0.006, 0.008, 0.012], ctx.bevel(0.001)));
  shoulder(ctx, zb - 0.011, (heelY + toeY) / 2);
};

/** Side-folding skeleton stock: an open frame with a butt pad. */
const frame: PartBuilder = (ctx) => {
  const { L } = ctx;
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const s = ctx.b.component('Stock', {
    kind: 'stock', variant: 'frame', pivot: [L.rec.width / 2, 0, z0],
    motion: { type: 'rotate', axis: [0, 1, 0], range: [0, Math.PI], purpose: 'fold' },
  });
  const t = 0.013;
  const bt = top - 0.006 - drop * 0.3, bb = -0.09 - drop;
  // An open "C" frame plus a front bar that closes it against the receiver.
  side(ctx, s, 'Stock', [
    [z0 + 0.006, top - 0.004], [zb, bt], [zb, bb], [z0 - 0.03, bottom - 0.004], [z0 + 0.006, bottom + 0.008],
    [z0 - 0.03, bottom + 0.008 + t * 0.3], [zb + t, bb + t], [zb + t, bt - t], [z0 - 0.02, top - 0.004 - t],
  ], 0.022, 0.003);
  side(ctx, s, 'Stock', [[z0 - 0.034, top - 0.004 - t], [z0 + 0.004, top - 0.004 - t], [z0 + 0.004, bottom + 0.008], [z0 - 0.034, bottom + 0.008]], 0.024, 0.002);
  side(ctx, s, 'Grip', [[zb + 0.002, bt + 0.002], [zb - 0.01, bt], [zb - 0.01, bb], [zb + 0.002, bb - 0.002]], 0.03, 0.003);
  shoulder(ctx, zb - 0.01, (bt + bb) / 2);
};

/** No separate grip: the stock has one carved in. */
const integral: PartBuilder = () => {};

export const VARIETY_STOCKS: Record<string, PartBuilder> = { thumbhole, butt, none, sporter, frame };
export const VARIETY_GRIPS: Record<string, PartBuilder> = { integral };

// ---------------------------------------------------------------------------
// Magazines
// ---------------------------------------------------------------------------

/** Flat pan magazine sitting on top of the receiver. */
const pan: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const zc = (L.magwell.z0 + L.magwell.z1) / 2;
  const y0 = Math.max(L.mountY, L.rec.top) + 0.006;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'pan', pivot: [0, y0, zc],
    motion: { type: 'translate', axis: [0, 1, 0], range: [0, 0.15], purpose: 'reload' },
  });
  const R = 0.065 + p.bulk * 0.025, h = 0.02 + p.bulk * 0.006;
  const seg = ctx.seg(1.6);
  put(ctx, m, 'Detail', box([0, y0, zc], [0.024, 0.014, 0.03], ctx.bevel(0.002)));
  // Built along Z then stood up (Z -> Y).
  const e = ctx.bevel(0.004);
  put(ctx, m, 'Magazine', lathe([[0, 0.006], [R - e, 0.006], [R, 0.006 + e], [R, 0.006 + h - e], [R - e, 0.006 + h], [R * 0.3, 0.006 + h + 0.004], [0, 0.006 + h + 0.004]], seg), [0, y0, zc], AXIS_Y);
  put(ctx, m, 'Trim', dome(R * 0.22, 0.006, seg, 2), [0, y0 + 0.006 + h + 0.003, zc], [-Math.PI / 2, 0, 0]);
  const ribs = 8 + Math.round(p.detail * 4);
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    put(ctx, m, 'Detail', box([0, 0, 0], [0.004, 0.003, R * 0.62]), [Math.sin(a) * R * 0.58, y0 + 0.006 + h + 0.0012, zc + Math.cos(a) * R * 0.58], [0, a, 0]);
  }
};

/** No magazine (break-action guns load straight into the barrels). */
const noMag: PartBuilder = () => {};

export const VARIETY_MAGAZINES: Record<string, PartBuilder> = { pan, none: noMag };
