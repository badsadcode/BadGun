/**
 * Front assembly: barrel, handguard/forend, muzzle device.
 */
import { exhaustMuzzle, smartMuzzle } from './punk.js';
import { Vec2, box, cylinder, extrudeSide, lathe, ring, tube, dome } from '../core/geometry.js';
import { BuildContext, put, side } from './context.js';
import { bottleMuzzle, canMuzzle } from './scrap.js';
import { crystalMuzzle, mawMuzzle } from './fantasy.js';
import type { PartBuilder } from './receiver.js';
import { MUZZLES_2 } from './muzzles2.js';

function barrelComponent(ctx: BuildContext, variant: string) {
  return ctx.b.component('Barrel', { kind: 'barrel', variant, pivot: [0, 0, ctx.L.barrel.z0] });
}

/** Radius of a lathe profile at a given z (linear interpolation). */
function radiusAt(profile: Vec2[], z: number): number {
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, z0] = profile[i], [r1, z1] = profile[i + 1];
    if (z >= Math.min(z0, z1) && z <= Math.max(z0, z1) && z1 !== z0) return r0 + ((z - z0) / (z1 - z0)) * (r1 - r0);
  }
  return profile[profile.length - 1][0];
}

function gasBlock(ctx: BuildContext, comp: ReturnType<typeof barrelComponent>): void {
  const { L } = ctx;
  const rb = L.barrel.radius;
  put(ctx, comp, 'Detail', box([0, 0.002, L.handguard.z1 + 0.014], [rb * 2 + 0.008, rb * 2 + 0.012, 0.016], ctx.bevel(0.0015)));
}

// ---------------------------------------------------------------------------
// Barrels
// ---------------------------------------------------------------------------

const plain: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = barrelComponent(ctx, 'plain');
  put(ctx, c, 'Barrel', tube(L.barrel.radius, L.barrel.radius * 0.45, L.barrel.z0, L.barrel.z1, ctx.seg(0.8)));
  if (ctx.style.traits.rails) gasBlock(ctx, c);
};

const heavy: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = barrelComponent(ctx, 'heavy');
  const rb = L.barrel.radius;
  put(ctx, c, 'Barrel', tube(rb, rb * 0.45, L.barrel.z0, L.handguard.z1, ctx.seg(0.8)));
  // Exposed part: heavier, octagonal profile.
  put(ctx, c, 'Barrel', lathe([[rb * 0.45, L.handguard.z1], [rb * 1.15, L.handguard.z1], [rb * 1.15, L.barrel.z1], [rb * 0.45, L.barrel.z1]], 8, Math.PI / 8));
  if (ctx.style.traits.rails) gasBlock(ctx, c);
};

const banded: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = barrelComponent(ctx, 'banded');
  const rb = L.barrel.radius * 1.1;
  // Classic octagonal barrel.
  put(ctx, c, 'Barrel', lathe([[rb * 0.45, L.barrel.z0], [rb, L.barrel.z0], [rb, L.barrel.z1], [rb * 0.45, L.barrel.z1]], 8, Math.PI / 8));
  const n = 2 + Math.round(p.ornament * 3);
  for (let i = 0; i < n; i++) {
    const z = L.handguard.z0 + 0.03 + (i / Math.max(1, n - 1)) * (L.barrel.z1 - L.handguard.z0 - 0.07);
    put(ctx, c, 'Trim', lathe([[rb * 1.1, z - 0.005], [rb * 1.3, z - 0.003], [rb * 1.3, z + 0.003], [rb * 1.1, z + 0.005]], ctx.seg(0.8)));
  }
};

const coiled: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = barrelComponent(ctx, 'coiled');
  const rb = L.barrel.radius;
  put(ctx, c, 'Barrel', tube(rb, rb * 0.45, L.barrel.z0, L.barrel.z1, ctx.seg(0.8)));
  // A copper coil (a stack of rings reads as a coil at game distances).
  const z0 = L.handguard.z0 + 0.03, z1 = L.barrel.z1 - 0.03;
  const minor = 0.0024 + p.bulk * 0.0008;
  const count = Math.min(40, Math.floor((z1 - z0) / (minor * 2.3)));
  for (let i = 0; i < count; i++) {
    const z = z0 + i * minor * 2.3;
    put(ctx, c, 'Accent', ring(rb + minor, minor, z, ctx.seg(0.6), Math.max(4, ctx.seg(0.25))));
  }
  for (const z of [z0 - 0.006, z0 + count * minor * 2.3 + 0.002]) {
    put(ctx, c, 'Trim', lathe([[rb, z - 0.005], [rb + minor * 2.6, z - 0.004], [rb + minor * 2.6, z + 0.004], [rb, z + 0.005]], ctx.seg(0.8)));
  }
};

