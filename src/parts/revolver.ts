/**
 * Revolver parts: frames, cylinders, barrels, grips and hammers.
 *
 * Layout (filled by archetypes/revolver.ts), weapon space, bore at y = 0:
 *   extra.zc0..zc1   cylinder span (a pepperbox's barrel cluster runs to the muzzle)
 *   extra.yc         cylinder axis; the top chamber lines up with the bore (yc = -rc)
 *   extra.cr / rc    cylinder radius / radius of the chamber circle; extra.chambers
 *   extra.low        bottom of the cylinder window; extra.strapY0 underside of the top strap
 *   extra.frontZ     front of the frame, where the barrel comes out; barrel.z1 = muzzle
 *   extra.hz         hammer pivot z; rec.top / rec.bottom = frame top and bottom
 *   grip             top-front corner of the grip and its rake, like pistols
 *
 * Swing-out frames put the cylinder on a `Crane`, top-breaks put it on the
 * hinged `Barrel` assembly, so both reload by moving the parent.
 */
import { Geometry, Vec2, Vec3, bezier, box, ccw, cylinder, dome, insetPolygon, lathe, ring, rod, smoothPolygon, AXIS_X } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, raked, side } from './context.js';
import { pistolTrigger } from './pistol.js';

/** Gap between the cylinder and the frame faces around it (avoids z-fighting). */
const G = 0.001;

interface Dims {
  zc0: number; zc1: number; yc: number; cr: number; rc: number; n: number;
  top: number; bottom: number; low: number; sy0: number; fz: number;
  gz: number; gy: number; a: number; D: number; Lg: number;
  w: number; hz: number; hy: number; rb: number; z1: number;
}

function dims(ctx: BuildContext): Dims {
  const { L } = ctx;
  const e = L.extra;
  return {
    zc0: e.zc0, zc1: e.zc1, yc: e.yc, cr: e.cr, rc: e.rc, n: e.chambers,
    top: L.rec.top, bottom: L.rec.bottom, low: e.low, sy0: e.strapY0, fz: e.frontZ,
    gz: L.grip.z, gy: L.grip.y, a: L.grip.angle, D: e.gripDepth, Lg: L.grip.length,
    w: L.rec.width, hz: e.hz, hy: e.yc, rb: L.barrel.radius, z1: L.barrel.z1,
  };
}

/** A point on the grip: t runs down the grip, s forward across it (0 = front edge). */
const gp = (d: Dims, t: number, s: number): Vec2 => raked([d.gz, d.gy], d.a, [[t, s]])[0];

function frameComp(ctx: BuildContext, variant: string): Component {
  return ctx.b.component('Frame', { kind: 'frame', variant, parent: null });
}

/** Mirror a part to both sides of the frame (x = +/-). */
function bothSides(fn: (s: number) => void): void {
  fn(1);
  fn(-1);
}

/** Round head (screw, rivet, gem) on both side faces. */
function heads(ctx: BuildContext, c: Component, slot: MaterialSlot, x: number, pts: Vec2[], r: number, h = r * 0.45, segs = 8): void {
  for (const [z, y] of pts) bothSides((s) => put(ctx, c, slot, dome(r, h, segs, 2), [s * x, y, z], [0, (s * Math.PI) / 2, 0]));
}

/**
 * The usual rear of a revolver frame: from the window's rear-bottom corner
 * back along the bottom, across the top of the grip, up the backstrap and
 * over the hammer to the top strap. `hump` bulges the backstrap, `shroud`
 * raises the top behind the hammer (snubs hide the hammer).
 */
function rearProfile(d: Dims, hump = 0, shroud = 0, steps = 6): Vec2[] {
  const gb = gp(d, 0.006, -d.D - 0.001);
  const tr: Vec2 = [d.hz - 0.013, d.top - 0.004 + shroud];
  return [
    [d.gz + 0.002, d.bottom], gp(d, 0.006, 0.0005), gb,
    ...bezier(gb, [gb[0] - 0.003 - hump, gb[1] + 0.012], [tr[0] - 0.006 - hump * 0.5, tr[1] - 0.008], tr, steps),
    [d.hz - 0.006, d.top + shroud * 0.7], [d.hz + 0.004, d.top + shroud * 0.3],
  ];
}

/**
 * A frame with a window for the cylinder. `rear` runs from the bottom behind
 * the window around to the top strap (see rearProfile); `front` continues
 * along the strap and down the front of the frame, ending on the front face.
 * The strap under the window is its own piece. With a crane, the lower front
 * of the frame (the yoke) is left out: the crane carries it.
 */
function windowed(ctx: BuildContext, f: Component, slot: MaterialSlot, d: Dims, rear: Vec2[], front: Vec2[], width: number, bevel: number, craneY?: number): void {
  const yb = craneY ?? d.low;
  side(ctx, f, slot, [
    [d.zc0 - G, d.bottom], ...rear, ...front,
    [d.fz, yb], [d.zc1 + G, yb], [d.zc1 + G, d.sy0], [d.zc0 - G, d.sy0], [d.zc0 - G, d.low],
  ], width, bevel);
  side(ctx, f, slot, [[d.zc0 - G, d.low], [d.fz, d.low], [d.fz, d.bottom + 0.003], [d.fz - 0.003, d.bottom], [d.zc0 - G, d.bottom]], width, bevel);
}

/** Front of the top strap sloping down to the barrel. */
const slopeFront = (d: Dims, k = 0.004): Vec2[] => [[d.zc1 + k, d.top], [d.fz, Math.min(d.top - 0.002, d.rb + 0.0035)]];

/** Round recoil shield behind the cylinder (shows as a bulge on both sides). */
function shield(ctx: BuildContext, f: Component, slot: MaterialSlot, d: Dims, k = 0.92): void {
  const r = d.cr * k, z0 = d.zc0 - 0.008, z1 = d.zc0 - 0.0016;
  put(ctx, f, slot, lathe([[0, z0], [r - 0.002, z0], [r, z0 + 0.002], [r, z1], [0, z1]], ctx.seg(1.1)), [0, d.yc, 0]);
}

/** Swing-out crane: the yoke under the barrel shank; the cylinder rides on it. */
function crane(ctx: BuildContext, slot: MaterialSlot, d: Dims, width: number, bevel: number): number {
  const ys = -d.rb - 0.0015;
  const c = ctx.b.component('Crane', {
    kind: 'crane', variant: 'swing-out', pivot: [width / 2, d.low, d.zc1],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, -1.55], purpose: 'swing out to reload' },
  });
  side(ctx, c, slot, [[d.zc1 + G, d.low], [d.fz, d.low], [d.fz, ys], [d.zc1 + G, ys]], width, bevel);
  put(ctx, c, 'Detail', cylinder(0.0021, d.zc1, d.fz + 0.0025, 10), [0, d.yc, 0]);
  return ys;
}

