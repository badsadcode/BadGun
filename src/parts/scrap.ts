/**
 * Survivor / makeshift parts: pipes, planks, tape, hose clamps, soda cans and
 * plastic bottles. Built to look *assembled*, not manufactured: slight
 * misalignments come from a seeded "wobble", so each one is uniquely janky.
 */
import { AXIS_X, Vec2, Vec3, box, cylinder, dome, lathe, rod, tube } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put, raked, side } from './context.js';
import { triggerAndGuard } from './receiver.js';
import { pistolTrigger } from './pistol.js';

/** A ring of duct tape around the Z axis at z (offset to center [x, y]). */
function tapeBand(ctx: BuildContext, c: Component, r: number, z: number, width: number, at: [number, number] = [0, 0], tilt = 0): void {
  put(ctx, c, 'Accent', lathe([[r, z - width / 2], [r + 0.0012, z - width / 2 + 0.001], [r + 0.0012, z + width / 2 - 0.001], [r, z + width / 2]], ctx.seg(0.8)).transform({ t: [0, 0, -z] }), [at[0], at[1], z], [tilt, 0, 0]);
}

/** Hose clamp: a thin metal band with a little screw housing. */
function hoseClamp(ctx: BuildContext, c: Component, r: number, z: number, at: [number, number] = [0, 0]): void {
  put(ctx, c, 'Trim', lathe([[r, z - 0.003], [r + 0.0012, z - 0.0025], [r + 0.0012, z + 0.0025], [r, z + 0.003]], ctx.seg(0.8)), [at[0], at[1], 0]);
  put(ctx, c, 'Trim', box([at[0] - r - 0.002, at[1], z], [0.005, 0.006, 0.009], ctx.bevel(0.001)));
}

function bolts(ctx: BuildContext, c: Component, pts: Vec3[], r = 0.0028): void {
  for (const pt of pts) {
    const s = pt[0] >= 0 ? 1 : -1;
    put(ctx, c, 'Detail', cylinder(r, 0, 0.002, 6), pt, [0, (s * Math.PI) / 2, 0]);
  }
}

/** Seeded wobble: makeshift parts are never perfectly straight. */
const wob = (ctx: BuildContext, name: string, amount: number) => ctx.rng(`wobble:${name}`).range(-amount, amount);

// ---------------------------------------------------------------------------
// Receivers
// ---------------------------------------------------------------------------

/** A thick steel pipe with screw caps, on a welded plate. */
const pipe: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'pipe', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const R = top;
  const seg = ctx.seg(1);
  put(ctx, rec, 'Body', lathe([[0, z0 + 0.012], [R, z0 + 0.012], [R, z1 - 0.012], [0, z1 - 0.012]], seg));
  // Hex pipe fittings at both ends.
  for (const [za, zb] of [[z0, z0 + 0.03], [z1 - 0.03, z1]] as [number, number][]) {
    put(ctx, rec, 'Barrel', lathe([[0, za], [R * 1.16, za], [R * 1.16, zb], [0, zb]], 6, Math.PI / 6));
  }
  // Welded plate underneath for the trigger.
  side(ctx, rec, 'Barrel', [[z0 + 0.04, -R * 0.5], [z1 - 0.05, -R * 0.5], [z1 - 0.06, bottom], [z0 + 0.05, bottom]], w * 0.5, 0.001);
  // Weld beads along the seam.
  for (let z = z0 + 0.045; z < z1 - 0.055; z += 0.012) {
    for (const s of [1, -1]) put(ctx, rec, 'Detail', dome(0.0028, 0.0018, 6, 2), [s * w * 0.25, -R * 0.52, z], [0, (s * Math.PI) / 2, 0]);
  }
  bolts(ctx, rec, [[w * 0.25 + 0.001, bottom + 0.01, z0 + 0.06], [w * 0.25 + 0.001, bottom + 0.01, z1 - 0.07], [-w * 0.25 - 0.001, bottom + 0.01, z0 + 0.06], [-w * 0.25 - 0.001, bottom + 0.01, z1 - 0.07]]);
  tapeBand(ctx, rec, R, z0 + 0.06 + p.detail * 0.03, 0.03, [0, 0], wob(ctx, 'rectape', 0.08));
  hoseClamp(ctx, rec, R, z1 - 0.06);
  // Bolt knob sticking out the right side.
  const ch = b.component('ChargingHandle', {
    kind: 'charging_handle', variant: 'bolt-knob', pivot: [-R, 0, z1 - 0.09],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.06], purpose: 'charge' },
  });
  put(ctx, ch, 'Detail', rod([-R * 0.9, 0.002, z1 - 0.09], [-R - 0.022, -0.004, z1 - 0.095], 0.0035, 6));
  put(ctx, ch, 'Detail', dome(0.007, 0.008, 8, 3), [-R - 0.022, -0.004, z1 - 0.095], [0, -Math.PI / 2, 0]);
  triggerAndGuard(ctx, 'Detail', 'square');
};

