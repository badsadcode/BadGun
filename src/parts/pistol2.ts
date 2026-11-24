/**
 * More pistol frames: compact, long target slide, polymer striker, magnum
 * autoloader, derringer, machine pistol, bullpup, coil gun, needler, wand,
 * nail gun, service pistol, rocket "gyro" pistol, cyber holdout and taser.
 *
 * Same conventions as `pistol.ts`: the layout's `rec` is the slide envelope
 * plus the frame bottom, the grip hangs from (grip.z, grip.y), every frame
 * owns a `Frame` root, a `Barrel` (muzzle devices parent to it) and a
 * `Trigger` (via `pistolTrigger` or its own). Per-frame proportions live in
 * `PISTOL2_LAYOUT`, read by the pistol archetype's layout.
 */
import { AXIS_X, Vec2, Vec3, box, cylinder, dome, lathe, ring, rod, smoothPolygon, tube } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, raked, side } from './context.js';
import { gripMagazine, pistolTrigger } from './pistol.js';
import { crystal, runes } from './fantasy.js';

/** Per-frame proportions: slide length (from the `length` param), grip offset from z0, barrel past z1, grip length/rake. */
export interface PistolFrameLayout {
  len: (length: number) => number;
  /** Grip front, measured from the back of the slide (z0). */
  grip: number;
  /** Barrel end beyond the slide/body front (z1). */
  muzzle: number;
  /** Grip length multiplier. */
  gripLen?: number;
  /** Grip rake override (radians). */
  angle?: number;
  /** Raise the slide top by this much. */
  top?: number;
}

export const PISTOL2_LAYOUT: Record<string, PistolFrameLayout> = {
  compact: { len: (l) => 0.145 + l * 0.025, grip: 0.058, muzzle: 0.002, gripLen: 0.8, top: 0.003 },
  longslide: { len: (l) => 0.24 + l * 0.06, grip: 0.07, muzzle: 0 },
  polymer: { len: (l) => 0.18 + l * 0.05, grip: 0.07, muzzle: 0.003 },
  magnum: { len: (l) => 0.21 + l * 0.07, grip: 0.075, muzzle: 0.014, top: 0.008 },
  derringer: { len: (l) => 0.115 + l * 0.03, grip: 0.03, muzzle: 0, gripLen: 0.75, angle: 0.42 },
  machine: { len: (l) => 0.19 + l * 0.05, grip: 0.07, muzzle: 0.03, top: 0.004 },
  bullpup: { len: (l) => 0.22 + l * 0.05, grip: 0.125, muzzle: 0.012, angle: 0.1 },
  coil: { len: (l) => 0.2 + l * 0.06, grip: 0.065, muzzle: 0.022 },
  needler: { len: (l) => 0.19 + l * 0.05, grip: 0.065, muzzle: 0.03 },
  wand: { len: (l) => 0.22 + l * 0.08, grip: 0.04, muzzle: 0.03 },
  nailgun: { len: (l) => 0.19 + l * 0.04, grip: 0.06, muzzle: 0.006 },
  service: { len: (l) => 0.19 + l * 0.05, grip: 0.068, muzzle: 0.004 },
  gyro: { len: (l) => 0.2 + l * 0.06, grip: 0.065, muzzle: 0.012 },
  holdout: { len: (l) => 0.135 + l * 0.02, grip: 0.05, muzzle: 0.001, gripLen: 0.78 },
  taser: { len: (l) => 0.16 + l * 0.03, grip: 0.065, muzzle: 0, top: 0.006 },
};

/** Frames whose nose is not a plain bore: the pistol fixup gives them no muzzle device. */
export const NO_MUZZLE_FRAMES = ['longslide', 'derringer', 'coil', 'needler', 'wand', 'nailgun', 'gyro', 'taser'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function frame(ctx: BuildContext, variant: string): Component {
  return ctx.b.component('Frame', { kind: 'frame', variant, parent: null });
}

function slideComp(ctx: BuildContext, variant: string, travel = 0.04): Component {
  return ctx.b.component('Slide', {
    kind: 'slide', variant, pivot: [0, 0, ctx.L.rec.z0],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, travel], purpose: 'fire (recoil) / rack' },
  });
}

/** Frame under a slide: rear tang, grip top, dust cover ending at `front`. */
function lowerFrame(ctx: BuildContext, f: Component, slot: MaterialSlot, front: number, sb: number, w: number, nose = 0.01): void {
  const { L } = ctx;
  const { z0, bottom } = L.rec;
  const D = L.extra.gripDepth;
  side(ctx, f, slot, [
    [L.grip.z - D - 0.006, sb], [front, sb], [front, sb - 0.006], [front - nose, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.006, sb - 0.002],
  ], w, 0.002);
}

/** Picatinny-style teeth hanging under the dust cover. */
function underRail(ctx: BuildContext, f: Component, slot: MaterialSlot, za: number, zb: number, y: number, width = 0.02): void {
  put(ctx, f, slot, box([0, y - 0.0012, (za + zb) / 2], [width * 0.8, 0.0024, zb - za]));
  for (let z = za + 0.003; z + 0.006 < zb; z += 0.01) put(ctx, f, slot, box([0, y - 0.003, z + 0.0026], [width, 0.0034, 0.0052]));
}

/** Rear notch sight (two posts) and a front blade. */
function sights(ctx: BuildContext, c: Component, y: number, zr: number, zf: number, slot: MaterialSlot = 'Detail', tall = 1): void {
  for (const x of [0.005, -0.005]) put(ctx, c, slot, box([x, y + 0.003 * tall, zr], [0.004, 0.006 * tall, 0.007], ctx.bevel(0.0008)));
  put(ctx, c, slot, box([0, y + 0.0028 * tall, zf], [0.003, 0.0056 * tall, 0.005], ctx.bevel(0.0006)));
  if (ctx.style.traits.glow) put(ctx, c, 'Emissive', box([0, y + 0.0058 * tall, zf], [0.0018, 0.0012, 0.002]));
}

/** Vertical serration grooves across a slide, from z going `dir` (+1 forward). */
function serrations(ctx: BuildContext, c: Component, n: number, z: number, dir: number, y0: number, y1: number, w: number, pitch = 0.0045, thick = 0.0018, lean = 0): void {
  for (let i = 0; i < n; i++) {
    const zz = z + dir * i * pitch;
    put(ctx, c, 'Detail', box([0, 0, 0], [w + 0.0012, y1 - y0, thick]), [0, (y0 + y1) / 2, zz], [lean, 0, 0]);
  }
}

/** Bare barrel tip poking out of a slide. */
function barrelTip(ctx: BuildContext, from: number, r = ctx.L.barrel.radius): Component {
  const { L } = ctx;
  const bar = ctx.b.component('Barrel', { kind: 'barrel', variant: 'pistol', pivot: [0, 0, L.barrel.z0] });
  put(ctx, bar, 'Barrel', tube(r, r * 0.55, from, L.barrel.z1, ctx.seg(0.7)));
  return bar;
}

const glowSlot = (ctx: BuildContext): MaterialSlot => (ctx.style.traits.glow || ctx.style.traits.magic ? 'Emissive' : 'Accent');