const shrouded: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = barrelComponent(ctx, 'shrouded');
  const rb = L.barrel.radius;
  put(ctx, c, 'Barrel', tube(rb, rb * 0.5, L.barrel.z0, L.barrel.z1, ctx.seg(0.8)));
  if (ctx.style.traits.glow) {
    const span = L.barrel.z1 - L.handguard.z1;
    for (let i = 0; i < 3; i++) {
      const z = L.handguard.z1 + span * (0.2 + i * 0.25);
      put(ctx, c, 'Emissive', lathe([[rb, z - 0.003], [rb + 0.0015, z - 0.002], [rb + 0.0015, z + 0.002], [rb, z + 0.003]], ctx.seg(0.8)));
    }
  }
};

const rails: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = barrelComponent(ctx, 'rails');
  const rb = L.barrel.radius * 0.8;
  put(ctx, c, 'Barrel', tube(rb, rb * 0.5, L.barrel.z0, L.handguard.z1 + 0.02, ctx.seg(0.8)));
  const z0 = L.handguard.z0 + 0.02, z1 = L.barrel.z1;
  for (const s of [1, -1]) {
    const y0 = s * (rb + 0.004), y1 = s * (rb + 0.015);
    const prof: Vec2[] = [[z0, y0], [z1, y0], [z1 + 0.006, (y0 + y1) / 2], [z1 - 0.01, y1], [z0, y1]];
    put(ctx, c, 'Trim', extrudeSide(prof, { width: 0.012, bevel: ctx.bevel(0.002) }));
  }
  if (ctx.style.traits.glow) {
    put(ctx, c, 'Emissive', box([0, 0, (L.handguard.z1 + z1) / 2], [0.003, (rb + 0.004) * 2, z1 - L.handguard.z1]));
  }
  // Brackets tying the rails together.
  for (const z of [L.handguard.z1 + 0.01, z1 - 0.015]) {
    put(ctx, c, 'Detail', box([0, 0, z], [0.016, (rb + 0.016) * 2, 0.008], ctx.bevel(0.002)));
  }
};

export const BARRELS: Record<string, PartBuilder> = { plain, heavy, banded, coiled, shrouded, rails };

// ---------------------------------------------------------------------------
// Handguards
// ---------------------------------------------------------------------------

const railed: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'railed', pivot: [0, 0, L.handguard.z0] });
  const { z0, z1, radius: Rh } = L.handguard;
  const rb = L.barrel.radius;
  const A = Rh * Math.cos(Math.PI / 8); // distance to each flat face
  const e = ctx.bevel(0.004);
  put(ctx, h, 'Body', lathe([[rb + 0.003, z0], [Rh * 0.9, z0], [Rh, z0 + e], [Rh, z1 - e], [Rh * 0.9, z1], [rb + 0.003, z1]], 8, Math.PI / 8));
  // Riser up to the receiver's rail height.
  const top = L.rec.top;
  if (top > A) put(ctx, h, 'Body', box([0, (A - 0.002 + top) / 2, (z0 + z1) / 2], [0.019, top - A + 0.002, z1 - z0 - 0.004]));
  // Accessory slots on the side and bottom faces.
  const n = Math.floor((z1 - z0 - 0.02) / 0.045);
  for (let i = 0; i < n; i++) {
    const z = z0 + 0.03 + i * 0.045;
    for (const s of [1, -1]) put(ctx, h, 'Detail', box([s * (A + 0.0003), 0, z], [0.001, 0.0075, 0.03]));
    put(ctx, h, 'Detail', box([0, -(A + 0.0003), z], [0.0075, 0.001, 0.03]));
  }
  // Barrel nut.
  put(ctx, h, 'Trim', cylinder(Rh * 0.8, z0 - 0.006, z0 + 0.001, ctx.seg(0.8)));
  // Hand stop under the front.
  if (p.detail > 0.55) {
    side(ctx, h, 'Accent', [[z1 - 0.06, -A], [z1 - 0.03, -A], [z1 - 0.035, -A - 0.018], [z1 - 0.045, -A - 0.02]], 0.016, 0.003);
  }
};

