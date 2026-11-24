/**
 * Launcher parts: shoulder-fired rocket launchers.
 *
 * The tube's bore axis is y = 0 with the muzzle toward +Z. The tube rests on
 * the shoulder at L.extra.shZ; the pistol grips hang below it. Sights sit on
 * a bracket on the weapon's left side (+X), where the eye is.
 *
 * Layout extras (see archetypes/launcher.ts): R (tube radius), zr / zf (rear
 * and front ends), gz (rear grip), fgZ (front grip), shZ (shoulder), under
 * (underside y at the grips), sideX (left face x), round (1 = round tube),
 * yTop (top of the grips), gripAngle, gripLen, gripDepth; multi pods add
 * cols, rows, pitch, rc. Tubes then set the rocket fit: rTail, rNose, rBr,
 * rHr, rHeadLen, loadFront (and cellN / cx<i> / cy<i> for pods).
 */
import { AXIS_X, Vec2, Vec3, bezier, box, cylinder, dome, extrudeFront, extrudeSide, lathe, ring, rod, smoothPolygon, tube } from '../core/geometry.js';
import type { Geometry } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, raked, side } from './context.js';
import { crystal } from './fantasy.js';
import { OPTIC_BUILDERS, type OpticBuilder } from './sight.js';

const ROOT = 'Tube';

function tubeComp(ctx: BuildContext, variant: string): Component {
  return ctx.b.component(ROOT, { kind: 'tube', variant, parent: null });
}

/** Hollow lathe: outer profile back->front, inner profile front->back ([r, z]). */
function hollow(outer: Vec2[], inner: Vec2[], seg: number): Geometry {
  return lathe([...outer, ...inner, outer[0]], seg);
}

/** Sphere centered on the Z axis at zc. */
function sphere(r: number, zc: number, seg: number, rings = 8): Geometry {
  const prof: Vec2[] = [];
  for (let i = 0; i <= rings; i++) {
    const a = -Math.PI / 2 + (i / rings) * Math.PI;
    prof.push([Math.cos(a) * r, zc + Math.sin(a) * r]);
  }
  prof[0] = [0, zc - r];
  prof[rings] = [0, zc + r];
  return lathe(prof, seg);
}

/** Thin band around the tube. */
function band(ctx: BuildContext, c: Component, slot: MaterialSlot, r: number, z: number, w: number, th = 0.003) {
  put(ctx, c, slot, tube(r + th, r - 0.002, z - w / 2, z + w / 2, ctx.seg(1.3)));
}

/** Radial fins around the Z axis (count n, starting at angle phase). Profile is [z, y] with y = distance from axis. */
function radial(ctx: BuildContext, c: Component, slot: MaterialSlot, profile: Vec2[], width: number, n: number, phase: number, at: Vec3 = [0, 0, 0]) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    put(ctx, c, slot, extrudeSide(profile, { width, bevel: ctx.bevel(Math.min(0.001, width * 0.3)) }), at, [0, 0, a - Math.PI / 2]);
  }
}

/** Rivet heads around a ring at radius r. */
function rivetRing(ctx: BuildContext, c: Component, r: number, z: number, n: number, size = 0.0028) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    put(ctx, c, 'Detail', dome(size, size * 0.6, 6, 2), [Math.cos(a) * r, Math.sin(a) * r, z], [0, Math.PI / 2, a]);
  }
}

/** Default rocket fit: inside the tube, nose just behind the muzzle. */
function fitInside(ctx: BuildContext, boreR: number, back = 0.018) {
  const E = ctx.L.extra;
  const rlen = Math.min(0.55, (E.zf - E.zr) * 0.42);
  E.rNose = E.zf - back;
  E.rTail = E.rNose - rlen;
  E.rBr = boreR * 0.9;
  E.rHr = boreR * 0.9;
  E.rHeadLen = rlen * 0.4;
  E.loadFront = 0;
}

const glowSlot = (ctx: BuildContext): MaterialSlot => (ctx.style.traits.glow || ctx.style.traits.magic ? 'Emissive' : 'Accent');

// ---------------------------------------------------------------------------
// Tubes
// ---------------------------------------------------------------------------

/** WW2-style: long thin tube, flared rear venturi with a wire guard ring, clamp bands, battery box. */
const bazooka: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'bazooka');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const ri = R * 0.86;
  put(ctx, T, 'Barrel', tube(R, ri, zr + 0.09, zf, seg));
  // Flared rear venturi.
  put(ctx, T, 'Barrel', hollow([[R * 0.98, zr + 0.1], [R * 1.25, zr + 0.04], [R * 1.55, zr]], [[R * 1.45, zr], [R * 1.15, zr + 0.04], [ri, zr + 0.1]], seg));
  // Wire guard ring behind the venturi, on four struts.
  const gr = R * 1.75, gz = zr - 0.07;
  put(ctx, T, 'Detail', ring(gr, 0.0025, gz, seg, 5));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    put(ctx, T, 'Detail', rod([Math.cos(a) * R * 1.4, Math.sin(a) * R * 1.4, zr + 0.015], [Math.cos(a) * gr, Math.sin(a) * gr, gz], 0.0022, 5));
  }
  // Muzzle ring and clamp bands.
  put(ctx, T, 'Trim', tube(R * 1.12, ri, zf - 0.025, zf, seg));
  for (const z of [E.gz - 0.045, E.fgZ - 0.05, (E.fgZ + zf) / 2, E.shZ - 0.12]) band(ctx, T, 'Trim', R, z, 0.018);
  // Battery box under the tube, behind the rear grip.
  side(ctx, T, 'Body', [[E.gz - 0.15, -R * 0.6], [E.gz - 0.05, -R * 0.6], [E.gz - 0.055, -R - 0.03], [E.gz - 0.14, -R - 0.03]], 0.04, 0.003);
  // Contact latch and wiring on top near the rear.
  put(ctx, T, 'Detail', box([0, R + 0.006, zr + 0.16], [0.016, 0.014, 0.03], ctx.bevel(0.002)));
  put(ctx, T, 'Detail', rod([0.006, R + 0.002, zr + 0.17], [0.006, R + 0.002, E.gz - 0.1], 0.0015, 5));
  if (p.detail > 0.5) put(ctx, T, 'Detail', box([0, R + 0.004, zf - 0.08], [0.01, 0.012, 0.02], ctx.bevel(0.001)));
  fitInside(ctx, ri);
};

/** Front-loaded: a fat warhead sticks out of the muzzle; wooden heat sleeve, flared rear cone. */
const rpg: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'rpg');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const ri = R * 0.84;
  put(ctx, T, 'Barrel', tube(R, ri, zr + 0.15, zf, seg));
  // Flared rear cone with a lip.
  put(ctx, T, 'Barrel', hollow([[R * 0.99, zr + 0.16], [R * 1.25, zr + 0.1], [R * 1.75, zr + 0.01], [R * 1.8, zr]], [[R * 1.7, zr], [R * 1.18, zr + 0.1], [ri, zr + 0.16]], seg));
  put(ctx, T, 'Trim', tube(R * 1.1, R * 0.96, zr + 0.14, zr + 0.17, seg));
  // Wooden heat-shield sleeve between shoulder and front grip, with metal end bands.
  const s0 = E.shZ + 0.09, s1 = E.fgZ - 0.04, sr = R * 1.3;
  put(ctx, T, 'Stock', lathe([[R * 0.95, s0], [sr - 0.006, s0], [sr, s0 + 0.008], [sr, s1 - 0.008], [sr - 0.006, s1], [R * 0.95, s1]], seg));
  for (const z of [s0 + 0.006, s1 - 0.006]) band(ctx, T, 'Trim', sr, z, 0.012, 0.002);
  if (p.detail > 0.4) for (let i = 1; i < 4; i++) put(ctx, T, 'Detail', box([0, -sr - 0.0005, s0 + ((s1 - s0) * i) / 4], [0.006, 0.002, 0.006]));
  // Muzzle ring.
  put(ctx, T, 'Trim', tube(R * 1.08, ri, zf - 0.02, zf, seg));
  // Warhead sticks out of the front.
  const out = 0.22 + p.length * 0.06;
  E.rTail = zf - 0.35;
  E.rNose = zf + out;
  E.rBr = ri * 0.92;
  E.rHr = R * (1.35 + p.bulk * 0.2);
  E.rHeadLen = out - 0.01;
  E.loadFront = 1;
};