/** A magazine in the grip that sticks `extra` meters out of the bottom. */
function longMagazine(ctx: BuildContext, extra: number): void {
  const { L } = ctx;
  const a = L.grip.angle;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'extended', pivot: [0, L.grip.y, L.grip.z - 0.025],
    motion: { type: 'translate', axis: [0, -Math.cos(a), -Math.sin(a)], range: [0, 0.14 + extra], purpose: 'reload' },
  });
  const o: Vec2 = [L.grip.z, L.grip.y];
  const D = L.extra.gripDepth, Lg = L.grip.length, E = Lg + extra;
  side(ctx, m, 'Magazine', raked(o, a, [[0, -0.007], [E, -0.004], [E, -D + 0.005], [0, -D + 0.007]]), 0.02, 0.001);
  // Ribs on the exposed part, and a base plate.
  for (let t = Lg + 0.012; t < E - 0.006; t += 0.012) side(ctx, m, 'Detail', raked(o, a, [[t, -0.003], [t + 0.003, -0.003], [t + 0.003, -D + 0.002], [t, -D + 0.002]]), 0.0215);
  side(ctx, m, 'Detail', raked(o, a, [[E - 0.001, -0.002], [E + 0.007, -0.001], [E + 0.008, -D - 0.001], [E - 0.001, -D + 0.002]]), 0.026, 0.0015);
}

// ---------------------------------------------------------------------------
// Modern
// ---------------------------------------------------------------------------

/** Subcompact: short, tall and squared, flush barrel, wide grooves. */
const compact: PartBuilder = (ctx) => {
  const { L } = ctx;
  const f = frame(ctx, 'compact');
  const { z0, z1, top, width } = L.rec;
  const w = width * 1.08, sb = -0.009;
  const s = slideComp(ctx, 'compact', 0.032);
  const e = 0.0035;
  side(ctx, s, 'Body', [[z0, sb], [z1, sb], [z1, top - e], [z1 - e, top], [z0 + e, top], [z0, top - e]], w, 0.0025);
  const rng = ctx.rng('frame2:compact');
  const n = rng.int(3, 5);
  serrations(ctx, s, n, z0 + 0.008, 1, sb + 0.004, top - 0.004, w, 0.0065, 0.003);
  put(ctx, s, 'Barrel', box([-w * 0.2, top - 0.0015, z0 + (z1 - z0) * 0.55], [w * 0.62, 0.004, 0.03], ctx.bevel(0.0008)));
  sights(ctx, s, top, z0 + 0.008, z1 - 0.008);
  barrelTip(ctx, z1 - 0.02);
  lowerFrame(ctx, f, 'Grip', z1 - 0.006, sb, w * 0.94, 0.006);
  if (ctx.style.traits.rails) underRail(ctx, f, 'Grip', L.grip.z + 0.058, z1 - 0.012, L.rec.bottom, 0.018);
  put(ctx, f, 'Detail', box([w * 0.47, sb - 0.003, L.grip.z + 0.03], [0.002, 0.004, 0.016], ctx.bevel(0.0006)));
  pistolTrigger(ctx, 'Grip', false);
  gripMagazine(ctx);
  L.mountY = top;
};

/** Target pistol: long slide with lightening windows, compensator nose, tall adjustable sight. */
const longslide: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const f = frame(ctx, 'longslide');
  const { z0, z1, top, width: w } = L.rec;
  const sb = -0.008;
  const cz = z1 - 0.036; // compensator starts here
  const s = slideComp(ctx, 'target', 0.045);
  const zA = z0 + 0.075; // solid rear block ends
  side(ctx, s, 'Body', [[z0, sb], [zA, sb], [zA, top], [z0 + 0.004, top], [z0, top - 0.004]], w, 0.002);
  // Windowed front: top and bottom strips with posts between the windows.
  const rib = 0.0055;
  side(ctx, s, 'Body', [[zA, top - rib], [cz - 0.002, top - rib], [cz - 0.002, top - 0.004], [cz - 0.006, top], [zA, top]], w, 0.0015);
  side(ctx, s, 'Body', [[zA, sb], [cz - 0.002, sb], [cz - 0.002, sb + rib], [zA, sb + rib]], w, 0.0015);
  const rng = ctx.rng('frame2:longslide');
  const nWin = rng.int(2, 4);
  const span = cz - 0.002 - zA;
  for (let i = 0; i <= nWin; i++) {
    const z = zA + (i / nWin) * span;
    const pw = i === 0 || i === nWin ? 0.008 : 0.005;
    const zc = i === 0 ? z + pw / 2 : i === nWin ? z - pw / 2 : z;
    put(ctx, s, 'Body', box([0, (top + sb) / 2, zc], [w, top - sb - 0.002, pw]));
  }
  serrations(ctx, s, 6 + Math.round(p.detail * 2), z0 + 0.008, 1, sb + 0.004, top - 0.004, w, 0.004, 0.0016);
  put(ctx, s, 'Barrel', box([-w * 0.2, top - 0.0015, z0 + 0.06], [w * 0.6, 0.004, 0.028], ctx.bevel(0.0008)));
  // Tall adjustable rear sight.
  put(ctx, s, 'Detail', box([0, top + 0.004, z0 + 0.012], [0.016, 0.008, 0.01], ctx.bevel(0.001)));
  put(ctx, s, 'Detail', box([0.009, top + 0.004, z0 + 0.012], [0.003, 0.004, 0.004]));

  // Barrel runs the whole slide (it shows through the windows) into a ported compensator.
  const bar = ctx.b.component('Barrel', { kind: 'barrel', variant: 'target', pivot: [0, 0, L.barrel.z0] });
  const rb = L.barrel.radius;
  put(ctx, bar, 'Barrel', cylinder(rb, zA - 0.01, cz + 0.002, ctx.seg(0.8)));
  const ch = top - sb;
  put(ctx, bar, 'Body', box([0, (top + sb) / 2, (cz + z1) / 2], [w * 0.96, ch, z1 - cz], ctx.bevel(0.003)));
  const ports = rng.int(2, 3);
  for (let i = 0; i < ports; i++) {
    const z = cz + 0.008 + i * ((z1 - cz - 0.014) / Math.max(1, ports - 1)) * (ports > 1 ? 1 : 0);
    put(ctx, bar, 'Detail', box([0, top + 0.0003, z], [w * 0.55, 0.0012, 0.0045]));
  }
  put(ctx, bar, 'Detail', box([0, top + 0.003, z1 - 0.008], [0.003, 0.006, 0.006], ctx.bevel(0.0006)));
  put(ctx, bar, 'Detail', cylinder(rb * 0.7, z1 - 0.0004, z1 + 0.0004, ctx.seg(0.7)));
  lowerFrame(ctx, f, 'Grip', cz - 0.004, sb, w * 0.92);
  if (ctx.style.traits.rails) underRail(ctx, f, 'Grip', L.grip.z + 0.06, cz - 0.014, L.rec.bottom);
  pistolTrigger(ctx, 'Grip', false);
  gripMagazine(ctx);
  L.barrel.radius = rb * 0.9;
  L.mountY = top;
};