function trigger(ctx: BuildContext, slot: MaterialSlot, round: boolean): void {
  pistolTrigger(ctx, slot, round);
}

/** Rear sight notch at the back of the top strap. */
function notch(ctx: BuildContext, f: Component, d: Dims, slot: MaterialSlot = 'Detail'): void {
  bothSides((s) => put(ctx, f, slot, box([s * 0.0026, d.top + 0.0012, d.zc0 - 0.002], [0.0022, 0.0026, 0.005])));
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/** Single-action: curved plow-handle backstrap, loading gate, brass guard. */
const classic: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'classic');
  windowed(ctx, f, 'Body', d, rearProfile(d, 0.004), slopeFront(d, 0.002), d.w, 0.0015);
  shield(ctx, f, 'Body', d);
  // Loading gate on the right, behind the cylinder.
  put(ctx, f, 'Detail', box([-(d.w / 2 + 0.0004), d.yc - d.rc * 0.5, d.zc0 - 0.006], [0.0012, d.cr * 0.75, 0.008], ctx.bevel(0.0005)));
  heads(ctx, f, 'Trim', d.w / 2, [[d.zc0 - 0.016, d.yc + 0.002], [d.zc0 - 0.009, d.low - 0.003], [d.fz - 0.006, d.low - 0.003]], 0.0018);
  // Top strap groove as a sight channel.
  put(ctx, f, 'Detail', box([0, d.top - 0.0004, (d.zc0 + d.zc1) / 2], [0.0024, 0.001, d.zc1 - d.zc0]));
  trigger(ctx, 'Trim', true);
};

/** Double-action service revolver: rounded frame, swing-out crane, latch. */
const service: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'service');
  const ys = crane(ctx, 'Body', d, d.w, 0.0015);
  windowed(ctx, f, 'Body', d, rearProfile(d, 0.001, 0, 8), slopeFront(d, 0.006), d.w, 0.002, ys);
  shield(ctx, f, 'Body', d, 0.9);
  // Cylinder release latch on the left, side plate screws on the right.
  put(ctx, f, 'Detail', box([d.w / 2 + 0.0008, d.yc + 0.003, d.zc0 - 0.012], [0.0024, 0.004, 0.009], ctx.bevel(0.0008)));
  heads(ctx, f, 'Detail', d.w / 2, [[d.zc0 - 0.02, d.yc - 0.004], [d.gz - 0.004, d.bottom + 0.004]], 0.0016, 0.0005);
  notch(ctx, f, d);
  trigger(ctx, 'Body', true);
};

/** Heavy magnum frame: wide, tall strap with a rib and an adjustable rear sight. */
const magnum: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'magnum');
  const ys = crane(ctx, 'Body', d, d.w, 0.002);
  windowed(ctx, f, 'Body', d, rearProfile(d, 0, 0, 4), slopeFront(d, 0.008), d.w, 0.002, ys);
  shield(ctx, f, 'Body', d, 0.95);
  // Rib on the strap and a square rear sight block.
  put(ctx, f, 'Body', box([0, d.top + 0.0012, (d.zc0 + d.fz) / 2], [0.008, 0.0028, d.fz - d.zc0 - 0.004], ctx.bevel(0.0008)));
  put(ctx, f, 'Detail', box([0, d.top + 0.0025, d.zc0 - 0.004], [0.011, 0.005, 0.009], ctx.bevel(0.0008)));
  put(ctx, f, 'Glass', box([0, d.top + 0.0045, d.zc0 - 0.0085], [0.007, 0.0012, 0.0006]));
  put(ctx, f, 'Detail', box([d.w / 2 + 0.0008, d.yc + 0.003, d.zc0 - 0.013], [0.0024, 0.005, 0.01], ctx.bevel(0.0008)));
  heads(ctx, f, 'Detail', d.w / 2, [[d.zc0 - 0.022, d.yc - 0.006], [d.gz - 0.004, d.bottom + 0.004]], 0.0017, 0.0005);
  trigger(ctx, 'Body', false);
};

/** Snub: compact, with a shrouded hammer hump and a round guard. */
const snub: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'snub');
  const ys = crane(ctx, 'Body', d, d.w, 0.002);
  windowed(ctx, f, 'Body', d, rearProfile(d, 0.002, 0.006, 8), slopeFront(d, 0.005), d.w, 0.0025, ys);
  shield(ctx, f, 'Body', d, 0.88);
  put(ctx, f, 'Detail', box([d.w / 2 + 0.0008, d.yc + 0.002, d.zc0 - 0.011], [0.0024, 0.004, 0.008], ctx.bevel(0.0008)));
  put(ctx, f, 'Detail', box([0, d.top + 0.0004, (d.zc0 + d.zc1) / 2], [0.0022, 0.0014, d.zc1 - d.zc0]));
  trigger(ctx, 'Body', true);
};

/** Top-break: the barrel, top strap and cylinder hinge down in front of the cylinder. */
const topbreak: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'topbreak');
  const hingeY = (d.low + d.bottom) / 2, hingeZ = d.zc1 + G + 0.0055;
  // Static frame: the rear with a notch for the strap's tail, and the strap under the cylinder.
  const tail = d.zc0 - 0.0075;
  side(ctx, f, 'Body', [
    [d.zc0 - G, d.bottom], ...rearProfile(d, 0.003), [tail, d.top], [tail, d.sy0], [d.zc0 - G, d.sy0],
  ], d.w, 0.0015);
  side(ctx, f, 'Body', [[d.zc0 - G, d.low], [d.zc1 + G, d.low], [d.zc1 + G, d.bottom], [d.zc0 - G, d.bottom]], d.w, 0.0015);
  shield(ctx, f, 'Body', d, 0.9);
  put(ctx, f, 'Detail', cylinder(0.0028, -d.w / 2 - 0.0012, d.w / 2 + 0.0012, 10), [0, hingeY, hingeZ], AXIS_X);
  heads(ctx, f, 'Trim', d.w / 2, [[d.zc0 - 0.016, d.yc], [d.gz - 0.003, d.bottom + 0.004]], 0.0017);
  // Moving assembly: strap and front post (the barrel builder adds the tube).
  const bar = ctx.b.component('Barrel', {
    kind: 'barrel', variant: 'topbreak', pivot: [0, hingeY, hingeZ],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.8], purpose: 'break open to reload' },
  });
  side(ctx, bar, 'Body', [
    [tail + 0.0005, d.sy0], [d.zc1 + G, d.sy0], [d.zc1 + G, d.bottom + 0.004], [d.zc1 + G + 0.004, d.bottom],
    [d.fz - 0.004, d.bottom], [d.fz, d.bottom + 0.004], [d.fz, Math.min(d.top - 0.002, d.rb + 0.0035)], [d.zc1 + 0.004, d.top], [tail + 0.0005, d.top],
  ], d.w * 0.96, 0.0015);
  // Stirrup latch over the hammer, with thumb pieces.
  put(ctx, bar, 'Detail', box([0, d.top + 0.002, d.zc0 - 0.007], [d.w * 0.7, 0.004, 0.006], ctx.bevel(0.0008)));
  bothSides((s) => put(ctx, bar, 'Detail', box([s * (d.w * 0.35 + 0.0015), d.top + 0.003, d.zc0 - 0.0085], [0.003, 0.005, 0.004], ctx.bevel(0.0008))));
  notch(ctx, bar, d);
  trigger(ctx, 'Trim', true);
  ctx.L.extra.topbreak = 1;
};