const forend: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'forend', pivot: [0, 0, L.handguard.z0] });
  const { z0, z1 } = L.handguard;
  const rb = L.barrel.radius;
  const depth = 0.028 + p.bulk * 0.008;
  side(ctx, h, 'Stock', [
    [z0 - 0.01, -rb * 0.6], [z1 - 0.025, -rb * 0.6], [z1, -rb - 0.008], [z1 - 0.006, -depth + 0.004], [z1 - 0.03, -depth],
    [z0 + 0.03, -depth - 0.004], [z0 - 0.01, -depth - 0.004],
  ], 0.036, 0.008);
  const seg = ctx.seg(0.9);
  const bands = [z1 - 0.018, z0 + (z1 - z0) * 0.45];
  for (const z of bands) {
    const r = depth * 0.72 + 0.006;
    put(ctx, h, 'Trim', lathe([[r - 0.001, z - 0.007], [r + 0.0015, z - 0.005], [r + 0.0015, z + 0.005], [r - 0.001, z + 0.007]], seg), [0, -depth * 0.42, 0]);
  }
};

const shell: PartBuilder = (ctx) => {
  const { L } = ctx;
  const rng = ctx.rng('handguard');
  const h = ctx.b.component('Handguard', { kind: 'handguard', variant: 'shell', pivot: [0, 0, L.handguard.z0] });
  const { z0, z1, radius: Rh } = L.handguard;
  const rb = L.barrel.radius;
  const len = z1 - z0;
  const segs = rng.pick([6, 8, ctx.seg()]);
  const phase = segs <= 8 ? Math.PI / segs : 0;
  const prof: Vec2[] = [
    [rb + 0.003, z0], [Rh * 0.85, z0], [Rh, z0 + 0.025], [Rh * 1.05, z0 + len * 0.5], [Rh * 0.88, z1 - 0.012], [Rh * 0.72, z1], [rb + 0.004, z1],
  ];
  put(ctx, h, 'Body', lathe(prof, segs, phase));
  if (ctx.style.traits.glow) {
    for (const t of [0.35, 0.62]) {
      const z = z0 + len * t;
      const r = radiusAt(prof, z) + 0.0008;
      put(ctx, h, 'Emissive', lathe([[r, z - 0.0025], [r, z + 0.0025]], segs, phase));
    }
  }
  // Lower fin.
  side(ctx, h, 'Trim', [[z0 + 0.02, -Rh * 0.8], [z1 - 0.04, -Rh * 0.75], [z1 - 0.06, -Rh - 0.012], [z0 + 0.05, -Rh - 0.016]], 0.008, 0.002);
};

export const HANDGUARDS: Record<string, PartBuilder> = { railed, forend, shell };

// ---------------------------------------------------------------------------
// Muzzle devices
// ---------------------------------------------------------------------------

/** Each muzzle returns its length so the muzzle socket lands at the tip. */
export type MuzzleBuilder = (ctx: BuildContext, comp: ReturnType<typeof muzzleComponent>, a: number, rb: number) => number;

function muzzleComponent(ctx: BuildContext, variant: string) {
  return ctx.b.component('Muzzle', { kind: 'muzzle', variant, parent: 'Barrel', pivot: [0, 0, ctx.L.barrel.z1] });
}