/** Mismatched steel boxes welded together, slightly crooked. */
const welded: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'welded', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const mid = (z0 + z1) / 2;
  put(ctx, rec, 'Body', box([0, (top + bottom) / 2 + 0.004, mid], [w, top - bottom - 0.008, z1 - z0], ctx.bevel(0.001)));
  // A second, different box bolted on top, a bit off-axis.
  const tilt = wob(ctx, 'weldtilt', 0.05);
  put(ctx, rec, 'Barrel', box([0, 0, 0], [w * 0.8, 0.016, (z1 - z0) * 0.6], ctx.bevel(0.001)), [wob(ctx, 'weldx', 0.003), top - 0.002, mid + wob(ctx, 'weldz', 0.03)], [tilt, 0, 0]);
  // Patch plate on the side.
  put(ctx, rec, 'Magazine', box([0, 0, 0], [w + 0.003, 0.03, 0.05]), [0, (top + bottom) / 2, z0 + 0.06], [wob(ctx, 'patch', 0.15), 0, 0]);
  for (let z = z0 + 0.008; z < z1; z += 0.014) put(ctx, rec, 'Detail', box([0, top - 0.004, z], [w + 0.002, 0.003, 0.006]));
  bolts(ctx, rec, [[w / 2 + 0.002, (top + bottom) / 2 + 0.01, z0 + 0.045], [w / 2 + 0.002, (top + bottom) / 2 - 0.01, z0 + 0.075], [-w / 2 - 0.002, 0.004, z1 - 0.03]]);
  if (p.detail > 0.4) tapeBand(ctx, rec, w * 0.62, z1 - 0.04, 0.025);
  triggerAndGuard(ctx, 'Detail', 'square');
};

export const SCRAP_RECEIVERS: Record<string, PartBuilder> = { pipe, welded };

// ---------------------------------------------------------------------------
// Barrels, handguards, muzzles
// ---------------------------------------------------------------------------

/** Plumbing pipe barrel with a fitting, clamps and tape. */
const pipeBarrel: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = ctx.b.component('Barrel', { kind: 'barrel', variant: 'pipe', pivot: [0, 0, L.barrel.z0] });
  const rb = L.barrel.radius * 1.25;
  put(ctx, c, 'Barrel', tube(rb, rb * 0.6, L.barrel.z0, L.barrel.z1, ctx.seg(0.8)));
  const zj = L.handguard.z1 + 0.02;
  if (zj < L.barrel.z1 - 0.04) put(ctx, c, 'Barrel', lathe([[rb, zj - 0.012], [rb * 1.3, zj - 0.012], [rb * 1.3, zj + 0.012], [rb, zj + 0.012]], 6, Math.PI / 6));
  hoseClamp(ctx, c, rb, L.barrel.z1 - 0.03);
};

export const SCRAP_BARRELS: Record<string, PartBuilder> = { pipe: pipeBarrel };

/** Two wooden planks bolted either side of the barrel. */
const plank: PartBuilder = (ctx) => {
  const { L } = ctx;
  const { z0, z1 } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'plank', pivot: [0, 0, z0] });
  const rb = L.barrel.radius;
  const len = z1 - z0;
  for (const s of [1, -1]) {
    const x = s * (rb + 0.008);
    const t = wob(ctx, `plank${s}`, 0.012);
    side(ctx, h, 'Stock', [[z0, 0.014 + t], [z1 - 0.01, 0.012], [z1, 0.004], [z1, -0.03], [z0, -0.034 + t]], 0.012, 0.001, x);
    bolts(ctx, h, [[x + s * 0.0062, -0.008, z0 + len * 0.25], [x + s * 0.0062, -0.008, z0 + len * 0.75]], 0.003);
  }
  tapeBand(ctx, h, rb + 0.016, z0 + len * 0.5, 0.03, [0, -0.01], wob(ctx, 'planktape', 0.1));
};

