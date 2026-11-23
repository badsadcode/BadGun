/**
 * Fantasy parts: rune-carved, gem-set, crystal-powered.
 *
 * Two shared helpers give the style its identity:
 *   runes()   engraves a strip of seeded glyphs (glowing when the style has
 *             the "magic" trait, gold inlay otherwise),
 *   crystal() a six-sided gem, pointed at both ends.
 */
import { AXIS_X, AXIS_Y, Vec2, Vec3, bezier, box, cylinder, dome, extrudeSide, lathe, ring, rod, smoothPolygon, tube } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, raked, side } from './context.js';
import { pistolTrigger } from './pistol.js';
import { rivetRow, triggerAndGuard } from './receiver.js';

const runeSlot = (ctx: BuildContext): MaterialSlot => (ctx.style.traits.magic ? 'Emissive' : 'Trim');

/**
 * A row of rune glyphs on a side face (the plane x = ±x), from z0 to z1,
 * centered at height y, glyph height h. Mirrored onto both sides.
 */
export function runes(ctx: BuildContext, c: Component, name: string, x: number, z0: number, z1: number, y: number, h: number, slot = runeSlot(ctx)): void {
  const rng = ctx.rng(`runes:${name}`);
  const pitch = h * 0.85;
  const t = 0.0011;
  for (let z = z0 + pitch / 2; z < z1 - pitch / 2; z += pitch) {
    // Each glyph: a stem plus one or two branches (a little like old runic alphabets).
    const strokes: { dz: number; dy: number; len: number; ang: number }[] = [{ dz: 0, dy: 0, len: h, ang: 0 }];
    const branches = rng.int(1, 2);
    for (let i = 0; i < branches; i++) {
      const up = rng.chance(0.5) ? 1 : -1;
      strokes.push({ dz: (up * h) / 6, dy: rng.range(-h * 0.25, h * 0.3), len: h * rng.range(0.38, 0.55), ang: up * rng.pick([0.6, 0.8, 1.0]) });
    }
    for (const s of [1, -1]) {
      for (const st of strokes) {
        put(ctx, c, slot, box([0, 0, 0], [0.0009, st.len, t]), [s * x, y + st.dy, z + st.dz], [st.ang, 0, 0]);
      }
    }
  }
}

/** Six-sided crystal along Z, centered at `at`, rotated by `r`. */
export function crystal(ctx: BuildContext, c: Component, at: Vec3, length: number, radius: number, r?: Vec3, slot: MaterialSlot = 'Emissive'): void {
  const L2 = length / 2;
  put(ctx, c, slot, lathe([[0, -L2], [radius, -L2 + length * 0.28], [radius, L2 - length * 0.32], [0, L2]], 6, Math.PI / 6), at, r);
}

/** Gem set into a gold bezel on a side face (x > 0 faces +X). */
export function sideGem(ctx: BuildContext, c: Component, x: number, y: number, z: number, radius: number): void {
  for (const s of [1, -1]) {
    const ry: Vec3 = [0, (s * Math.PI) / 2, 0];
    put(ctx, c, 'Trim', cylinder(radius * 1.35, 0, 0.003, 12, ctx.bevel(0.001)), [s * x, y, z], ry);
    put(ctx, c, 'Emissive', lathe([[0, 0], [radius, 0.001], [radius * 0.7, radius * 0.55], [0, radius * 0.7]], 6, Math.PI / 6), [s * (x + 0.0025), y, z], ry);
  }
}

// ---------------------------------------------------------------------------
// Receivers
// ---------------------------------------------------------------------------