/** Pepperbox: no barrel, the whole cluster of barrels turns. Bar frame, brass fittings. */
const pepperbox: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'pepperbox');
  side(ctx, f, 'Body', [[d.zc0 - G, d.bottom], ...rearProfile(d, 0.005), [d.zc0 - G, d.top]], d.w, 0.0015);
  // Bar under the cluster, ending in a lug for the arbor.
  const zb = d.zc0 + 0.03;
  side(ctx, f, 'Body', [[d.zc0 - G, d.low], [zb, d.low], [zb + 0.004, d.low - 0.004], [zb, d.bottom], [d.zc0 - G, d.bottom]], d.w * 0.8, 0.0015);
  shield(ctx, f, 'Trim', d, 1.02);
  put(ctx, f, 'Trim', lathe([[d.cr * 1.02, d.zc0 - 0.008], [d.cr * 1.08, d.zc0 - 0.007], [d.cr * 1.08, d.zc0 - 0.005], [d.cr * 1.02, d.zc0 - 0.004]], ctx.seg(1.1)), [0, d.yc, 0]);
  // Arbor tip in front of the cluster.
  put(ctx, f, 'Trim', dome(d.rc * 0.32, 0.004, ctx.seg(0.6), 2), [0, d.yc, d.zc1]);
  heads(ctx, f, 'Trim', d.w / 2, [[d.zc0 - 0.017, d.yc], [d.gz - 0.003, d.bottom + 0.004]], 0.002);
  if (ctx.style.traits.plumbing) {
    // A little steam line along the right side.
    put(ctx, f, 'Accent', rod([-(d.w / 2 + 0.002), d.bottom + 0.003, d.gz - 0.01], [-(d.w / 2 + 0.002), d.bottom + 0.003, zb], 0.0014, 6));
    put(ctx, f, 'Trim', cylinder(0.0024, zb - 0.002, zb + 0.002, 8), [-(d.w / 2 + 0.002), d.bottom + 0.003, 0]);
  }
  trigger(ctx, 'Trim', true);
};

/** Sci-fi heavy: a wide armored shroud over a fixed cylinder, vents and glow strips. */
const heavy: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'heavy');
  const glow: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  windowed(ctx, f, 'Body', d, rearProfile(d, -0.002, 0.004, 3), [[d.zc1, d.top], [d.fz, d.top - 0.002]], d.w, 0.0025);
  // Shroud over the top of the cylinder, wider than it.
  const y0 = d.yc + d.cr * 0.45, y1 = d.top + 0.004, W = d.cr * 2 + 0.006;
  side(ctx, f, 'Body', [[d.zc0 - 0.012, y0], [d.fz + 0.006, y0], [d.fz + 0.006, y1 - 0.004], [d.fz, y1], [d.zc0 - 0.008, y1], [d.zc0 - 0.016, y1 - 0.006]], W, 0.003);
  side(ctx, f, 'Trim', [[d.zc0 - 0.006, y0 + 0.002], [d.fz, y0 + 0.002], [d.fz, y0 + 0.0045], [d.zc0 - 0.006, y0 + 0.0045]], W + 0.002, 0.0008);
  side(ctx, f, glow, [[d.zc0 - 0.004, y1 - 0.0055], [d.fz - 0.004, y1 - 0.0055], [d.fz - 0.004, y1 - 0.0042], [d.zc0 - 0.004, y1 - 0.0042]], W + 0.0012);
  for (let i = 0; i < 3; i++) put(ctx, f, 'Detail', box([0, y1 + 0.0002, d.zc0 + 0.004 + i * 0.012], [W * 0.6, 0.0012, 0.005]));
  // Side armor on the rear.
  side(ctx, f, 'Trim', [[d.hz - 0.008, d.yc + 0.006], [d.zc0 - 0.003, d.yc + 0.006], [d.zc0 - 0.003, d.low], [d.gz + 0.004, d.bottom + 0.003], [d.hz - 0.01, d.yc - 0.012]], d.w + 0.003, 0.001);
  shield(ctx, f, 'Body', d, 0.96);
  trigger(ctx, 'Body', false);
};

/** Sci-fi coil: sleek frame, coil rings wound around the barrel shank, a dorsal fin. */
const coil: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'coil');
  const glow: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  const ys = crane(ctx, 'Body', d, d.w, 0.002);
  windowed(ctx, f, 'Body', d, rearProfile(d, -0.001, 0.002, 6), slopeFront(d, 0.004), d.w, 0.0025, ys);
  shield(ctx, f, 'Body', d, 0.94);
  // Coil housing and rings around the barrel shank.
  const seg = ctx.seg(1);
  const R = d.rb + 0.0035, zr = d.fz + Math.min(0.03, (d.z1 - d.fz) * 0.45);
  put(ctx, f, 'Body', lathe([[d.rb * 0.9, d.fz - 0.003], [R, d.fz - 0.001], [R, d.fz + 0.004], [d.rb * 1.02, d.fz + 0.007]], seg));
  const rings = Math.max(2, Math.floor((zr - d.fz - 0.006) / 0.006));
  for (let i = 0; i < rings; i++) put(ctx, f, i % 2 ? 'Trim' : glow, ring(d.rb + 0.0016, 0.0014, d.fz + 0.008 + i * 0.006, seg, 5));
  // Dorsal fin.
  side(ctx, f, 'Accent', [[d.zc0 - 0.006, d.top - 0.001], [d.zc1 - 0.004, d.top - 0.001], [d.zc0 + 0.006, d.top + 0.008], [d.zc0 - 0.002, d.top + 0.008]], 0.003, 0.0008);
  side(ctx, f, glow, [[d.zc0 - 0.012, d.yc + 0.003], [d.zc0 - 0.003, d.yc + 0.003], [d.zc0 - 0.003, d.yc + 0.0045], [d.zc0 - 0.012, d.yc + 0.0045]], d.w + 0.0012);
  trigger(ctx, 'Body', true);
};