/** Angular striker pistol: chamfered nose, angled grooves, optic plate, full rail and a hooked guard. */
const polymer: PartBuilder = (ctx) => {
  const { L } = ctx;
  const f = frame(ctx, 'polymer');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const sb = -0.008;
  const s = slideComp(ctx, 'angular', 0.04);
  side(ctx, s, 'Body', [[z0, sb], [z1 - 0.014, sb], [z1, sb + 0.009], [z1, top - 0.007], [z1 - 0.012, top], [z0 + 0.006, top], [z0, top - 0.007]], w, 0.0025);
  // Narrow top deck: makes the slide read as faceted from the front.
  side(ctx, s, 'Body', [[z0 + 0.01, top - 0.002], [z1 - 0.016, top - 0.002], [z1 - 0.018, top + 0.002], [z0 + 0.012, top + 0.002]], w * 0.62, 0.001);
  const T = top + 0.002;
  serrations(ctx, s, 5, z0 + 0.009, 1, sb + 0.004, top - 0.004, w, 0.005, 0.002, -0.35);
  serrations(ctx, s, 3, z1 - 0.024, -1, sb + 0.006, top - 0.005, w, 0.005, 0.002, 0.35);
  put(ctx, s, 'Barrel', box([-w * 0.2, T - 0.0015, z0 + (z1 - z0) * 0.55], [w * 0.4, 0.004, 0.03], ctx.bevel(0.0008)));
  put(ctx, s, 'Accent', box([0, T + 0.0008, z0 + 0.035], [w * 0.6, 0.0016, 0.028], ctx.bevel(0.0005)));
  sights(ctx, s, T, z0 + 0.008, z1 - 0.012);
  barrelTip(ctx, z1 - 0.03);
  // Frame: full-length dust cover with a step, thumb shelf on the left.
  const D = L.extra.gripDepth;
  side(ctx, f, 'Grip', [
    [L.grip.z - D - 0.006, sb], [z1 - 0.004, sb], [z1 - 0.004, sb - 0.005], [z1 - 0.012, bottom + 0.002], [L.grip.z + 0.05, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.005, sb - 0.001],
  ], w * 0.94, 0.0015);
  put(ctx, f, 'Grip', box([w * 0.5 + 0.001, sb - 0.009, L.grip.z + 0.006], [0.004, 0.003, 0.02], ctx.bevel(0.0008)));
  underRail(ctx, f, 'Grip', L.grip.z + 0.058, z1 - 0.014, bottom + 0.002);
  pistolTrigger(ctx, 'Grip', false);
  // Hook on the front of the guard.
  const g1 = L.grip.z + 0.05;
  put(ctx, f, 'Grip', box([0, bottom - 0.026 + 0.001, g1 + 0.004], [0.012, 0.005, 0.006], ctx.bevel(0.001)));
  gripMagazine(ctx);
  L.mountY = T;
};

/** Big-bore autoloader: tall ridged slab slide, heavy frame, hammer and a thick hex barrel. */
const magnum: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = frame(ctx, 'magnum');
  const { z0, z1, top, bottom, width } = L.rec;
  const w = width * 1.22, sb = -0.01;
  const s = slideComp(ctx, 'slab', 0.05);
  side(ctx, s, 'Body', [[z0, sb], [z1, sb], [z1, top - 0.01], [z1 - 0.008, top - 0.006], [z0 + 0.004, top - 0.006], [z0, top - 0.01]], w, 0.003);
  // Triangular ridge on top.
  side(ctx, s, 'Body', [[z0 + 0.006, top - 0.008], [z1 - 0.01, top - 0.008], [z1 - 0.016, top], [z0 + 0.01, top]], w * 0.55, 0.002);
  serrations(ctx, s, 4, z0 + 0.01, 1, sb + 0.005, top - 0.01, w, 0.007, 0.0028);
  put(ctx, s, 'Barrel', box([-w * 0.22, top - 0.0055, z0 + (z1 - z0) * 0.5], [w * 0.45, 0.004, 0.038], ctx.bevel(0.0008)));
  sights(ctx, s, top, z0 + 0.01, z1 - 0.014);
  // Thick hex barrel standing out of the slide nose.
  const rb = L.barrel.radius * 1.55;
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'hex', pivot: [0, 0, L.barrel.z0] });
  put(ctx, bar, 'Barrel', lathe([[rb * 0.45, z1 - 0.01], [rb, z1 - 0.01], [rb, L.barrel.z1], [rb * 0.45, L.barrel.z1]], 6, Math.PI / 6));
  // Heavy frame: deep dust cover to the nose, squared front.
  const D = L.extra.gripDepth;
  side(ctx, f, 'Body', [
    [L.grip.z - D - 0.006, sb], [z1, sb], [z1, bottom - 0.004], [L.grip.z + 0.054, bottom - 0.004], [L.grip.z + 0.05, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.012, sb - 0.002],
  ], w * 0.95, 0.002);
  put(ctx, f, 'Trim', box([0, bottom - 0.002, (L.grip.z + 0.06 + z1) / 2], [w * 0.7, 0.003, z1 - L.grip.z - 0.07]));
  for (const x of [1, -1]) put(ctx, f, 'Detail', cylinder(0.0025, 0, 0.002, 8), [x * w * 0.48, sb - 0.008, z1 - 0.01], [0, (x * Math.PI) / 2, 0]);
  const hz = z0 - 0.004;
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'ring', pivot: [0, sb - 0.004, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.7], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [[hz + 0.004, sb - 0.008], [hz - 0.002, sb - 0.008], [hz - 0.012, top - 0.008], [hz - 0.004, top - 0.006], [hz + 0.004, sb + 0.002]], 0.008, 0.0015);
  pistolTrigger(ctx, 'Body', false);
  gripMagazine(ctx);
  L.barrel.radius = rb;
  L.mountY = top;
};

/** Machine pistol: tall receiver, long magazine, vented shroud, front grip and a stock lug. */
const machine: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = frame(ctx, 'machine');
  const { z0, z1, top, bottom, width } = L.rec;
  const w = width * 1.1, sb = -0.01;
  const zs = z1 - 0.03;
  const s = slideComp(ctx, 'machine', 0.035);
  side(ctx, s, 'Body', [[z0, sb], [zs, sb], [zs, top - 0.004], [zs - 0.004, top], [z0 + 0.004, top], [z0, top - 0.004]], w, 0.002);
  serrations(ctx, s, 5, z0 + 0.008, 1, sb + 0.004, top - 0.004, w, 0.005, 0.002);
  put(ctx, s, 'Barrel', box([-w * 0.2, top - 0.0015, z0 + (zs - z0) * 0.55], [w * 0.6, 0.004, 0.032], ctx.bevel(0.0008)));
  sights(ctx, s, top, z0 + 0.008, zs - 0.008, 'Detail', 1.3);
  // Vented shroud.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'shroud', pivot: [0, 0, zs] });
  const R = 0.011;
  put(ctx, bar, 'Barrel', lathe([[L.barrel.radius, zs - 0.004], [R, zs - 0.004], [R, L.barrel.z1 - 0.003], [R * 0.8, L.barrel.z1], [L.barrel.radius, L.barrel.z1]], ctx.seg(0.9)));
  for (let z = zs + 0.008; z < L.barrel.z1 - 0.01; z += 0.009) {
    for (const x of [1, -1]) put(ctx, bar, 'Detail', box([x * R * 0.92, 0, z], [0.002, 0.006, 0.004]));
  }
  // Frame to the nose with a selector, stock lug at the back.
  const D = L.extra.gripDepth;
  side(ctx, f, 'Body', [
    [L.grip.z - D - 0.006, sb], [z1, sb], [z1, sb - 0.006], [z1 - 0.008, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.014, sb - 0.004], [z0 - 0.014, sb],
  ], w * 0.95, 0.002);
  put(ctx, f, 'Body', box([0, sb - 0.008, z0 - 0.02], [w * 0.7, 0.012, 0.014], ctx.bevel(0.0015)));
  put(ctx, f, 'Detail', ring(0.0045, 0.0014, 0, ctx.seg(0.6), 5), [0, sb - 0.008, z0 - 0.022], AXIS_X);
  put(ctx, f, 'Accent', box([w * 0.48 + 0.001, sb - 0.006, L.grip.z + 0.004], [0.002, 0.003, 0.012]));
  // Front grip: a hinge block and a post angled slightly forward.
  const fz = z1 - 0.022, fy = bottom;
  put(ctx, f, 'Body', box([0, fy - 0.003, fz], [0.016, 0.008, 0.02], ctx.bevel(0.0015)));
  const post = smoothPolygon([[fz - 0.008, fy - 0.004], [fz + 0.009, fy - 0.004], [fz + 0.016, fy - 0.05], [fz + 0.012, fy - 0.056], [fz - 0.002, fy - 0.056], [fz - 0.002, fy - 0.03]], 1);
  side(ctx, f, 'Grip', post, 0.022, 0.004);
  pistolTrigger(ctx, 'Body', false);
  longMagazine(ctx, 0.06);
  L.mountY = top;
};