const brake: MuzzleBuilder = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:brake-look');
  const ports = g.int(2, 4), kind = g.pick(['groove', 'window', 'saw'] as const);
  const R = rb * g.range(1.55, 1.85);
  const seg = ctx.seg(0.9);
  if (kind === 'window') {
    // Round body with rectangular side windows and a stepped crown.
    const len = 0.012 + ports * 0.013;
    put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [R, a - 0.004], [R, a + len], [R * 0.82, a + len + 0.005], [rb * 0.55, a + len + 0.005], [rb * 0.55, a + len - 0.004]], seg));
    for (let i = 0; i < ports; i++) {
      const z = a + 0.012 + i * 0.013;
      for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * (R - 0.0006), 0, z], [0.0022, R * 1.1, 0.0075]));
    }
    // Flat top so the windows read from above too.
    put(ctx, c, 'Barrel', box([0, R * 0.92, a + len / 2], [R * 0.9, R * 0.16, len], ctx.bevel(0.001)));
    return len + 0.005;
  }
  const prof: Vec2[] = [[rb * 0.5, a - 0.004], [R * 0.9, a - 0.004], [R, a]];
  let z = a + 0.012;
  for (let i = 0; i < ports; i++) {
    if (kind === 'groove') prof.push([R, z], [R * 0.7, z], [R * 0.7, z + 0.007], [R, z + 0.007]);
    // Sawtooth: each chamber grows forward and steps down sharply.
    else prof.push([R * 1.08, z], [R * 0.72, z + 0.001], [R * 0.78, z + 0.007]);
    z += 0.015;
  }
  const end = z;
  prof.push([R, end - 0.003], [R * 0.86, end], [rb * 0.55, end], [rb * 0.55, end - 0.01]);
  put(ctx, c, 'Barrel', lathe(prof, kind === 'saw' ? Math.max(6, Math.round(seg / 2)) * 2 : seg));
  return end - a;
};

const flash: MuzzleBuilder = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:flash-look');
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [rb * 1.45, a - 0.004], [rb * 1.45, a + 0.014], [rb * 1.6, a + 0.018], [rb * 1.6, a + 0.024], [rb * 0.9, a + 0.024]], ctx.seg(0.9)));
  const tines = g.pick([3, 4, 5, 6]);
  const tl = g.range(0.024, 0.04), splay = g.pick([0, 0, 0.08]);
  const thick = rb * g.range(0.38, 0.5);
  for (let i = 0; i < tines; i++) {
    const ang = (i / tines) * Math.PI * 2 + Math.PI / 2;
    const r = rb * 1.25 + Math.sin(splay) * tl * 0.5;
    put(ctx, c, 'Barrel', box([0, 0, 0], [thick, thick, tl], ctx.bevel(0.0008)), [Math.cos(ang) * r, Math.sin(ang) * r, a + 0.023 + tl / 2], [-splay, 0, ang - Math.PI / 2]);
  }
  // Some hiders close the tines with a ring.
  if (g.chance(0.35)) {
    put(ctx, c, 'Barrel', tube(rb * 1.25 + thick / 2 + Math.sin(splay) * tl, rb * 1.25 - thick / 2 + Math.sin(splay) * tl, a + 0.023 + tl - 0.004, a + 0.023 + tl + 0.001, ctx.seg(0.9)));
    return 0.024 + tl;
  }
  return 0.023 + tl;
};

const bell: MuzzleBuilder = (ctx, c, a, rb) => {
  const out: Vec2[] = [[rb * 0.9, a - 0.004], [rb * 1.4, a - 0.004]];
  const flare = 0.06 + ctx.p.ornament * 0.02;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    out.push([rb * (1.4 + 2.1 * Math.pow(t, 2.4)), a + flare * t]);
  }
  const lip = rb * 3.5;
  out.push([lip, a + flare + 0.003], [lip - 0.003, a + flare + 0.003]);
  for (let i = 8; i >= 1; i--) {
    const t = i / 8;
    out.push([rb * (1.0 + 2.0 * Math.pow(t, 2.4)), a + flare * t]);
  }
  out.push([rb * 0.9, a + 0.006]);
  put(ctx, c, 'Trim', lathe(out, ctx.seg(1)));
  put(ctx, c, 'Trim', ring(rb * 1.5, 0.0025, a + 0.004, ctx.seg(1), 6));
  return flare + 0.003;
};

const crown: MuzzleBuilder = (ctx, c, a, rb) => {
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [rb * 1.5, a - 0.004], [rb * 1.5, a + 0.03], [rb * 1.2, a + 0.036], [rb * 0.6, a + 0.036], [rb * 0.6, a + 0.028]], ctx.seg(0.9)));
  for (const z of [a + 0.006, a + 0.024]) put(ctx, c, 'Trim', ring(rb * 1.5, 0.0022, z, ctx.seg(0.9), 6));
  return 0.036;
};

