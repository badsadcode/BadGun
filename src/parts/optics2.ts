/**
 * More optics, each with its own silhouette (not just a longer or fatter tube):
 * boxy prisms, long-range target scopes, electronic box scopes, thermals,
 * night vision, magnifier combos, canted dots, tube dots, pistol-size reflex
 * dots, brass periscopes, crystal "eye" sights, tin-can scrap scopes, WW-era
 * ladder sights and projected HUD panels.
 *
 * Same contract as every OpticBuilder: (0, y, z) is the mount point on top of
 * the weapon; return the line-of-sight height and the eyepiece's rear z.
 * Shape genes come from `ctx.rng('optic:<name>-look')` only, so a standalone
 * optic is identical to the one on the gun.
 */
import { AXIS_X, AXIS_Y, Geometry, Vec2, Vec3, box, cylinder, dome, extrudeFront, extrudeSide, lathe, ring, rod, roundedRect, smoothPolygon, tube } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, side } from './context.js';
import type { OpticBuilder } from './sight.js';

type Optic = OpticBuilder;
const RIGHT: Vec3 = [0, -Math.PI / 2, 0];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** A round knob or turret pointing up, left (+X) or right (-X), starting at `at`. */
export function knob(ctx: BuildContext, c: Component, slot: MaterialSlot, r: number, h: number, at: Vec3, dir: 'up' | 'left' | 'right' | 'back' | 'front', bevel = 0.0008): void {
  const rot = dir === 'up' ? AXIS_Y : dir === 'left' ? AXIS_X : dir === 'right' ? RIGHT : dir === 'back' ? ([0, Math.PI, 0] as Vec3) : undefined;
  put(ctx, c, slot, cylinder(r, 0, h, Math.max(8, ctx.seg(0.6)), ctx.bevel(bevel)), at, rot);
}

/** Rail clamp under an optic, with a cross bolt on the right side. */
function clamp(ctx: BuildContext, c: Component, y: number, z: number, len: number, w = 0.024): void {
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [w, 0.008, len], ctx.bevel(0.0015)));
  knob(ctx, c, 'Detail', 0.0035, 0.003, [-w / 2, y + 0.004, z], 'right');
}

/** Thin lens disc facing Z at (0, yc), from z0 to z0 + 0.001. */
function lens(ctx: BuildContext, c: Component, r: number, yc: number, z0: number, x = 0): void {
  put(ctx, c, 'Glass', cylinder(r, z0, z0 + 0.001, ctx.seg(1)), [x, yc, 0]);
}

/** Closed lathe body with recessed lens seats at both ends (stations are [r, z], back to front). */
function scopeLathe(stations: Vec2[], recess = 0.005): Vec2[] {
  const [rb, zb] = stations[0];
  const [rf, zf] = stations[stations.length - 1];
  return [
    [0, zb + recess], [rb * 0.85, zb + recess], [rb * 0.85, zb],
    ...stations,
    [rf * 0.88, zf], [rf * 0.88, zf - recess], [0, zf - recess],
  ];
}

/** Open flip-up lens cap hinged on top of a tube end (dir -1: rear cap swings back, +1: front cap swings forward). */
export function flipCap(ctx: BuildContext, c: Component, slot: MaterialSlot, r: number, yc: number, zEdge: number, dir: 1 | -1): void {
  const g = cylinder(r, -0.0012, 0.0012, ctx.seg(1), ctx.bevel(0.0005)).transform({ t: [0, -r, 0] });
  put(ctx, c, slot, g, [0, yc + r + 0.0012, zEdge + dir * 0.0015], [-dir * 2.6, 0, 0]);
  put(ctx, c, 'Detail', box([0, yc + r + 0.0006, zEdge], [0.006, 0.003, 0.004]));
}

/** Short picatinny section (rail top accessory mount). */
function railTop(ctx: BuildContext, c: Component, y: number, z0: number, z1: number, w = 0.016): void {
  put(ctx, c, 'Detail', box([0, y + 0.002, (z0 + z1) / 2], [w, 0.004, z1 - z0], ctx.bevel(0.0006)));
  for (let zz = z0 + 0.004; zz < z1 - 0.002; zz += 0.008) put(ctx, c, 'Detail', box([0, y + 0.0048, zz], [w + 0.004, 0.0024, 0.004]));
}

/** Toothed gear seen from the side, centered at (zc, yc), at x. */
function gear(ctx: BuildContext, c: Component, slot: MaterialSlot, zc: number, yc: number, r: number, teeth: number, x: number, w = 0.0025): void {
  const pts: Vec2[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [f, rr] of [[0, r * 0.8], [0.22, r], [0.5, r], [0.72, r * 0.8]] as [number, number][]) pts.push([zc + Math.cos(a + f * step) * rr, yc + Math.sin(a + f * step) * rr]);
  }
  side(ctx, c, slot, pts, w, 0.0004, x);
  put(ctx, c, 'Detail', dome(r * 0.3, r * 0.25, 10, 2), [x + (x > 0 ? w / 2 : -w / 2), yc, zc], x > 0 ? AXIS_X : RIGHT);
}

// ---------------------------------------------------------------------------
// Modern
// ---------------------------------------------------------------------------