/** Bullpup pistol: boxy shell with the magazine behind the grip. */
const bullpup: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = frame(ctx, 'bullpup');
  const { z0, z1, top, bottom, width } = L.rec;
  const w = width * 1.15, T = top + 0.01;
  const D = L.extra.gripDepth;
  side(ctx, f, 'Body', [
    [z0 - 0.006, T - 0.01], [z0 + 0.008, T], [z1 - 0.03, T], [z1 - 0.004, T - 0.014], [z1, -0.012], [z1 - 0.01, bottom],
    [L.grip.z - 0.004, bottom], [L.grip.z - D - 0.002, bottom + 0.004], [z0, bottom + 0.004], [z0 - 0.008, bottom + 0.014],
  ], w, 0.004);
  side(ctx, f, 'Trim', [[z0 + 0.02, T - 0.006], [z1 - 0.05, T - 0.006], [z1 - 0.056, -0.002], [z0 + 0.024, -0.002]], w + 0.002, 0.001);
  put(ctx, f, 'Detail', box([-w / 2, T - 0.012, z0 + 0.03], [0.002, 0.008, 0.03]));
  // Flat top channel for sights.
  put(ctx, f, 'Body', box([0, T + 0.002, (z0 + z1) / 2 - 0.01], [0.012, 0.004, z1 - z0 - 0.05], ctx.bevel(0.001)));
  sights(ctx, f, T + 0.004, z0 + 0.02, z1 - 0.04);
  // Magwell lip and the magazine behind the grip.
  const mz0 = z0 + 0.006, mz1 = L.grip.z - D - 0.01, mt = bottom + 0.012;
  put(ctx, f, 'Detail', box([0, bottom - 0.0015, (mz0 + mz1) / 2], [0.022, 0.006, mz1 - mz0 + 0.006], ctx.bevel(0.001)));
  const m = b.component('Magazine', {
    kind: 'magazine', variant: 'rear', pivot: [0, bottom, (mz0 + mz1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.13], purpose: 'reload' },
  });
  const ml = 0.05 + ctx.p.bulk * 0.015;
  side(ctx, m, 'Magazine', [[mz0 + 0.002, mt], [mz1 - 0.002, mt], [mz1 - 0.003, bottom - ml], [mz0 + 0.001, bottom - ml]], 0.018, 0.001);
  side(ctx, m, 'Detail', [[mz0 - 0.001, bottom - ml + 0.002], [mz1 + 0.001, bottom - ml + 0.002], [mz1 + 0.001, bottom - ml - 0.005], [mz0 - 0.001, bottom - ml - 0.005]], 0.022, 0.0015);
  // Charging knob on the left.
  const ch = b.component('ChargingHandle', {
    kind: 'charging_handle', variant: 'knob', pivot: [w / 2, 0.004, z1 - 0.06],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.05], purpose: 'charge' },
  });
  put(ctx, ch, 'Detail', cylinder(0.003, 0, 0.008, 8), [w / 2 + 0.0005, 0.004, z1 - 0.06], AXIS_X);
  put(ctx, f, 'Detail', box([w / 2, 0.004, z1 - 0.085], [0.0012, 0.0025, 0.055]));
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'stub', pivot: [0, 0, z1] });
  put(ctx, bar, 'Barrel', tube(L.barrel.radius * 1.2, L.barrel.radius * 0.6, z1 - 0.004, L.barrel.z1, ctx.seg(0.8)));
  pistolTrigger(ctx, 'Body', false);
  L.mountY = T + 0.004;
  L.opticZ = (z0 + z1) / 2;
};

// ---------------------------------------------------------------------------
// Sci-fi
// ---------------------------------------------------------------------------

/** Coil gun: an open skeleton of two rails, rings of coil around a glowing core. */
const coil: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'coil');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const zb = L.grip.z + 0.056; // solid block ends
  const glow = glowSlot(ctx);
  side(ctx, f, 'Body', smoothPolygon([
    [z0 - 0.004, top - 0.006], [z0 + 0.006, top], [zb, top], [zb, -0.012], [zb - 0.008, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.004], [z0 - 0.006, -0.006],
  ], p.smoothness > 0.4 ? 1 : 0), w * 1.1, 0.003);
  // Top and bottom rails to the front plate.
  const ty = top - 0.003, by = -0.0145;
  side(ctx, f, 'Body', [[zb - 0.004, ty - 0.003], [z1 - 0.004, ty - 0.003], [z1, ty], [z1 - 0.004, top + 0.001], [zb - 0.004, top + 0.001]], w * 0.45, 0.001);
  side(ctx, f, 'Body', [[zb - 0.004, by - 0.004], [z1 - 0.004, by - 0.004], [z1, by - 0.001], [z1 - 0.004, by + 0.001], [zb - 0.004, by + 0.001]], w * 0.45, 0.001);
  side(ctx, f, 'Trim', [[z1 - 0.008, by - 0.004], [z1, by - 0.004], [z1, top + 0.001], [z1 - 0.008, top + 0.001]], w * 0.9, 0.0015);
  // Core and coils.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'coil', pivot: [0, 0, zb] });
  const seg = ctx.seg(0.9);
  put(ctx, bar, glow, cylinder(0.0042, zb - 0.004, z1 - 0.004, seg));
  put(ctx, bar, 'Glass', cylinder(0.0058, zb - 0.002, z1 - 0.008, seg));
  const nRings = 4 + Math.round(p.detail * 3);
  const slot: MaterialSlot = ctx.style.traits.plumbing ? 'Accent' : 'Trim';
  for (let i = 0; i < nRings; i++) {
    const z = zb + 0.008 + (i / Math.max(1, nRings - 1)) * (z1 - zb - 0.024);
    put(ctx, bar, slot, ring(0.0088, 0.0021, z, seg, 5));
  }
  // Emitter nose.
  const R = L.barrel.radius * 1.2;
  put(ctx, bar, 'Barrel', lathe([[R * 0.5, z1], [R * 1.25, z1], [R, L.barrel.z1 - 0.004], [R * 0.6, L.barrel.z1]], seg));
  put(ctx, bar, glow, cylinder(R * 0.55, L.barrel.z1 - 0.006, L.barrel.z1 + 0.0004, seg));
  // Vents on the block.
  for (let i = 0; i < 3; i++) put(ctx, f, 'Detail', box([0, top * 0.5, z0 + 0.012 + i * 0.006], [w * 1.1 + 0.001, 0.008, 0.0022]));
  pistolTrigger(ctx, 'Body', true);
  gripMagazine(ctx, ctx.style.traits.glow ? 'Emissive' : 'Magazine');
  L.mountY = top + 0.001;
};