/** Disposable: light telescoping tube, rubber end caps with flip covers, ribs, warning band. */
const disposable: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'disposable');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const split = zf - 0.3 - p.length * 0.05;
  const r2 = R * 0.9;
  put(ctx, T, 'Body', tube(R, R * 0.9, zr + 0.035, split, seg));
  put(ctx, T, 'Body', tube(r2, r2 * 0.88, split - 0.04, zf - 0.03, seg));
  // Collar where the halves telescope.
  put(ctx, T, 'Trim', lathe([[R * 0.95, split - 0.012], [R * 1.06, split - 0.008], [R * 1.06, split], [r2 * 0.98, split + 0.006]], seg));
  // End caps.
  put(ctx, T, 'Accent', tube(R * 1.08, R * 0.86, zr, zr + 0.04, seg));
  put(ctx, T, 'Accent', tube(r2 * 1.1, r2 * 0.86, zf - 0.035, zf, seg));
  // Flip covers hanging open below each end, on small hinges.
  put(ctx, T, 'Accent', cylinder(r2 * 0.95, -0.003, 0.003, seg), [0, -r2 * 1.98, zf + 0.012], [0.15, 0, 0]);
  put(ctx, T, 'Detail', box([0, -r2 * 1.12, zf + 0.002], [0.012, 0.016, 0.014]));
  put(ctx, T, 'Accent', cylinder(R * 0.98, -0.003, 0.003, seg), [0, -R * 1.98, zr - 0.012], [-0.15, 0, 0]);
  put(ctx, T, 'Detail', box([0, -R * 1.12, zr - 0.002], [0.012, 0.016, 0.014]));
  // Stiffening ribs and a warning band.
  for (const z of [E.shZ - 0.1, E.gz - 0.06]) band(ctx, T, 'Body', R, z, 0.01, 0.002);
  band(ctx, T, 'Accent', r2, zf - 0.12, 0.03, 0.0015);
  // Firing mechanism housing on top, with a safety lever.
  side(ctx, T, 'Body', smoothPolygon([[E.gz - 0.1, R * 0.7], [E.gz + 0.06, R * 0.7], [E.gz + 0.05, R + 0.018], [E.gz - 0.08, R + 0.02]], 1), 0.028, 0.003);
  put(ctx, T, 'Detail', box([0, R + 0.024, E.gz - 0.02], [0.008, 0.01, 0.03], ctx.bevel(0.001)));
  // Sling swivels.
  for (const z of [zr + 0.08, zf - 0.08]) put(ctx, T, 'Detail', ring(0.008, 0.0015, 0, 8, 4), [-R - 0.006, 0, z], [0, Math.PI / 2, 0]);
  fitInside(ctx, r2 * 0.88, 0.05);
};

/** Recoilless rifle: heavy tube, breech ring, big rear venturi, folding front legs. */
const recoilless: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'recoilless');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const ri = R * 0.8;
  put(ctx, T, 'Barrel', tube(R, ri, zr + 0.22, zf, seg));
  put(ctx, T, 'Barrel', lathe([[R * 0.95, zf - 0.06], [R * 1.12, zf - 0.05], [R * 1.12, zf], [ri, zf]], seg));
  // Breech ring + venturi.
  put(ctx, T, 'Body', lathe([[R * 0.9, zr + 0.17], [R * 1.32, zr + 0.17], [R * 1.38, zr + 0.19], [R * 1.38, zr + 0.24], [R * 1.25, zr + 0.26], [R * 0.95, zr + 0.26]], seg));
  put(ctx, T, 'Barrel', hollow([[R * 0.9, zr + 0.18], [R * 1.25, zr + 0.12], [R * 1.75, zr + 0.03], [R * 1.95, zr]], [[R * 1.85, zr], [R * 1.4, zr + 0.06], [R * 0.75, zr + 0.17]], seg));
  // Breech handle on the right.
  put(ctx, T, 'Detail', rod([-R * 1.3, 0, zr + 0.2], [-R * 1.3 - 0.06, -0.02, zr + 0.16], 0.005, 8));
  put(ctx, T, 'Grip', cylinder(0.009, 0, 0.03, 10, ctx.bevel(0.002)), [-R * 1.3 - 0.06, -0.02, zr + 0.16], [0, -Math.PI / 2, 0]);
  // Cooling rings.
  const n = 3 + Math.round(p.detail * 2);
  for (let i = 0; i < n; i++) band(ctx, T, 'Body', R, E.fgZ + 0.08 + i * 0.03, 0.012, 0.005);
  // Folding front legs (bipod).
  const lz = zf - 0.12 - p.length * 0.03;
  band(ctx, T, 'Trim', R, lz, 0.03, 0.006);
  put(ctx, T, 'Detail', box([0, -R - 0.012, lz], [0.04, 0.016, 0.026], ctx.bevel(0.002)));
  for (const s of [1, -1]) {
    const foot: Vec3 = [s * (R + 0.05), -R - 0.2, lz + 0.09];
    put(ctx, T, 'Detail', rod([s * 0.012, -R - 0.016, lz], foot, 0.0045, 8));
    put(ctx, T, 'Grip', cylinder(0.012, -0.004, 0.004, 10), [foot[0], foot[1] - 0.004, foot[2]], [-Math.PI / 2, 0, 0]);
  }
  fitInside(ctx, ri);
};

/** Multi-tube pod: a box of 4 or 6 rocket tubes side by side. */
const multi: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'multi');
  const { zr, zf, cols, rows, pitch, rc } = E;
  const seg = ctx.seg(1);
  const W = E.sideX * 2, H = -E.under * 2;
  const fl = 0.14, rl = 0.08, wall = 0.008;
  // Main box with chamfered edges.
  put(ctx, T, 'Body', box([0, 0, (zr + rl + zf - fl) / 2], [W, H, zf - fl - zr - rl], ctx.bevel(0.008)));
  // Front and rear frames around the tube ends.
  for (const [a, b] of [[zf - fl, zf], [zr, zr + rl]] as [number, number][]) {
    for (const s of [1, -1]) {
      put(ctx, T, 'Body', box([0, s * (H / 2 - wall / 2), (a + b) / 2], [W, wall, b - a], ctx.bevel(0.002)));
      put(ctx, T, 'Body', box([s * (W / 2 - wall / 2), 0, (a + b) / 2], [wall, H - wall * 2, b - a], ctx.bevel(0.002)));
    }
  }
  E.cellN = cols * rows;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = (k - (cols - 1) / 2) * pitch, y = (r - (rows - 1) / 2) * pitch;
      E[`cx${i}`] = x;
      E[`cy${i}`] = y;
      i++;
      put(ctx, T, 'Barrel', tube(rc, rc * 0.84, zf - fl - 0.002, zf - 0.004, seg), [x, y, 0]);
      put(ctx, T, 'Barrel', tube(rc, rc * 0.84, zr + 0.004, zr + rl + 0.002, seg), [x, y, 0]);
      put(ctx, T, 'Accent', cylinder(rc * 0.85, zr + 0.02, zr + 0.026, seg), [x, y, 0]);
    }
  }
  // Carry handle on top, cable box on the right side, side ribs.
  const hz0 = E.gz - 0.06, hz1 = E.gz + 0.12, hy = H / 2;
  for (const z of [hz0, hz1]) put(ctx, T, 'Detail', rod([0, hy - 0.002, z], [0, hy + 0.04, z + (z === hz0 ? 0.02 : -0.02)], 0.005, 8));
  put(ctx, T, 'Grip', cylinder(0.009, hz0 + 0.02, hz1 - 0.02, 10, ctx.bevel(0.002)), [0, hy + 0.04, 0]);
  put(ctx, T, 'Detail', box([-W / 2 - 0.012, -H * 0.15, E.fgZ + 0.08], [0.024, H * 0.4, 0.12], ctx.bevel(0.003)));
  if (p.detail > 0.3) for (const s of [1, -1]) for (const y of [-H * 0.25, H * 0.25]) put(ctx, T, 'Trim', box([s * (W / 2 + 0.0015), y, (zr + zf) / 2], [0.003, 0.008, zf - zr - fl - rl - 0.04]));
  put(ctx, T, 'Accent', box([W / 2 + 0.001, -H * 0.05, zf - fl - 0.12], [0.002, H * 0.3, 0.1]));
  // Rockets: a salvo of slim missiles, noses just inside the tubes.
  E.rNose = zf - 0.014;
  E.rTail = E.rNose - Math.min(0.5, (zf - zr) * 0.45);
  E.rBr = rc * 0.78;
  E.rHr = rc * 0.78;
  E.rHeadLen = 0.08;
  E.loadFront = 0;
};