/** Compact prism sight: squared chunky housing, short objective and eyecup, fiber strip or rail on top. */
export const prism: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:prism-look');
  const L = g.range(0.9, 1.15), H = g.range(0.95, 1.1);
  const topRail = g.chance(0.45);
  const seg = ctx.seg(1);
  const yb = y + 0.008, top = y + 0.046 * H, yc = y + 0.028 * H;
  const z0 = z - 0.032 * L, z1 = z + 0.022 * L;
  clamp(ctx, c, y, z, 0.05 * L, 0.026);
  side(ctx, c, 'Sight', [[z0, yb], [z1, yb], [z1 + 0.004, yc - 0.006], [z1 + 0.004, top - 0.008], [z1 - 0.004, top], [z0 + 0.006, top], [z0, top - 0.008]], 0.036, 0.003);
  // Objective and eyecup.
  put(ctx, c, 'Sight', lathe([[0.014, z1 - 0.002], [0.017, z1 + 0.004], [0.017, z1 + 0.026], [0.0145, z1 + 0.026], [0.0145, z1 + 0.021], [0, z1 + 0.021]], seg), [0, yc, 0]);
  lens(ctx, c, 0.0145, yc, z1 + 0.0212);
  put(ctx, c, 'Grip', lathe([[0, z0 - 0.012], [0.011, z0 - 0.012], [0.0112, z0 - 0.016], [0.0145, z0 - 0.021], [0.0148, z0 - 0.008], [0.013, z0 + 0.002]], seg), [0, yc, 0]);
  lens(ctx, c, 0.0108, yc, z0 - 0.0132);
  put(ctx, c, 'Emissive', box([0, yc, z0 - 0.0118], [0.0016, 0.0016, 0.0004]));
  // Top: fiber-optic strip on a holder, or a short accessory rail.
  if (topRail) railTop(ctx, c, top, z0 + 0.004, z1 - 0.004);
  else {
    put(ctx, c, 'Detail', box([0, top + 0.0015, (z0 + z1) / 2], [0.008, 0.003, (z1 - z0) * 0.75], ctx.bevel(0.0008)));
    put(ctx, c, 'Emissive', cylinder(0.0016, z0 + 0.006, z1 - 0.006, 8), [0, top + 0.0034, 0]);
  }
  // Square-capped turret on the right, illumination dial on the left, side screws.
  put(ctx, c, 'Sight', box([-0.0205, yc, z - 0.004], [0.007, 0.016, 0.016], ctx.bevel(0.0015)));
  knob(ctx, c, 'Trim', 0.0085, 0.006, [0.018, yc, z - 0.006], 'left');
  for (const dz of [z0 + 0.006, z1 - 0.006]) for (const dy of [yb + 0.006, top - 0.006]) put(ctx, c, 'Detail', dome(0.0018, 0.0008, 8, 2), [0.018, dy, dz], AXIS_X);
  return { eyeY: yc, rearZ: z0 - 0.021 };
};

/** Long-range target scope: big objective bell, sunshade, tall turrets, parallax knob, one-piece cantilever mount. */
export const longrange: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:longrange-look');
  const seg = ctx.seg(1.3);
  const K = g.range(0.92, 1.1), B = g.range(0.95, 1.15);
  const shade = g.chance(0.7);
  const rb = 0.029 * B, yc = y + rb + 0.012;
  const st: Vec2[] = ([
    [0.021, -0.19], [0.021, -0.145], [0.0148, -0.122], [0.0148, -0.042], [0.0195, -0.036], [0.0195, 0.032],
    [0.0148, 0.038], [0.0148, 0.07], [rb, 0.12], [rb, 0.165],
  ] as Vec2[]).map(([r, s]) => [r, z + s * K] as Vec2);
  put(ctx, c, 'Sight', lathe(scopeLathe(st, 0.006), seg), [0, yc, 0]);
  lens(ctx, c, 0.0178, yc, st[0][1] + 0.0048);
  lens(ctx, c, rb * 0.87, yc, st[st.length - 1][1] - 0.0062);
  const zf = st[st.length - 1][1];
  if (shade) put(ctx, c, 'Sight', tube(rb + 0.0006, rb - 0.0012, zf - 0.004, zf + 0.075 * K, seg), [0, yc, 0]);
  // Magnification ring with a throw lever.
  put(ctx, c, 'Trim', tube(0.0218, 0.0205, z - 0.17 * K, z - 0.155 * K, seg), [0, yc, 0]);
  put(ctx, c, 'Detail', box([-0.024, yc + 0.004, z - 0.162 * K], [0.006, 0.004, 0.006], ctx.bevel(0.0008)));
  // Tall target turrets: elevation on top, windage right, a big parallax wheel left.
  knob(ctx, c, 'Sight', 0.0115, 0.026, [0, yc + 0.0185, z], 'up');
  for (const h of [0.007, 0.013]) knob(ctx, c, 'Trim', 0.0122, 0.003, [0, yc + 0.0185 + h, z], 'up', 0.0003);
  knob(ctx, c, 'Accent', 0.0095, 0.003, [0, yc + 0.0185 + 0.026, z], 'up');
  knob(ctx, c, 'Sight', 0.0105, 0.016, [-0.0185, yc, z], 'right');
  knob(ctx, c, 'Trim', 0.0112, 0.003, [-0.0185 - 0.009, yc, z], 'right', 0.0003);
  knob(ctx, c, 'Sight', 0.0175, 0.005, [0.0185, yc, z], 'left');
  knob(ctx, c, 'Trim', 0.006, 0.012, [0.0185, yc, z], 'left');
  // One-piece cantilever mount: rear ring over the clamp, front ring reaching forward.
  const a = z - 0.07 * K, b = z + 0.052 * K, ry = yc - 0.0148;
  side(ctx, c, 'Detail', [
    [a - 0.012, y], [a + 0.07, y], [a + 0.07, y + 0.008], [b + 0.009, ry + 0.002], [b - 0.009, ry + 0.002],
    [a + 0.045, y + 0.014], [a + 0.012, y + 0.014], [a + 0.009, ry + 0.002], [a - 0.009, ry + 0.002], [a - 0.012, y + 0.012],
  ], 0.022, 0.002);
  for (const rz of [a, b]) {
    put(ctx, c, 'Detail', tube(0.0195, 0.0147, rz - 0.0085, rz + 0.0085, seg), [0, yc, 0]);
    for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.017, yc + 0.006, rz], [0.006, 0.006, 0.012], ctx.bevel(0.001)));
  }
  put(ctx, c, 'Detail', box([-0.0135, y + 0.006, a + 0.03], [0.004, 0.006, 0.03], ctx.bevel(0.001)));
  return { eyeY: yc, rearZ: st[0][1] };
};