/** A pipe shroud wrapped in uneven strips of tape. */
const taped: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0, z1, radius } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'taped', pivot: [0, 0, z0] });
  const R = radius * 0.85;
  put(ctx, h, 'Barrel', lathe([[L.barrel.radius + 0.002, z0], [R, z0], [R, z1], [L.barrel.radius + 0.002, z1]], ctx.seg(0.9)));
  const n = 3 + Math.round(p.detail * 3);
  for (let i = 0; i < n; i++) {
    const z = z0 + 0.02 + (i + 0.5) * ((z1 - z0 - 0.04) / n) + wob(ctx, `tz${i}`, 0.01);
    tapeBand(ctx, h, R, z, 0.018 + wob(ctx, `tw${i}`, 0.008), [0, 0], wob(ctx, `tt${i}`, 0.12));
  }
};

export const SCRAP_HANDGUARDS: Record<string, PartBuilder> = { plank, taped };

/** Soda-can suppressor, taped on. Returns length. */
export function canMuzzle(ctx: BuildContext, c: Component, a: number, rb: number): number {
  const R = 0.032, len = 0.12;
  const seg = ctx.seg(1.2);
  put(ctx, c, 'Trim', lathe([
    [rb * 0.7, a + 0.006], [R * 0.75, a + 0.006], [R, a + 0.016], [R, a + 0.04], [R * 0.97, a + 0.044], [R, a + 0.048],
    [R, a + len - 0.012], [R * 0.82, a + len], [rb * 0.7, a + len],
  ], seg));
  put(ctx, c, 'Accent', lathe([[rb * 1.1, a - 0.012], [rb * 1.6, a - 0.01], [R * 0.8, a + 0.008], [R * 0.8, a + 0.016], [rb * 1.1, a + 0.016]], seg));
  return len;
}

/** Plastic-bottle suppressor (yes, really), taped onto the barrel. Returns length. */
export function bottleMuzzle(ctx: BuildContext, c: Component, a: number, rb: number): number {
  const R = 0.034, len = 0.21;
  const seg = ctx.seg(1.2);
  const prof: Vec2[] = [[rb * 0.9, a], [rb * 1.7, a], [rb * 1.7, a + 0.022]];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    prof.push([rb * 1.7 + (R - rb * 1.7) * Math.sin((t * Math.PI) / 2), a + 0.022 + t * 0.045]);
  }
  prof.push([R, a + 0.09], [R * 0.96, a + 0.1], [R, a + 0.11], [R, a + len - 0.015], [R * 0.7, a + len - 0.002], [0, a + len]);
  put(ctx, c, 'Glass', lathe(prof, seg));
  put(ctx, c, 'Accent', lathe([[rb * 1.2, a - 0.02], [rb * 1.9, a - 0.018], [rb * 1.9, a + 0.02], [rb * 1.2, a + 0.022]], seg));
  // Label band.
  put(ctx, c, 'Magazine', lathe([[R + 0.0004, a + 0.12], [R + 0.0004, a + 0.17]], seg));
  return len;
}

// ---------------------------------------------------------------------------
// Stocks and grips
// ---------------------------------------------------------------------------

/** A straight wooden board for a stock, nailed and taped. */
const plankStock: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'plank', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const t = wob(ctx, 'plankstock', 0.01);
  side(ctx, s, 'Stock', [[z0 + 0.03, top - 0.006], [zb, top - 0.022 - drop + t], [zb, -0.095 - drop + t], [zb + 0.03, -0.098 - drop], [z0 + 0.03, bottom + 0.006]], 0.022, 0.001);
  // Steel strap joining it to the receiver.
  for (const sgn of [1, -1]) side(ctx, s, 'Barrel', [[z0 - 0.03, top - 0.012], [z0 + 0.04, top - 0.012], [z0 + 0.04, bottom + 0.01], [z0 - 0.03, bottom + 0.01]], 0.002, 0, sgn * 0.0125);
  const nails: Vec3[] = [];
  for (const z of [z0 - 0.015, z0 + 0.02]) for (const y of [top - 0.02, bottom + 0.018]) for (const sg of [1, -1]) nails.push([sg * 0.0137, y, z]);
  bolts(ctx, s, nails, 0.0022);
  side(ctx, s, 'Accent', [[zb + 0.005, top - 0.018 - drop + t], [zb - 0.004, top - 0.02 - drop + t], [zb - 0.004, -0.097 - drop + t], [zb + 0.005, -0.097 - drop]], 0.026);
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (top - 0.1 - drop) / 2, zb - 0.004], forward: [0, 0, -1], description: 'Butt of the plank stock.' });
};