/** Scrap: a block of bar stock, a pipe for a top strap, plates bolted on. */
const junk: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'junk');
  const gb = gp(d, 0.006, -d.D - 0.001);
  side(ctx, f, 'Body', [
    [d.zc0 - G, d.bottom], [d.gz + 0.002, d.bottom], gp(d, 0.006, 0.0005), gb, [d.hz - 0.016, d.top - 0.008], [d.hz - 0.008, d.top - 0.002], [d.zc0 - G, d.top - 0.002],
  ], d.w, 0);
  // Front plate and the flat bar under the cylinder.
  side(ctx, f, 'Accent', [[d.zc1 + G, d.low - 0.002], [d.fz, d.low - 0.002], [d.fz, d.top - 0.001], [d.zc1 + G, d.top - 0.001]], d.w * 1.05, 0);
  put(ctx, f, 'Detail', box([0, (d.low + d.bottom) / 2, (d.zc0 + d.fz) / 2], [d.w * 0.7, d.low - d.bottom, d.fz - d.zc0 + 0.004]));
  // Pipe top strap with wire wraps.
  const py = d.top - 0.004;
  put(ctx, f, 'Barrel', cylinder(0.0042, d.zc0 - 0.012, d.fz + 0.003, ctx.seg(0.6)), [0, py, 0]);
  for (const z of [d.zc0 + 0.008, d.zc1 - 0.006]) put(ctx, f, 'Detail', ring(0.0046, 0.0008, z, ctx.seg(0.6), 4), [0, py, 0]);
  // Hex bolts.
  for (const [z, y] of [[d.zc0 - 0.008, d.yc + 0.004], [d.zc0 - 0.02, d.yc - 0.008], [d.fz - 0.006, d.low + 0.006], [d.fz - 0.006, d.top - 0.009], [d.gz - 0.006, d.bottom + 0.004]] as Vec2[]) {
    put(ctx, f, 'Detail', cylinder(0.0024, -d.w / 2 - 0.0016, d.w / 2 + 0.0016, 6), [0, y, z], AXIS_X);
  }
  // A hose clamp around the barrel shank.
  put(ctx, f, 'Trim', ring(d.rb + 0.0008, 0.001, d.fz + 0.008, ctx.seg(0.8), 4));
  trigger(ctx, 'Detail', false);
};

/** Spiral ribbon (scrollwork) centered at (cz, cy). */
function scroll(cz: number, cy: number, r: number, dir: number, phase: number): Vec2[] {
  const out: Vec2[] = [], inn: Vec2[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = phase + dir * u * Math.PI * 2.1;
    const rr = r * (1 - u * 0.72), th = r * 0.24 * (1 - u * 0.55);
    out.push([cz + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    inn.push([cz + Math.cos(a) * (rr - th), cy + Math.sin(a) * (rr - th)]);
  }
  return [...out, ...inn.reverse()];
}

/** Fantasy: a classic frame dressed in gold scrollwork and gems. */
const ornate: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'ornate');
  const gem: MaterialSlot = ctx.style.traits.magic ? 'Emissive' : 'Glass';
  windowed(ctx, f, 'Body', d, rearProfile(d, 0.005, 0.001, 8), slopeFront(d, 0.002), d.w, 0.0015);
  shield(ctx, f, 'Trim', d, 0.95);
  const W = d.w + 0.0014;
  side(ctx, f, 'Trim', scroll(d.zc0 - 0.016, d.yc - 0.003, 0.0075, 1, Math.PI * 0.2), W);
  side(ctx, f, 'Trim', scroll(d.gz - 0.004, d.bottom + 0.0045, 0.0042, -1, 0), W);
  side(ctx, f, 'Trim', scroll((d.zc0 + d.fz) / 2, (d.low + d.bottom) / 2, 0.0034, 1, Math.PI), W);
  // Gold edge on the top strap, gems on the frame and the front post.
  side(ctx, f, 'Trim', [[d.hz + 0.004, d.top - 0.0018], [d.zc1 + 0.002, d.top - 0.0018], [d.zc1 + 0.002, d.top - 0.0006], [d.hz + 0.004, d.top - 0.0006]], W);
  heads(ctx, f, gem, d.w / 2 + 0.0006, [[d.fz - 0.006, (d.low + d.sy0) / 2 - 0.004]], 0.0024, 0.0016, 10);
  heads(ctx, f, gem, d.w / 2 + 0.0006, [[d.zc0 - 0.016, d.yc - 0.003]], 0.0016, 0.0012, 10);
  trigger(ctx, 'Trim', true);
};

/** Dieselpunk: streamlined frame, chrome speed lines and a long dorsal fin. */
const deco: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'deco');
  const ys = crane(ctx, 'Body', d, d.w, 0.002);
  windowed(ctx, f, 'Body', d, rearProfile(d, 0.008, 0.004, 10), [[d.zc1 + 0.002, d.top], [d.fz, d.rb + 0.0025]], d.w, 0.0025, ys);
  shield(ctx, f, 'Body', d, 0.92);
  const W = d.w + 0.0012;
  for (let i = 0; i < 3; i++) {
    const y = d.bottom + 0.0018 + i * 0.0026;
    side(ctx, f, 'Trim', [[d.zc0 - 0.012 + i * 0.003, y], [d.fz - 0.004 - i * 0.002, y], [d.fz - 0.004 - i * 0.002, y + 0.0011], [d.zc0 - 0.012 + i * 0.003, y + 0.0011]], W);
  }
  const reach = Math.min(0.035, (d.z1 - d.fz) * 0.5);
  side(ctx, f, 'Trim', [[d.hz + 0.004, d.top - 0.001], [d.zc1, d.top - 0.001], [d.fz + reach, d.rb + 0.0005], [d.fz + reach, d.rb + 0.002], [d.zc1, d.top + 0.004], [d.zc0, d.top + 0.005]], 0.0035, 0.0008);
  trigger(ctx, 'Trim', true);
};

/** Cyberpunk smart revolver: angular frame, side display, neon strip, cable. */
const smart: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const f = frameComp(ctx, 'smart');
  const neon: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  const ys = crane(ctx, 'Body', d, d.w, 0.0012);
  windowed(ctx, f, 'Body', d, rearProfile(d, -0.003, 0.003, 2), [[d.zc1 + 0.006, d.top], [d.fz, d.top - 0.004]], d.w, 0.0012, ys);
  shield(ctx, f, 'Body', d, 0.94);
  // Display on the left side of the frame.
  const zs = d.zc0 - 0.012, yd = d.yc + 0.001;
  put(ctx, f, 'Detail', box([d.w / 2 + 0.0004, yd, zs], [0.0012, 0.013, 0.014], ctx.bevel(0.0004)));
  put(ctx, f, 'Emissive', box([d.w / 2 + 0.0011, yd, zs], [0.0004, 0.01, 0.011]));
  // Neon strip along the strap, a short top rail.
  side(ctx, f, neon, [[d.zc0, d.sy0 + 0.0012], [d.fz - 0.004, d.sy0 + 0.0012], [d.fz - 0.004, d.sy0 + 0.0024], [d.zc0, d.sy0 + 0.0024]], d.w + 0.0012);
  for (let z = d.zc0 + 0.002; z < d.zc1 - 0.002; z += 0.006) put(ctx, f, 'Detail', box([0, d.top + 0.0012, z], [0.012, 0.0024, 0.0035]));
  // Cable from the grip to the back of the frame (right side).
  const x = -(d.w / 2 + 0.003);
  const a: Vec3 = [x, ...gp(d, d.Lg * 0.55, -d.D * 0.6).slice().reverse()] as Vec3;
  const b: Vec3 = [x, d.yc + 0.002, d.zc0 - 0.02];
  const pts: Vec3[] = [];
  for (let i = 0; i <= 4; i++) {
    const u = i / 4;
    pts.push([x - Math.sin(u * Math.PI) * 0.004, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u - Math.sin(u * Math.PI) * 0.008]);
  }
  for (let i = 0; i < 4; i++) put(ctx, f, 'Accent', rod(pts[i], pts[i + 1], 0.0018, 6));
  trigger(ctx, 'Body', false);
};