/** Electronic box scope: a rectangular housing, round or square front window, a screen in a hood at the back, buttons. */
export const digital: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:digital-look');
  const seg = ctx.seg(1);
  const hl = 0.06 * g.range(0.85, 1.2), H = g.range(0.9, 1.12);
  const squareWindow = g.chance(0.4), rail = g.chance(0.5);
  const yb = y + 0.01, top = y + 0.052 * H, yc = (yb + top) / 2;
  const zb = z - hl, zf = z + hl;
  clamp(ctx, c, y, z, 0.07, 0.028);
  put(ctx, c, 'Detail', box([0, y + 0.009, z], [0.02, 0.004, 0.06]));
  side(ctx, c, 'Sight', [[zb, yb], [zf, yb], [zf + 0.006, yb + 0.008], [zf + 0.006, top - 0.01], [zf - 0.006, top], [zb + 0.004, top], [zb, top - 0.004]], 0.04, 0.003);
  if (squareWindow) {
    put(ctx, c, 'Detail', box([0, yc + 0.002, zf + 0.007], [0.034, top - yb - 0.012, 0.003], ctx.bevel(0.001)));
    put(ctx, c, 'Glass', box([0, yc + 0.002, zf + 0.0088], [0.028, top - yb - 0.018, 0.001]));
  } else {
    put(ctx, c, 'Sight', lathe([[0.015, zf + 0.002], [0.0175, zf + 0.005], [0.0175, zf + 0.022], [0.015, zf + 0.022], [0.015, zf + 0.018], [0, zf + 0.018]], seg), [0, yc, 0]);
    put(ctx, c, 'Trim', tube(0.0182, 0.017, zf + 0.008, zf + 0.014, seg), [0, yc, 0]);
    lens(ctx, c, 0.0148, yc, zf + 0.0182);
  }
  // Rubber hood around the rear screen.
  const hw = 0.034, hh = top - yb + 0.004, hz = zb - 0.009;
  for (const s of [1, -1]) {
    put(ctx, c, 'Grip', box([s * (hw / 2 - 0.0015), yc, hz], [0.003, hh, 0.018], ctx.bevel(0.0008)));
    put(ctx, c, 'Grip', box([0, yc + s * (hh / 2 - 0.0015), hz], [hw, 0.003, 0.018], ctx.bevel(0.0008)));
  }
  put(ctx, c, 'Emissive', box([0, yc, zb - 0.0006], [0.026, hh - 0.01, 0.001]));
  // Buttons on top, a rocker on the left, a battery tube on the right.
  for (let i = 0; i < 3; i++) put(ctx, c, 'Detail', box([0.009, top + 0.0012, zb + 0.012 + i * 0.01], [0.007, 0.0026, 0.006], ctx.bevel(0.0006)));
  put(ctx, c, 'Detail', box([0.0205, yc, zb + 0.016], [0.003, 0.012, 0.02], ctx.bevel(0.0008)));
  put(ctx, c, 'Sight', cylinder(0.0075, zb + hl * 0.4, zf - hl * 0.3, seg), [-0.021, yc - 0.004, 0]);
  put(ctx, c, 'Detail', cylinder(0.0078, zf - hl * 0.3, zf - hl * 0.3 + 0.006, seg, ctx.bevel(0.0008)), [-0.021, yc - 0.004, 0]);
  if (rail) railTop(ctx, c, top, z - hl * 0.2, zf - 0.008, 0.014);
  return { eyeY: yc, rearZ: hz - 0.009 };
};

/** Thermal sight: faceted (octagonal or rounded-square) body, wide dark objective, rubber eyecup with a glowing screen. */
export const thermal: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:thermal-look');
  const seg = ctx.seg(1.1);
  const R = 0.022 * g.range(0.95, 1.1), yc = y + R + 0.012;
  const oct = g.chance(0.55);
  const zb = z - 0.045 * g.range(0.9, 1.15), zf = z + 0.035;
  clamp(ctx, c, y, z, 0.05);
  put(ctx, c, 'Detail', box([0, (y + 0.008 + yc - R * 0.8) / 2, z], [0.02, yc - R * 0.8 - y - 0.008, 0.044], ctx.bevel(0.0015)));
  put(ctx, c, 'Detail', box([-0.013, y + 0.007, z + 0.01], [0.004, 0.006, 0.026], ctx.bevel(0.001)));
  const prof: Vec2[] = oct
    ? Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (i * Math.PI) / 4; return [Math.cos(a) * R * 1.08, yc + Math.sin(a) * R * 1.08] as Vec2; })
    : roundedRect(0, yc, R * 2, R * 2, R * 0.45, 3);
  put(ctx, c, 'Sight', extrudeFront(prof, zb, zf, ctx.bevel(0.002)));
  // Wide objective with a ribbed focus ring.
  put(ctx, c, 'Sight', lathe([[R * 0.9, zf - 0.002], [R * 1.18, zf + 0.006], [R * 1.18, zf + 0.032], [R * 1.04, zf + 0.032], [R * 1.04, zf + 0.027], [0, zf + 0.027]], seg), [0, yc, 0]);
  for (let i = 0; i < 4; i++) put(ctx, c, 'Trim', tube(R * 1.22, R * 1.1, zf + 0.009 + i * 0.005, zf + 0.0115 + i * 0.005, seg), [0, yc, 0]);
  lens(ctx, c, R * 1.03, yc, zf + 0.0272);
  // Eyecup with the screen glowing inside.
  put(ctx, c, 'Grip', lathe([[0, zb - 0.012], [R * 0.55, zb - 0.012], [R * 0.6, zb - 0.034], [R * 0.8, zb - 0.034], [R * 0.76, zb - 0.01], [R * 0.62, zb + 0.002]], seg), [0, yc, 0]);
  put(ctx, c, 'Emissive', cylinder(R * 0.48, zb - 0.0132, zb - 0.0122, seg), [0, yc, 0]);
  // Buttons on top, a battery cap on the left.
  const ty = yc + R * (oct ? 1.08 * Math.cos(Math.PI / 8) : 1);
  for (let i = 0; i < 4; i++) put(ctx, c, 'Detail', box([0, ty + 0.0012, zb + 0.012 + i * 0.011], [0.01, 0.0025, 0.007], ctx.bevel(0.0006)));
  knob(ctx, c, 'Detail', 0.009, 0.007, [R * 0.95, yc, z - 0.005], 'left');
  knob(ctx, c, 'Trim', 0.005, 0.009, [R * 0.95, yc, z - 0.005], 'left');
  return { eyeY: yc, rearZ: zb - 0.034 };
};

