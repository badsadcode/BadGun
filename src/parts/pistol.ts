/**
 * Handgun parts: frames (slide pistol, revolver, blaster), pistol grips and
 * the magazine that hides inside the grip.
 *
 * Pistol layout reuses LongGunLayout fields:
 *   rec      = slide envelope (z0..z1, top) + frame bottom (bottom)
 *   handguard = dust cover under the slide (front of the frame)
 *   magwell  = magazine inside the grip
 */
import { Vec2, Vec3, bezier, box, cylinder, dome, lathe, smoothPolygon, tube } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import { BuildContext, put, raked, side } from './context.js';
import { platedBlock } from './plated.js';
import type { MaterialSlot } from '../types.js';

const ROOT = 'Frame';

function frame(ctx: BuildContext, variant: string) {
  return ctx.b.component(ROOT, { kind: 'frame', variant, parent: null });
}

/** Trigger plus a guard running from the grip forward. */
export function pistolTrigger(ctx: BuildContext, slot: MaterialSlot, round: boolean): void {
  const { L, b } = ctx;
  const f = frame(ctx, '-');
  const y = L.rec.bottom;
  const zt = L.trigger.z;
  const trig = b.component('Trigger', {
    kind: 'trigger', variant: 'blade', pivot: [0, y + 0.004, zt],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.3], purpose: 'fire' },
  });
  side(ctx, trig, 'Detail', [[zt - 0.003, y + 0.006], [zt + 0.003, y + 0.006], [zt + 0.003, y - 0.008], [zt, y - 0.017], [zt - 0.004, y - 0.016], [zt - 0.001, y - 0.008]], 0.006, 0.0012);
  const g0 = L.grip.z - 0.004, g1 = L.grip.z + 0.05, depth = 0.026, t = 0.0045;
  let guard: Vec2[];
  if (round) {
    const outer = bezier([g0, y], [g0 + 0.002, y - depth * 1.25], [g1 + 0.006, y - depth * 1.15], [g1, y], 10);
    const inner = bezier([g1 - t, y], [g1 - t + 0.004, y - (depth - t) * 1.1], [g0 + t, y - (depth - t) * 1.2], [g0 + t, y], 10);
    guard = [[g0, y], ...outer, ...inner];
  } else {
    guard = [
      [g0, y], [g0, y - depth + 0.006], [g0 + 0.008, y - depth], [g1 + 0.004, y - depth], [g1, y],
      [g1 - t, y], [g1 - t + 0.002, y - depth + t], [g0 + t + 0.006, y - depth + t], [g0 + t, y - depth + t + 0.006], [g0 + t, y],
    ];
  }
  side(ctx, f, slot, guard, 0.012, 0.0015);
}

/** Magazine hidden in the grip; only the base plate shows. Slides out along the grip. */
export function gripMagazine(ctx: BuildContext, bodySlot: 'Magazine' | 'Emissive' = 'Magazine'): void {
  const { L } = ctx;
  const a = L.grip.angle;
  const axis: Vec3 = [0, -Math.cos(a), -Math.sin(a)];
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'grip', pivot: [0, L.grip.y, L.grip.z - 0.025],
    motion: { type: 'translate', axis, range: [0, 0.14], purpose: 'reload' },
  });
  const o: Vec2 = [L.grip.z, L.grip.y];
  const D = L.extra.gripDepth, Lg = L.grip.length;
  side(ctx, m, bodySlot, raked(o, a, [[0, -0.007], [Lg, -0.007], [Lg, -D + 0.007], [0, -D + 0.007]]), 0.02);
  side(ctx, m, 'Detail', raked(o, a, [[Lg - 0.001, -0.003], [Lg + 0.008, -0.002], [Lg + 0.009, -D - 0.002], [Lg - 0.001, -D + 0.001]]), 0.03, 0.002);
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