export const REVOLVER_FRAMES: Record<string, PartBuilder> = { classic, service, magnum, snub, topbreak, pepperbox, heavy, coil, junk, ornate, deco, smart };

// ---------------------------------------------------------------------------
// Cylinders
// ---------------------------------------------------------------------------

type CylStyle = 'fluted' | 'plain' | 'eight' | 'engraved' | 'energy';

function cylinderPart(ctx: BuildContext, variant: CylStyle): void {
  const d = dims(ctx);
  const { b, p } = ctx;
  const pepper = ctx.chosen.frame === 'pepperbox';
  const parent = b.has('Crane') ? 'Crane' : ctx.L.extra.topbreak ? 'Barrel' : 'Frame';
  const cyl = b.component('Cylinder', {
    kind: 'cylinder', variant, parent, pivot: [0, d.yc, d.zc0],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, (Math.PI * 2) / d.n], purpose: 'advance one chamber' },
  });
  const seg = ctx.seg(1.2);
  const e = ctx.bevel(0.003);
  const { zc0, zc1, cr, rc, yc, n } = d;
  const ang = (i: number) => Math.PI / 2 + (i / n) * Math.PI * 2;
  const body: MaterialSlot = variant === 'energy' ? 'Body' : 'Magazine';
  const at = (a: number, r: number, z = 0): Vec3 => [Math.cos(a) * r, yc + Math.sin(a) * r, z];
  const tubes = pepper && variant !== 'plain' && variant !== 'engraved';

  if (tubes) {
    // Pepperbox: a chamber block, then one barrel per chamber around a core.
    const zb = zc0 + 0.028, rt = rc * Math.sin(Math.PI / n) * 1.02;
    put(ctx, cyl, body, lathe([[0, zc0], [cr - e, zc0], [cr, zc0 + e], [cr, zb - 0.002], [cr * 0.9, zb], [0, zb]], seg), [0, yc, 0]);
    put(ctx, cyl, body, cylinder(rc * 0.6, zb - 0.001, zc1 - 0.004, ctx.seg(0.8)), [0, yc, 0]);
    for (let i = 0; i < n; i++) {
      const g = lathe([[0, zb - 0.002], [rt, zb - 0.002], [rt, zc1 - 0.002], [rt * 0.9, zc1], [rt * 0.5, zc1], [rt * 0.5, zc1 - 0.006], [0, zc1 - 0.006]], ctx.seg(0.6));
      put(ctx, cyl, 'Barrel', g, at(ang(i), rc));
      if (variant === 'energy') put(ctx, cyl, 'Emissive', ring(rt, 0.0009, zc1 - 0.006, ctx.seg(0.6), 4), at(ang(i), rc));
    }
    if (variant === 'eight' || p.ornament > 0.4) put(ctx, cyl, 'Trim', lathe([[cr, zb - 0.007], [cr + 0.001, zb - 0.006], [cr + 0.001, zb - 0.003], [cr, zb - 0.002]], seg), [0, yc, 0]);
    return;
  }

  // Solid cylinder (a long one for a pepperbox), chamber mouths at the front.
  put(ctx, cyl, body, lathe([[0, zc0], [cr - e, zc0], [cr, zc0 + e], [cr, zc1 - e], [cr - e, zc1], [0, zc1]], seg), [0, yc, 0]);
  const mouth = rc * (n >= 8 ? 0.34 : 0.42);
  for (let i = 0; i < n; i++) put(ctx, cyl, variant === 'energy' ? 'Emissive' : 'Detail', cylinder(mouth, zc1 - 0.0004, zc1 + 0.0008, 10), at(ang(i), rc));
  const len = Math.min(zc1 - zc0, 0.06);
  const mid = pepper ? zc1 - len / 2 - 0.004 : (zc0 + zc1) / 2 + 0.002;
  const groove = (a: number, wdt: number, l: number, slot: MaterialSlot, z = mid, depth = 0.0024) =>
    put(ctx, cyl, slot, box([0, 0, 0], [wdt, depth, l]), at(a, cr, z), [0, 0, a + Math.PI / 2]);
  const band = (z: number, slot: MaterialSlot = 'Trim') => put(ctx, cyl, slot, lathe([[cr, z - 0.0018], [cr + 0.0011, z - 0.001], [cr + 0.0011, z + 0.001], [cr, z + 0.0018]], seg), [0, yc, 0]);

  if (variant === 'fluted') {
    for (let i = 0; i < n; i++) groove(ang(i) + Math.PI / n, 0.0042, len * 0.62, 'Detail');
  } else if (variant === 'plain') {
    // Cylinder stop notches near the rear.
    for (let i = 0; i < n; i++) groove(ang(i), 0.0026, 0.004, 'Detail', zc0 + len * 0.28, 0.0014);
  } else if (variant === 'eight') {
    for (let i = 0; i < n; i++) groove(ang(i) + Math.PI / n, 0.0028, len * 0.55, 'Detail');
    band(zc0 + 0.003, 'Detail');
  } else if (variant === 'engraved') {
    band(zc0 + 0.004);
    band(zc1 - 0.004);
    for (let i = 0; i < n; i++) {
      const a = ang(i) + Math.PI / n;
      put(ctx, cyl, 'Trim', dome(0.0022, 0.001, 8, 2).transform({ r: [0, Math.PI / 2, 0] }).transform({ r: [0, 0, a] }), at(a, cr - 0.0003, mid));
      groove(ang(i), 0.0011, len * 0.45, 'Trim', mid, 0.0008);
    }
  } else {
    // Energy: glowing chamber windows on the outside, a hot ring at the front.
    for (let i = 0; i < n; i++) {
      groove(ang(i), 0.0052, len * 0.6, 'Emissive', mid, 0.002);
      groove(ang(i) + Math.PI / n, 0.003, len * 0.7, 'Detail', mid, 0.0026);
    }
    band(zc1 - 0.004, 'Emissive');
    band(zc0 + 0.004, 'Trim');
  }
  if (pepper) {
    band(zc0 + 0.028);
    for (let i = 0; i < n; i++) groove(ang(i) + Math.PI / n, 0.0024, (zc1 - zc0) * 0.6, 'Detail', zc1 - (zc1 - zc0) * 0.35, 0.0016);
  }
};