/** Night-vision scope: a stubby tube with a big round objective, a battery box on the side and an IR lamp. */
export const nightvision: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:nightvision-look');
  const seg = ctx.seg(1.1);
  const R = 0.019 * g.range(0.95, 1.1), Rf = R * g.range(1.35, 1.6);
  const len = g.range(0.9, 1.2);
  const yc = y + Rf + 0.007;
  const zb = z - 0.045 * len, zf = z + 0.06;
  clamp(ctx, c, y, z - 0.01, 0.05);
  put(ctx, c, 'Detail', box([0, (y + 0.008 + yc - R + 0.002) / 2, z - 0.01], [0.018, yc - R + 0.002 - y - 0.008, 0.04], ctx.bevel(0.0015)));
  put(ctx, c, 'Sight', lathe([[R, zb], [R, z + 0.015], [Rf * 0.8, z + 0.025], [Rf, z + 0.03], [Rf, zf], [Rf * 0.9, zf], [Rf * 0.9, zf - 0.008], [0, zf - 0.008]], seg), [0, yc, 0]);
  lens(ctx, c, Rf * 0.89, yc, zf - 0.0078);
  for (let i = 0; i < 3; i++) put(ctx, c, 'Trim', tube(Rf + 0.0012, Rf - 0.001, z + 0.036 + i * 0.007, z + 0.039 + i * 0.007, seg), [0, yc, 0]);
  // Rubber eyecup with the green phosphor glow.
  put(ctx, c, 'Grip', lathe([[0, zb - 0.006], [R * 0.6, zb - 0.006], [R * 0.66, zb - 0.024], [R * 0.92, zb - 0.024], [R * 0.96, zb - 0.004], [R * 1.02, zb + 0.004]], seg), [0, yc, 0]);
  put(ctx, c, 'Emissive', cylinder(R * 0.5, zb - 0.0072, zb - 0.0062, seg), [0, yc, 0]);
  // Battery box on the left with a screw cap, IR illuminator up on the right.
  const bx = R + 0.008;
  put(ctx, c, 'Sight', box([bx, yc - 0.004, z - 0.012], [0.016, 0.02, 0.042], ctx.bevel(0.002)));
  put(ctx, c, 'Detail', cylinder(0.0065, z + 0.009, z + 0.015, seg, ctx.bevel(0.0008)), [bx, yc - 0.004, 0]);
  put(ctx, c, 'Sight', cylinder(0.006, z - 0.02, z + 0.025, seg), [-R * 0.75, yc + R * 0.75, 0]);
  put(ctx, c, 'Glass', cylinder(0.0052, z + 0.025, z + 0.026, seg), [-R * 0.75, yc + R * 0.75, 0]);
  put(ctx, c, 'Detail', box([-R * 0.55, yc + R * 0.55, z], [0.006, 0.006, 0.02]), undefined);
  knob(ctx, c, 'Trim', 0.005, 0.006, [0, yc + R - 0.001, z - 0.02], 'up');
  return { eyeY: yc, rearZ: zb - 0.024 };
};

/** Small red-dot tube (shared by `magnifier`): mount riser, short hooded tube, glass, dot, side dial. */
function dotTube(ctx: BuildContext, c: Component, y: number, z: number, yc: number, R = 0.0145): void {
  const seg = ctx.seg(1);
  clamp(ctx, c, y, z, 0.032);
  put(ctx, c, 'Detail', box([0, (y + 0.008 + yc - R + 0.002) / 2, z], [0.018, yc - R + 0.002 - y - 0.008, 0.026], ctx.bevel(0.0012)));
  put(ctx, c, 'Sight', lathe([[0, z - 0.016], [R * 0.85, z - 0.016], [R * 0.85, z - 0.02], [R, z - 0.02], [R, z + 0.014], [R * 1.08, z + 0.02], [R * 0.92, z + 0.02], [R * 0.92, z + 0.006], [0, z + 0.006]], seg), [0, yc, 0]);
  lens(ctx, c, R * 0.9, yc, z + 0.0062);
  put(ctx, c, 'Emissive', box([0, yc, z + 0.005], [0.0014, 0.0014, 0.0006]));
  knob(ctx, c, 'Sight', 0.006, 0.006, [R - 0.001, yc, z - 0.002], 'left');
  knob(ctx, c, 'Sight', 0.005, 0.005, [0, yc + R - 0.001, z - 0.002], 'up');
}

/** Red dot with a magnifier behind it on a flip-to-side mount (sometimes flipped out of the way). */
export const magnifier: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:magnifier-look');
  const flipped = g.chance(0.35);
  const seg = ctx.seg(1);
  const yc = y + 0.031;
  const zd = z + 0.042, zm = z - 0.035, ml = 0.036 * g.range(0.9, 1.15);
  dotTube(ctx, c, y, zd, yc);
  // Magnifier base with its hinge on the right.
  clamp(ctx, c, y, zm, 0.036);
  const hx = -0.016, hy = y + 0.014;
  put(ctx, c, 'Detail', box([-0.012, y + 0.011, zm], [0.012, 0.008, 0.034], ctx.bevel(0.001)));
  put(ctx, c, 'Trim', cylinder(0.0035, zm - 0.018, zm + 0.018, 10), [hx, hy, 0]);
  // The swinging part, built around the hinge (local x, y; absolute z).
  const T: Vec3 = [hx, hy, 0], Rz: Vec3 = [0, 0, flipped ? Math.PI / 2 : 0];
  const lx = -hx, ly = yc - hy, R = 0.0135;
  const st: Vec2[] = [[0.0148, zm - ml], [0.0148, zm - ml + 0.018], [0.0118, zm - ml + 0.026], [0.0118, zm + ml - 0.012], [R, zm + ml - 0.006], [R, zm + ml]];
  put(ctx, c, 'Sight', lathe(scopeLathe(st, 0.004), seg).transform({ t: [lx, ly, 0] }), T, Rz);
  put(ctx, c, 'Glass', cylinder(0.0124, zm - ml + 0.0032, zm - ml + 0.0042, seg).transform({ t: [lx, ly, 0] }), T, Rz);
  put(ctx, c, 'Glass', cylinder(R * 0.86, zm + ml - 0.0042, zm + ml - 0.0032, seg).transform({ t: [lx, ly, 0] }), T, Rz);
  put(ctx, c, 'Grip', tube(0.0155, 0.0146, zm - ml + 0.002, zm - ml + 0.014, seg).transform({ t: [lx, ly, 0] }), T, Rz);
  put(ctx, c, 'Detail', box([0.011, 0.004, zm], [0.026, 0.01, 0.026], ctx.bevel(0.0012)), T, Rz);
  put(ctx, c, 'Detail', tube(0.0158, 0.0116, zm - 0.006, zm + 0.006, seg).transform({ t: [lx, ly, 0] }), T, Rz);
  put(ctx, c, 'Accent', box([-0.004, 0.012, zm + 0.008], [0.004, 0.012, 0.004], ctx.bevel(0.0006)), T, Rz);
  return { eyeY: yc, rearZ: flipped ? zd - 0.02 : zm - ml };
};