/** Modern striker pistol: polymer frame, metal slide that racks back. */
const slide: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'slide');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const sb = -0.008;
  const s = b.component('Slide', {
    kind: 'slide', variant: 'serrated', pivot: [0, 0, z0],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.04], purpose: 'fire (recoil) / rack' },
  });
  // Seeded slide look: nose shape, serration pattern, top ports, optic plate.
  const look = ctx.rng('frame:slide-look');
  const nose = look.pick(['square', 'chamfer', 'round'] as const);
  const pattern = look.pick(['fine', 'wide', 'angled'] as const);
  const ports = look.chance(0.3) ? look.int(2, 3) : 0;
  const plate = look.chance(0.3);
  const front: Vec2[] = nose === 'chamfer'
    ? [[z1 - 0.009, sb], [z1, sb + 0.007], [z1, top - 0.005], [z1 - 0.007, top]]
    : nose === 'round'
      ? [[z1, sb], [z1, top * 0.3], ...bezier([z1, top * 0.3], [z1, top - 0.002], [z1 - 0.004, top], [z1 - 0.012, top], 4).slice(1)]
      : [[z1, sb], [z1, top - 0.005], [z1 - 0.007, top]];
  side(ctx, s, 'Body', [[z0, sb], ...front, [z0 + 0.004, top], [z0, top - 0.004]], w, 0.002);
  // Rear (and maybe front) serrations.
  const serr = pattern === 'wide' ? 3 + Math.round(p.detail * 2) : 5 + Math.round(p.detail * 3);
  const pitch = pattern === 'wide' ? 0.0068 : 0.0045, thick = pattern === 'wide' ? 0.003 : 0.0018, lean = pattern === 'angled' ? 0.3 : 0;
  for (let i = 0; i < serr; i++) {
    put(ctx, s, 'Detail', box([0, 0, 0], [w + 0.0012, top - sb - 0.008, thick]), [0, (sb + top) / 2 - 0.001, z0 + 0.008 + i * pitch], [-lean, 0, 0]);
    if (p.detail > 0.55 && i < 4) put(ctx, s, 'Detail', box([0, 0, 0], [w + 0.0012, top - sb - 0.008, thick]), [0, (sb + top) / 2 - 0.001, z1 - 0.014 - i * pitch], [lean, 0, 0]);
  }
  for (let i = 0; i < ports; i++) put(ctx, s, 'Detail', box([0, top + 0.0003, z1 - 0.022 - i * 0.008], [w * 0.5, 0.001, 0.004]));
  if (plate) put(ctx, s, 'Accent', box([0, top + 0.0008, z0 + 0.03], [w * 0.62, 0.0016, 0.026], ctx.bevel(0.0005)));
  // Ejection port and sights.
  put(ctx, s, 'Barrel', box([-w * 0.2, top - 0.0015, z0 + (z1 - z0) * 0.55], [w * 0.62, 0.004, 0.034], ctx.bevel(0.0008)));
  for (const x of [0.005, -0.005]) put(ctx, s, 'Detail', box([x, top + 0.003, z0 + 0.008], [0.004, 0.006, 0.007], ctx.bevel(0.0008)));
  put(ctx, s, 'Detail', box([0, top + 0.0028, z1 - 0.01], [0.003, 0.0056, 0.005], ctx.bevel(0.0006)));
  if (ctx.style.traits.glow) put(ctx, s, 'Emissive', box([0, top + 0.0058, z1 - 0.01], [0.0018, 0.0012, 0.002]));

  // Barrel: only the muzzle end shows.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'pistol', pivot: [0, 0, L.barrel.z0] });
  put(ctx, bar, 'Barrel', tube(L.barrel.radius, L.barrel.radius * 0.55, z1 - 0.03, L.barrel.z1, ctx.seg(0.7)));

  // Polymer frame: dust cover + rear tang.
  const hg = L.handguard;
  side(ctx, f, 'Grip', [
    [L.grip.z - L.extra.gripDepth - 0.006, sb], [hg.z1, sb], [hg.z1, sb - 0.006], [hg.z1 - 0.01, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.004], [z0 - 0.006, sb - 0.002],
  ], w * 0.92, 0.002);
  if (ctx.style.traits.rails) {
    // Accessory rail under the dust cover (teeth point down).
    for (let z = hg.z0 + 0.006; z + 0.006 < hg.z1 - 0.008; z += 0.01) {
      put(ctx, f, 'Grip', box([0, bottom - 0.0028, z + 0.0026], [0.02, 0.0034, 0.0052]));
    }
  }
  // Slide stop and takedown lever on the left.
  put(ctx, f, 'Detail', box([w * 0.47, sb - 0.002, L.grip.z + 0.03], [0.002, 0.004, 0.02], ctx.bevel(0.0006)));
  put(ctx, f, 'Detail', box([w * 0.47, sb - 0.003, L.grip.z + 0.055], [0.002, 0.005, 0.006], ctx.bevel(0.0006)));
  pistolTrigger(ctx, 'Grip', ctx.rng('frame').chance(0.5));
  gripMagazine(ctx);
  L.mountY = top;
};