const emitter: MuzzleBuilder = (ctx, c, a, rb) => {
  const R = rb * 2.0;
  put(ctx, c, 'Trim', lathe([[rb * 0.8, a - 0.004], [R, a - 0.004], [R * 1.12, a + 0.02], [R * 1.12, a + 0.034], [R * 0.85, a + 0.04], [R * 0.6, a + 0.04], [R * 0.6, a + 0.03], [0, a + 0.03]], ctx.seg(1)));
  if (ctx.style.traits.glow) put(ctx, c, 'Emissive', cylinder(R * 0.6, a + 0.03, a + 0.032, ctx.seg(1)));
  return 0.04;
};

const prongs: MuzzleBuilder = (ctx, c, a, rb) => {
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [rb * 1.6, a - 0.004], [rb * 1.6, a + 0.014], [rb * 0.8, a + 0.016]], ctx.seg(0.9)));
  const prong: Vec2[] = [[0, rb], [0.05, rb + 0.004], [0.066, rb + 0.012], [0.058, rb + 0.016], [0.0, rb + 0.013]];
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    put(ctx, c, 'Trim', extrudeSide(prong, { width: 0.006, bevel: ctx.bevel(0.0015) }), [0, 0, a], [0, 0, ang]);
  }
  if (ctx.style.traits.glow) {
    put(ctx, c, 'Emissive', dome(rb * 1.1, rb * 1.3, ctx.seg(0.8), 4), [0, 0, a + 0.02]);
    put(ctx, c, 'Emissive', dome(rb * 1.1, rb * 1.1, ctx.seg(0.8), 4), [0, 0, a + 0.02], [0, Math.PI, 0]);
  }
  return 0.066;
};

const suppressor: MuzzleBuilder = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:suppressor-look');
  const R = rb * (2.1 + ctx.p.bulk * 0.5);
  const len = 0.12 + ctx.p.length * 0.05;
  // Cross-section: round, octagonal or a faceted hexagon.
  const section = g.pick(['round', 'round', 'octagon', 'hex'] as const);
  const seg = section === 'octagon' ? 8 : section === 'hex' ? 6 : ctx.seg(1);
  const phase = section === 'round' ? 0 : Math.PI / seg;
  const cap = g.pick(['flat', 'nose', 'step'] as const);
  const front: Vec2[] =
    cap === 'flat' ? [[R, a + len - 0.008], [R * 0.9, a + len], [rb * 0.6, a + len], [rb * 0.6, a + len - 0.006]]
      : cap === 'nose' ? [[R, a + len - 0.022], [R * 0.82, a + len - 0.008], [R * 0.5, a + len], [rb * 0.6, a + len], [rb * 0.6, a + len - 0.006]]
        : [[R, a + len - 0.014], [R * 0.86, a + len - 0.014], [R * 0.86, a + len - 0.002], [R * 0.8, a + len], [rb * 0.6, a + len], [rb * 0.6, a + len - 0.006]];
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [rb * 1.3, a - 0.004], [rb * 1.3, a + 0.006], [R * 0.9, a + 0.01], [R, a + 0.016], ...front], seg, phase));
  const skin = g.pick(['bands', 'ribbed', 'sleeve'] as const);
  const band = (z: number, h: number, r = R) => lathe([[r, z - h], [r + 0.0008, z - h * 0.7], [r + 0.0008, z + h * 0.7], [r, z + h]], seg, phase);
  if (skin === 'bands') {
    for (const z of [a + 0.024, a + len - 0.03]) put(ctx, c, 'Trim', band(z, 0.003));
  } else if (skin === 'ribbed') {
    const n = Math.floor((len - 0.05) / 0.009);
    for (let i = 0; i < n; i++) put(ctx, c, 'Trim', band(a + 0.026 + i * 0.009, 0.0022));
  } else {
    // A heat sleeve over the rear half.
    put(ctx, c, 'Accent', lathe([[R, a + 0.018], [R + 0.0022, a + 0.022], [R + 0.0022, a + len * 0.55], [R, a + len * 0.55 + 0.004]], seg, phase));
  }
  return len;
};