/** A tiny open reflex sight built around its own base (local frame: base at the origin, +Y up). */
function miniDot(ctx: BuildContext, c: Component, t: Vec3, r: Vec3 | undefined, look: number): number {
  const P = (slot: MaterialSlot, geo: Geometry) => put(ctx, c, slot, geo, t, r);
  const w = 0.022, hz0 = 0.004, hz1 = 0.016;
  P('Sight', box([0, 0.0025, 0], [w, 0.005, 0.034], ctx.bevel(0.0012)));
  // Emitter hump at the back.
  P('Sight', extrudeSide([[-0.017, 0.004], [-0.002, 0.004], [-0.004, 0.009], [-0.015, 0.011], [-0.017, 0.009]], { width: w * 0.8, bevel: ctx.bevel(0.0012) }));
  const eye = 0.0125;
  const arch: Vec2[] = [];
  if (look < 0.4) {
    // Arched hood.
    const outer: Vec2[] = [], inner: Vec2[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      outer.push([Math.cos(a) * w / 2, 0.004 + Math.sin(a) * 0.018]);
      inner.push([Math.cos(a) * (w / 2 - 0.0022), 0.004 + Math.sin(a) * 0.0155]);
    }
    for (const [x, yy] of inner) arch.push([x * 0.94, 0.005 + (yy - 0.004) * 0.94]);
    P('Sight', extrudeFront([...outer, ...inner.reverse()], hz0, hz1, ctx.bevel(0.0006)));
  } else if (look < 0.75) {
    // Squared frame.
    for (const s of [1, -1]) P('Sight', box([s * (w / 2 - 0.0012), 0.012, (hz0 + hz1) / 2], [0.0024, 0.016, hz1 - hz0], ctx.bevel(0.0005)));
    P('Sight', box([0, 0.0205, (hz0 + hz1) / 2], [w, 0.0026, hz1 - hz0], ctx.bevel(0.0005)));
  } else {
    // Slanted shield: posts lean back, the top bar sits over the glass.
    for (const s of [1, -1]) P('Sight', extrudeSide([[hz0, 0.004], [hz1, 0.004], [hz1 - 0.004, 0.02], [hz1 - 0.01, 0.02]], { width: 0.0024, bevel: ctx.bevel(0.0005), x: s * (w / 2 - 0.0012) }));
    P('Sight', box([0, 0.0205, hz1 - 0.007], [w, 0.0026, 0.008], ctx.bevel(0.0005)));
  }
  const pane: Vec2[] = arch.length ? arch : [[-(w / 2 - 0.002), eye - 0.007], [w / 2 - 0.002, eye - 0.007], [w / 2 - 0.002, eye + 0.007], [-(w / 2 - 0.002), eye + 0.007]];
  P('Glass', extrudeFront(pane, -0.0005, 0.0005).transform({ t: [0, -0.005, 0] }).transform({ r: [-0.22, 0, 0] }).transform({ t: [0, 0.005, hz1 - 0.006] }));
  P('Emissive', box([0, eye, hz1 - 0.0072], [0.0012, 0.0012, 0.0004]));
  P('Detail', cylinder(0.0022, 0, 0.002, 8).transform({ r: RIGHT, t: [-w / 2, 0.003, -0.008] }));
  P('Detail', cylinder(0.002, 0, 0.0016, 8).transform({ r: AXIS_Y, t: [0, 0.011, -0.01] }));
  return eye;
}

/** Pistol-size open reflex dot: thin frame and angled glass on a low plate. */
export const minidot: Optic = (ctx, c, y, z) => {
  const look = ctx.rng('optic:minidot-look').next();
  const eye = miniDot(ctx, c, [0, y, z], undefined, look);
  return { eyeY: y + eye, rearZ: z - 0.017 };
};

/** Compact scope on a long mount, with a small reflex dot canted 45 degrees on the right side. */
export const offset: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:offset-look');
  const seg = ctx.seg(1.1);
  const K = g.range(0.9, 1.1), front = g.chance(0.6), look = g.next();
  const yc = y + 0.03;
  const st: Vec2[] = ([
    [0.0175, -0.12], [0.0175, -0.085], [0.0127, -0.07], [0.0127, -0.028], [0.0165, -0.024], [0.0165, 0.024],
    [0.0127, 0.028], [0.0127, 0.07], [0.0155, 0.08], [0.0155, 0.11],
  ] as Vec2[]).map(([r, s]) => [r, z + s * K] as Vec2);
  put(ctx, c, 'Sight', lathe(scopeLathe(st), seg), [0, yc, 0]);
  lens(ctx, c, 0.0148, yc, st[0][1] + 0.004);
  lens(ctx, c, 0.0135, yc, st[st.length - 1][1] - 0.0052);
  knob(ctx, c, 'Sight', 0.0075, 0.008, [0, yc + 0.0155, z], 'up');
  knob(ctx, c, 'Sight', 0.0075, 0.008, [0.0155, yc, z], 'left');
  put(ctx, c, 'Trim', tube(0.0185, 0.0172, z - 0.11 * K, z - 0.1 * K, seg), [0, yc, 0]);
  // Long base with two rings.
  const a = z - 0.05 * K, b = z + 0.045 * K;
  put(ctx, c, 'Detail', box([0, y + 0.005, (a + b) / 2], [0.024, 0.01, b - a + 0.02], ctx.bevel(0.0015)));
  for (const rz of [a, b]) {
    put(ctx, c, 'Detail', box([0, (y + 0.01 + yc - 0.012) / 2, rz], [0.018, yc - 0.012 - y - 0.01, 0.012], ctx.bevel(0.0012)));
    put(ctx, c, 'Detail', tube(0.0162, 0.0126, rz - 0.006, rz + 0.006, seg), [0, yc, 0]);
  }
  // The canted dot sits on a block on the right of the base.
  const zd = front ? b : a + 0.006;
  put(ctx, c, 'Detail', box([-0.0145, y + 0.009, zd], [0.012, 0.014, 0.03], ctx.bevel(0.0012)));
  put(ctx, c, 'Detail', box([0, -0.004, 0], [0.022, 0.008, 0.03]), [-0.019, y + 0.014, zd], [0, 0, Math.PI / 4]);
  miniDot(ctx, c, [-0.019, y + 0.014, zd], [0, 0, Math.PI / 4], look);
  return { eyeY: yc, rearZ: st[0][1] };
};