/** Arcane: an ornate curved body with a gold spine, side gems and rune strips. */
const arcane: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'arcane', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const rng = ctx.rng('receiver');
  const swell = rng.range(0.004, 0.012);
  side(ctx, rec, 'Body', smoothPolygon([
    [z0 - 0.006, top - 0.012], [z0 + 0.004, bottom + 0.01], [z0 + 0.03, bottom], [L.magwell.z0 - 0.006, bottom], [L.magwell.z0 - 0.004, bottom - 0.006],
    [L.magwell.z1 + 0.008, bottom - 0.006], [z1 - 0.01, bottom + 0.006], [z1 + 0.006, -0.004], [z1, top - 0.006], [(z0 + z1) / 2, top + swell], [z0 + 0.02, top],
  ], 1), w, 0.004);
  // Gold spine along the top and a scroll at the back.
  side(ctx, rec, 'Trim', smoothPolygon([[z0 + 0.01, top - 0.004], [(z0 + z1) / 2, top + swell + 0.003], [z1 - 0.004, top - 0.004], [(z0 + z1) / 2, top + swell - 0.004]], 1), w * 0.4, 0.001);
  put(ctx, rec, 'Trim', ring(0.009, 0.0026, 0, 10, 5), [0, top - 0.012, z0 - 0.004], AXIS_X);
  sideGem(ctx, rec, w / 2, (top + bottom) / 2 + 0.004, z0 + (z1 - z0) * 0.32, 0.009 + p.ornament * 0.004);
  runes(ctx, rec, 'rec', w / 2 + 0.0003, z0 + (z1 - z0) * 0.45, z1 - 0.02, (top + bottom) / 2 + 0.004, 0.012);
  L.mountY = top + swell;
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Runic (dwarven): a heavy stepped iron block, big rivets, glowing rune grooves. */
const runic: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'runic', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const step = 0.008;
  side(ctx, rec, 'Body', [
    [z0, bottom + 0.012], [z0 + 0.012, bottom], [z1 - 0.012, bottom], [z1, bottom + 0.012], [z1, top - step], [z1 - 0.03, top - step],
    [z1 - 0.034, top], [z0 + 0.04, top], [z0 + 0.036, top - step], [z0, top - step],
  ], w * 1.05, 0.002);
  // Gold bands at the ends.
  for (const z of [z0 + 0.008, z1 - 0.008]) put(ctx, rec, 'Trim', box([0, (top + bottom) / 2 - step / 2, z], [w * 1.05 + 0.004, top - bottom - step - 0.004, 0.008], ctx.bevel(0.001)));
  const pts: Vec3[] = [];
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) for (const y of [bottom + 0.01, top - step - 0.008]) pts.push([s * (w * 0.525 + 0.0005), y, z0 + 0.03 + i * ((z1 - z0 - 0.06) / 2)]);
  rivetRow(ctx, rec, 'Detail', pts, 0.0034);
  runes(ctx, rec, 'rec', w * 0.525 + 0.0003, z0 + 0.04, z1 - 0.04, (top + bottom) / 2 - step / 2, 0.016);
  if (p.ornament > 0.5) sideGem(ctx, rec, w * 0.525, top - step - 0.01, z1 - 0.02, 0.006);
  L.mountY = top;
  triggerAndGuard(ctx, 'Detail', 'square');
};

export const FANTASY_RECEIVERS: Record<string, PartBuilder> = { arcane, runic };

// ---------------------------------------------------------------------------
// Barrels and muzzles
// ---------------------------------------------------------------------------

/** Octagonal barrel ringed with glowing rune bands. */
const rune: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = ctx.b.component('Barrel', { kind: 'barrel', variant: 'rune', pivot: [0, 0, L.barrel.z0] });
  const rb = L.barrel.radius * 1.1;
  put(ctx, c, 'Barrel', lathe([[rb * 0.45, L.barrel.z0], [rb, L.barrel.z0], [rb, L.barrel.z1], [rb * 0.45, L.barrel.z1]], 8, Math.PI / 8));
  const zA = Math.max(L.handguard.z1, L.barrel.z0) + 0.015, zB = L.barrel.z1 - 0.015;
  const n = Math.max(2, Math.round((zB - zA) / 0.035) + Math.round(p.ornament * 2));
  for (let i = 0; i < n; i++) {
    const z = zA + (i / Math.max(1, n - 1)) * (zB - zA);
    put(ctx, c, runeSlot(ctx), lathe([[rb, z - 0.0018], [rb + 0.0009, z - 0.0012], [rb + 0.0009, z + 0.0012], [rb, z + 0.0018]], 8, Math.PI / 8));
  }
  put(ctx, c, 'Trim', lathe([[rb, zA - 0.012], [rb * 1.22, zA - 0.01], [rb * 1.22, zA - 0.004], [rb, zA - 0.002]], 8, Math.PI / 8));
};