/** Steampunk revolver: brass frame, fluted cylinder, octagonal barrel, big hammer. */
const revolver: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'revolver');
  const { z0, z1, width: w } = L.rec;
  const seg = ctx.seg(1.1);
  const cr = 0.019 + p.bulk * 0.004, rc = cr * 0.58, yc = -rc;
  const zc0 = z0 + 0.045, zc1 = zc0 + 0.04 + p.bulk * 0.006;
  const strapY0 = yc + cr + 0.0015, strapY1 = strapY0 + 0.007;
  const lowY = yc - cr - 0.002;
  const fw = w * 0.9;
  // Top strap, standing breech, lower frame, front lug.
  side(ctx, f, 'Body', [[zc0 - 0.014, strapY0], [zc1 + 0.014, strapY0], [zc1 + 0.014, strapY1], [zc0 - 0.004, strapY1 + 0.001], [zc0 - 0.02, strapY1 - 0.002]], fw, 0.0015);
  side(ctx, f, 'Body', [[zc1, -0.012], [zc1 + 0.016, -0.012], [zc1 + 0.016, strapY1], [zc1, strapY1]], fw, 0.0015);
  side(ctx, f, 'Body', [[zc0 - 0.016, lowY - 0.008], [zc1 + 0.008, lowY - 0.008], [zc1 + 0.008, -0.012], [zc1, -0.014], [zc1, lowY + 0.002], [zc0 - 0.016, lowY + 0.002]], fw, 0.0015);
  side(ctx, f, 'Body', [
    [z0 - 0.004, strapY1 - 0.006], [zc0 - 0.004, strapY1], [zc0 - 0.004, lowY - 0.008], [L.grip.z + 0.004, L.rec.bottom - 0.002],
    [L.grip.z - L.extra.gripDepth, L.rec.bottom + 0.002], [z0 - 0.01, strapY1 - 0.016],
  ], fw, 0.002);
  // Screws.
  for (const [z, y] of [[zc0 - 0.01, (strapY1 + lowY) / 2], [L.grip.z - 0.01, L.rec.bottom + 0.008]] as [number, number][]) {
    for (const s of [1, -1]) put(ctx, f, 'Trim', dome(0.0028, 0.0012, 8, 2), [s * fw / 2, y, z], [0, (s * Math.PI) / 2, 0]);
  }

  // Cylinder: rotates one chamber per shot.
  const cyl = b.component('Cylinder', {
    kind: 'cylinder', variant: 'six-shot', pivot: [0, yc, zc0],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, Math.PI / 3], purpose: 'advance one chamber' },
  });
  const e = ctx.bevel(0.003);
  put(ctx, cyl, 'Magazine', lathe([[0, zc0], [cr - e, zc0], [cr, zc0 + e], [cr, zc1 - e], [cr - e, zc1], [0, zc1]], seg), [0, yc, 0]);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * Math.PI * 2;
    put(ctx, cyl, 'Detail', cylinder(rc * 0.42, 0, 0.0012, 10), [Math.cos(a) * rc, yc + Math.sin(a) * rc, zc1 - 0.0004]);
    const fa = a + Math.PI / 6;
    put(ctx, cyl, 'Detail', box([0, 0, 0], [0.004, 0.0024, (zc1 - zc0) * 0.62]), [Math.cos(fa) * cr, yc + Math.sin(fa) * cr, (zc0 + zc1) / 2 + 0.002], [0, 0, fa + Math.PI / 2]);
  }
  if (p.ornament > 0.4) put(ctx, cyl, 'Trim', lathe([[cr, zc0 + 0.004], [cr + 0.0012, zc0 + 0.005], [cr + 0.0012, zc0 + 0.008], [cr, zc0 + 0.009]], seg), [0, yc, 0]);

  // Octagonal barrel with ejector rod and front blade.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'octagonal', pivot: [0, 0, zc1] });
  const rb = L.barrel.radius * 1.3;
  put(ctx, bar, 'Barrel', lathe([[rb * 0.45, zc1 + 0.002], [rb, zc1 + 0.002], [rb, z1], [rb * 0.45, z1]], 8, Math.PI / 8));
  put(ctx, bar, 'Detail', cylinder(rb * 0.42, zc1 + 0.01, z1 - 0.02, 10), [0, -rb * 1.5, 0]);
  put(ctx, bar, 'Barrel', box([0, -rb * 0.9, (zc1 + z1) / 2 - 0.006], [rb * 0.9, rb * 1.2, z1 - zc1 - 0.03], ctx.bevel(0.001)));
  put(ctx, bar, 'Trim', box([0, rb + 0.004, z1 - 0.008], [0.0025, 0.008, 0.008], ctx.bevel(0.0008)));
  if (p.ornament > 0.5) put(ctx, bar, 'Trim', lathe([[rb, z1 - 0.004], [rb * 1.2, z1 - 0.003], [rb * 1.2, z1], [rb, z1 + 0.0005]], 8, Math.PI / 8));

  // Hammer with a big spur.
  const hz = zc0 - 0.012, hy = strapY1 - 0.002;
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'spur', pivot: [0, hy - 0.01, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.7], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [
    [hz + 0.006, hy - 0.014], [hz, hy - 0.014], [hz - 0.008, hy + 0.006], [hz - 0.022, hy + 0.014], [hz - 0.024, hy + 0.009], [hz - 0.01, hy - 0.002], [hz + 0.004, hy - 0.006],
  ], 0.007, 0.0015);
  pistolTrigger(ctx, 'Trim', true);
  L.mountY = strapY1;
  L.extra.revolver = 1;
};