export const REVOLVER_CYLINDERS: Record<string, PartBuilder> = {
  fluted: (ctx) => cylinderPart(ctx, 'fluted'),
  plain: (ctx) => cylinderPart(ctx, 'plain'),
  eight: (ctx) => cylinderPart(ctx, 'eight'),
  engraved: (ctx) => cylinderPart(ctx, 'engraved'),
  energy: (ctx) => cylinderPart(ctx, 'energy'),
};

/** Chambers per cylinder variant (the layout needs it before anything is built). */
export const CHAMBERS: Record<string, number> = { fluted: 6, plain: 5, eight: 8, engraved: 6, energy: 6 };

// ---------------------------------------------------------------------------
// Barrels
// ---------------------------------------------------------------------------

function barrelComp(ctx: BuildContext, variant: string): Component {
  return ctx.b.component('Barrel', { kind: 'barrel', variant, pivot: [0, 0, ctx.L.extra.frontZ] });
}

/** Outer tube with a recessed bore at the muzzle. */
function barrelTube(r0: number, r1: number, z0: number, z1: number, seg: number, phase = 0): Geometry {
  return lathe([[0, z0], [r0, z0], [r1, z1 - 0.0015], [r1 * 0.9, z1], [r1 * 0.45, z1], [r1 * 0.45, z1 - 0.008], [0, z1 - 0.008]], seg, phase);
}

/** Front blade, tall enough to line up with the rear notch. */
function frontSight(ctx: BuildContext, c: Component, d: Dims, base: number, slot: MaterialSlot = 'Detail', z = d.z1 - 0.006): void {
  const ys = d.top + 0.0012;
  side(ctx, c, slot, [[z - 0.007, base - 0.001], [z + 0.002, base - 0.001], [z + 0.002, ys], [z - 0.002, ys]], 0.0028, 0.0005);
}

/** Ejector rod housing under the barrel (not on top-breaks: they eject on opening). */
function ejector(ctx: BuildContext, c: Component, d: Dims, x = 0): void {
  if (ctx.L.extra.topbreak) return;
  const er = d.rb * 0.46, y = -(d.rb + er * 0.45);
  const len = Math.min(d.z1 - d.fz - 0.012, d.zc1 - d.zc0 + 0.012);
  if (len < 0.012) return;
  put(ctx, c, 'Barrel', lathe([[0, d.fz - 0.002], [er, d.fz - 0.002], [er, d.fz + len - 0.002], [er * 0.7, d.fz + len], [0, d.fz + len]], ctx.seg(0.6)), [x, y, 0]);
  put(ctx, c, 'Detail', cylinder(er * 0.5, d.fz + len - 0.001, d.fz + len + 0.003, 8), [x, y, 0]);
}

const round: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'round');
  put(ctx, c, 'Barrel', barrelTube(d.rb, d.rb, d.zc1 + 0.004, d.z1, ctx.seg(0.9)));
  ejector(ctx, c, d, ctx.chosen.frame === 'classic' || ctx.chosen.frame === 'ornate' ? -d.rb * 0.35 : 0);
  frontSight(ctx, c, d, d.rb);
};

const octagonal: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'octagonal');
  const r = d.rb * 1.08;
  put(ctx, c, 'Barrel', barrelTube(r, r, d.zc1 + 0.004, d.z1, 8, Math.PI / 8));
  put(ctx, c, ctx.p.ornament > 0.5 ? 'Trim' : 'Barrel', lathe([[r * 0.9, d.fz - 0.001], [r * 1.1, d.fz], [r * 1.1, d.fz + 0.006], [r * 0.9, d.fz + 0.007]], ctx.seg(0.9)));
  if (ctx.p.ornament > 0.5) put(ctx, c, 'Trim', lathe([[r, d.z1 - 0.006], [r * 1.12, d.z1 - 0.005], [r * 1.12, d.z1 - 0.001], [r, d.z1]], 8, Math.PI / 8));
  ejector(ctx, c, d, ctx.chosen.frame === 'classic' || ctx.chosen.frame === 'ornate' ? -d.rb * 0.4 : 0);
  frontSight(ctx, c, d, r, 'Trim');
};

/** Round barrel with a raised, ventilated rib. */
const ribbed: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'ribbed');
  put(ctx, c, 'Barrel', barrelTube(d.rb, d.rb, d.zc1 + 0.004, d.z1, ctx.seg(0.9)));
  const y = d.rb + 0.0032;
  put(ctx, c, 'Barrel', box([0, y, (d.fz + d.z1) / 2], [0.0065, 0.0016, d.z1 - d.fz - 0.003], ctx.bevel(0.0004)));
  for (let z = d.fz + 0.004; z < d.z1 - 0.004; z += 0.011) put(ctx, c, 'Detail', box([0, d.rb + 0.001, z], [0.004, 0.004, 0.004]));
  ejector(ctx, c, d);
  frontSight(ctx, c, d, y + 0.0008);
};

/** Full-length underlug and a flat top rib. */
const underlug: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'underlug');
  put(ctx, c, 'Barrel', barrelTube(d.rb, d.rb, d.zc1 + 0.004, d.z1, ctx.seg(0.9)));
  const yb = -d.rb - 0.011;
  side(ctx, c, 'Barrel', [[d.fz - 0.002, -d.rb * 0.4], [d.z1 - 0.0008, -d.rb * 0.4], [d.z1 - 0.0008, yb + 0.003], [d.z1 - 0.005, yb], [d.fz - 0.002, yb]], d.rb * 1.7, 0.0018);
  put(ctx, c, 'Barrel', box([0, d.rb + 0.0004, (d.fz + d.z1) / 2], [0.0075, 0.0036, d.z1 - d.fz - 0.002], ctx.bevel(0.0006)));
  frontSight(ctx, c, d, d.rb + 0.0022);
};

/** Heavy barrel with a top rib and ports near the muzzle. */
const ported: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'ported');
  const r = d.rb * 1.12;
  put(ctx, c, 'Barrel', barrelTube(r, r, d.zc1 + 0.004, d.z1, ctx.seg(0.9)));
  put(ctx, c, 'Barrel', box([0, r + 0.0004, (d.fz + d.z1) / 2], [0.008, 0.004, d.z1 - d.fz - 0.002], ctx.bevel(0.0006)));
  const ports = 2 + Math.round(ctx.p.detail * 2);
  for (let i = 0; i < ports; i++) bothSides((s) => put(ctx, c, 'Detail', box([s * 0.0022, r + 0.0024, d.z1 - 0.016 - i * 0.007], [0.0026, 0.0006, 0.0045])));
  ejector(ctx, c, d);
  frontSight(ctx, c, d, r + 0.0022, 'Detail', d.z1 - 0.004 - ports * 0.007 - 0.012);
};