/** Sci-fi: segmented shell over a glowing core, emitter prongs with a plasma charge. */
const energy: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'energy');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const glow = glowSlot(ctx);
  const em = zf - 0.17;
  // Rear cap.
  put(ctx, T, 'Body', lathe([[0, zr], [R * 0.7, zr], [R * 0.95, zr + 0.03], [R, zr + 0.07], [R * 0.9, zr + 0.075], [0, zr + 0.075]], seg));
  put(ctx, T, glow, cylinder(R * 0.45, zr - 0.006, zr + 0.002, seg));
  // Glowing core under the segments.
  put(ctx, T, glow, cylinder(R * 0.86, zr + 0.07, em, seg));
  const n = 5 + Math.round(p.detail * 2);
  const gap = 0.014, s0 = zr + 0.075, step = (em - s0) / n;
  for (let i = 0; i < n; i++) {
    const a = s0 + i * step + (i ? gap / 2 : 0), b = s0 + (i + 1) * step - (i < n - 1 ? gap / 2 : 0);
    put(ctx, T, i % 2 ? 'Trim' : 'Body', lathe([[R * 0.85, a], [R * 0.97, a], [R, a + 0.006], [R, b - 0.006], [R * 0.97, b], [R * 0.85, b]], seg));
  }
  // Top spine fin and a side panel.
  side(ctx, T, 'Trim', [[zr + 0.1, R * 0.8], [E.gz + 0.1, R * 0.8], [E.gz + 0.06, R + 0.03], [zr + 0.16, R + 0.022]], 0.008, 0.002);
  put(ctx, T, glow, box([0, R + 0.02, (zr + E.gz) / 2 + 0.05], [0.009, 0.004, 0.1]));
  // Emitter: collar and three prongs curling toward the charge.
  put(ctx, T, 'Trim', lathe([[R * 0.6, em - 0.01], [R * 1.08, em], [R * 1.12, em + 0.03], [R * 0.95, em + 0.04], [R * 0.5, em + 0.04]], seg));
  const prong: Vec2[] = [[em + 0.02, R * 0.55], [em + 0.02, R * 1.02], [zf - 0.04, R * 0.95], [zf, R * 0.72], [zf - 0.012, R * 0.66], [zf - 0.05, R * 0.78], [em + 0.06, R * 0.62]];
  radial(ctx, T, 'Body', prong, 0.012, 3, Math.PI / 2);
  radial(ctx, T, glow, [[zf - 0.05, R * 0.79], [zf - 0.01, R * 0.7], [zf - 0.004, R * 0.73], [zf - 0.045, R * 0.83]], 0.014, 3, Math.PI / 2);
  E.rNose = zf - 0.025;
  E.rTail = zf - 0.15;
  E.rBr = R * 0.4;
  E.rHr = R * 0.5;
  E.rHeadLen = 0.1;
  E.loadFront = 0;
};

/** Survivor: welded pipe, hose clamps, tape and a bucket for a blast cone. */
const pipe: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'pipe');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const ri = R * 0.86;
  const joint = E.fgZ + 0.06 + ctx.rng('tube').range(0, 0.08);
  put(ctx, T, 'Barrel', tube(R, ri, zr + 0.12, joint, seg));
  put(ctx, T, 'Barrel', tube(R * 0.97, ri, joint, zf, seg));
  // Pipe coupler with weld beads.
  put(ctx, T, 'Body', tube(R * 1.14, R * 0.96, joint - 0.03, joint + 0.03, seg));
  for (const z of [joint - 0.03, joint + 0.03]) put(ctx, T, 'Detail', ring(R * 1.08, 0.003, z, seg, 4));
  put(ctx, T, 'Detail', ring(R * 1.0, 0.0035, zr + 0.125, seg, 4));
  // Hose clamps with screw housings.
  for (const z of [E.gz - 0.05, E.fgZ + 0.04, zf - 0.05]) {
    band(ctx, T, 'Detail', R, z, 0.012, 0.0018);
    put(ctx, T, 'Detail', box([-R * 0.72, R * 0.72, z], [0.012, 0.012, 0.016]), [0, 0, 0]);
    put(ctx, T, 'Detail', cylinder(0.0025, z - 0.014, z + 0.014, 6), [-R * 0.72 - 0.004, R * 0.72 + 0.004, 0]);
  }
  // Tape wraps.
  for (const z of [E.shZ, (E.fgZ + zf) / 2 + 0.05]) band(ctx, T, 'Accent', R, z, 0.06 + p.detail * 0.03, 0.0025);
  // Bucket blast cone at the back, with a wire handle.
  const bz = zr + 0.13;
  put(ctx, T, 'Body', hollow([[R * 0.95, bz], [R * 1.35, bz - 0.04], [R * 2.0, zr + 0.004], [R * 2.05, zr]], [[R * 1.96, zr], [R * 1.92, zr + 0.006], [R * 1.28, bz - 0.04], [R * 0.86, bz]], seg));
  put(ctx, T, 'Detail', ring(R * 2.05, 0.0035, zr + 0.004, seg, 4));
  const hp: Vec3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    hp.push([Math.cos(a) * R * 2.05, Math.sin(a) * R * 1.0 - R * 0.2, zr - 0.04 - Math.sin(a) * 0.06]);
  }
  for (let i = 0; i < 8; i++) put(ctx, T, 'Detail', rod(hp[i], hp[i + 1], 0.0022, 5));
  for (const s of [1, -1]) put(ctx, T, 'Detail', rod([s * R * 2.05, -R * 0.2, zr - 0.04], [s * R * 2.0, -R * 0.2, zr + 0.004], 0.0022, 5));
  fitInside(ctx, ri * 0.97);
};

/** Steampunk: riveted brass tube, copper pipes, a pressure gauge and a flared bell. */
const brass: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'brass');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.3);
  const ri = R * 0.86;
  const bell = zf - 0.12 - p.length * 0.03;
  put(ctx, T, 'Body', tube(R, ri, zr + 0.06, bell + 0.01, seg));
  // Flared bell at the front.
  put(ctx, T, 'Trim', hollow([[R * 0.98, bell], [R * 1.1, bell + 0.05], [R * 1.4, zf - 0.02], [R * 1.75, zf]], [[R * 1.65, zf], [R * 1.3, zf - 0.02], [R * 1.0, bell + 0.05], [ri, bell]], seg));
  // Breech hatch at the back.
  put(ctx, T, 'Trim', lathe([[0, zr], [R * 0.9, zr], [R * 1.1, zr + 0.01], [R * 1.1, zr + 0.065], [R * 0.95, zr + 0.07]], seg));
  put(ctx, T, 'Detail', box([0, 0, zr - 0.006], [R * 1.4, 0.012, 0.012], ctx.bevel(0.002)));
  // Riveted bands.
  const bands = [zr + 0.11, E.shZ - 0.1, E.gz - 0.06, E.fgZ + 0.06, bell - 0.03];
  for (const z of bands) {
    band(ctx, T, 'Trim', R, z, 0.022, 0.004);
    rivetRing(ctx, T, R + 0.004, z, 8);
  }
  // Copper pipes along the right side, with elbows into the tube.
  const px = -(R + 0.014);
  for (const [y, z0, z1] of [[R * 0.35, zr + 0.13, bell - 0.05], [-R * 0.3, E.shZ - 0.06, E.fgZ + 0.02]] as [number, number, number][]) {
    put(ctx, T, 'Accent', rod([px, y, z0], [px, y, z1], 0.0045, 8));
    for (const z of [z0, z1]) put(ctx, T, 'Accent', rod([px, y, z], [-R * 0.8, y, z], 0.0045, 8));
  }
  // Pressure gauge on the right, near the rear grip.
  const gzz = E.gz + 0.05, gy = R * 0.75, gx = -(R + 0.016);
  put(ctx, T, 'Accent', rod([-R * 0.8, gy * 0.7, gzz], [gx, gy, gzz], 0.004, 8));
  put(ctx, T, 'Trim', cylinder(0.024, 0, 0.012, seg, ctx.bevel(0.002)), [gx - 0.006, gy + 0.018, gzz], [0, -Math.PI / 2, 0]);
  put(ctx, T, 'Glass', cylinder(0.02, 0, 0.002, seg), [gx - 0.0185, gy + 0.018, gzz], [0, -Math.PI / 2, 0]);
  put(ctx, T, 'Detail', box([0, 0, 0], [0.0012, 0.016, 0.0024]), [gx - 0.0172, gy + 0.022, gzz], [0.6, 0, 0]);
  fitInside(ctx, ri, 0.04);
};