/** Sci-fi blaster: chunky shell, glowing coils, power cell under the barrel. */
const blaster: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'blaster');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const rng = ctx.rng('frame');
  const hump = rng.range(0.004, 0.012);
  side(ctx, f, 'Body', smoothPolygon([
    [z0, top - 0.006], [z0 + 0.004, bottom + 0.006], [L.grip.z - L.extra.gripDepth, bottom], [L.grip.z + 0.06, bottom], [z1 - 0.03, -0.012],
    [z1 - 0.012, -0.006], [z1 - 0.016, top * 0.6], [z1 - 0.05, top], [z0 + 0.04, top + hump], [z0 + 0.008, top + hump * 0.5],
  ], p.smoothness > 0.3 ? 1 : 0), w * 1.1, 0.005);
  side(ctx, f, 'Trim', smoothPolygon([[z0 + 0.02, -0.002], [z1 - 0.06, -0.004], [z1 - 0.07, top - 0.006], [z0 + 0.03, top - 0.002]], 1), w * 1.1 + 0.004, 0.0015);
  if (ctx.style.traits.glow) {
    side(ctx, f, 'Emissive', [[z0 + 0.03, 0.004], [z1 - 0.075, 0.003], [z1 - 0.076, 0.0058], [z0 + 0.031, 0.0068]], w * 1.1 + 0.007);
  }
  // Top fin.
  side(ctx, f, 'Accent', [[z0 + 0.03, top + hump - 0.002], [z0 + 0.08, top + hump - 0.001], [z0 + 0.07, top + hump + 0.008], [z0 + 0.045, top + hump + 0.008]], 0.004, 0.001);

  // Shroud barrel with glowing rings.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'shroud', pivot: [0, 0, z1 - 0.03] });
  const R = 0.012 + p.bulk * 0.003;
  const seg = ctx.seg(1);
  put(ctx, bar, 'Barrel', lathe([[L.barrel.radius, z1 - 0.03], [R, z1 - 0.026], [R, L.barrel.z1 - 0.004], [R * 0.8, L.barrel.z1], [L.barrel.radius, L.barrel.z1]], seg));
  if (ctx.style.traits.glow) {
    for (let i = 0; i < 3; i++) {
      const z = z1 - 0.012 + i * ((L.barrel.z1 - z1) / 3);
      put(ctx, bar, 'Emissive', lathe([[R, z - 0.002], [R + 0.0012, z - 0.0015], [R + 0.0012, z + 0.0015], [R, z + 0.002]], seg));
    }
  }

  // Power cell under the front: slides forward to swap.
  const cz0 = L.grip.z + 0.06, cz1 = z1 - 0.02, cy = bottom + 0.002, cr = 0.008 + p.bulk * 0.002;
  const cell = b.component('Magazine', {
    kind: 'magazine', variant: 'cell', pivot: [0, cy, cz0],
    motion: { type: 'translate', axis: [0, 0, 1], range: [0, 0.08], purpose: 'reload' },
  });
  put(ctx, cell, 'Magazine', lathe([[0, cz0], [cr, cz0 + 0.002], [cr, cz0 + 0.008], [cr * 0.9, cz0 + 0.008]], seg), [0, cy, 0]);
  put(ctx, cell, 'Emissive', cylinder(cr * 0.75, cz0 + 0.008, cz1 - 0.008, seg), [0, cy, 0]);
  put(ctx, cell, 'Glass', cylinder(cr * 0.95, cz0 + 0.008, cz1 - 0.008, seg), [0, cy, 0]);
  put(ctx, cell, 'Magazine', lathe([[cr * 0.9, cz1 - 0.008], [cr, cz1 - 0.008], [cr, cz1 - 0.002], [0, cz1]], seg), [0, cy, 0]);
  pistolTrigger(ctx, 'Body', true);
  L.mountY = top + hump * 0.6;
};