const compensator: MuzzleBuilder = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:compensator-look');
  const R = rb * 1.65, len = g.range(0.034, 0.05);
  const flat = g.chance(0.4);
  const seg = flat ? 8 : ctx.seg(0.9);
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [R, a - 0.004], [R, a + len - 0.004], [R * 0.8, a + len], [rb * 0.6, a + len], [rb * 0.6, a + len - 0.006]], seg, flat ? Math.PI / 8 : 0));
  const top = flat ? R * Math.cos(Math.PI / 8) : R;
  const pattern = g.pick(['slots', 'holes', 'long', 'vee'] as const);
  if (pattern === 'slots') {
    const n = Math.max(2, Math.floor((len - 0.012) / 0.01));
    for (let i = 0; i < n; i++) put(ctx, c, 'Detail', box([0, top - 0.0005, a + 0.009 + i * 0.01], [R * 0.9, 0.002, 0.005]));
  } else if (pattern === 'holes') {
    const n = Math.max(2, Math.floor((len - 0.01) / 0.008));
    for (let i = 0; i < n; i++) for (const x of [-R * 0.35, R * 0.35]) {
      put(ctx, c, 'Detail', cylinder(R * 0.17, 0, 0.002, 8), [x, top - 0.0012, a + 0.008 + i * 0.008], [-Math.PI / 2, 0, 0]);
    }
  } else if (pattern === 'long') {
    put(ctx, c, 'Detail', box([0, top - 0.0005, a + len * 0.5], [R * 0.45, 0.002, len * 0.6]));
    for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * (R * 0.95), R * 0.25, a + len * 0.6], [0.002, R * 0.35, len * 0.35]));
  } else {
    // Chevron ports: angled slots meeting on the top center line.
    const n = Math.max(2, Math.floor((len - 0.012) / 0.011));
    for (let i = 0; i < n; i++) for (const s of [1, -1]) {
      put(ctx, c, 'Detail', box([0, 0, 0], [R * 0.6, 0.002, 0.004]), [s * R * 0.25, top - 0.0005, a + 0.01 + i * 0.011], [0, s * 0.6, 0]);
    }
  }
  return len;
};

/** Heavy two-chamber brake (anti-materiel rifles): a big slab with side ports. */
const heavybrake: MuzzleBuilder = (ctx, c, a, rb) => {
  const W = rb * 4, H = rb * 2.4, len = 0.06 + ctx.p.bulk * 0.025;
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [rb * 1.3, a - 0.004], [rb * 1.3, a + 0.012], [rb * 0.6, a + 0.012]], ctx.seg(0.8)));
  put(ctx, c, 'Barrel', box([0, 0, a + 0.012 + len / 2], [W, H, len], ctx.bevel(0.004)));
  for (let i = 0; i < 2; i++) {
    const z = a + 0.012 + len * (0.3 + i * 0.4);
    for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * (W / 2 + 0.0005), 0, z], [0.002, H * 0.72, len * 0.24]));
  }
  return len + 0.012;
};

/** No muzzle device: the barrel ends bare (the socket still marks the tip). */
const none: MuzzleBuilder = () => 0;

export const MUZZLE_BUILDERS: Record<string, MuzzleBuilder> = { brake, flash, bell, crown, emitter, prongs, suppressor, compensator, heavybrake, none, can: canMuzzle, bottle: bottleMuzzle, crystal: crystalMuzzle, maw: mawMuzzle, exhaust: exhaustMuzzle, smart: smartMuzzle, ...MUZZLES_2 };

export const MUZZLES: Record<string, PartBuilder> = Object.fromEntries(
  Object.entries(MUZZLE_BUILDERS).map(([name, fn]) => [
    name,
    (ctx: BuildContext) => {
      const { L } = ctx;
      const c = muzzleComponent(ctx, name);
      const len = fn(ctx, c, L.barrel.z1, L.barrel.radius);
      ctx.b.socket({
        name: 'SOCKET_Muzzle',
        parent: 'Muzzle',
        position: [L.extra.muzzleX ?? 0, 0, L.barrel.z1 + len],
        forward: [0, 0, 1],
        description: 'Muzzle tip: projectiles, flashes, tracers.',
      });
    },
  ]),
);