/** Barrel wrapped in a spiral of gold wire. */
const spiral: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = ctx.b.component('Barrel', { kind: 'barrel', variant: 'spiral', pivot: [0, 0, L.barrel.z0] });
  const rb = L.barrel.radius;
  put(ctx, c, 'Barrel', tube(rb, rb * 0.5, L.barrel.z0, L.barrel.z1, ctx.seg(0.8)));
  const zA = Math.max(L.handguard.z1, L.barrel.z0) + 0.008, zB = L.barrel.z1 - 0.01;
  const turns = 3 + Math.round(p.ornament * 4);
  const steps = turns * 10;
  const R = rb + 0.0018;
  let prev: Vec3 | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * turns * Math.PI * 2;
    const pt: Vec3 = [Math.cos(a) * R, Math.sin(a) * R, zA + t * (zB - zA)];
    if (prev) put(ctx, c, 'Trim', rod(prev, pt, 0.0016, 5));
    prev = pt;
  }
};

export const FANTASY_BARRELS: Record<string, PartBuilder> = { rune, spiral };

/** Gold claws holding a crystal at the muzzle. Returns length. */
export function crystalMuzzle(ctx: BuildContext, c: Component, a: number, rb: number): number {
  put(ctx, c, 'Trim', lathe([[rb * 0.5, a - 0.004], [rb * 1.6, a - 0.004], [rb * 1.9, a + 0.012], [rb * 1.2, a + 0.018]], ctx.seg(0.9)));
  const claw: Vec2[] = [[0, rb * 1.2], [0.02, rb * 2.4], [0.05, rb * 2.2], [0.064, rb * 1.1], [0.058, rb * 0.9], [0.044, rb * 1.7], [0.016, rb * 1.6]];
  for (let i = 0; i < 3; i++) {
    put(ctx, c, 'Trim', extrudeSide(claw, { width: 0.005, bevel: ctx.bevel(0.0012) }), [0, 0, a], [0, 0, (i / 3) * Math.PI * 2 + Math.PI / 6]);
  }
  crystal(ctx, c, [0, 0, a + 0.038], 0.05, rb * 1.35);
  return 0.065;
}

/** A flared "maw" with teeth around the rim. Returns length. */
export function mawMuzzle(ctx: BuildContext, c: Component, a: number, rb: number): number {
  const flare = 0.05;
  const prof: Vec2[] = [[rb * 0.9, a - 0.004], [rb * 1.5, a - 0.004]];
  for (let i = 1; i <= 6; i++) prof.push([rb * (1.5 + 1.4 * Math.pow(i / 6, 2)), a + (flare * i) / 6]);
  prof.push([rb * 2.6, a + flare], [rb * 1.1, a + 0.01]);
  put(ctx, c, 'Barrel', lathe(prof, ctx.seg(1)));
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const ang = (i / teeth) * Math.PI * 2;
    const r = rb * 2.6;
    put(ctx, c, 'Trim', lathe([[0, 0], [0.0032, 0], [0, 0.014]], 5), [Math.cos(ang) * r, Math.sin(ang) * r, a + flare - 0.002], [0, 0, 0]);
  }
  put(ctx, c, 'Emissive', cylinder(rb * 1.15, a + 0.008, a + 0.01, ctx.seg(0.8)));
  return flare;
}