/** Long target barrel: tapered, with a muzzle band and a tall blade. */
const target: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'target');
  put(ctx, c, 'Barrel', barrelTube(d.rb * 1.08, d.rb * 0.88, d.zc1 + 0.004, d.z1, ctx.seg(0.9)));
  put(ctx, c, 'Trim', lathe([[d.rb * 0.86, d.z1 - 0.014], [d.rb * 1.02, d.z1 - 0.013], [d.rb * 1.02, d.z1 - 0.004], [d.rb * 0.86, d.z1 - 0.003]], ctx.seg(0.9)));
  ejector(ctx, c, d);
  frontSight(ctx, c, d, d.rb * 0.9, 'Detail', d.z1 - 0.018);
};

/** Short, thick barrel with a half shroud and a ramp sight. */
const snubBarrel: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const c = barrelComp(ctx, 'snub');
  const r = d.rb * 1.1;
  put(ctx, c, 'Barrel', barrelTube(r, r, d.zc1 + 0.004, d.z1, ctx.seg(0.9)));
  side(ctx, c, 'Barrel', smoothPolygon([[d.fz - 0.003, -r * 0.4], [d.z1 - 0.002, -r * 0.4], [d.z1 - 0.004, -r - 0.004], [d.fz - 0.003, -r - 0.007]], 1), r * 1.5, 0.0015);
  side(ctx, c, 'Detail', [[d.z1 - 0.016, r - 0.001], [d.z1 - 0.002, r - 0.001], [d.z1 - 0.002, d.top + 0.0006], [d.z1 - 0.006, d.top + 0.0006]], 0.0032, 0.0006);
};

/** No barrel (pepperbox); on any other frame the muzzle is the front of the frame. */
const noBarrel: PartBuilder = (ctx) => {
  if (ctx.chosen.frame === 'pepperbox') return;
  const d = dims(ctx);
  ctx.L.barrel.z1 = d.fz;
  const f = ctx.b.has('Barrel') ? ctx.b.component('Barrel', { kind: 'barrel', variant: 'none' }) : frameComp(ctx, '-');
  put(ctx, f, 'Detail', cylinder(d.rb * 0.5, d.fz - 0.002, d.fz + 0.0006, 10));
};

export const REVOLVER_BARRELS: Record<string, PartBuilder> = { round, octagonal, ribbed, underlug, ported, target, snub: snubBarrel, none: noBarrel };

// ---------------------------------------------------------------------------
// Grips: a metal grip frame with panels (outlines in grip space: [t down, s forward])
// ---------------------------------------------------------------------------

function gripComp(ctx: BuildContext, variant: string): Component {
  const { L } = ctx;
  return ctx.b.component('Grip', { kind: 'grip', variant, pivot: [0, L.grip.y, L.grip.z] });
}

const toWorld = (d: Dims, pts: Vec2[]): Vec2[] => raked([d.gz, d.gy], d.a, pts as [number, number][]);

/** Metal grip frame (straps show around the panels) plus panels inset from it. */
function strapAndPanels(ctx: BuildContext, g: Component, outline: Vec2[], panel: MaterialSlot = 'Grip', strap: MaterialSlot = 'Body', inset = 0.0022, pw = 0.03): Vec2[] {
  const d = dims(ctx);
  const world = ccw(toWorld(d, outline));
  side(ctx, g, strap, world, 0.019, 0.0012);
  const p = insetPolygon(world, inset);
  side(ctx, g, panel, p, pw, 0.0035);
  return p;
}

const curve = (a: Vec2, b: Vec2, c: Vec2, e: Vec2, n = 5): Vec2[] => bezier(a, b, c, e, n);

/** Rounded bird's head butt that curls forward. */
const birdshead: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const g = gripComp(ctx, 'birdshead');
  const L = d.Lg, D = d.D;
  strapAndPanels(ctx, g, [
    [0, 0], ...curve([0, 0], [L * 0.5, 0.002], [L * 0.8, 0.006], [L, 0.002]),
    ...curve([L, 0.002], [L + 0.008, -D * 0.3], [L + 0.004, -D * 0.9], [L * 0.86, -D - 0.004]),
    ...curve([L * 0.86, -D - 0.004], [L * 0.6, -D - 0.006], [L * 0.3, -D - 0.001], [0, -D]),
  ]);
  put(ctx, g, 'Trim', dome(0.0022, 0.0008, 8, 2).transform({ r: [0, Math.PI / 2, 0] }), [0.0154, ...toWorld(d, [[L * 0.45, -D * 0.5]])[0].slice().reverse()] as Vec3);
  put(ctx, g, 'Trim', dome(0.0022, 0.0008, 8, 2).transform({ r: [0, -Math.PI / 2, 0] }), [-0.0154, ...toWorld(d, [[L * 0.45, -D * 0.5]])[0].slice().reverse()] as Vec3);
};

/** Square butt with a flat metal cap. */
const square: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const g = gripComp(ctx, 'square');
  const L = d.Lg, D = d.D;
  strapAndPanels(ctx, g, [[0, 0], [L, 0.001], [L + 0.002, -D - 0.003], [L * 0.5, -D - 0.002], [0, -D]]);
  side(ctx, g, 'Detail', toWorld(d, [[L - 0.001, 0.0015], [L + 0.0035, 0.0015], [L + 0.0045, -D - 0.0035], [L, -D - 0.0035]]), 0.024, 0.0008);
  // Grip screw.
  const [z, y] = toWorld(d, [[L * 0.5, -D * 0.5]])[0];
  bothSides((s) => put(ctx, g, 'Detail', dome(0.0018, 0.0007, 8, 2), [s * 0.0152, y, z], [0, (s * Math.PI) / 2, 0]));
};

/** Plow handle that flares at the heel, wood panels with a medallion. */
const panel: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const g = gripComp(ctx, 'panel');
  const L = d.Lg, D = d.D;
  strapAndPanels(ctx, g, [
    [0, 0], ...curve([0, 0], [L * 0.4, 0.003], [L * 0.8, 0.002], [L, 0.003]),
    [L + 0.003, -D * 0.4], ...curve([L + 0.003, -D * 0.4], [L + 0.004, -D - 0.004], [L - 0.002, -D - 0.008], [L - 0.008, -D - 0.008]),
    ...curve([L - 0.008, -D - 0.008], [L * 0.6, -D - 0.002], [L * 0.3, -D + 0.001], [0, -D]),
  ], 'Grip', 'Trim');
  const [z, y] = toWorld(d, [[L * 0.38, -D * 0.48]])[0];
  bothSides((s) => {
    put(ctx, g, 'Trim', dome(0.0045, 0.0012, ctx.seg(0.6), 2), [s * 0.0151, y, z], [0, (s * Math.PI) / 2, 0]);
    put(ctx, g, 'Accent', dome(0.003, 0.0012, ctx.seg(0.6), 2), [s * 0.0158, y, z], [0, (s * Math.PI) / 2, 0]);
  });
};