/** Fantasy: carved wooden tube with stone rings, glowing runes and a claw mouth holding a crystal bolt. */
const arcane: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'arcane');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.2);
  const glow: MaterialSlot = ctx.style.traits.magic ? 'Emissive' : 'Trim';
  const ri = R * 0.7;
  put(ctx, T, 'Stock', hollow([[R * 0.8, zr + 0.06], [R * 1.0, zr + 0.2], [R, zf - 0.08], [R * 0.92, zf - 0.03]], [[ri, zf - 0.03], [ri, zr + 0.08]], seg));
  // Carved root knot at the back.
  put(ctx, T, 'Stock', lathe([[0, zr], [R * 0.55, zr + 0.01], [R * 0.85, zr + 0.06], [R * 0.6, zr + 0.08], [0, zr + 0.08]], seg));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    put(ctx, T, 'Stock', rod([Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, zr + 0.12], [Math.cos(a) * R * 1.35, Math.sin(a) * R * 1.35, zr - 0.02], 0.007, 6));
  }
  // Stone rings with rune bands.
  for (const z of [zr + 0.16, E.shZ - 0.08, E.fgZ + 0.08]) {
    put(ctx, T, 'Body', lathe([[R * 0.95, z - 0.025], [R * 1.12, z - 0.02], [R * 1.16, z], [R * 1.12, z + 0.02], [R * 0.95, z + 0.025]], Math.max(6, Math.round(seg / 2))));
    put(ctx, T, glow, ring(R * 1.16, 0.0015, z, seg, 3));
  }
  // Rune glyphs along both sides.
  const rr = ctx.rng('runes');
  const n = 5 + Math.round(p.ornament * 4);
  for (let i = 0; i < n; i++) {
    const z = E.fgZ + 0.13 + i * ((zf - 0.12 - E.fgZ - 0.13) / n);
    for (const s of [1, -1]) {
      put(ctx, T, glow, box([0, 0, 0], [0.002, 0.014, 0.003]), [s * (R + 0.0005), 0, z], [rr.range(-0.6, 0.6), 0, 0]);
      put(ctx, T, glow, box([0, 0, 0], [0.002, 0.003, 0.01]), [s * (R + 0.0005), rr.range(-0.006, 0.006), z + 0.004], [0, 0, 0]);
    }
  }
  // Claw mouth.
  put(ctx, T, 'Trim', lathe([[ri * 0.95, zf - 0.035], [R * 1.05, zf - 0.04], [R * 1.12, zf - 0.015], [ri * 1.05, zf - 0.005]], seg));
  const claw: Vec2[] = [[zf - 0.03, R * 0.9], [zf + 0.02, R * 1.25], [zf + 0.07, R * 1.05], [zf + 0.09, R * 0.6], [zf + 0.075, R * 0.55], [zf + 0.055, R * 0.85], [zf + 0.01, R * 0.95]];
  radial(ctx, T, 'Trim', claw, 0.007, 3, Math.PI / 2);
  // Crystal bolt sticks out of the mouth.
  E.rTail = zf - 0.32;
  E.rNose = zf + 0.14 + p.length * 0.04;
  E.rBr = ri * 0.9;
  E.rHr = R * 0.55;
  E.rHeadLen = 0.12;
  E.loadFront = 1;
};

/** Dieselpunk: streamlined teardrop body, swept fins, chrome speed lines. */
const deco: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'deco');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.4);
  const rb = R * 1.08, ri = R * 0.78;
  put(ctx, T, 'Body', lathe([
    [0, zr + 0.07], [R * 0.42, zr + 0.07], [R * 0.5, zr], [R * 0.64, zr], [R * 0.85, zr + 0.06], [rb * 0.97, zr + 0.18], [rb, zr + 0.3],
    [rb, zf - 0.26], [R * 0.98, zf - 0.1], [R * 0.9, zf - 0.02], [R * 0.9, zf], [ri, zf], [ri, zf - 0.18], [0, zf - 0.18],
  ], seg));
  // Chrome nose ring and rear nozzle ring.
  put(ctx, T, 'Trim', lathe([[R * 0.86, zf - 0.03], [R * 0.95, zf - 0.03], [R * 0.95, zf + 0.004], [ri * 0.98, zf + 0.004]], seg));
  put(ctx, T, 'Trim', tube(R * 0.68, R * 0.5, zr - 0.008, zr + 0.01, seg));
  // Swept tail fins (X layout).
  const fin: Vec2[] = [[zr + 0.03, R * 0.6], [zr + 0.2, rb * 0.95], [zr + 0.12, rb + 0.06 + p.bulk * 0.02], [zr - 0.01, rb + 0.07 + p.bulk * 0.02], [zr + 0.005, R * 0.6]];
  radial(ctx, T, 'Trim', fin, 0.006, 4, Math.PI / 4);
  // Speed lines down both sides, and a top crest.
  const n = 2 + Math.round(p.ornament * 2);
  for (const s of [1, -1]) for (let i = 0; i < n; i++) {
    const y = (i - (n - 1) / 2) * 0.012;
    put(ctx, T, 'Trim', box([s * (Math.sqrt(rb * rb - y * y) - 0.0004), y, E.fgZ + 0.12], [0.003, 0.003, (zf - 0.3 - E.fgZ) + 0.02 - i * 0.03]));
  }
  side(ctx, T, 'Trim', [[zr + 0.25, rb - 0.004], [E.gz - 0.02, rb - 0.004], [E.gz - 0.06, rb + 0.014], [zr + 0.32, rb + 0.006]], 0.008, 0.002);
  fitInside(ctx, ri, 0.04);
};

/** Cyberpunk: angular faceted shell, muzzle collar, side display and neon strips. */
const smart: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'smart');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.2);
  const hw = E.sideX, hh = -E.under;
  const ch = R * 0.42;
  const shell: Vec2[] = [[-hw, -hh + ch], [-hw + ch, -hh], [hw - ch, -hh], [hw, -hh + ch], [hw, hh - ch * 0.6], [hw - ch * 0.6, hh], [-hw + ch * 0.6, hh], [-hw, hh - ch * 0.6]];
  const s0 = zr + 0.07, s1 = zf - 0.07;
  put(ctx, T, 'Body', extrudeFront(shell, s0, s1, ctx.bevel(0.004)));
  // Raised armor panel on top, inset darker band underneath.
  put(ctx, T, 'Trim', extrudeFront([[-hw * 0.6, hh - 0.002], [hw * 0.6, hh - 0.002], [hw * 0.45, hh + 0.012], [-hw * 0.45, hh + 0.012]], E.shZ - 0.05, E.fgZ + 0.1, ctx.bevel(0.002)));
  // Collars.
  put(ctx, T, 'Barrel', tube(R * 0.95, R * 0.8, s1 - 0.02, zf, seg));
  put(ctx, T, 'Barrel', hollow([[R * 0.85, s0 + 0.02], [R * 1.05, zr + 0.02], [R * 1.1, zr]], [[R * 0.98, zr], [R * 0.75, s0 + 0.02]], seg));
  put(ctx, T, 'Detail', tube(R * 1.0, R * 0.9, s1 - 0.004, s1 + 0.012, seg));
  // Side display (left) and neon strips on both upper edges.
  const dz = E.fgZ + 0.12 + p.length * 0.03;
  put(ctx, T, 'Sight', box([hw + 0.004, 0, dz], [0.008, hh * 0.9, 0.11], ctx.bevel(0.002)));
  put(ctx, T, 'Emissive', box([hw + 0.0084, 0, dz], [0.0012, hh * 0.72, 0.092]));
  for (const s of [1, -1]) put(ctx, T, 'Emissive', box([0, 0, (s0 + s1) / 2], [0.0035, 0.0035, s1 - s0 - 0.04]), [s * (hw - ch * 0.3), hh - ch * 0.3, 0], [0, 0, -s * Math.PI / 4]);
  // Cable from the display to the rear.
  put(ctx, T, 'Detail', rod([-hw - 0.004, -hh * 0.4, E.fgZ], [-hw - 0.004, -hh * 0.4, zr + 0.12], 0.003, 6));
  fitInside(ctx, R * 0.8, 0.03);
};