/** Needler: an organic hull with a fan of crystal needles on top (the magazine lifts out). */
const needler: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'needler');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const glow = glowSlot(ctx);
  side(ctx, f, 'Body', smoothPolygon([
    [z0 - 0.012, top - 0.002], [z0 + 0.02, top + 0.004], [z1 - 0.05, top - 0.002], [z1, 0.002], [z1 - 0.008, -0.01], [L.grip.z + 0.07, bottom - 0.004],
    [L.grip.z - 0.004, bottom], [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.004], [z0 - 0.01, -0.008],
  ], 2), w * 1.2, 0.006);
  side(ctx, f, 'Accent', smoothPolygon([[z0 + 0.005, -0.004], [z1 - 0.03, -0.006], [z1 - 0.012, -0.002], [z1 - 0.03, 0.004], [z0 + 0.01, 0.004]], 1), w * 1.2 + 0.003, 0.001);
  // Spiny side ridges.
  for (let i = 0; i < 3; i++) {
    const z = z0 + 0.03 + i * 0.022;
    side(ctx, f, 'Accent', [[z, top - 0.004], [z + 0.012, top - 0.006], [z - 0.008, top + 0.004]], w * 1.2 + 0.006, 0.0005);
  }
  // Needle magazine: a slotted cradle of crystals on the spine.
  const mz0 = z0 + 0.03, mz1 = z1 - 0.05, my = top;
  const m = b.component('Magazine', {
    kind: 'magazine', variant: 'needles', pivot: [0, my, (mz0 + mz1) / 2],
    motion: { type: 'translate', axis: [0, 1, 0], range: [0, 0.05], purpose: 'reload' },
  });
  put(ctx, m, 'Magazine', box([0, my + 0.002, (mz0 + mz1) / 2], [0.012, 0.006, mz1 - mz0], ctx.bevel(0.0015)));
  const n = 5 + Math.round(p.detail * 3);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const z = mz0 + 0.006 + u * (mz1 - mz0 - 0.012);
    const h = 0.012 + Math.sin(u * Math.PI) * 0.016;
    side(ctx, m, 'Glass', [[z - 0.0025, my + 0.004], [z + 0.0025, my + 0.004], [z - h * 0.45, my + 0.004 + h]], 0.004);
    side(ctx, m, glow, [[z - 0.001, my + 0.004], [z + 0.001, my + 0.004], [z - h * 0.35, my + 0.004 + h * 0.75]], 0.0015);
  }
  // Barrel: a slim pointed spike.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'needle', pivot: [0, 0, z1] });
  const r = L.barrel.radius;
  put(ctx, bar, 'Barrel', lathe([[0, z1 - 0.02], [r * 1.3, z1 - 0.012], [r * 0.9, L.barrel.z1 - 0.004], [r * 0.5, L.barrel.z1]], ctx.seg(0.8)));
  put(ctx, bar, glow, cylinder(r * 0.45, L.barrel.z1 - 0.003, L.barrel.z1 + 0.0004, ctx.seg(0.6)));
  pistolTrigger(ctx, 'Body', true);
  L.barrel.radius = r * 0.6;
  L.mountY = top + 0.006;
  L.opticZ = z0 + 0.02;
};

/** Cyber holdout: a tiny faceted wedge with neon edge lines. */
const holdout: PartBuilder = (ctx) => {
  const { L } = ctx;
  const f = frame(ctx, 'holdout');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const sb = -0.008;
  const neon = glowSlot(ctx);
  const s = slideComp(ctx, 'wedge', 0.028);
  side(ctx, s, 'Body', [[z0, sb], [z1 - 0.004, sb], [z1, sb + 0.004], [z1 - 0.022, top], [z0 + 0.012, top + 0.002], [z0, top - 0.006]], w, 0.0015);
  side(ctx, s, neon, [[z0 + 0.012, top - 0.004], [z1 - 0.026, top - 0.005], [z1 - 0.026, top - 0.0035], [z0 + 0.012, top - 0.0025]], w + 0.0016);
  put(ctx, s, 'Detail', box([0, (sb + top) / 2, z0 + 0.008], [w + 0.0012, top - sb - 0.006, 0.006]));
  sights(ctx, s, top, z0 + 0.016, z1 - 0.028, 'Detail', 0.7);
  barrelTip(ctx, z1 - 0.015);
  const D = L.extra.gripDepth;
  side(ctx, f, 'Grip', [
    [L.grip.z - D - 0.006, sb], [z1 - 0.004, sb], [z1 - 0.012, bottom + 0.004], [L.grip.z + 0.05, bottom],
    [L.grip.z - 0.004, bottom], [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.012, sb + 0.002],
  ], w * 0.94, 0.0012);
  side(ctx, f, neon, [[L.grip.z + 0.056, sb - 0.006], [z1 - 0.012, sb - 0.003], [z1 - 0.014, sb - 0.0045], [L.grip.z + 0.056, sb - 0.0075]], w * 0.94 + 0.0016);
  if (ctx.style.traits.rails) underRail(ctx, f, 'Grip', L.grip.z + 0.06, z1 - 0.016, bottom + 0.003, 0.016);
  pistolTrigger(ctx, 'Grip', false);
  gripMagazine(ctx);
  L.mountY = top;
};

