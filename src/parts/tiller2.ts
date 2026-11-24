/**
 * More crossbow tillers (the "bodies" update):
 *
 *   pistol    compact one-hand tiller with an under-lever to draw the string (no stock)
 *   repeater  a bolt magazine on top of the rail, worked by a yoke lever
 *   heavy     a siege-style thick beam with iron bands and a windlass at the back
 *
 * Same conventions as crossbow.ts: the bolt rests on the flight rail at y = 0,
 * the rail top is at y = -0.004 and the prod sits at L.extra.prodZ.
 */
import { AXIS_X, Vec2, Vec3, box, cylinder, rod, ring, smoothPolygon } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, side } from './context.js';
import { rivetRow, triggerAndGuard } from './receiver.js';

function tiller(ctx: BuildContext, variant: string) {
  return ctx.b.component('Tiller', { kind: 'tiller', variant, parent: null });
}

/** Wood for old-world styles, the body color otherwise. */
const woodOr = (ctx: BuildContext, other: MaterialSlot): MaterialSlot => {
  const t = ctx.style.traits;
  return t.plumbing || t.magic || t.scrap || (t.era ?? 2000) < 1950 ? 'Stock' : other;
};

/** Pistol crossbow: a short housing and rail, drawn by a lever folded under the rail. */
const pistol: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const t = tiller(ctx, 'pistol');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const pz = L.extra.prodZ;
  const body = woodOr(ctx, 'Body');
  // Compact housing with a rounded tail (there is no stock behind it).
  side(ctx, t, body, smoothPolygon([
    [z0 - 0.004, (top + bottom) / 2], [z0 + 0.006, top - 0.004], [z0 + 0.03, top], [z1 - 0.01, top - 0.004], [z1 + 0.03, -0.004],
    [z1 + 0.03, -0.022], [z1, bottom + 0.01], [z0 + 0.03, bottom], [z0, bottom + 0.012],
  ], 1), w * 0.9, 0.004);
  // Slim flight rail and the prod mount.
  side(ctx, t, 'Body', [[z1, -0.004], [pz + 0.034, -0.004], [pz + 0.04, -0.01], [pz + 0.04, -0.028], [pz - 0.03, -0.03], [z1 + 0.03, -0.022], [z1, -0.022]], 0.024, 0.0018);
  put(ctx, t, 'Detail', box([0, -0.0035, (z1 + pz) / 2], [0.005, 0.0012, pz - z1]));
  // Front and rear sight on the housing.
  put(ctx, t, 'Detail', box([0, top + 0.003, z0 + 0.02], [0.012, 0.006, 0.006], ctx.bevel(0.0008)));
  put(ctx, t, 'Detail', box([0, -0.004 + 0.004, pz - 0.02], [0.003, 0.008, 0.004]));
  // Cocking lever folded under the rail: hinged at the front, the tail swings down.
  const hz = pz - 0.025, hy = -0.034;
  const lever = b.component('Lever', {
    kind: 'lever', variant: 'under-lever', pivot: [0, hy, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.9], purpose: 'cock (swing the tail down to draw the string)' },
  });
  const tail = z1 + 0.035;
  side(ctx, lever, 'Detail', [[hz + 0.008, hy + 0.004], [tail + 0.01, hy + 0.006], [tail, hy - 0.006], [tail - 0.012, hy - 0.016], [tail - 0.006, hy - 0.004], [hz, hy - 0.006]], 0.012, 0.0015);
  put(ctx, lever, 'Trim', cylinder(0.004, -0.009, 0.009, 10), [0, hy, hz], AXIS_X);
  L.mountY = top + 0.006;
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Repeater: a box of bolts sits on the rail, cycled by a yoke lever that wraps around it. */
const repeater: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const t = tiller(ctx, 'repeater');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const pz = L.extra.prodZ;
  const wood = woodOr(ctx, 'Body');
  // Tiller: housing plus a deep flight rail.
  side(ctx, t, wood, [[z0, bottom + 0.012], [z0 + 0.014, bottom], [z1, bottom], [z1 + 0.04, -0.03], [pz - 0.03, -0.032], [pz + 0.04, -0.026],
    [pz + 0.045, -0.004], [z1 + 0.01, -0.004], [z1 - 0.01, top - 0.006], [z0 + 0.01, top - 0.004], [z0, top - 0.012]], w * 0.85, 0.004);
  // The magazine: a tall box over the latch, open slot on the side showing the bolts.
  const m0 = L.extra.latchZ - 0.02, m1 = z1 + 0.11 + p.length * 0.03;
  const mb = 0.004, mt = 0.05 + p.bulk * 0.01, mw = 0.032;
  side(ctx, t, wood, [[m0, mb], [m1, mb], [m1, mt - 0.006], [m1 - 0.01, mt], [m0, mt]], mw, 0.003);
  side(ctx, t, 'Trim', [[m0 - 0.002, mt - 0.004], [m1 - 0.006, mt - 0.004], [m1 - 0.012, mt + 0.003], [m0 - 0.002, mt + 0.003]], mw + 0.003, 0.001);
  for (const s of [1, -1]) {
    side(ctx, t, 'Detail', [[m0 + 0.03, mb + 0.01], [m1 - 0.03, mb + 0.01], [m1 - 0.03, mt - 0.012], [m0 + 0.03, mt - 0.012]], 0.002, 0, s * (mw / 2 + 0.0002));
    // Bolt shafts stacked in the window.
    const n = 3 + Math.round(p.detail * 2);
    for (let i = 0; i < n; i++) {
      const y = mb + 0.014 + i * ((mt - mb - 0.03) / Math.max(1, n - 1));
      put(ctx, t, 'Accent', box([s * (mw / 2 + 0.0008), y, (m0 + m1) / 2], [0.0012, 0.004, m1 - m0 - 0.066]));
    }
  }
  // Metal straps holding the magazine to the tiller.
  for (const z of [m0 + 0.012, m1 - 0.014]) put(ctx, t, 'Trim', box([0, (mb + mt) / 2 - 0.012, z], [mw + 0.004, mt - mb + 0.024, 0.006], ctx.bevel(0.001)));
  // Yoke lever: two side arms hinged ahead of the magazine, a handle bar behind it.
  const hz = m1 + 0.04, hy = -0.016;
  const lever = b.component('Lever', {
    kind: 'lever', variant: 'yoke', pivot: [0, hy, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.6], purpose: 'cycle (lever up and back: draws the string and drops a bolt)' },
  });
  const seg = Math.max(6, ctx.seg(0.4));
  const ax = mw / 2 + 0.007;
  const back: Vec3[] = [];
  for (const s of [1, -1]) {
    const a: Vec3 = [s * ax, hy, hz], k: Vec3 = [s * ax, mt + 0.008, m1 - 0.01], e: Vec3 = [s * ax, mt + 0.012, m0 - 0.012];
    put(ctx, lever, 'Detail', rod(a, k, 0.0028, seg));
    put(ctx, lever, 'Detail', rod(k, e, 0.0028, seg));
    put(ctx, lever, 'Trim', cylinder(0.005, -0.003, 0.003, 10), [s * (ax + 0.001), hy, hz], AXIS_X);
    back.push(e);
  }
  put(ctx, lever, 'Grip', cylinder(0.0055, -ax - 0.006, ax + 0.006, 10, ctx.bevel(0.0015)), [0, mt + 0.012, m0 - 0.012], AXIS_X);
  put(ctx, t, 'Detail', cylinder(0.003, -ax - 0.004, ax + 0.004, 8), [0, hy, hz], AXIS_X);
  // Foregrip block under the rail.
  const fz = hz + (pz - hz) * 0.4;
  side(ctx, t, 'Grip', [[fz - 0.02, -0.03], [fz + 0.024, -0.03], [fz + 0.018, -0.066 - p.bulk * 0.01], [fz - 0.014, -0.066 - p.bulk * 0.01]], 0.026, 0.004);
  if (ctx.style.traits.rivets) rivetRow(ctx, t, 'Trim', [1, -1].flatMap((s) => [[s * (w * 0.425 + 0.0005), bottom + 0.012, z0 + 0.03], [s * (w * 0.425 + 0.0005), top - 0.012, z0 + 0.03]] as Vec3[]), 0.0022);
  L.mountY = mt + 0.004;
  triggerAndGuard(ctx, 'Trim', 'square');
};