/** Tube red dot with a long sunshade, flip-up caps and a riser mount. */
export const tubedot: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:tubedot-look');
  const seg = ctx.seg(1);
  const riser = g.chance(0.5) ? 0.013 : 0.003;
  const R = 0.0155 * g.range(0.95, 1.08), hood = g.range(0.02, 0.036), caps = g.chance(0.65);
  const yc = y + 0.008 + riser + R;
  const zb = z - 0.035, zf = z + 0.03 + hood;
  clamp(ctx, c, y, z, 0.036);
  side(ctx, c, 'Detail', [[z - 0.018, y + 0.007], [z + 0.018, y + 0.007], [z + 0.014, yc - R + 0.003], [z - 0.014, yc - R + 0.003]], 0.02, 0.0015);
  put(ctx, c, 'Sight', lathe([[0, zb + 0.005], [R * 0.85, zb + 0.005], [R * 0.85, zb], [R, zb + 0.003], [R, z + 0.03], [R * 1.04, z + 0.032], [R * 1.04, zf], [R * 0.93, zf], [R * 0.93, z + 0.012], [0, z + 0.012]], seg), [0, yc, 0]);
  lens(ctx, c, R * 0.84, yc, zb + 0.0038);
  lens(ctx, c, R * 0.92, yc, z + 0.0122);
  put(ctx, c, 'Emissive', box([0, yc, z + 0.011], [0.0014, 0.0014, 0.0006]));
  put(ctx, c, 'Trim', tube(R * 1.1, R * 1.0, z + 0.026, z + 0.031, seg), [0, yc, 0]);
  // Turret block: elevation on top, windage on the right, a big battery dial on the left.
  put(ctx, c, 'Sight', box([0, yc, z - 0.004], [R * 2 + 0.004, R * 1.4, 0.024], ctx.bevel(0.002)));
  knob(ctx, c, 'Sight', 0.0065, 0.008, [0, yc + R * 0.7, z - 0.004], 'up');
  knob(ctx, c, 'Sight', 0.0065, 0.007, [-R - 0.002, yc, z - 0.004], 'right');
  knob(ctx, c, 'Sight', 0.0095, 0.008, [R + 0.002, yc, z - 0.004], 'left');
  knob(ctx, c, 'Trim', 0.0098, 0.002, [R + 0.006, yc, z - 0.004], 'left', 0.0003);
  if (caps) {
    flipCap(ctx, c, 'Grip', R * 1.05, yc, zb, -1);
    flipCap(ctx, c, 'Grip', R * 1.1, yc, zf, 1);
  }
  return { eyeY: yc, rearZ: zb };
};

// ---------------------------------------------------------------------------
// Steampunk / diesel
// ---------------------------------------------------------------------------

/** Stepped brass periscope sight: low eyepiece, a raised prism tower and an objective up high, with gears. */
export const periscope: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:periscope-look');
  const seg = ctx.seg(1);
  const rise = 0.04 * g.range(0.85, 1.3), bell = g.range(1, 1.35), gears = g.int(1, 2);
  const yc = y + 0.022, yt = yc + rise;
  const zr = z - 0.025, ze = z - 0.08, zo = z + 0.075;
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.018, 0.008, 0.1], ctx.bevel(0.0015)));
  for (const zz of [ze + 0.02, zr]) put(ctx, c, 'Detail', box([0, (y + 0.008 + yc - 0.008) / 2, zz], [0.008, yc - 0.008 - y - 0.008, 0.008], ctx.bevel(0.001)));
  // Eyepiece with a flared brass cup.
  put(ctx, c, 'Sight', lathe([[0, ze + 0.006], [0.0085, ze + 0.006], [0.0085, ze + 0.004], [0.0105, ze + 0.008], [0.0105, zr]], seg), [0, yc, 0]);
  put(ctx, c, 'Trim', lathe([[0.0092, ze + 0.004], [0.0135, ze - 0.004], [0.0145, ze - 0.002], [0.0112, ze + 0.012], [0.0105, ze + 0.014]], seg), [0, yc, 0]);
  lens(ctx, c, 0.0084, yc, ze + 0.0048);
  // Prism boxes and the tower between them.
  put(ctx, c, 'Sight', box([0, yc, zr], [0.026, 0.026, 0.028], ctx.bevel(0.002)));
  knob(ctx, c, 'Sight', 0.0095, rise, [0, yc, zr], 'up');
  put(ctx, c, 'Sight', box([0, yt, zr], [0.022, 0.022, 0.024], ctx.bevel(0.002)));
  for (const yy of [yc + 0.013, yt - 0.011]) knob(ctx, c, 'Trim', 0.0118, 0.003, [0, yy, zr], 'up', 0.0004);
  // Objective up high, with a brass bell.
  const rb = 0.0125 * bell;
  put(ctx, c, 'Sight', lathe([[0.0095, zr], [0.0095, z + 0.03], [rb, z + 0.05], [rb, zo], [rb * 0.86, zo], [rb * 0.86, zo - 0.004], [0, zo - 0.004]], seg), [0, yt, 0]);
  put(ctx, c, 'Trim', tube(rb + 0.0015, rb - 0.0005, zo - 0.008, zo + 0.001, seg), [0, yt, 0]);
  put(ctx, c, 'Trim', tube(0.0112, 0.009, z + 0.006, z + 0.012, seg), [0, yt, 0]);
  lens(ctx, c, rb * 0.85, yt, zo - 0.0038);
  put(ctx, c, 'Detail', rod([0, y + 0.008, z + 0.035], [0, yt - 0.009, z + 0.048], 0.0025, 8));
  // Gears on the left side.
  gear(ctx, c, 'Trim', zr, yc, 0.011, 10, 0.0145);
  if (gears > 1) gear(ctx, c, 'Trim', zr + 0.0175, yc - 0.003, 0.0068, 7, 0.0145);
  gear(ctx, c, 'Trim', zr, yt, 0.0075, 8, -0.0125);
  return { eyeY: yc, rearZ: ze - 0.004 };
};

// ---------------------------------------------------------------------------
// Fantasy / scrap / historical / sci-fi
// ---------------------------------------------------------------------------