/** Sci-fi loop blaster: stacked plated body, glowing core, and a guard that loops from the grip to the nose. */
const loopFrame: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'loop');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const glow = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  platedBlock(ctx, f, z0, z1 - 0.02, top, bottom + 0.008, w * 1.15);
  // Glowing core on both sides.
  for (const s of [1, -1]) put(ctx, f, glow, dome(0.009, 0.004, 10, 2), [s * w * 0.58, (top + bottom) / 2 + 0.006, z0 + 0.06], [0, (s * Math.PI) / 2, 0]);
  // Shroud.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'shroud', pivot: [0, 0, z1 - 0.03] });
  const R = 0.011 + p.bulk * 0.003;
  put(ctx, bar, 'Barrel', lathe([[L.barrel.radius, z1 - 0.03], [R, z1 - 0.026], [R, L.barrel.z1 - 0.004], [R * 0.75, L.barrel.z1], [L.barrel.radius, L.barrel.z1]], ctx.seg(1)));
  put(ctx, bar, glow, lathe([[R, L.barrel.z1 - 0.014], [R + 0.001, L.barrel.z1 - 0.013], [R + 0.001, L.barrel.z1 - 0.009], [R, L.barrel.z1 - 0.008]], ctx.seg(1)));
  // The loop: from the bottom of the grip forward and up to the nose.
  const a = L.grip.angle, Lg = L.grip.length;
  const bz = L.grip.z - Math.sin(a) * Lg + 0.006, by = L.grip.y - Math.cos(a) * Lg + 0.008;
  const nz = z1 - 0.04, t = 0.008;
  side(ctx, f, 'Body', [[bz, by], [nz - 0.01, by + 0.02], [nz, bottom + 0.008], [nz - t, bottom + 0.008], [nz - t - 0.008, by + 0.02 + t], [bz + 0.004, by + t]], 0.016, 0.0025);
  pistolTrigger(ctx, 'Body', true);
  gripMagazine(ctx);
  L.mountY = top + 0.006;
};