// ---------------------------------------------------------------------------
// Handguard, stock, grip
// ---------------------------------------------------------------------------

/** Wooden forend wrapped in gold filigree bands, with rune strips. */
const filigree: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0, z1 } = L.handguard;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'filigree', pivot: [0, 0, z0] });
  const rb = L.barrel.radius;
  const depth = 0.026 + p.bulk * 0.008;
  side(ctx, h, 'Stock', smoothPolygon([[z0 - 0.006, -rb * 0.5], [z1 - 0.02, -rb * 0.5], [z1, -rb - 0.01], [z1 - 0.01, -depth], [z0 + 0.02, -depth - 0.004], [z0 - 0.006, -depth + 0.006]], 1), 0.036, 0.008);
  const seg = ctx.seg(1);
  const bands = 2 + Math.round(p.ornament * 2);
  for (let i = 0; i < bands; i++) {
    const z = z0 + 0.02 + (i / Math.max(1, bands - 1)) * (z1 - z0 - 0.045);
    put(ctx, h, 'Trim', ring(depth * 0.7, 0.0022, 0, seg, 5), [0, -depth * 0.42, z]);
    put(ctx, h, 'Trim', ring(depth * 0.7, 0.0016, 0, seg, 5), [0, -depth * 0.42, z + 0.006]);
  }
  runes(ctx, h, 'hg', 0.0182, z0 + 0.03, z1 - 0.03, -depth * 0.5, 0.01);
};

export const FANTASY_HANDGUARDS: Record<string, PartBuilder> = { filigree };

/** Carved stock with a scrolled toe, gold butt plate and a set gem. */
const ornate: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const z0 = L.rec.z0 - 0.004;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'ornate', pivot: [0, 0, z0] });
  const zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const heelY = top * 0.4 - drop * 0.6, toeY = -0.1 - drop - p.bulk * 0.01;
  const lower = bezier([zb + 0.03, toeY - 0.004], [zb + 0.1, toeY + 0.015], [z0 - 0.08, bottom - 0.012], [z0 - 0.02, bottom + 0.002], 10);
  const prof: Vec2[] = [
    [z0 + 0.01, top * 0.6], [zb + 0.014, heelY], [zb, heelY - 0.006], [zb + 0.002, toeY + 0.01],
    // the scroll: the toe curls forward and up
    [zb + 0.012, toeY - 0.008], [zb + 0.03, toeY - 0.004], ...lower, [z0 + 0.01, bottom + 0.008],
  ];
  side(ctx, s, 'Stock', smoothPolygon(prof, ctx.p.smoothness > 0.3 ? 1 : 0), 0.042, 0.008);
  side(ctx, s, 'Trim', [[zb + 0.006, heelY + 0.001], [zb - 0.006, heelY - 0.004], [zb - 0.004, toeY + 0.01], [zb + 0.008, toeY + 0.012]], 0.044, 0.002);
  const cz = zb + (z0 - zb) * 0.42, cy = (heelY + toeY) / 2 + 0.01;
  sideGem(ctx, s, 0.0215, cy, cz, 0.008 + p.ornament * 0.004);
  runes(ctx, s, 'stock', 0.0213, cz + 0.02, z0 - 0.04, cy + 0.002, 0.011);
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (heelY + toeY) / 2, zb - 0.006], forward: [0, 0, -1], description: 'Butt of the carved stock.' });
};

export const FANTASY_STOCKS: Record<string, PartBuilder> = { ornate };