/** A loop of bent pipe for a stock, with a taped shoulder pad. */
const pipeStock: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'pipe', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1 + 0.02, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const seg = Math.max(6, ctx.seg(0.5));
  const r = 0.0065;
  const pts: Vec3[] = [[0, top - 0.008, z0 + 0.01], [0, top - 0.012 - drop * 0.3, zb + 0.01], [0, -0.085 - drop, zb + 0.01], [0, bottom + 0.004, z0 - 0.03]];
  for (let i = 0; i < pts.length - 1; i++) {
    put(ctx, s, 'Barrel', rod(pts[i], pts[i + 1], r, seg));
    put(ctx, s, 'Barrel', dome(r * 1.15, r * 1.15, seg, 3), pts[i + 1]);
    put(ctx, s, 'Barrel', dome(r * 1.15, r * 1.15, seg, 3), pts[i + 1], [0, Math.PI, 0]);
  }
  side(ctx, s, 'Grip', [[zb + 0.016, top - 0.01 - drop * 0.3], [zb - 0.006, top - 0.012 - drop * 0.3], [zb - 0.006, -0.08 - drop], [zb + 0.016, -0.08 - drop]], 0.036, 0.004);
  tapeBand(ctx, s, r, (z0 + zb) / 2, 0.025, [0, (top + top - drop * 0.3) / 2 - 0.01]);
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (top - 0.08 - drop) / 2, zb - 0.006], forward: [0, 0, -1], description: 'Taped shoulder pad.' });
};

export const SCRAP_STOCKS: Record<string, PartBuilder> = { plank: plankStock, pipe: pipeStock };

/** Wooden handle wrapped in tape. */
const tapedGrip: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'taped', pivot: [0, L.grip.y, L.grip.z] });
  const D = 0.032 + p.bulk * 0.006, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Stock', raked(o, L.grip.angle, [[-0.008, 0.002], [Lg + 0.004, 0.0], [Lg + 0.004, -D], [-0.008, -D - 0.004]]), 0.026, 0.002);
  const wraps = 3 + Math.round(p.detail * 2);
  for (let i = 0; i < wraps; i++) {
    const t = 0.008 + i * ((Lg - 0.012) / wraps) + wob(ctx, `gw${i}`, 0.003);
    side(ctx, g, 'Accent', raked(o, L.grip.angle, [[t, 0.0014], [t + 0.014, 0.0012], [t + 0.014, -D - 0.0012], [t, -D - 0.0014]]), 0.0285);
  }
};

/** Chunky wooden block grip, screwed on. */
const plankGrip: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'plank', pivot: [0, L.grip.y, L.grip.z] });
  const D = 0.036 + p.bulk * 0.006, Lg = L.grip.length * 1.05;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Stock', raked(o, L.grip.angle, [[-0.006, 0.004], [Lg, 0.002], [Lg + 0.006, -D * 0.5], [Lg, -D - 0.002], [-0.006, -D - 0.006]]), 0.03, 0.0015);
  const [z, y] = raked(o, L.grip.angle, [[Lg * 0.3, -D * 0.5]])[0];
  bolts(ctx, g, [[0.0152, y, z], [-0.0152, y, z]], 0.003);
};

export const SCRAP_GRIPS: Record<string, PartBuilder> = { taped: tapedGrip, plank: plankGrip };

// ---------------------------------------------------------------------------
// Magazines
// ---------------------------------------------------------------------------

/** A paint can drum magazine, with its wire handle. */
const can: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0: m0, z1: m1 } = L.magwell;
  const yB = L.rec.bottom;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'can', pivot: [0, yB, (m0 + m1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.25], purpose: 'reload' },
  });
  side(ctx, m, 'Magazine', [[m0 + 0.006, yB + 0.008], [m1 - 0.006, yB + 0.008], [m1 - 0.008, yB - 0.03], [m0 + 0.008, yB - 0.03]], 0.026, 0.001);
  const R = 0.048 + p.bulk * 0.014, hw = 0.04 + p.bulk * 0.01;
  const zc = (m0 + m1) / 2 + 0.006, yc = yB - 0.028 - R * 0.85;
  const seg = ctx.seg(1.4);
  put(ctx, m, 'Magazine', lathe([[0, -hw], [R, -hw], [R, hw], [0, hw]], seg), [0, yc, zc], AXIS_X);
  for (const s of [1, -1]) put(ctx, m, 'Trim', lathe([[R * 0.98, -0.003], [R + 0.002, -0.002], [R + 0.002, 0.002], [R * 0.98, 0.003]], seg), [s * hw, yc, zc], AXIS_X);
  put(ctx, m, 'Accent', lathe([[R + 0.0005, -hw * 0.5], [R + 0.0005, hw * 0.5]], seg), [0, yc, zc], AXIS_X);
  // Wire handle.
  const hz = zc, hy = yc - R;
  put(ctx, m, 'Detail', rod([hw, yc, zc - R * 0.2], [hw * 0.5, hy - 0.02, hz], 0.0015, 5));
  put(ctx, m, 'Detail', rod([hw * 0.5, hy - 0.02, hz], [-hw * 0.5, hy - 0.02, hz], 0.0015, 5));
  put(ctx, m, 'Detail', rod([-hw * 0.5, hy - 0.02, hz], [-hw, yc, zc - R * 0.2], 0.0015, 5));
};