/** Hand cannon: a slab body, a big cylinder and a thick shroud with a top rib. */
const cannon: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'cannon');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const cr = 0.022 + p.bulk * 0.005, yc = -cr * 0.45;
  const zc0 = z0 + 0.045, zc1 = zc0 + 0.045;
  side(ctx, f, 'Body', [[z0 - 0.006, top - 0.004], [zc0, top], [zc0, yc - cr - 0.004], [L.grip.z + 0.004, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.004], [z0 - 0.014, top - 0.02]], w * 1.1, 0.003);
  side(ctx, f, 'Body', [[zc1, top], [z1, top], [z1, -0.016], [zc1, yc - cr]], w * 1.1, 0.003);
  side(ctx, f, 'Trim', [[zc0 - 0.01, top], [z1 - 0.006, top], [z1 - 0.012, top + 0.008], [zc0, top + 0.008]], 0.008, 0.0015);
  put(ctx, f, 'Body', box([0, yc - cr - 0.005, (zc0 + zc1) / 2], [w * 0.9, 0.008, zc1 - zc0 + 0.01], ctx.bevel(0.002)));
  const cyl = b.component('Cylinder', {
    kind: 'cylinder', variant: 'heavy', pivot: [0, yc, zc0],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, Math.PI / 3], purpose: 'advance one chamber' },
  });
  const e = ctx.bevel(0.003);
  put(ctx, cyl, 'Magazine', lathe([[0, zc0], [cr - e, zc0], [cr, zc0 + e], [cr, zc1 - e], [cr - e, zc1], [0, zc1]], ctx.seg(1.2)), [0, yc, 0]);
  for (let i = 0; i < 6; i++) {
    const fa = (i / 6) * Math.PI * 2;
    put(ctx, cyl, 'Detail', box([0, 0, 0], [0.004, 0.0026, (zc1 - zc0) * 0.6]), [Math.cos(fa) * cr, yc + Math.sin(fa) * cr, (zc0 + zc1) / 2], [0, 0, fa + Math.PI / 2]);
  }
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'shroud', pivot: [0, 0, z1] });
  put(ctx, bar, 'Barrel', lathe([[L.barrel.radius, z1], [L.barrel.radius * 1.6, z1], [L.barrel.radius * 1.6, L.barrel.z1], [L.barrel.radius * 0.8, L.barrel.z1]], 8, Math.PI / 8));
  if (ctx.style.traits.glow) side(ctx, f, 'Emissive', [[zc1 + 0.006, 0.004], [z1 - 0.006, 0.004], [z1 - 0.006, 0.0065], [zc1 + 0.006, 0.0065]], w * 1.1 + 0.003);
  pistolTrigger(ctx, 'Body', false);
  L.mountY = top + 0.008;
  L.extra.revolver = 1;
};