/** Taser: bright blocky body, a front cartridge with two dart bays and electrodes. */
const taser: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = frame(ctx, 'taser');
  const { z0, z1, top, bottom, width } = L.rec;
  const w = width * 1.3;
  const zc = z1 - 0.034; // cartridge starts here
  const D = L.extra.gripDepth;
  side(ctx, f, 'Accent', smoothPolygon([
    [z0 - 0.004, top - 0.008], [z0 + 0.008, top], [zc + 0.004, top], [zc + 0.004, bottom + 0.002], [L.grip.z + 0.054, bottom],
    [L.grip.z - 0.004, bottom], [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.008, bottom + 0.012],
  ], 1), w, 0.004);
  side(ctx, f, 'Body', [[z0 + 0.01, -0.006], [zc - 0.004, -0.006], [zc - 0.004, 0.002], [z0 + 0.014, 0.002]], w + 0.002, 0.0008);
  // Status LED and an arc window on top.
  put(ctx, f, 'Emissive', box([0, top + 0.0005, z0 + 0.016], [0.006, 0.0014, 0.006]));
  put(ctx, f, 'Glass', box([0, top + 0.0004, z0 + 0.04], [0.012, 0.0012, 0.03]));
  sights(ctx, f, top, z0 + 0.008, zc - 0.006, 'Detail', 0.8);
  put(ctx, f, 'Detail', box([w / 2, 0.006, z0 + 0.024], [0.002, 0.004, 0.01], ctx.bevel(0.0006)));
  // Bay sleeve around the cartridge (the "barrel" the muzzle socket hangs from).
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'bay', pivot: [0, 0, zc] });
  put(ctx, bar, 'Body', box([0, top - 0.002, (zc + z1) / 2 - 0.001], [w, 0.004, z1 - zc - 0.002], ctx.bevel(0.001)));
  put(ctx, bar, 'Body', box([0, bottom + 0.004, (zc + z1) / 2 - 0.001], [w, 0.004, z1 - zc - 0.002], ctx.bevel(0.001)));
  // Cartridge: slides forward out of the bay.
  const ct = top - 0.004, cb = bottom + 0.006;
  const m = b.component('Magazine', {
    kind: 'magazine', variant: 'cartridge', pivot: [0, (ct + cb) / 2, zc],
    motion: { type: 'translate', axis: [0, 0, 1], range: [0, 0.06], purpose: 'reload' },
  });
  put(ctx, m, 'Magazine', box([0, (ct + cb) / 2, (zc + z1) / 2], [w * 0.92, ct - cb, z1 - zc], ctx.bevel(0.0015)));
  const yA = ct - (ct - cb) * 0.3, yB = cb + (ct - cb) * 0.3;
  for (const y of [yA, yB]) {
    put(ctx, m, 'Detail', box([0, y, z1 + 0.0004], [w * 0.62, (ct - cb) * 0.28, 0.0012]));
    for (const x of [1, -1]) put(ctx, m, 'Trim', cylinder(0.0014, z1, z1 + 0.003, 6), [x * w * 0.38, y, 0]);
  }
  // A little arc between the electrodes.
  put(ctx, m, 'Emissive', box([0, 0, 0], [0.001, (yA - yB) * 0.6, 0.0008]), [w * 0.38, (yA + yB) / 2, z1 + 0.0012], [0, 0, 0.3]);
  put(ctx, m, 'Emissive', box([0, 0, 0], [0.001, (yA - yB) * 0.6, 0.0008]), [-w * 0.38, (yA + yB) / 2, z1 + 0.0012], [0, 0, -0.3]);
  // Laser window under the bay.
  put(ctx, f, 'Glass', cylinder(0.0035, 0, 0.002, 10), [0, bottom - 0.002, zc + 0.0045]);
  put(ctx, f, 'Accent', box([0, bottom - 0.002, zc - 0.006], [0.012, 0.01, 0.022], ctx.bevel(0.0015)));
  pistolTrigger(ctx, 'Accent', true);
  L.barrel.z1 = z1;
  L.mountY = top;
};

// ---------------------------------------------------------------------------
// Steampunk / fantasy / period
// ---------------------------------------------------------------------------

/** Over-under pocket derringer: spur trigger, two barrels that tip down to load. */
const derringer: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'derringer');
  const { z0, z1, bottom, width } = L.rec;
  const w = width * 0.85;
  const rb = L.barrel.radius * 1.15 + 0.0012;
  const lowY = -2 * rb - 0.0015;
  const zb = z0 + 0.04; // breech face
  const top2 = rb + 0.003;
  const lugB = lowY - rb - 0.006;
  // Override the trigger spot: the spur trigger sits right under the breech.
  L.trigger.z = zb - 0.006;
  const metal: MaterialSlot = ctx.style.traits.plumbing ? 'Trim' : 'Body';
  side(ctx, f, metal, smoothPolygon([
    [z0 - 0.01, rb * 0.2], [z0 + 0.004, top2], [zb, top2], [zb, lowY - rb], [zb + 0.016, lowY - rb], [zb + 0.016, lugB],
    [zb - 0.004, Math.min(lugB, bottom)], [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.002], [z0 - 0.014, -0.006],
  ], 1), w, 0.002);
  // Spur sheath and trigger.
  const zt = L.trigger.z, yt = Math.min(lugB, bottom);
  side(ctx, f, metal, [[zt - 0.006, yt + 0.001], [zt + 0.008, yt + 0.001], [zt + 0.004, yt - 0.007], [zt - 0.004, yt - 0.007]], 0.008, 0.001);
  const trig = b.component('Trigger', {
    kind: 'trigger', variant: 'spur', pivot: [0, yt, zt],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.3], purpose: 'fire' },
  });
  side(ctx, trig, 'Detail', [[zt - 0.003, yt], [zt + 0.003, yt], [zt + 0.002, yt - 0.013], [zt - 0.003, yt - 0.016], [zt - 0.005, yt - 0.013]], 0.005, 0.0008);
  // Barrels on a hinge at the front of the lug.
  const pz = zb + 0.016, py = lowY - rb - 0.001;
  const bar = b.component('Barrel', {
    kind: 'barrel', variant: 'over-under', pivot: [0, py, pz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.75], purpose: 'break open to reload' },
  });
  const seg = ctx.seg(0.8);
  for (const y of [0, lowY]) put(ctx, bar, 'Barrel', tube(rb, rb * 0.6, zb + 0.0005, z1, seg), [0, y, 0]);
  put(ctx, bar, 'Barrel', box([0, lowY / 2, (zb + z1) / 2], [rb * 0.9, -lowY, z1 - zb - 0.002]));
  // Top rib with a bead sight, and a hinge pin.
  put(ctx, bar, metal, box([0, rb + 0.001, (zb + z1) / 2], [rb * 0.7, 0.003, z1 - zb - 0.004], ctx.bevel(0.0006)));
  put(ctx, bar, 'Detail', dome(0.0016, 0.0018, 8, 2), [0, rb + 0.0025, z1 - 0.005], [-Math.PI / 2, 0, 0]);
  put(ctx, f, 'Detail', cylinder(0.0028, -w * 0.55, w * 0.55, 8), [0, py, pz], AXIS_X);
  if (p.ornament > 0.4) for (const z of [zb + 0.004, z1 - 0.004]) put(ctx, bar, 'Trim', box([0, lowY / 2, z], [rb * 2.1, -lowY + rb * 2.1, 0.0025], ctx.bevel(0.0006)));
  ctx.b.socket({ name: 'SOCKET_Muzzle_2', parent: 'Barrel', position: [0, lowY, z1], forward: [0, 0, 1], description: 'Lower barrel muzzle.' });
  // Spur hammer.
  const hz = z0 + 0.002, hy = top2 - 0.002;
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'spur', pivot: [0, hy - 0.008, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.7], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [[hz + 0.004, hy - 0.012], [hz - 0.004, hy - 0.012], [hz - 0.01, hy + 0.002], [hz - 0.017, hy + 0.008], [hz - 0.016, hy + 0.012], [hz - 0.004, hy + 0.004], [hz + 0.004, hy - 0.002]], 0.006, 0.001);
  L.barrel.radius = rb;
  L.mountY = rb + 0.0025;
  L.opticZ = (zb + z1) / 2;
  L.extra.revolver = 1;
};