/** Carved wooden mount holding a crystal lens in a claw ring, with a gem and a ring peep. */
export const eye: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:eye-look');
  const seg = ctx.seg(1.4);
  const glow: MaterialSlot = ctx.style.traits.magic ? 'Emissive' : 'Accent';
  const R = 0.017 * g.range(0.9, 1.2), claws = g.pick([3, 4, 5, 6]), vine = g.chance(0.6);
  const yc = y + R + 0.013;
  const zf = z + 0.03, zb = z - 0.045;
  side(ctx, c, 'Stock', smoothPolygon([
    [zb - 0.01, y], [zf + 0.014, y], [zf + 0.01, y + 0.007], [zf + 0.004, yc - R - 0.002], [zf - 0.004, yc - R - 0.002],
    [zf - 0.012, y + 0.012], [zb + 0.014, y + 0.009], [zb + 0.005, yc - 0.007], [zb - 0.005, yc - 0.007],
  ], 2), 0.012, 0.002);
  // Claw ring and crystal lens.
  put(ctx, c, 'Trim', ring(R + 0.0022, 0.0024, zf, seg, 6), [0, yc, 0]);
  put(ctx, c, 'Glass', lathe([[0, zf - 0.004], [R * 0.6, zf - 0.0032], [R + 0.0005, zf], [R * 0.6, zf + 0.0032], [0, zf + 0.004]], seg), [0, yc, 0]);
  put(ctx, c, glow, ring(R * 0.5, 0.0006, zf - 0.0042, seg, 4), [0, yc, 0]);
  for (let i = 0; i < claws; i++) {
    const a = -Math.PI / 2 + Math.PI / claws + (i * Math.PI * 2) / claws;
    const at: Vec3 = [Math.cos(a) * (R + 0.006), yc + Math.sin(a) * (R + 0.006), zf + 0.002];
    put(ctx, c, 'Trim', extrudeSide([[-0.003, -0.004], [0.003, -0.004], [0.006, 0.005], [0.002, 0.003]], { width: 0.003 }), at, [0, 0, a - Math.PI / 2]);
  }
  put(ctx, c, glow, lathe([[0, -0.006], [0.0042, 0], [0, 0.007]], 5), [0, yc + R + 0.012, zf], AXIS_Y);
  put(ctx, c, 'Trim', box([0, yc + R + 0.005, zf], [0.004, 0.006, 0.004]));
  // Rear ring peep with a glint in it.
  put(ctx, c, 'Trim', ring(0.0055, 0.0014, zb, seg, 5), [0, yc, 0]);
  put(ctx, c, glow, dome(0.0012, 0.0012, 6, 2), [0, yc, zb + 0.001]);
  if (vine) for (const s of [1, -1]) put(ctx, c, 'Trim', rod([s * 0.0055, yc - 0.002, zb], [s * (R + 0.002), yc - 0.004, zf - 0.002], 0.0011, 6));
  return { eyeY: yc, rearZ: zb - 0.006 };
};

/** Scrap sight: a tin can with a lens taped in front, a washer peep at the back, wired to a wooden block. */
export const tincan: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:tincan-look');
  const seg = ctx.seg(1);
  const R = 0.019 * g.range(0.9, 1.15), len = 0.085 * g.range(0.85, 1.15), label = g.chance(0.7);
  const yc = y + R + 0.011, z0 = z - len / 2, z1 = z + len / 2;
  put(ctx, c, 'Stock', box([0, y + 0.006, z + g.range(-0.006, 0.006)], [0.022, 0.012, len * 0.7], ctx.bevel(0.001)));
  put(ctx, c, 'Barrel', tube(R, R - 0.0008, z0, z1, seg), [0, yc, 0]);
  for (const zz of [z0 + 0.0012, z1 - 0.0012]) put(ctx, c, 'Barrel', ring(R, 0.0012, zz, seg, 4), [0, yc, 0]);
  for (let zz = z0 + 0.012; zz < z1 - 0.01; zz += 0.012) put(ctx, c, 'Barrel', ring(R, 0.0006, zz, seg, 4), [0, yc, 0]);
  if (label) put(ctx, c, 'Accent', tube(R + 0.0009, R + 0.0001, z0 + len * 0.22, z1 - len * 0.22, seg), [0, yc, 0]);
  // Lens taped into the front, a washer with a peephole at the back.
  put(ctx, c, 'Glass', cylinder(R * 0.96, z1 - 0.007, z1 - 0.006, seg), [0, yc, 0]);
  put(ctx, c, 'Grip', tube(R + 0.0014, R - 0.0004, z1 - 0.009, z1 - 0.002, seg), [0, yc, 0]);
  put(ctx, c, 'Detail', tube(R * 0.97, 0.0035, z0 + 0.002, z0 + 0.0035, seg), [0, yc, 0]);
  // Wire wraps twisted down to the block.
  for (const zz of [z - len * 0.28, z + len * 0.28]) {
    put(ctx, c, 'Detail', ring(R + 0.0012, 0.0008, zz, seg, 4), [0, yc, 0]);
    for (const s of [1, -1]) put(ctx, c, 'Detail', rod([s * R * 0.8, yc - R * 0.6, zz], [s * 0.0105, y + 0.011, zz + s * 0.002], 0.0008, 5));
  }
  put(ctx, c, 'Detail', rod([0.009, y + 0.011, z - len * 0.28], [0.013, y + 0.002, z - len * 0.28 - 0.008], 0.0008, 5));
  return { eyeY: yc, rearZ: z0 };
};