/** Carved grip with a gold pommel cap and a gem in the pommel. */
const carved: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'carved', pivot: [0, L.grip.y, L.grip.z] });
  const D = 0.034 + p.bulk * 0.006, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', smoothPolygon(raked(o, L.grip.angle, [
    [-0.01, 0.003], [Lg * 0.5, -0.002], [Lg, 0.004], [Lg + 0.004, -D * 0.5], [Lg, -D - 0.004], [Lg * 0.5, -D + 0.002], [-0.004, -D - 0.004], [-0.01, -D * 0.5],
  ]), 2), 0.03, 0.006);
  side(ctx, g, 'Trim', raked(o, L.grip.angle, [[Lg - 0.003, 0.006], [Lg + 0.008, 0.003], [Lg + 0.008, -D - 0.006], [Lg - 0.003, -D - 0.006]]), 0.032, 0.002);
  const [z, y] = raked(o, L.grip.angle, [[Lg + 0.008, -D * 0.5]])[0];
  put(ctx, g, 'Emissive', dome(0.006, 0.005, 6, 2), [0, y, z], [Math.PI / 2 + L.grip.angle, 0, 0]);
};

export const FANTASY_GRIPS: Record<string, PartBuilder> = { carved };

// ---------------------------------------------------------------------------
// "Magazines": power crystals and orbs
// ---------------------------------------------------------------------------

function magComp(ctx: BuildContext, variant: string) {
  const { L } = ctx;
  return ctx.b.component('Magazine', {
    kind: 'magazine', variant, pivot: [0, L.rec.bottom, (L.magwell.z0 + L.magwell.z1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.2], purpose: 'reload (swap the power source)' },
  });
}

/** A cluster of crystals in a gold collar, hanging below the receiver. */
const crystalMag: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const m = magComp(ctx, 'crystal');
  const zc = (L.magwell.z0 + L.magwell.z1) / 2, yB = L.rec.bottom;
  const len = L.magLength * 0.8, r = 0.012 + p.bulk * 0.004;
  put(ctx, m, 'Trim', lathe([[r * 1.8, 0.008], [r * 1.9, 0.004], [r * 1.7, -0.008], [r * 1.2, -0.014]], 6, Math.PI / 6), [0, yB, zc], AXIS_Y);
  crystal(ctx, m, [0, yB - len / 2, zc], len, r, [Math.PI / 2, 0, 0]);
  crystal(ctx, m, [r * 1.4, yB - len * 0.3, zc + r * 0.4], len * 0.5, r * 0.55, [Math.PI / 2, 0, -0.35]);
  crystal(ctx, m, [-r * 1.2, yB - len * 0.28, zc - r * 0.6], len * 0.42, r * 0.5, [Math.PI / 2 - 0.2, 0, 0.4]);
};

/** A glass orb with a glowing core, held in a gold cage. */
const orb: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const m = magComp(ctx, 'orb');
  const zc = (L.magwell.z0 + L.magwell.z1) / 2, yB = L.rec.bottom;
  const R = 0.03 + p.bulk * 0.012;
  const yc = yB - 0.014 - R;
  const seg = ctx.seg(1.2);
  const sphere: Vec2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    sphere.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  put(ctx, m, 'Glass', lathe(sphere, seg), [0, yc, zc]);
  put(ctx, m, 'Emissive', lathe(sphere.map(([r, z]) => [r * 0.45, z * 0.45] as Vec2), Math.max(6, seg - 4)), [0, yc, zc]);
  put(ctx, m, 'Trim', lathe([[0.012, -0.006], [0.016, -0.004], [0.014, 0.006], [0.008, 0.012]], seg), [0, yB - 0.004, zc], AXIS_Y);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    put(ctx, m, 'Trim', ring(R + 0.0015, 0.0013, 0, seg, 4), [0, yc, zc], [0, a, 0]);
  }
};

export const FANTASY_MAGAZINES: Record<string, PartBuilder> = { crystal: crystalMag, orb };

// ---------------------------------------------------------------------------
// Pistol, crossbow and bow pieces
// ---------------------------------------------------------------------------