export const SCRAP_MAGAZINES: Record<string, PartBuilder> = { can };

// ---------------------------------------------------------------------------
// Pistol and crossbow bits
// ---------------------------------------------------------------------------

/** Zip gun: a pipe barrel strapped to a wooden handle block. */
export const pipePistol: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = b.component('Frame', { kind: 'frame', variant: 'pipe', parent: null });
  const { z0, z1, bottom, width: w } = L.rec;
  // The pipe *is* the bore (y = 0); the wooden block hangs under it.
  const R = 0.011 + p.bulk * 0.003;
  const yb = 0;
  side(ctx, f, 'Stock', [[z0, -R * 0.7], [z0 + 0.1, -R * 0.7], [z0 + 0.11, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.002], [z0 - 0.006, -R * 0.7 - 0.01]], w * 0.95, 0.002);
  // Pipe barrel on top, with a screw cap at the back.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'pipe', pivot: [0, yb, z0] });
  put(ctx, bar, 'Barrel', tube(R, R * 0.55, z0 + 0.012, z1, ctx.seg(0.8)), [0, yb, 0]);
  put(ctx, bar, 'Barrel', lathe([[0, z0 - 0.004], [R * 1.25, z0 - 0.004], [R * 1.25, z0 + 0.014], [0, z0 + 0.014]], 6, Math.PI / 6), [0, yb, 0]);
  for (const z of [z0 + 0.035, z0 + 0.085]) tapeBand(ctx, f, R + 0.004, z, 0.016, [0, yb - 0.004], wob(ctx, `zt${z}`, 0.1));
  hoseClamp(ctx, bar, R, z1 - 0.02, [0, yb]);
  // Nail "hammer" with a rubber band (very dangerous; video games only!).
  put(ctx, f, 'Detail', rod([0, yb + R * 0.3, z0 - 0.012], [0, yb + R + 0.018, z0 - 0.03], 0.0022, 5));
  put(ctx, f, 'Grip', rod([-0.006, yb + R + 0.01, z0 - 0.02], [-0.006, yb - 0.004, z0 + 0.06], 0.0016, 5));
  pistolTrigger(ctx, 'Detail', false);
  L.mountY = R + 0.002;
  L.rec.top = R;
  L.barrel.radius = R;
};

/** Pistol grip: a stick of wood with tape. */
export const tapedPistolGrip: PartBuilder = (ctx) => {
  const { L } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'taped', pivot: [0, L.grip.y, L.grip.z] });
  const D = L.extra.gripDepth, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Stock', raked(o, L.grip.angle, [[-0.004, 0.0], [Lg, 0.001], [Lg, -D], [-0.004, -D - 0.004]]), 0.026, 0.002);
  for (let i = 0; i < 3; i++) {
    const t = 0.01 + i * 0.028 + wob(ctx, `pg${i}`, 0.004);
    side(ctx, g, 'Accent', raked(o, L.grip.angle, [[t, 0.0014], [t + 0.016, 0.0012], [t + 0.016, -D - 0.0012], [t, -D - 0.0014]]), 0.0285);
  }
};

/** Crossbow body: a plank with a pipe trigger housing. */
export const plankTiller: PartBuilder = (ctx) => {
  const { L } = ctx;
  const t = ctx.b.component('Tiller', { kind: 'tiller', variant: 'plank', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const pz = L.extra.prodZ;
  side(ctx, t, 'Stock', [[z0, -0.004], [pz + 0.04, -0.004], [pz + 0.04, -0.034], [z0, -0.034]], 0.03, 0.001);
  side(ctx, t, 'Body', [[z0, top], [z1, top], [z1, bottom + 0.02], [z0 + 0.02, bottom], [z0, bottom + 0.01]], w * 0.7, 0.0015);
  bolts(ctx, t, [[w * 0.35 + 0.001, -0.015, z0 + 0.03], [w * 0.35 + 0.001, -0.015, z1 - 0.03], [-w * 0.35 - 0.001, -0.015, z0 + 0.03]]);
  for (const z of [z1 + 0.05, pz - 0.06]) tapeBand(ctx, t, 0.02, z, 0.025, [0, -0.019], wob(ctx, `xt${z}`, 0.1));
  L.mountY = top;
  triggerAndGuard(ctx, 'Detail', 'square');
};