/** Heavy: a siege-style thick beam with iron bands, a big prod block and a rear windlass. */
const heavy: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const t = tiller(ctx, 'heavy');
  const { z0, z1, top, bottom } = L.rec;
  const w = L.rec.width * 1.3;
  const pz = L.extra.prodZ;
  const latch = L.extra.latchZ;
  const beamB = bottom - 0.01;
  // The beam: tall at the back (housing the nut), a deep rail to the prod.
  side(ctx, t, 'Stock', [
    [z0, beamB + 0.01], [z0 + 0.01, beamB], [z1 + 0.04, beamB + 0.004], [pz - 0.04, -0.054], [pz + 0.05, -0.05], [pz + 0.055, -0.004],
    [latch + 0.016, -0.004], [latch + 0.006, top], [z0 + 0.006, top], [z0, top - 0.008],
  ], w, 0.003);
  put(ctx, t, 'Detail', box([0, -0.0036, (latch + pz) / 2 + 0.02], [0.007, 0.0014, pz - latch]));
  // Revolving nut (the latch) on top of the housing.
  put(ctx, t, 'Trim', cylinder(0.011, -w * 0.3, w * 0.3, ctx.seg(0.8)), [0, 0.006, latch - 0.004], AXIS_X);
  // Iron bands around the beam.
  const bands = [z0 + 0.03, z1 + 0.02, (z1 + pz) / 2, pz - 0.05];
  for (const z of bands) {
    const yTop = z < latch ? top : -0.004;
    const yBot = beamB + (z > z1 ? ((-0.054 - beamB) * (z - z1)) / (pz - z1) : 0);
    put(ctx, t, 'Detail', box([0, (yTop + yBot) / 2, z], [w + 0.004, yTop - yBot + 0.004, 0.01], ctx.bevel(0.0008)));
    rivetRow(ctx, t, 'Trim', [1, -1].map((s) => [s * (w / 2 + 0.0022), (yTop + yBot) / 2, z] as Vec3), 0.0022);
  }
  // Prod lashings: an iron block with straps.
  put(ctx, t, 'Detail', box([0, -0.02, pz], [w + 0.01, 0.04, 0.06], ctx.bevel(0.003)));
  // Windlass at the back: two posts, a rope drum on an axle, crank handles on both ends.
  const wz = z0 + 0.024, wy = top + 0.018, R = 0.011 + p.bulk * 0.003;
  for (const s of [1, -1]) side(ctx, t, 'Detail', [[wz - 0.014, top - 0.01], [wz + 0.014, top - 0.01], [wz + 0.006, wy + 0.004], [wz - 0.006, wy + 0.004]], 0.006, 0.001, s * (w / 2 - 0.003));
  const crank = b.component('Crank', {
    kind: 'crank', variant: 'windlass', pivot: [0, wy, wz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, Math.PI * 6], purpose: 'wind the string back' },
  });
  const seg = Math.max(8, ctx.seg(0.8));
  put(ctx, crank, 'Stock', cylinder(R, -w / 2 + 0.008, w / 2 - 0.008, seg, ctx.bevel(0.002)), [0, wy, wz], AXIS_X);
  for (let i = 0; i < 4; i++) put(ctx, crank, 'Detail', ring(R + 0.0012, 0.0014, -w / 2 + 0.014 + i * ((w - 0.028) / 3), seg, 4), [0, wy, wz], AXIS_X);
  put(ctx, crank, 'Detail', cylinder(0.004, -w / 2 - 0.03, w / 2 + 0.03, 8), [0, wy, wz], AXIS_X);
  for (const s of [1, -1]) {
    const x = s * (w / 2 + 0.026), arm = 0.038 + p.bulk * 0.01;
    for (const dir of [1, -1]) {
      const end: Vec3 = [x, wy + dir * arm * 0.7, wz + dir * arm * 0.7];
      put(ctx, crank, 'Detail', rod([x, wy, wz], end, 0.0028, 6));
      put(ctx, crank, 'Grip', cylinder(0.0045, s > 0 ? 0 : -0.022, s > 0 ? 0.022 : 0, 8, ctx.bevel(0.001)), end, AXIS_X);
    }
  }
  // Rope from the drum forward to a claw hook resting on the string at the latch.
  const hook: Vec2 = [latch + 0.004, 0.012];
  for (const x of [0.004, -0.004]) put(ctx, t, 'Accent', rod([x, wy - R * 0.6, wz + R * 0.6], [x, hook[1], hook[0] - 0.012], 0.0014, 5));
  side(ctx, t, 'Detail', [[hook[0] - 0.014, hook[1] + 0.004], [hook[0], hook[1] + 0.004], [hook[0] + 0.006, hook[1] - 0.004], [hook[0] + 0.002, hook[1] - 0.008], [hook[0] - 0.002, hook[1] - 0.002], [hook[0] - 0.014, hook[1] - 0.003]], 0.014, 0.001);
  L.mountY = top + 0.004;
  triggerAndGuard(ctx, 'Detail', 'square');
};

export const TILLERS2: Record<string, PartBuilder> = { pistol, repeater, heavy };