/** Wizard's wand pistol: carved, banded wooden shaft with a crystal held in prongs. */
const wand: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'wand');
  const { z0, z1, bottom, width: w } = L.rec;
  const seg = Math.max(8, ctx.seg(0.6));
  const r0 = 0.012 + p.bulk * 0.002, r1 = 0.0065;
  // Wooden body: the lower part that holds the grip and trigger.
  side(ctx, f, 'Stock', smoothPolygon([
    [z0 - 0.016, 0.004], [z0 + 0.03, r0 * 0.4], [L.grip.z + 0.07, -r0 * 0.6], [L.grip.z + 0.05, bottom + 0.002], [L.grip.z - 0.004, bottom],
    [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.004], [z0 - 0.02, -0.008],
  ], 2), w * 0.95, 0.004);
  // Shaft: a tapering octagon with carved bands.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'wand', pivot: [0, 0, z0] });
  const r = (z: number) => r0 + (r1 - r0) * ((z - z0) / (z1 - z0));
  put(ctx, bar, 'Stock', lathe([[0, z0 - 0.022], [r0 * 0.7, z0 - 0.02], [r0 * 1.05, z0 - 0.008], [r0, z0], [r1, z1], [0, z1]], 8, Math.PI / 8));
  const bands = [z0 - 0.006, z0 + (z1 - z0) * 0.45, z1 - 0.008];
  for (const z of bands) put(ctx, bar, 'Trim', lathe([[r(z), z - 0.003], [r(z) * 1.18, z - 0.002], [r(z) * 1.18, z + 0.002], [r(z), z + 0.003]], seg));
  put(ctx, bar, 'Trim', dome(r0 * 0.75, r0 * 0.5, seg, 3), [0, 0, z0 - 0.022], [Math.PI, 0, 0]);
  runes(ctx, bar, 'wand', r0 * 0.88, z0 + 0.012, z0 + (z1 - z0) * 0.42, 0, r0 * 0.9);
  // Crystal held by three prongs.
  const cl = L.barrel.z1 - z1;
  const glow: MaterialSlot = ctx.style.traits.magic || ctx.style.traits.glow ? 'Emissive' : 'Glass';
  crystal(ctx, bar, [0, 0, z1 + cl * 0.5], cl, r1 * 1.25, undefined, glow);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const A: Vec3 = [Math.cos(a) * r1 * 0.9, Math.sin(a) * r1 * 0.9, z1 - 0.004];
    const B: Vec3 = [Math.cos(a) * r1 * 1.4, Math.sin(a) * r1 * 1.4, z1 + cl * 0.45];
    put(ctx, bar, 'Trim', rod(A, B, 0.0012, 6));
  }
  pistolTrigger(ctx, 'Trim', true);
  L.barrel.radius = r1;
  L.mountY = r0 + 0.002;
};

/** Service pistol: plain steel slide, barrel bushing, exposed hammer, grip safety and lanyard ring. */
const service: PartBuilder = (ctx) => {
  const { L, b } = ctx;
  const f = frame(ctx, 'service');
  const { z0, z1, top, bottom, width } = L.rec;
  const w = width * 0.9, sb = -0.008;
  const s = slideComp(ctx, 'service', 0.04);
  side(ctx, s, 'Body', [[z0, sb], [z1, sb], [z1, top - 0.003], [z1 - 0.003, top], [z0 + 0.003, top], [z0, top - 0.003]], w, 0.0025);
  serrations(ctx, s, 8, z0 + 0.006, 1, sb + 0.004, top - 0.003, w, 0.0028, 0.0012);
  put(ctx, s, 'Barrel', box([-w * 0.22, top - 0.0015, z0 + (z1 - z0) * 0.6], [w * 0.55, 0.004, 0.028], ctx.bevel(0.0006)));
  sights(ctx, s, top, z0 + 0.008, z1 - 0.01, 'Detail', 0.75);
  const bar = barrelTip(ctx, z1 - 0.012, L.barrel.radius * 0.95);
  put(ctx, bar, 'Barrel', lathe([[L.barrel.radius, z1 - 0.004], [L.barrel.radius * 1.7, z1 - 0.004], [L.barrel.radius * 1.7, z1 + 0.0015], [L.barrel.radius, z1 + 0.0015]], ctx.seg(0.8)));
  // Steel frame, long slide stop, grip safety tang.
  const D = L.extra.gripDepth;
  side(ctx, f, 'Body', [
    [L.grip.z - D - 0.004, sb], [z1 - 0.008, sb], [z1 - 0.008, sb - 0.005], [z1 - 0.016, bottom + 0.002], [L.grip.z - 0.004, bottom],
    [L.grip.z - D - 0.002, bottom + 0.004], [z0 - 0.006, sb - 0.002],
  ], w * 0.96, 0.0015);
  side(ctx, f, 'Body', [[z0 - 0.002, sb - 0.001], [z0 + 0.004, sb - 0.012], [L.grip.z - D - 0.004, bottom + 0.002], [z0 - 0.016, sb - 0.006], [z0 - 0.014, sb - 0.002]], w * 0.8, 0.0015);
  put(ctx, f, 'Detail', box([w * 0.5 + 0.001, sb - 0.003, L.grip.z + 0.02], [0.002, 0.004, 0.032], ctx.bevel(0.0006)));
  put(ctx, f, 'Detail', cylinder(0.0028, 0, 0.002, 8), [w * 0.5 + 0.001, sb - 0.003, L.grip.z + 0.04], AXIS_X);
  // Lanyard ring at the heel of the grip.
  const a = L.grip.angle, Lg = L.grip.length;
  const [lz, ly] = raked([L.grip.z, L.grip.y], a, [[Lg + 0.006, -D + 0.002]])[0];
  put(ctx, f, 'Detail', ring(0.0055, 0.0011, 0, ctx.seg(0.7), 5), [0, ly, lz], AXIS_X);
  // Exposed hammer.
  const hz = z0 - 0.004;
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'spur', pivot: [0, sb - 0.004, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.7], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [[hz + 0.003, sb - 0.007], [hz - 0.003, sb - 0.007], [hz - 0.011, top - 0.002], [hz - 0.013, top - 0.006], [hz + 0.003, sb + 0.002]], 0.006, 0.001);
  pistolTrigger(ctx, 'Body', false);
  gripMagazine(ctx);
  L.mountY = top;
};