/** Wraparound rubber grip with finger grooves on the front. */
const rubber: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const g = gripComp(ctx, 'rubber');
  const L = d.Lg, D = d.D;
  const front: Vec2[] = [];
  const bumps = 3;
  for (let i = 0; i <= bumps * 4; i++) {
    const t = 0.004 + (i / (bumps * 4)) * (L - 0.01);
    front.push([t, 0.002 + Math.max(0, Math.sin((i / 4) * Math.PI)) * 0.0035]);
  }
  const outline: Vec2[] = [[-0.001, 0.001], ...front, [L, 0.002], [L + 0.004, -D * 0.4], [L + 0.002, -D - 0.004], [L * 0.6, -D - 0.004], [0.006, -D - 0.002], [-0.001, -D - 0.001]];
  side(ctx, g, 'Grip', smoothPolygon(ccw(toWorld(d, outline)), 1), 0.03, 0.005);
  // Texture bands.
  for (let i = 0; i < 4; i++) {
    const t = L * (0.25 + i * 0.16);
    side(ctx, g, 'Detail', toWorld(d, [[t, -D * 0.25], [t + 0.0022, -D * 0.25], [t + 0.0022, -D * 0.8], [t, -D * 0.8]]), 0.0312);
  }
};

/** Sci-fi skeleton: open frame of straps around a glowing core. */
const skeletal: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const g = gripComp(ctx, 'skeletal');
  const L = d.Lg, D = d.D, k = 0.0055;
  const core: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  side(ctx, g, 'Grip', toWorld(d, [[0, 0.001], [L - k, 0.003], [L - k, -k + 0.002], [0, -k]]), 0.026, 0.0018);
  side(ctx, g, 'Grip', toWorld(d, [[0, -D + k], [L - k, -D + k - 0.002], [L - k, -D - 0.002], [0, -D]]), 0.026, 0.0018);
  side(ctx, g, 'Grip', toWorld(d, [[L - k, 0.004], [L, 0.003], [L + 0.002, -D * 0.5], [L, -D - 0.003], [L - k, -D - 0.003]]), 0.028, 0.0018);
  side(ctx, g, 'Body', toWorld(d, [[-0.002, -k + 0.001], [L - k + 0.001, -k + 0.003], [L - k + 0.001, -D + k - 0.003], [-0.002, -D + k - 0.001]]), 0.012, 0.001);
  side(ctx, g, core, toWorld(d, [[0.012, -k - 0.002], [L - k - 0.006, -k - 0.001], [L - k - 0.006, -D + k + 0.001], [0.012, -D + k + 0.002]]), 0.0136);
  ctx.L.extra.insigniaX = 0.0136;
};

export const REVOLVER_GRIPS: Record<string, PartBuilder> = { birdshead, square, panel, rubber, skeletal };

// ---------------------------------------------------------------------------
// Hammers: drawn around the pivot behind the cylinder; cocking turns the top back.
// ---------------------------------------------------------------------------

function hammerComp(ctx: BuildContext, variant: string, travel: number): Component {
  const d = dims(ctx);
  return ctx.b.component('Hammer', {
    kind: 'hammer', variant, pivot: [0, d.hy, d.hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -travel], purpose: 'cock' },
  });
}

const spur: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const h = hammerComp(ctx, 'spur', 0.7);
  const { hz, hy, top: t } = d;
  side(ctx, h, 'Detail', [
    [hz + 0.004, hy - 0.004], [hz + 0.0055, t + 0.002], [hz + 0.002, t + 0.007], [hz - 0.008, t + 0.011], [hz - 0.019, t + 0.0155],
    [hz - 0.0225, t + 0.0125], [hz - 0.012, t + 0.0035], [hz - 0.0065, t - 0.002], [hz - 0.005, hy - 0.006],
  ], 0.0068, 0.0012);
  for (let i = 0; i < 3; i++) {
    const z = hz - 0.012 - i * 0.003, y = t + 0.0102 + i * 0.0014;
    put(ctx, h, 'Body', box([0, 0, 0], [0.0072, 0.0006, 0.0012]), [0, y, z], [0.4, 0, 0]);
  }
};

const bobbed: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const h = hammerComp(ctx, 'bobbed', 0.5);
  const { hz, hy, top: t } = d;
  side(ctx, h, 'Detail', smoothPolygon([
    [hz + 0.004, hy - 0.004], [hz + 0.0055, t + 0.001], [hz + 0.001, t + 0.005], [hz - 0.006, t + 0.0045], [hz - 0.009, t + 0.0005], [hz - 0.006, hy - 0.006],
  ], 1), 0.0068, 0.0012);
};

const ornateHammer: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const h = hammerComp(ctx, 'ornate', 0.7);
  const { hz, hy, top: t } = d;
  side(ctx, h, 'Trim', [
    [hz + 0.004, hy - 0.004], [hz + 0.0055, t + 0.002], [hz + 0.002, t + 0.008], [hz - 0.008, t + 0.012], [hz - 0.016, t + 0.016],
    [hz - 0.019, t + 0.014], [hz - 0.012, t + 0.0035], [hz - 0.0065, t - 0.002], [hz - 0.005, hy - 0.006],
  ], 0.0068, 0.0012);
  // Curl at the tip and a gem on each side.
  put(ctx, h, 'Trim', ring(0.0028, 0.0009, 0, 10, 4).transform({ r: [0, Math.PI / 2, 0] }), [0, t + 0.0175, hz - 0.0195]);
  const gem: MaterialSlot = ctx.style.traits.magic ? 'Emissive' : 'Glass';
  bothSides((s) => put(ctx, h, gem, dome(0.0017, 0.0011, 8, 2), [s * 0.0034, t + 0.0055, hz - 0.002], [0, (s * Math.PI) / 2, 0]));
};

/** Angular block hammer for sci-fi frames, with a glowing top. */
const block: PartBuilder = (ctx) => {
  const d = dims(ctx);
  const h = hammerComp(ctx, 'block', 0.55);
  const { hz, hy, top: t } = d;
  side(ctx, h, 'Detail', [
    [hz + 0.004, hy - 0.004], [hz + 0.005, t + 0.006], [hz - 0.004, t + 0.009], [hz - 0.014, t + 0.009], [hz - 0.014, t + 0.0045], [hz - 0.007, t + 0.001], [hz - 0.006, hy - 0.006],
  ], 0.008, 0.001);
  put(ctx, h, ctx.style.traits.glow ? 'Emissive' : 'Accent', box([0, t + 0.0093, hz - 0.006], [0.0042, 0.0008, 0.012]));
};

export const REVOLVER_HAMMERS: Record<string, PartBuilder> = { spur, bobbed, ornate: ornateHammer, block };