/** Harpoon launcher: a short barrel, a barbed spear sticking out, and a rope line from a side reel. */
const harpoon: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'harpoon');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.2);
  const ri = R * 0.7;
  // Rear body (a compact butt housing) and the barrel.
  put(ctx, T, 'Body', lathe([[0, zr], [R * 1.1, zr], [R * 1.35, zr + 0.03], [R * 1.35, E.gz - 0.04], [R * 1.1, E.gz - 0.01], [R * 0.9, E.gz - 0.01]], seg));
  put(ctx, T, 'Barrel', tube(R, ri, E.gz - 0.02, zf - 0.03, seg));
  // Muzzle head with a line guide.
  put(ctx, T, 'Trim', lathe([[ri, zf - 0.05], [R * 1.25, zf - 0.045], [R * 1.3, zf - 0.01], [R * 1.1, zf], [ri, zf]], seg));
  const guide: Vec3 = [-R * 1.3 - 0.008, -R * 0.3, zf - 0.025];
  put(ctx, T, 'Detail', ring(0.007, 0.0018, 0, 8, 4), guide, [0, 0, 0]);
  put(ctx, T, 'Detail', box([-R * 1.15, -R * 0.3, zf - 0.025], [R * 0.4, 0.004, 0.006]));
  // Rubber power bands from the muzzle head back to a wishbone notch (decoration on top).
  for (const s of [1, -1]) put(ctx, T, 'Grip', rod([s * R * 0.9, R * 0.6, zf - 0.03], [s * 0.006, R + 0.012, E.fgZ + 0.08], 0.005, 6));
  put(ctx, T, 'Detail', box([0, R + 0.012, E.fgZ + 0.08], [0.02, 0.006, 0.008], ctx.bevel(0.001)));
  // Rope reel on the right side, between the grips.
  const rz = (E.gz + E.fgZ) / 2 + 0.02, rx = -R - 0.03, ry = -R * 0.1, rr = 0.032 + p.bulk * 0.006;
  put(ctx, T, 'Detail', box([-R * 0.8 - 0.008, ry, rz], [0.022, 0.012, 0.02]));
  for (const dx of [0.014, -0.014]) put(ctx, T, 'Trim', cylinder(rr, -0.002, 0.002, seg, ctx.bevel(0.0008)), [rx + dx, ry, rz], AXIS_X);
  put(ctx, T, 'Body', cylinder(rr * 0.45, -0.014, 0.014, seg), [rx, ry, rz], AXIS_X);
  for (let i = 0; i < 5; i++) put(ctx, T, 'Accent', ring(rr * 0.6, 0.0028, 0, Math.max(8, seg), 4), [rx - 0.011 + i * 0.0055, ry, rz], AXIS_X);
  put(ctx, T, 'Detail', rod([rx - 0.016, ry, rz], [rx - 0.03, ry - rr * 0.8, rz + 0.01], 0.0025, 6));
  put(ctx, T, 'Grip', cylinder(0.005, 0, 0.016, 8), [rx - 0.03, ry - rr * 0.8, rz + 0.01], [0, -Math.PI / 2, 0]);
  // Spear sticks out the front; the rope runs from the reel through the guide to the spear's line eye.
  const out = 0.24 + p.length * 0.06;
  E.rTail = zf - 0.36;
  E.rNose = zf + out;
  E.rBr = ri * 0.85;
  E.rHr = R * 0.6;
  E.rHeadLen = 0.1;
  E.loadFront = 1;
  E.ropeZ = zf + 0.05;
  const eye: Vec3 = [-0.009, -0.004, E.ropeZ];
  const top: Vec3 = [rx, ry + rr * 0.6, rz];
  const pts: Vec3[] = [top];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    pts.push([top[0] + (guide[0] - top[0]) * t - Math.sin(t * Math.PI) * 0.01, top[1] + (guide[1] - top[1]) * t - Math.sin(t * Math.PI) * 0.03, top[2] + (guide[2] - top[2]) * t]);
  }
  pts.push([(guide[0] + eye[0]) / 2 - 0.004, (guide[1] + eye[1]) / 2 - 0.008, (guide[2] + eye[2]) / 2], eye);
  for (let i = 0; i < pts.length - 1; i++) put(ctx, T, 'Accent', rod(pts[i], pts[i + 1], 0.0022, 5));
};

/** Oversized sci-fi energy cannon: chunky housing, caged core window, coils, big emitter dish. */
const megacannon: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const E = L.extra;
  const T = tubeComp(ctx, 'megacannon');
  const { R, zr, zf } = E;
  const seg = ctx.seg(1.4);
  const glow: MaterialSlot = 'Emissive';
  // Sections, back to front: cap, core window, housing (shoulder + grips), coils, emitter.
  const c0 = zr + 0.06, c1 = E.shZ - 0.1, h1 = E.fgZ + 0.06;
  const e0 = zf - Math.min(0.15, (zf - h1) * 0.5);
  put(ctx, T, 'Body', lathe([[0, zr], [R * 0.75, zr], [R * 1.04, zr + 0.04], [R * 1.04, c0], [R * 0.6, c0], [0, c0]], seg));
  put(ctx, T, glow, cylinder(R * 0.5, zr - 0.006, zr + 0.002, seg));
  put(ctx, T, 'Body', lathe([[0, c1], [R * 0.7, c1], [R, c1], [R, h1], [R * 0.7, h1], [0, h1]], seg));
  for (const z of [c1 + 0.02, E.gz + 0.06, h1 - 0.02]) put(ctx, T, 'Trim', lathe([[R * 0.98, z - 0.018], [R * 1.06, z - 0.012], [R * 1.06, z + 0.012], [R * 0.98, z + 0.018]], seg));
  // Heavy armor plates on the sides.
  for (const s of [1, -1]) put(ctx, T, 'Trim', box([s * (R + 0.006), R * 0.15, (E.shZ + 0.09 + E.fgZ - 0.04) / 2], [0.012, R * 0.9, E.fgZ - E.shZ - 0.13], ctx.bevel(0.003)));
  // Core window: a glowing cylinder behind cage bars.
  put(ctx, T, glow, cylinder(R * 0.7, c0, c1, seg));
  for (const z of [c0 + 0.01, c1 - 0.01]) put(ctx, T, 'Trim', tube(R * 1.08, R * 0.6, z - 0.012, z + 0.012, seg));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    put(ctx, T, 'Detail', box([0, 0, 0], [0.012, 0.012, c1 - c0]), [Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, (c0 + c1) / 2], [0, 0, a]);
  }
  // Barrel with heavy coils.
  put(ctx, T, 'Barrel', cylinder(R * 0.62, h1, e0 + 0.01, seg));
  const n = Math.max(2, Math.min(4 + Math.round(p.detail * 2), Math.floor((e0 - h1) / (R * 0.3))));
  for (let i = 0; i < n; i++) {
    const z = h1 + R * 0.15 + (i / Math.max(1, n - 1)) * (e0 - h1 - R * 0.3);
    put(ctx, T, 'Accent', ring(R * 0.76, R * 0.12, z, seg, 6));
  }
  // Emitter dish with a glowing throat.
  put(ctx, T, 'Trim', hollow([[R * 0.6, e0], [R * 1.05, e0 + 0.05], [R * 1.3, zf - 0.02], [R * 1.32, zf]], [[R * 1.2, zf], [R * 0.95, zf - 0.04], [R * 0.55, e0 + 0.04]], seg));
  put(ctx, T, glow, cylinder(R * 0.56, e0 + 0.035, e0 + 0.042, seg));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    put(ctx, T, 'Body', box([0, 0, 0], [0.014, 0.02, 0.07]), [Math.cos(a) * R * 1.28, Math.sin(a) * R * 1.28, zf + 0.01], [0, 0, a]);
  }
  // Top carry handle.
  const hy = R + 0.05;
  for (const z of [E.shZ, E.gz + 0.1]) put(ctx, T, 'Detail', rod([0, R * 0.9, z], [0, hy, z], 0.007, 8));
  put(ctx, T, 'Grip', cylinder(0.012, E.shZ - 0.01, E.gz + 0.11, 12, ctx.bevel(0.003)), [0, hy, 0]);
  E.rNose = zf + R * 0.35;
  E.rTail = E.rNose - R * 1.4;
  E.rBr = R * 0.6;
  E.rHr = R * 0.68;
  E.rHeadLen = R * 1.3;
  E.loadFront = 0;
};

export const LAUNCHER_TUBES: Record<string, PartBuilder> = { bazooka, rpg, disposable, recoilless, multi, energy, pipe, brass, arcane, deco, smart, harpoon, megacannon };