/** Rocket pistol: streamlined frame and a fat finned launch tube. */
const gyro: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'gyro');
  const { z0, bottom, width: w } = L.rec;
  const R = 0.012 + p.bulk * 0.003;
  side(ctx, f, 'Body', smoothPolygon([
    [z0 - 0.012, R * 0.6], [z0 + 0.02, R * 0.9], [z0 + 0.05, -R * 0.4], [L.grip.z + 0.07, bottom], [L.grip.z - 0.004, bottom],
    [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.004], [z0 - 0.016, -0.004],
  ], 1), w * 1.05, 0.004);
  // Chrome speed lines on the body.
  for (let i = 0; i < 3; i++) {
    const y = -0.004 - i * 0.005;
    side(ctx, f, 'Trim', [[z0 + i * 0.008, y - 0.001], [z0 + 0.06 - i * 0.008, y - 0.001], [z0 + 0.063 - i * 0.008, y + 0.001], [z0 + i * 0.008, y + 0.001]], w * 1.05 + 0.002);
  }
  // Swept tail fin.
  side(ctx, f, 'Accent', [[z0 - 0.012, R * 0.4], [z0 + 0.02, R * 0.8], [z0 + 0.008, R + 0.012], [z0 - 0.006, R + 0.012]], 0.004, 0.001);
  // Launch tube with cooling rings and a flared mouth.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'tube', pivot: [0, 0, z0] });
  const seg = ctx.seg(1);
  const zt0 = z0 + 0.012;
  put(ctx, bar, 'Barrel', lathe([[R * 0.5, zt0 - 0.006], [R * 0.9, zt0 - 0.004], [R, zt0 + 0.004], [R, L.barrel.z1 - 0.012], [R * 1.25, L.barrel.z1 - 0.002], [R * 1.25, L.barrel.z1], [R * 0.75, L.barrel.z1], [R * 0.75, L.barrel.z1 - 0.012]], seg));
  const nr = 3 + Math.round(p.detail * 3);
  for (let i = 0; i < nr; i++) {
    const z = z0 + 0.07 + i * 0.008;
    if (z > L.barrel.z1 - 0.02) break;
    put(ctx, bar, 'Trim', lathe([[R, z - 0.002], [R * 1.15, z - 0.0015], [R * 1.15, z + 0.0015], [R, z + 0.002]], seg));
  }
  // Four little stabilizer fins at the mouth.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    put(ctx, bar, 'Accent', box([0, 0, 0], [0.0018, 0.006, 0.018]), [Math.cos(a) * (R + 0.002), Math.sin(a) * (R + 0.002), L.barrel.z1 - 0.022], [0, 0, a - Math.PI / 2]);
  }
  sights(ctx, bar, R, z0 + 0.03, L.barrel.z1 - 0.03, 'Detail', 0.8);
  if (ctx.style.traits.rivets) for (const z of [z0 + 0.03, z0 + 0.05]) for (const x of [1, -1]) put(ctx, f, 'Trim', dome(0.0018, 0.001, 6, 2), [x * w * 0.525, -R * 0.9, z], [0, (x * Math.PI) / 2, 0]);
  pistolTrigger(ctx, 'Trim', true);
  gripMagazine(ctx);
  L.barrel.radius = R * 0.75;
  L.mountY = R + 0.001;
};

// ---------------------------------------------------------------------------
// Scrap
// ---------------------------------------------------------------------------

/** Nail gun: a power-tool shell with a motor cap, battery under the grip and an angled nail strip. */
const nailgun: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = frame(ctx, 'nailgun');
  const { z0, z1, top, bottom, width } = L.rec;
  const w = width * 1.25, T = top + 0.014;
  const zn = z1 - 0.026; // nose starts here
  side(ctx, f, 'Accent', smoothPolygon([
    [z0, T - 0.014], [z0 + 0.012, T], [zn - 0.006, T - 0.002], [zn, T - 0.01], [zn, -0.014], [L.grip.z + 0.06, bottom],
    [L.grip.z - 0.004, bottom], [L.grip.z - L.extra.gripDepth - 0.002, bottom + 0.004], [z0, bottom + 0.012],
  ], 1), w, 0.005);
  // Motor cap with vents at the back.
  const seg = ctx.seg(0.9);
  const yc = (T + bottom) / 2 + 0.006, rc = (T - bottom) * 0.4;
  put(ctx, f, 'Body', lathe([[0, z0 - 0.012], [rc * 0.8, z0 - 0.011], [rc, z0 - 0.005], [rc, z0 + 0.006]], seg), [0, yc, 0]);
  for (let i = 0; i < 4; i++) put(ctx, f, 'Detail', box([0, yc - rc * 0.5 + i * rc * 0.33, z0 - 0.0115], [rc * 1.1, 0.0016, 0.002]));
  for (let i = 0; i < 4; i++) put(ctx, f, 'Detail', box([0, T - 0.007, z0 + 0.02 + i * 0.007], [w + 0.001, 0.006, 0.0022]));
  // Brand-less label plate and screws.
  side(ctx, f, 'Body', [[z0 + 0.05, 0.0], [zn - 0.02, 0.0], [zn - 0.024, T - 0.012], [z0 + 0.054, T - 0.012]], w + 0.002, 0.0008);
  // Driver nose and contact tip.
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'driver', pivot: [0, 0, zn] });
  put(ctx, bar, 'Body', box([0, -0.004, (zn + z1) / 2], [w * 0.6, 0.028, z1 - zn], ctx.bevel(0.002)));
  put(ctx, bar, 'Detail', box([0, -0.0015, z1 + 0.002], [0.008, 0.012, 0.004], ctx.bevel(0.0008)));
  put(ctx, bar, 'Barrel', tube(L.barrel.radius * 0.9, L.barrel.radius * 0.45, z1, L.barrel.z1, ctx.seg(0.6)));
  // Nail strip angled down and back under the nose.
  const sa: Vec2 = [zn + 0.012, -0.012], sbt: Vec2 = [L.grip.z + 0.07, bottom - 0.032];
  const dz = sbt[0] - sa[0], dy = sbt[1] - sa[1];
  const len = Math.hypot(dz, dy), ang = Math.atan2(-dy, -dz);
  const mid: Vec3 = [0, (sa[1] + sbt[1]) / 2, (sa[0] + sbt[0]) / 2];
  put(ctx, f, 'Body', box([0, 0, 0], [0.012, 0.012, len], ctx.bevel(0.001)), mid, [-ang, 0, 0]);
  const nails = 5 + Math.round(p.detail * 4);
  for (let i = 0; i < nails; i++) {
    const u = (i + 0.5) / nails;
    put(ctx, f, 'Detail', box([0, 0, 0], [0.0135, 0.008, 0.0015]), [0, sa[1] + dy * u, sa[0] + dz * u], [-ang, 0, 0]);
  }
  pistolTrigger(ctx, 'Body', false);
  // Battery pack under the grip: slides off along the grip axis.
  const a = L.grip.angle, Lg = L.grip.length, D = L.extra.gripDepth;
  const o: Vec2 = [L.grip.z, L.grip.y];
  const m = b.component('Magazine', {
    kind: 'magazine', variant: 'battery', pivot: [0, L.grip.y, L.grip.z - D / 2],
    motion: { type: 'translate', axis: [0, -Math.cos(a), -Math.sin(a)], range: [0, 0.06], purpose: 'reload' },
  });
  const bh = 0.03 + p.bulk * 0.006;
  side(ctx, m, 'Magazine', raked(o, a, [[Lg - 0.004, 0.012], [Lg + bh, 0.016], [Lg + bh, -D - 0.014], [Lg - 0.004, -D - 0.01]]), 0.042, 0.004);
  side(ctx, m, 'Body', raked(o, a, [[Lg + bh * 0.35, 0.0165], [Lg + bh * 0.65, 0.0165], [Lg + bh * 0.65, -D - 0.0145], [Lg + bh * 0.35, -D - 0.0145]]), 0.043);
  for (let i = 0; i < 3; i++) put(ctx, m, 'Emissive', box([0, 0, 0], [0.004, 0.002, 0.002]), (() => { const [z, y] = raked(o, a, [[Lg + bh * 0.15, 0.006 - i * 0.004]])[0]; return [0.021, y, z] as Vec3; })());
  L.mountY = T;
};

export const PISTOL_FRAMES_2: Record<string, PartBuilder> = {
  compact, longslide, polymer, magnum, machine, bullpup, holdout, taser, coil, needler, derringer, wand, service, gyro, nailgun,
};