/** "Crystal-lock" flintlock pistol: octagonal barrel, lock plate, a gem in the hammer's jaws. */
export const flintlock: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const f = b.component('Frame', { kind: 'frame', variant: 'flintlock', parent: null });
  const { z0, z1, bottom, width: w } = L.rec;
  const rb = L.barrel.radius * 1.3;
  // Wooden body under the barrel, sweeping down into the grip.
  side(ctx, f, 'Stock', smoothPolygon([
    [z0 - 0.01, rb * 0.6], [z1 - 0.03, -rb * 0.4], [z1 - 0.026, -rb - 0.006], [L.grip.z + 0.05, bottom + 0.004],
    [L.grip.z - 0.002, bottom], [L.grip.z - L.extra.gripDepth, bottom + 0.004], [z0 - 0.016, rb * 0.2],
  ], 1), w, 0.004);
  const bar = b.component('Barrel', { kind: 'barrel', variant: 'octagonal', pivot: [0, 0, z0] });
  put(ctx, bar, 'Barrel', lathe([[rb * 0.45, z0], [rb, z0], [rb, z1], [rb * 1.2, z1 - 0.004], [rb * 1.2, z1], [rb * 0.45, z1]], 8, Math.PI / 8));
  for (const z of [z0 + 0.03, (z0 + z1) / 2 + 0.02]) put(ctx, bar, 'Trim', lathe([[rb, z - 0.004], [rb * 1.18, z - 0.003], [rb * 1.18, z + 0.003], [rb, z + 0.004]], 8, Math.PI / 8));
  runes(ctx, bar, 'barrel', rb * 0.95, z0 + 0.04, (z0 + z1) / 2, 0, rb * 0.9);
  // Lock plate on the right with a hammer holding a crystal.
  side(ctx, f, 'Trim', smoothPolygon([[z0 + 0.004, 0.004], [z0 + 0.06, 0.002], [z0 + 0.064, -0.012], [z0 + 0.004, -0.014]], 1), 0.002, 0.0005, -w / 2 - 0.001);
  const hz = z0 + 0.012, hy = rb + 0.006;
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'crystal-lock', pivot: [-w / 2 - 0.004, 0, hz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.8], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [[hz - 0.004, -0.004], [hz + 0.006, -0.004], [hz + 0.002, hy], [hz - 0.012, hy + 0.014], [hz - 0.016, hy + 0.01], [hz - 0.006, hy - 0.004]], 0.004, 0.001, -w / 2 - 0.004);
  crystal(ctx, hammer, [-w / 2 - 0.004, hy + 0.01, hz - 0.006], 0.016, 0.0045, [-0.7, 0, 0]);
  pistolTrigger(ctx, 'Trim', true);
  L.mountY = rb + 0.002;
  L.barrel.radius = rb;
  void p;
};

/** Scrolled pistol grip with a gold cap and gem. */
export const scrollGrip: PartBuilder = (ctx) => {
  const { L } = ctx;
  const g = ctx.b.component('Grip', { kind: 'grip', variant: 'scroll', pivot: [0, L.grip.y, L.grip.z] });
  const D = L.extra.gripDepth, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Stock', smoothPolygon(raked(o, L.grip.angle, [
    [-0.004, 0.002], [Lg * 0.6, -0.002], [Lg, 0.004], [Lg + 0.014, -D * 0.2], [Lg + 0.01, -D - 0.008], [Lg * 0.5, -D], [-0.004, -D - 0.004],
  ]), 2), 0.03, 0.006);
  const [z, y] = raked(o, L.grip.angle, [[Lg + 0.012, -D * 0.35]])[0];
  put(ctx, g, 'Trim', cylinder(0.011, -0.016, 0.016, 10, ctx.bevel(0.002)), [0, y, z], [0, Math.PI / 2, 0]);
  put(ctx, g, 'Emissive', dome(0.006, 0.004, 6, 2), [0.0165, y, z], [0, Math.PI / 2, 0]);
  put(ctx, g, 'Emissive', dome(0.006, 0.004, 6, 2), [-0.0165, y, z], [0, -Math.PI / 2, 0]);
};