// ---------------------------------------------------------------------------
// Grips (rear pistol grip with trigger, front grip)
// ---------------------------------------------------------------------------

function trigger(ctx: BuildContext, guard: 'round' | 'square', slot: MaterialSlot, gripComp: Component) {
  const { L, b } = ctx;
  const E = L.extra;
  const y = E.yTop, zt = E.gz + 0.024;
  const trig = b.component('Trigger', {
    kind: 'trigger', variant: 'blade', pivot: [0, y + 0.004, zt],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.3], purpose: 'fire' },
  });
  side(ctx, trig, 'Detail', [[zt - 0.003, y + 0.006], [zt + 0.003, y + 0.006], [zt + 0.004, y - 0.008], [zt + 0.001, y - 0.019], [zt - 0.004, y - 0.02], [zt - 0.001, y - 0.01]], 0.006, 0.0015);
  const g0 = E.gz - 0.002, g1 = E.gz + 0.058, depth = 0.03, t = 0.0045;
  let pts: Vec2[];
  if (guard === 'round') {
    const outer = bezier([g0, y], [g0 - 0.002, y - depth * 1.2], [g1 + 0.004, y - depth * 1.2], [g1, y], 10);
    const inner = bezier([g1 - t, y], [g1 - t + 0.003, y - (depth - t) * 1.15], [g0 + t - 0.002, y - (depth - t) * 1.15], [g0 + t, y], 10);
    pts = [[g0, y], ...outer, ...inner];
  } else {
    pts = [[g0, y], [g0, y - depth + 0.004], [g0 + 0.006, y - depth], [g1, y - depth], [g1, y], [g1 - t, y], [g1 - t, y - depth + t], [g0 + t + 0.004, y - depth + t], [g0 + t, y - depth + t + 0.004], [g0 + t, y]];
  }
  side(ctx, gripComp, slot, pts, 0.01, 0.0015);
}

/** Mount block from inside the tube down to y. */
function mount(ctx: BuildContext, c: Component, slot: MaterialSlot, z0: number, z1: number, y: number, w = 0.028) {
  const top = ctx.L.extra.under + 0.012;
  put(ctx, c, slot, box([0, (top + y) / 2, (z0 + z1) / 2], [w, top - y, z1 - z0], ctx.bevel(0.002)));
}

function gripComps(ctx: BuildContext, variant: string) {
  const E = ctx.L.extra;
  const rear = ctx.b.component('Grip', { kind: 'grip', variant, pivot: [0, E.yTop, E.gz] });
  const front = ctx.b.component('FrontGrip', { kind: 'grip', variant, pivot: [0, E.yTop, E.fgZ] });
  return { rear, front };
}

/** Modern polymer pistol grips with a trigger guard. */
const pistolGrips: PartBuilder = (ctx) => {
  const E = ctx.L.extra;
  const { rear, front } = gripComps(ctx, 'pistol');
  const a = E.gripAngle, len = E.gripLen, D = E.gripDepth;
  mount(ctx, rear, 'Body', E.gz - D - 0.01, E.gz + 0.066, E.yTop);
  side(ctx, rear, 'Grip', raked([E.gz, E.yTop + 0.002], a, [[0, 0.002], [len * 0.25, 0.006], [len * 0.45, 0.001], [len * 0.65, 0.005], [len, 0.002], [len + 0.008, -0.006], [len + 0.008, -D + 0.004], [len, -D - 0.004], [len * 0.4, -D - 0.008], [0, -D - 0.004]]), 0.03, 0.005);
  side(ctx, rear, 'Detail', raked([E.gz, E.yTop], a, [[len + 0.004, 0.003], [len + 0.012, 0.002], [len + 0.012, -D - 0.002], [len + 0.004, -D - 0.003]]), 0.032, 0.002);
  trigger(ctx, 'square', 'Body', rear);
  const fy = E.under - 0.016;
  mount(ctx, front, 'Body', E.fgZ - 0.035, E.fgZ + 0.035, fy + 0.002, 0.026);
  side(ctx, front, 'Grip', raked([E.fgZ + 0.018, fy + 0.002], 0.08, [[0, 0.002], [0.03, 0.005], [0.05, 0.001], [0.07, 0.005], [0.095, 0.002], [0.1, -0.006], [0.1, -0.032], [0.095, -0.038], [0, -0.038]]), 0.03, 0.005);
};

/** Wooden handles: a rounded rear grip and a turned front handle. */
const woodGrips: PartBuilder = (ctx) => {
  const E = ctx.L.extra;
  const { rear, front } = gripComps(ctx, 'wood');
  const a = E.gripAngle + 0.08, len = E.gripLen * 0.95, D = E.gripDepth + 0.004;
  mount(ctx, rear, 'Body', E.gz - D - 0.008, E.gz + 0.062, E.yTop, 0.024);
  side(ctx, rear, 'Stock', smoothPolygon(raked([E.gz, E.yTop + 0.002], a, [[0, 0.003], [len, 0.004], [len + 0.012, -0.004], [len + 0.012, -D - 0.002], [len, -D - 0.01], [0, -D - 0.004]]), 2), 0.032, 0.007);
  trigger(ctx, 'round', 'Trim', rear);
  const fy = E.under - 0.012;
  mount(ctx, front, 'Body', E.fgZ - 0.02, E.fgZ + 0.02, fy + 0.002, 0.02);
  const h = 0.1, r = 0.017;
  put(ctx, front, 'Stock', lathe([[0, 0], [r * 0.8, 0], [r, 0.01], [r * 1.05, h * 0.5], [r * 0.95, h - 0.012], [r * 1.15, h - 0.004], [r * 0.6, h], [0, h]], ctx.seg(1)), [0, fy + 0.004, E.fgZ], [Math.PI / 2, 0, 0]);
  put(ctx, front, 'Trim', tube(r * 0.95, r * 0.7, -0.004, 0.006, ctx.seg(1)), [0, fy + 0.004, E.fgZ], [Math.PI / 2, 0, 0]);
};

/** Sci-fi skeletal grips: open loop frames with glowing inlays. */
const skeletalGrips: PartBuilder = (ctx) => {
  const E = ctx.L.extra;
  const { rear, front } = gripComps(ctx, 'skeletal');
  const glow: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  const a = E.gripAngle, len = E.gripLen + 0.006, D = E.gripDepth + 0.004, w = 0.01;
  mount(ctx, rear, 'Body', E.gz - D - 0.012, E.gz + 0.066, E.yTop);
  side(ctx, rear, 'Grip', raked([E.gz, E.yTop + 0.002], a, [[0, 0.004], [len, 0.004], [len + 0.006, -D * 0.5], [len, -D - 0.006], [0, -D - 0.006], [0, -D - 0.006 + w * 1.6], [len - w, -D - 0.006 + w * 1.6], [len - w, 0.004 - w], [0, 0.004 - w]]), 0.026, 0.004);
  side(ctx, rear, glow, raked([E.gz, E.yTop + 0.002], a, [[0.01, -D + 0.002], [len - 0.012, -D + 0.002], [len - 0.012, -D - 0.002], [0.01, -D - 0.002]]), 0.028);
  trigger(ctx, 'square', 'Body', rear);
  const fy = E.under - 0.014;
  mount(ctx, front, 'Body', E.fgZ - 0.04, E.fgZ + 0.03, fy + 0.002, 0.026);
  side(ctx, front, 'Grip', [[E.fgZ - 0.04, fy + 0.002], [E.fgZ + 0.03, fy + 0.002], [E.fgZ + 0.012, fy - 0.09], [E.fgZ - 0.012, fy - 0.096], [E.fgZ - 0.01, fy - 0.08], [E.fgZ - 0.002, fy - 0.02], [E.fgZ - 0.03, fy - 0.01]], 0.026, 0.004);
  side(ctx, front, glow, [[E.fgZ + 0.006, fy - 0.02], [E.fgZ + 0.012, fy - 0.02], [E.fgZ + 0.004, fy - 0.08], [E.fgZ - 0.002, fy - 0.08]], 0.028);
};

export const LAUNCHER_GRIPS: Record<string, PartBuilder> = { pistol: pistolGrips, wood: woodGrips, skeletal: skeletalGrips };

// ---------------------------------------------------------------------------
// Shoulder rests
// ---------------------------------------------------------------------------