/** WW-era tangent ladder sight on a stepped ramp (raised with a slider, or folded flat), plus a barleycorn front sight. */
export const ladder: Optic = (ctx, c, y) => {
  const { L } = ctx;
  const g = ctx.rng('optic:ladder-look');
  const rb = L.barrel.radius;
  const z = L.rec.z1 + 0.018;
  const base = Math.max(y, rb + 0.008);
  const raised = g.chance(0.4), hl = 0.05 * g.range(0.85, 1.15), slide = g.range(0.35, 0.8);
  // Ramp base and stepped side walls.
  side(ctx, c, 'Detail', [[z - 0.032, base - 0.007], [z + 0.036, base - 0.007], [z + 0.036, base - 0.001], [z - 0.032, base + 0.003]], 0.02, 0.0012);
  const steps: Vec2[] = [[z - 0.028, base - 0.002], [z + 0.032, base - 0.002]];
  for (let i = 1; i <= 4; i++) steps.push([z + 0.032 - (i - 1) * 0.012, base + i * 0.002], [z + 0.032 - i * 0.012, base + i * 0.002]);
  steps.push([z - 0.028, base + 0.009]);
  for (const s of [1, -1]) side(ctx, c, 'Detail', steps, 0.0025, 0, s * 0.0085);
  // The ladder, built around its hinge at the back of the ramp.
  const hy = base + 0.004, hz = z - 0.026;
  const a = raised ? -0.08 : Math.PI / 2 - 0.07;
  const T: Vec3 = [0, hy, hz], Rx: Vec3 = [a, 0, 0];
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.005, hl / 2, 0], [0.002, hl, 0.0025]), T, Rx);
  for (let yy = 0.008; yy < hl - 0.004; yy += 0.008) put(ctx, c, 'Detail', box([0, yy, 0], [0.01, 0.0012, 0.0018]), T, Rx);
  put(ctx, c, 'Detail', box([0, hl, 0], [0.014, 0.004, 0.003], ctx.bevel(0.0006)), T, Rx);
  const sy = hl * slide;
  put(ctx, c, 'Trim', box([0, sy, 0], [0.0135, 0.005, 0.005], ctx.bevel(0.0008)), T, Rx);
  for (const s of [1, -1]) put(ctx, c, 'Trim', box([s * 0.003, sy + 0.004, 0], [0.003, 0.003, 0.003]), T, Rx);
  put(ctx, c, 'Trim', cylinder(0.0022, -0.0095, 0.0095, 8), T, AXIS_X);
  // Battle notch behind the hinge, used when the ladder is down.
  put(ctx, c, 'Detail', box([0, base + 0.008, hz - 0.004], [0.014, 0.008, 0.002]));
  // Barleycorn front sight between two protective ears.
  const fz = L.barrel.z1 - 0.016;
  const front = ctx.b.component('FrontSight', { kind: 'sight', variant: 'barleycorn', parent: 'Barrel', pivot: [0, rb, fz] });
  put(ctx, front, 'Detail', lathe([[rb * 0.95, fz - 0.008], [rb + 0.0025, fz - 0.007], [rb + 0.0025, fz + 0.007], [rb * 0.95, fz + 0.008]], ctx.seg(0.8)));
  put(ctx, front, 'Detail', box([0, rb + 0.004, fz], [0.008, 0.006, 0.014], ctx.bevel(0.001)));
  side(ctx, front, 'Detail', [[fz - 0.004, rb + 0.006], [fz + 0.004, rb + 0.006], [fz, rb + 0.0145]], 0.0022);
  for (const s of [1, -1]) side(ctx, front, 'Detail', [[fz - 0.006, rb + 0.005], [fz + 0.006, rb + 0.005], [fz + 0.003, rb + 0.016], [fz - 0.004, rb + 0.016]], 0.0018, 0, s * 0.0055);
  const eyeY = raised ? hy + Math.cos(a) * (sy + 0.0055) : base + 0.012;
  const rearZ = raised ? hz - Math.sin(-a) * sy - 0.003 : hz - 0.005;
  return { eyeY, rearZ };
};

/** Projected HUD: a slim emitter block with one or two thin arms holding a transparent panel with a glowing reticle. */
export const hud: Optic = (ctx, c, y, z) => {
  const g = ctx.rng('optic:hud-look');
  const twin = g.chance(0.5), wide = g.range(1, 1.35), shape = g.pick(['rect', 'hex', 'round']);
  const glow: MaterialSlot = ctx.style.traits.glow || ctx.style.traits.cyber ? 'Emissive' : 'Accent';
  const pw = 0.034 * wide, ph = 0.024, tilt = -0.18;
  const yp = y + 0.034, zp = z + 0.014;
  side(ctx, c, 'Sight', [[z - 0.03, y], [z + 0.022, y], [z + 0.026, y + 0.005], [z + 0.018, y + 0.012], [z - 0.024, y + 0.011], [z - 0.03, y + 0.007]], 0.022, 0.0015);
  put(ctx, c, glow, box([0, y + 0.0118, z + 0.006], [0.012, 0.0012, 0.008]));
  put(ctx, c, 'Detail', box([0.0115, y + 0.006, z - 0.012], [0.002, 0.004, 0.012]));
  // Panel corners after the tilt.
  const ybot = yp - (ph / 2) * Math.cos(tilt), zbot = zp - (ph / 2) * Math.sin(tilt);
  const ytop = yp + (ph / 2) * Math.cos(tilt), ztop = zp + (ph / 2) * Math.sin(tilt);
  if (twin) {
    for (const s of [1, -1]) side(ctx, c, 'Sight', [[z + 0.002, y + 0.008], [z + 0.016, y + 0.008], [ztop + 0.0016, ytop], [ztop - 0.0016, ytop]], 0.0028, 0.0006, s * (pw / 2 + 0.0016));
    put(ctx, c, 'Sight', box([0, y + 0.0095, z + 0.009], [pw + 0.006, 0.004, 0.012], ctx.bevel(0.001)));
  } else {
    side(ctx, c, 'Sight', [[z + 0.012, y + 0.01], [z + 0.022, y + 0.004], [zbot + 0.0022, ybot + 0.001], [zbot - 0.0022, ybot + 0.001]], 0.008, 0.001);
  }
  // Panel, edge lights, reticle and little readouts (all tilted with the panel).
  const T: Vec3 = [0, yp, zp], Rx: Vec3 = [tilt, 0, 0];
  const panel: Vec2[] = shape === 'rect' ? [[-pw / 2, -ph / 2], [pw / 2, -ph / 2], [pw / 2, ph / 2], [-pw / 2, ph / 2]]
    : shape === 'hex' ? [[-pw / 2 + 0.006, -ph / 2], [pw / 2 - 0.006, -ph / 2], [pw / 2, 0], [pw / 2 - 0.006, ph / 2], [-pw / 2 + 0.006, ph / 2], [-pw / 2, 0]]
    : roundedRect(0, 0, pw, ph, ph * 0.45, 4);
  put(ctx, c, 'Glass', extrudeFront(panel, -0.0006, 0.0006), T, Rx);
  for (const s of [1, -1]) put(ctx, c, glow, box([0, s * (ph / 2 + 0.0004), 0], [pw * (shape === 'rect' ? 1 : 0.6), 0.0012, 0.0016]), T, Rx);
  put(ctx, c, 'Emissive', ring(0.0042, 0.00035, -0.0009, 16, 3), T, Rx);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(ctx, c, 'Emissive', box([dx * 0.007, dy * 0.007, -0.0009], [dx ? 0.004 : 0.0007, dy ? 0.004 : 0.0007, 0.0004]), T, Rx);
  put(ctx, c, 'Emissive', box([pw * 0.3, -ph * 0.3, -0.0009], [0.006, 0.0012, 0.0004]), T, Rx);
  put(ctx, c, 'Emissive', box([-pw * 0.3, -ph * 0.3, -0.0009], [0.004, 0.0012, 0.0004]), T, Rx);
  return { eyeY: yp, rearZ: z - 0.03 };
};

export const OPTIC_BUILDERS_2: Record<string, OpticBuilder> = { prism, longrange, digital, thermal, nightvision, magnifier, offset, tubedot, minidot, periscope, eye, tincan, ladder, hud };