/** Flare gun: a fat short barrel that breaks open, a chunky frame and a big guard. */
const flare: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'flare');
  const { z0, bottom, width: w } = L.rec;
  const R = 0.016 + p.bulk * 0.004;
  side(ctx, f, 'Accent', [[z0 - 0.004, R * 0.6], [z0 + 0.05, R * 0.3], [z0 + 0.06, -R], [L.grip.z + 0.05, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.004], [z0 - 0.012, -0.004]], w * 1.05, 0.004);
  const bar = b.component('Barrel', {
    kind: 'barrel', variant: 'flare', pivot: [0, -R, z0 + 0.05],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.6], purpose: 'break open to reload' },
  });
  put(ctx, bar, 'Accent', lathe([[R * 0.75, z0 + 0.04], [R, z0 + 0.04], [R, L.barrel.z1 - 0.006], [R * 1.08, L.barrel.z1 - 0.004], [R * 1.08, L.barrel.z1], [R * 0.75, L.barrel.z1]], ctx.seg(1)));
  put(ctx, f, 'Detail', cylinder(0.004, -w * 0.55, w * 0.55, 8), [0, -R, z0 + 0.05], [0, Math.PI / 2, 0]);
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'spur', pivot: [0, R * 0.4, z0],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.6], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [[z0 + 0.004, R * 0.2], [z0 - 0.004, R * 0.2], [z0 - 0.014, R + 0.01], [z0 - 0.008, R + 0.012]], 0.007, 0.0015);
  pistolTrigger(ctx, 'Accent', false);
  L.barrel.radius = R * 0.75;
  L.mountY = R + 0.002;
};

export const PISTOL_FRAMES: Record<string, PartBuilder> = { slide, revolver, blaster, loop: loopFrame, cannon, flare };

// ---------------------------------------------------------------------------
// Pistol grips (the frame's handle)
// ---------------------------------------------------------------------------

function pistolGrip(ctx: BuildContext, variant: string) {
  return ctx.b.component('Grip', { kind: 'grip', variant, pivot: [0, ctx.L.grip.y, ctx.L.grip.z] });
}

/** Modern polymer grip with a beavertail and textured panel. */
const block: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = pistolGrip(ctx, 'block');
  const D = L.extra.gripDepth, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', raked(o, L.grip.angle, [
    [-0.004, 0.0], [Lg, 0.002], [Lg + 0.003, -D * 0.5], [Lg, -D - 0.001], [0.01, -D], [-0.004, -D - 0.01], [-0.01, -D - 0.008], [-0.008, -D * 0.4],
  ]), 0.028, 0.003);
  // Backstrap insert in the accent color.
  if (p.detail > 0.35) {
    side(ctx, g, 'Accent', raked(o, L.grip.angle, [[0.012, -D + 0.004], [Lg - 0.006, -D + 0.003], [Lg - 0.006, -D - 0.0015], [0.012, -D - 0.002]]), 0.024, 0.001);
  }
};

/** Rounded wooden "bird's head" grip with a brass cap. */
const birdshead: PartBuilder = (ctx) => {
  const { L } = ctx;
  const g = pistolGrip(ctx, 'birdshead');
  const D = L.extra.gripDepth, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', smoothPolygon(raked(o, L.grip.angle, [
    [-0.004, 0.002], [Lg * 0.6, 0.0], [Lg, 0.006], [Lg + 0.006, -D * 0.3], [Lg + 0.002, -D - 0.006], [Lg * 0.5, -D], [-0.004, -D - 0.004],
  ]), 2), 0.03, 0.006);
  side(ctx, g, 'Trim', raked(o, L.grip.angle, [[Lg - 0.002, 0.004], [Lg + 0.006, -0.002], [Lg + 0.006, -D * 0.55], [Lg - 0.002, -D * 0.5]]), 0.032, 0.0015);
};

/** Sci-fi grip: smooth, forward-swept, with a contrast insert. */
const swept: PartBuilder = (ctx) => {
  const { L } = ctx;
  const g = pistolGrip(ctx, 'swept');
  const D = L.extra.gripDepth, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  const prof = (k: number): Vec2[] => smoothPolygon(raked(o, L.grip.angle, [
    [-0.004, 0.002 - k], [Lg * 0.5, 0.004 - k], [Lg - k, 0.012 - k], [Lg + 0.004 - k, -0.004], [Lg - k, -D + k], [0.01, -D - 0.004 + k], [-0.006, -D * 0.5],
  ]), 1);
  side(ctx, g, 'Grip', prof(0), 0.028, 0.006);
  side(ctx, g, 'Trim', prof(0.008), 0.031, 0.0015);
};

export const PISTOL_GRIPS: Record<string, PartBuilder> = { block, birdshead, swept };