/** Padded saddle under the tube where it rests on the shoulder. */
const pad: PartBuilder = (ctx) => {
  const E = ctx.L.extra;
  const c = ctx.b.component('Shoulder', { kind: 'shoulder', variant: 'pad', pivot: [0, E.under, E.shZ] });
  const th = 0.022, half = 0.085;
  if (E.round) {
    const R = -E.under, pts: Vec2[] = [];
    const a0 = Math.PI * 1.12, a1 = Math.PI * 1.88, n = 10;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([Math.cos(a) * (R + th), Math.sin(a) * (R + th)]);
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([Math.cos(a) * (R - 0.003), Math.sin(a) * (R - 0.003)]);
    }
    put(ctx, c, 'Grip', extrudeFront(pts, E.shZ - half, E.shZ + half, ctx.bevel(0.006)));
    for (const z of [E.shZ - half + 0.012, E.shZ + half - 0.012]) band(ctx, c, 'Detail', R, z, 0.01, 0.0025);
  } else {
    put(ctx, c, 'Grip', box([0, E.under - th / 2 + 0.002, E.shZ], [E.sideX * 1.3, th, half * 2], ctx.bevel(0.007)));
  }
  E.shoulderY = E.under - th;
};

/** Wire frame shoulder stock under the tube with a small butt plate. */
const wire: PartBuilder = (ctx) => {
  const E = ctx.L.extra;
  const c = ctx.b.component('Shoulder', { kind: 'shoulder', variant: 'wire', pivot: [0, E.under, E.shZ] });
  const u = E.under, z = E.shZ;
  for (const x of [0.016, -0.016]) {
    const pts: Vec3[] = [[x, u + 0.006, z + 0.1], [x, u - 0.05, z + 0.02], [x, u - 0.075, z - 0.14], [x, u - 0.01, z - 0.15]];
    for (let i = 0; i < pts.length - 1; i++) put(ctx, c, 'Detail', rod(pts[i], pts[i + 1], 0.0035, 6));
    put(ctx, c, 'Detail', dome(0.0045, 0.0045, 6, 2), pts[1], [Math.PI / 2, 0, 0]);
    put(ctx, c, 'Detail', dome(0.0045, 0.0045, 6, 2), pts[2], [Math.PI / 2, 0, 0]);
  }
  put(ctx, c, 'Detail', rod([0.018, u - 0.05, z + 0.02], [-0.018, u - 0.05, z + 0.02], 0.003, 6));
  put(ctx, c, 'Grip', box([0, u - 0.045, z - 0.15], [0.05, 0.08, 0.014], ctx.bevel(0.004)));
  // Clamp to the tube.
  if (E.round) band(ctx, c, 'Detail', -E.under, z + 0.1, 0.016, 0.003);
  else put(ctx, c, 'Detail', box([0, u - 0.002, z + 0.1], [0.04, 0.008, 0.02]));
  E.shoulderY = u - 0.005;
};

const noShoulder: PartBuilder = (ctx) => {
  ctx.L.extra.shoulderY = ctx.L.extra.under;
};

export const LAUNCHER_SHOULDERS: Record<string, PartBuilder> = { pad, wire, none: noShoulder };

// ---------------------------------------------------------------------------
// Rockets (the projectile). Built in place, sized to the tube's rocket fit.
// ---------------------------------------------------------------------------

interface Fit { tail: number; nose: number; br: number; hr: number; headLen: number }
type RocketShape = (ctx: BuildContext, c: Component, f: Fit, at: Vec3) => void;

function fins(ctx: BuildContext, c: Component, slot: MaterialSlot, z0: number, z1: number, r0: number, r1: number, n: number, at: Vec3, phase = Math.PI / 4) {
  radial(ctx, c, slot, [[z0, r0], [z1, r0], [z0 + (z1 - z0) * 0.35, r1], [z0, r1]], 0.0022, n, phase, at);
}

const heat: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(1.1);
  const { tail: z0, nose: z1, br, hr } = f;
  const hl = Math.min(f.headLen, (z1 - z0) * 0.55);
  const h0 = z1 - hl;
  const mr = Math.min(br * 0.8, hr);
  put(ctx, c, 'Barrel', lathe([[0, z0 + 0.01], [mr * 0.6, z0 + 0.01], [mr * 0.75, z0], [mr * 0.9, z0 + 0.03], [mr, z0 + 0.05], [mr, h0], [mr * 0.9, h0 + 0.004], [0, h0 + 0.004]], seg), at);
  put(ctx, c, 'Accent', lathe([[0, h0], [mr * 0.95, h0], [hr, h0 + Math.min(0.05, hl * 0.25)], [hr, h0 + hl * 0.5], [hr * 0.45, z1 - hl * 0.12], [hr * 0.22, z1 - hl * 0.1], [hr * 0.16, z1 - 0.004], [0, z1]], seg), at);
  put(ctx, c, 'Trim', lathe([[mr * 0.98, h0 - 0.01], [mr * 1.04, h0 - 0.008], [mr * 1.04, h0 + 0.006], [mr * 0.98, h0 + 0.008]], seg), at);
  fins(ctx, c, 'Detail', z0 + 0.005, z0 + 0.07, mr * 0.6, br * 0.98, 4, at);
};

const slim: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(0.9);
  const { tail: z0, nose: z1, br } = f;
  const r = br * 0.62, nl = Math.max(0.05, Math.min(0.14, (z1 - z0) * 0.25));
  const pts: Vec2[] = [[0, z0], [r * 0.7, z0], [r, z0 + 0.02], [r, z1 - nl]];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    pts.push([r * Math.sqrt(1 - t * t) * (i === 5 ? 0 : 1), z1 - nl + nl * t]);
  }
  put(ctx, c, 'Barrel', lathe(pts.slice(0, 4), seg), at);
  put(ctx, c, 'Accent', lathe([[0, z1 - nl], ...pts.slice(3)], seg), at);
  put(ctx, c, 'Trim', tube(r * 1.04, r * 0.9, z1 - nl - 0.02, z1 - nl - 0.008, seg), at);
  fins(ctx, c, 'Detail', z0 + 0.004, z0 + 0.06, r * 0.9, br * 0.98, 4, at);
  fins(ctx, c, 'Detail', z1 - nl - 0.1, z1 - nl - 0.06, r * 0.9, r * 1.35, 4, at);
};

const bulb: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(1.1);
  const { tail: z0, nose: z1, br, hr } = f;
  const r = br * 0.6, hb = Math.min(hr, br) * 0.98;
  put(ctx, c, 'Barrel', lathe([[0, z0], [r * 0.8, z0], [r, z0 + 0.02], [r, z1 - hb * 2.2], [r * 0.9, z1 - hb * 2.2 + 0.004], [0, z1 - hb * 2.2 + 0.004]], seg), at);
  put(ctx, c, 'Trim', lathe([[r * 0.9, z1 - hb * 2.3], [hb * 0.7, z1 - hb * 1.9], [hb * 0.6, z1 - hb * 1.6], [0, z1 - hb * 1.6]], seg), at);
  put(ctx, c, 'Accent', sphere(hb, z1 - hb, seg), at);
  fins(ctx, c, 'Detail', z0 + 0.004, z0 + 0.07, r * 0.9, br * 0.98, 6, at, 0);
};

const plasma: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(1.1);
  const hr = f.hr;
  const zc = f.nose - hr;
  put(ctx, c, 'Emissive', sphere(hr, zc, seg), at);
  for (const r of [[Math.PI / 2, 0, 0.6], [Math.PI / 2, 0, -0.6]] as Vec3[]) put(ctx, c, 'Emissive', ring(hr * 1.15, hr * 0.04, 0, seg, 4), [at[0], at[1], zc], r);
};

const orb: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(1.4);
  const hr = f.hr;
  const zc = f.nose - hr;
  put(ctx, c, 'Emissive', sphere(hr, zc, seg, 10), at);
  put(ctx, c, 'Glass', sphere(hr * 1.12, zc, seg, 10), at);
  for (const r of [[Math.PI / 2, 0, 0], [Math.PI / 2, Math.PI / 3, 0], [Math.PI / 2, -Math.PI / 3, 0]] as Vec3[]) put(ctx, c, 'Emissive', ring(hr * 1.35, hr * 0.035, 0, seg, 4), [at[0], at[1], zc], r);
};

const firework: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(0.9);
  const { tail: z0, nose: z1, br } = f;
  const r = br * 0.7, len = z1 - z0;
  const b0 = z0 + len * 0.45, n0 = z1 - Math.min(0.09, len * 0.22);
  put(ctx, c, 'Stock', cylinder(Math.max(0.004, r * 0.18), z0, b0 + 0.02, 6), [at[0], at[1] - r * 0.6, 0]);
  put(ctx, c, 'Accent', cylinder(r, b0, n0, seg), at);
  put(ctx, c, 'Trim', lathe([[0, n0], [r * 1.05, n0], [r * 0.3, z1 - 0.008], [0, z1]], seg), at);
  for (const z of [b0 + 0.02, (b0 + n0) / 2, n0 - 0.02]) put(ctx, c, 'Trim', tube(r * 1.03, r * 0.95, z - 0.005, z + 0.005, seg), at);
  put(ctx, c, 'Detail', rod([at[0], at[1], b0], [at[0] + r * 0.4, at[1] + r * 0.3, b0 - 0.05], 0.0015, 4));
  fins(ctx, c, 'Stock', b0 - 0.02, b0 + 0.05, r * 0.9, br * 0.98, 3, at, Math.PI / 2);
};

const spear: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(0.8);
  const { tail: z0, nose: z1 } = f;
  const sr = 0.0055 + f.br * 0.08, hl = 0.1;
  put(ctx, c, 'Detail', cylinder(sr, z0, z1 - hl + 0.01, Math.max(6, seg)), at);
  put(ctx, c, 'Barrel', lathe([[0, z1 - hl], [sr * 1.4, z1 - hl], [sr * 2.6, z1 - hl * 0.55], [sr * 0.5, z1 - 0.006], [0, z1]], 4, Math.PI / 4), at);
  // Barbs fold back from the head.
  for (const zb of [z1 - hl * 0.6, z1 - hl * 1.1]) radial(ctx, c, 'Barrel', [[zb, sr * 0.6], [zb + 0.022, sr * 0.6], [zb - 0.03, sr * 4.2], [zb - 0.032, sr * 3.6]], 0.0024, 2, 0, at);
  // Line eye (the rope ties on here) and a tail stop.
  const ez = ctx.L.extra.ropeZ ?? z0 + (z1 - z0) * 0.6;
  put(ctx, c, 'Trim', tube(sr * 1.8, sr * 0.9, ez - 0.008, ez + 0.008, 8), at);
  put(ctx, c, 'Detail', ring(0.005, 0.0014, 0, 8, 4), [at[0] - sr * 1.8 - 0.003, at[1] - 0.003, ez], [0, Math.PI / 2, 0]);
  put(ctx, c, 'Trim', cylinder(sr * 2.2, z0, z0 + 0.012, 8), at);
};

const crystalBolt: RocketShape = (ctx, c, f, at) => {
  const seg = ctx.seg(0.8);
  const { tail: z0, nose: z1, br, hr } = f;
  const sr = Math.max(0.006, br * 0.32), cl = Math.min(0.12, (z1 - z0) * 0.3);
  put(ctx, c, 'Stock', cylinder(sr, z0, z1 - cl + 0.01, Math.max(6, seg)), at);
  put(ctx, c, 'Trim', lathe([[sr, z1 - cl - 0.01], [sr * 1.6, z1 - cl], [sr * 1.4, z1 - cl + 0.012], [sr, z1 - cl + 0.014]], seg), at);
  crystal(ctx, c, [at[0], at[1], z1 - cl / 2], cl, Math.min(hr, sr * 2.2), undefined, ctx.style.traits.magic ? 'Emissive' : 'Glass');
  fins(ctx, c, 'Accent', z0 + 0.005, z0 + 0.07, sr * 0.8, br * 0.95, 3, at, Math.PI / 2);
};

const ROCKET_SHAPES: Record<string, RocketShape> = { heat, slim, bulb, plasma, firework, spear, orb, crystal: crystalBolt };

function rocketBuilder(shape: string): PartBuilder {
  return (ctx) => {
    const E = ctx.L.extra;
    const c = ctx.b.component('Rocket', {
      kind: 'projectile', variant: shape, pivot: [0, 0, E.rTail],
      motion: { type: 'translate', axis: [0, 0, 1], range: [0, 3], purpose: 'fire (leaves the tube)' },
    });
    const fit: Fit = { tail: E.rTail, nose: E.rNose, br: E.rBr, hr: E.rHr, headLen: E.rHeadLen };
    const n = E.cellN || 1;
    for (let i = 0; i < n; i++) ROCKET_SHAPES[shape](ctx, c, fit, E.cellN ? [E[`cx${i}`], E[`cy${i}`], 0] : [0, 0, 0]);
  };
}

export const LAUNCHER_ROCKETS: Record<string, PartBuilder> = Object.fromEntries(Object.keys(ROCKET_SHAPES).map((k) => [k, rocketBuilder(k)]));

// ---------------------------------------------------------------------------
// Sights: on a bracket on the left side (+X), next to the shooter's eye.
// ---------------------------------------------------------------------------

/** Folding frame sight: a rear peep and a front range frame on a rail. */
const frameSight: OpticBuilder = (ctx, c, y, z) => {
  const zr = z - 0.05, zf = z + 0.13;
  put(ctx, c, 'Sight', box([0, y + 0.004, (zr + zf) / 2], [0.014, 0.008, zf - zr + 0.02], ctx.bevel(0.0015)));
  const ap = y + 0.034;
  put(ctx, c, 'Sight', box([0, (y + 0.008 + ap - 0.004) / 2, zr], [0.008, ap - 0.004 - y - 0.008, 0.006], ctx.bevel(0.001)));
  put(ctx, c, 'Detail', tube(0.006, 0.0022, zr - 0.002, zr + 0.002, 10), [0, ap, 0]);
  const fw = 0.034, fh = 0.032, t = 0.003, fy = ap;
  for (const s of [1, -1]) put(ctx, c, 'Sight', box([s * (fw / 2 - t / 2), fy, zf], [t, fh, 0.004]));
  for (const yy of [fy - fh / 2 + t / 2, fy + fh / 2 - t / 2]) put(ctx, c, 'Sight', box([0, yy, zf], [fw, t, 0.004]));
  put(ctx, c, 'Sight', box([0, (y + 0.008 + fy - fh / 2) / 2, zf], [0.01, fy - fh / 2 - y - 0.008, 0.006]));
  put(ctx, c, 'Detail', box([0, fy - 0.004, zf], [0.0015, fh * 0.55, 0.0015]));
  for (const k of [-1, 0, 1]) put(ctx, c, 'Detail', box([0, fy + 0.004 + k * 0.006, zf], [0.012 - Math.abs(k) * 0.003, 0.0012, 0.0015]));
  return { eyeY: ap, rearZ: zr };
};

export const LAUNCHER_OPTICS: Record<string, OpticBuilder> = { frame: frameSight };
export const LAUNCHER_OPTIC_NAMES = ['frame', 'reddot', 'scope', 'holo', 'brass', 'tube', 'rune', 'lamp', 'smart', 'prism', 'thermal'];

/** Build the sight (or none) on a side bracket, with SOCKET_Optic and SOCKET_ADS. */
export function launcherOptic(ctx: BuildContext, choice: string): void {
  const { L, b } = ctx;
  const E = L.extra;
  const y = 0.014, z = L.opticZ;
  const xo = E.sideX + 0.026;
  b.socket({ name: 'SOCKET_Optic', parent: ROOT, position: [xo, y, z], forward: [0, 0, 1], description: 'Optic mount on the left-side bracket (next to the eye; the tube is on the shoulder).' });
  let eyeY = y + 0.03, rearZ = z - 0.05;
  const T = b.component(ROOT, { kind: 'tube', variant: '-' });
  put(ctx, T, 'Detail', box([(E.sideX * 0.6 + xo + 0.008) / 2, y - 0.007, z], [xo + 0.008 - E.sideX * 0.6, 0.014, 0.05], ctx.bevel(0.002)));
  if (choice !== 'none') {
    const fn = LAUNCHER_OPTICS[choice] ?? OPTIC_BUILDERS[choice];
    if (!fn || !LAUNCHER_OPTIC_NAMES.includes(choice)) throw new Error(`Unknown optic "${choice}". Available: none, ${LAUNCHER_OPTIC_NAMES.join(', ')}`);
    const c = b.component('Optic', { kind: 'optic', variant: choice, pivot: [xo, y, z] });
    ({ eyeY, rearZ } = fn(ctx, c, y, z));
    for (const g of c.geometry.values()) g.transform({ t: [xo, 0, 0] });
  }
  b.socket({ name: 'SOCKET_ADS', parent: ROOT, position: [xo, eyeY, rearZ - 0.07], forward: [0, 0, 1], description: 'Eye position when aiming down sights (place the camera here).' });
}
