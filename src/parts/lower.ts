/**
 * Grips and magazines: the parts that hang under the receiver.
 */
import { AXIS_X, AXIS_Y, Vec2, Vec3, box, cylinder, dome, lathe, ring, roundedRect, smoothPolygon } from '../core/geometry.js';
import { BuildContext, put, raked, side } from './context.js';
import type { PartBuilder } from './receiver.js';
import { magBody, magLook } from './mags2.js';

// ---------------------------------------------------------------------------
// Grips
// ---------------------------------------------------------------------------

function gripComponent(ctx: BuildContext, variant: string) {
  const { L } = ctx;
  return ctx.b.component('Grip', { kind: 'grip', variant, pivot: [0, L.grip.y, L.grip.z] });
}

const polymer: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = gripComponent(ctx, 'polymer');
  const D = 0.032 + p.bulk * 0.006, Lg = L.grip.length;
  const pts: [number, number][] = [[-0.008, 0.002], [0.012, 0.002]];
  // Finger grooves along the front.
  const grooves = p.detail > 0.35 ? 3 : 0;
  for (let i = 1; i <= 12; i++) {
    const t = 0.012 + (i / 12) * (Lg - 0.016);
    const wave = grooves ? Math.abs(Math.sin((i / 12) * Math.PI * grooves)) * 0.004 : 0;
    pts.push([t, 0.001 + wave]);
  }
  pts.push([Lg, 0.002], [Lg + 0.004, -D * 0.45], [Lg, -D - 0.002], [0.03, -D], [0.004, -D - 0.006], [-0.006, -D - 0.008], [-0.008, -D * 0.5]);
  side(ctx, g, 'Grip', raked([L.grip.z, L.grip.y], L.grip.angle, pts), 0.028, 0.0035);
};

const wood: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = gripComponent(ctx, 'wood');
  const D = 0.036 + p.bulk * 0.006, Lg = L.grip.length;
  const pts: [number, number][] = [
    [-0.01, 0.004], [0.02, 0.0], [0.05, -0.002], [Lg - 0.01, 0.002], [Lg, 0.006],
    [Lg, -D - 0.006], [Lg - 0.012, -D - 0.002], [0.04, -D + 0.002], [0.01, -D - 0.002], [-0.01, -D * 0.6],
  ];
  side(ctx, g, 'Grip', smoothPolygon(raked([L.grip.z, L.grip.y], L.grip.angle, pts), 1), 0.03, 0.006);
  // Brass pommel cap.
  side(ctx, g, 'Trim', raked([L.grip.z, L.grip.y], L.grip.angle, [
    [Lg - 0.002, 0.008], [Lg + 0.006, 0.006], [Lg + 0.007, -D - 0.006], [Lg - 0.002, -D - 0.008],
  ]), 0.032, 0.002);
  if (p.ornament > 0.5) {
    // Escutcheon rivets on both sides.
    for (const s of [1, -1]) {
      const [z, y] = raked([L.grip.z, L.grip.y], L.grip.angle, [[Lg * 0.45, -D * 0.5]])[0];
      put(ctx, g, 'Trim', dome(0.004, 0.0018, Math.max(6, ctx.seg(0.4)), 2), [s * 0.0152, y, z], [0, (s * Math.PI) / 2, 0]);
    }
  }
};

const sleekGrip: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = gripComponent(ctx, 'sleek');
  const D = 0.032 + p.bulk * 0.006, Lg = L.grip.length;
  const prof = (shrink: number): Vec2[] =>
    raked([L.grip.z, L.grip.y], L.grip.angle, [
      [-0.006, 0.002 - shrink], [0.03, 0.004 - shrink], [0.07, -shrink], [Lg - shrink, 0.008 - shrink],
      [Lg + 0.004 - shrink, -0.006], [Lg - shrink, -D + shrink], [0.05, -D - 0.002 + shrink], [0.004, -D - 0.004 + shrink],
      [-0.006, -D * 0.5],
    ]);
  side(ctx, g, 'Grip', smoothPolygon(prof(0), 1), 0.028, 0.006);
  side(ctx, g, 'Trim', smoothPolygon(prof(0.007), 1), 0.031, 0.002);
};

export const GRIPS: Record<string, PartBuilder> = { polymer, wood, sleek: sleekGrip };

// ---------------------------------------------------------------------------
// Magazines
// ---------------------------------------------------------------------------

function magComponent(ctx: BuildContext, variant: string, axis: Vec3 = [0, -1, 0]) {
  const { L } = ctx;
  return ctx.b.component('Magazine', {
    kind: 'magazine',
    variant,
    pivot: [0, L.rec.bottom, (L.magwell.z0 + L.magwell.z1) / 2],
    motion: { type: 'translate', axis, range: [0, 0.25], purpose: 'reload' },
  });
}

/** Box magazine body plus its seeded look (baseplate, ribs, witness holes, window); see mags2.ts. */
function boxMag(ctx: BuildContext, variant: string, curve: number): void {
  const m = magComponent(ctx, variant);
  magLook(ctx, magBody(ctx, m, { curve }), variant);
}

const curved: PartBuilder = (ctx) => boxMag(ctx, 'curved', 0.022 + ctx.rng('magazine').range(0, 0.02));
const straight: PartBuilder = (ctx) => boxMag(ctx, 'straight', 0.004);

const drum: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const m = magComponent(ctx, 'drum');
  const { z0: m0, z1: m1 } = L.magwell;
  const yB = L.rec.bottom;
  const seg = ctx.seg(1.4);
  side(ctx, m, 'Magazine', [[m0 + 0.004, yB + 0.008], [m1 - 0.004, yB + 0.008], [m1 - 0.006, yB - 0.034], [m0 + 0.006, yB - 0.034]], 0.03, 0.002);
  const Rd = 0.05 + p.bulk * 0.02, hw = 0.024 + p.bulk * 0.008;
  const zc = (m0 + m1) / 2 + 0.004, yc = yB - 0.03 - Rd * 0.85;
  const e = ctx.bevel(0.006);
  put(ctx, m, 'Magazine', lathe([[0, -hw], [Rd - e, -hw], [Rd, -hw + e], [Rd, hw - e], [Rd - e, hw], [0, hw]], seg), [0, yc, zc], AXIS_X);
  for (const s of [1, -1]) {
    put(ctx, m, 'Trim', ring(Rd * 0.72, 0.0028, 0, seg, Math.max(4, ctx.seg(0.3))), [s * hw, yc, zc], AXIS_X);
    put(ctx, m, 'Trim', dome(Rd * 0.24, 0.006, seg, 3), [s * hw, yc, zc], [0, (s * Math.PI) / 2, 0]);
    // Rivets around the face.
    const n = Math.round(4 + p.ornament * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      put(ctx, m, 'Detail', dome(0.0032, 0.002, 6, 2), [s * hw, yc + Math.sin(a) * Rd * 0.88, zc + Math.cos(a) * Rd * 0.88], [0, (s * Math.PI) / 2, 0]);
    }
  }
  // Winding key on the left face.
  put(ctx, m, 'Detail', cylinder(0.004, 0, 0.012, 8), [hw + 0.005, yc, zc], AXIS_X);
  put(ctx, m, 'Detail', box([hw + 0.017, yc, zc], [0.004, 0.026, 0.008], ctx.bevel(0.0015)));
};

const canister: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const m = magComponent(ctx, 'canister');
  const yB = L.rec.bottom;
  const r = 0.022 + p.bulk * 0.006;
  const h = L.magLength * 0.9;
  const zc = (L.magwell.z0 + L.magwell.z1) / 2;
  const seg = ctx.seg(1);
  // Built along Z, then stood up (Z -> Y).
  put(ctx, m, 'Magazine', lathe([
    [0, -h - 0.012], [r * 0.55, -h - 0.01], [r * 0.9, -h - 0.004], [r, -h + 0.004], [r, 0.01],
  ], seg), [0, yB, zc], AXIS_Y);
  const rings = 2 + Math.round(p.ornament * 2);
  for (let i = 0; i < rings; i++) {
    const y = yB - 0.012 - (i / Math.max(1, rings - 1)) * (h - 0.03);
    put(ctx, m, 'Trim', lathe([[r, -0.004], [r + 0.003, -0.003], [r + 0.003, 0.003], [r, 0.004]], seg), [0, y, zc], AXIS_Y);
  }
  // Glowing sight-window on the left.
  put(ctx, m, 'Trim', box([r - 0.0005, yB - h * 0.5, zc], [0.003, h * 0.6, 0.014], ctx.bevel(0.001)));
  put(ctx, m, 'Emissive', box([r + 0.0003, yB - h * 0.5, zc], [0.0026, h * 0.52, 0.008]));
};

const cell: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const m = magComponent(ctx, 'cell');
  const { z0: m0, z1: m1 } = L.magwell;
  const yB = L.rec.bottom;
  const Lc = L.magLength * 0.7;
  const depth = m1 - m0 - 0.004;
  const zc = (m0 + m1) / 2;
  const seg = Math.max(2, Math.round(ctx.seg(0.25)));
  const width = 0.028 + p.bulk * 0.006;
  side(ctx, m, 'Magazine', roundedRect(zc, yB + 0.008 - Lc / 2, depth, Lc, 0.008, seg), width, 0.003);
  if (ctx.style.traits.glow) {
    side(ctx, m, 'Emissive', roundedRect(zc, yB - Lc * 0.45, depth * 0.62, Lc * 0.45, 0.004, seg), width + 0.004);
  }
  side(ctx, m, 'Trim', roundedRect(zc, yB + 0.008 - Lc + 0.006, depth + 0.004, 0.014, 0.004, seg), width + 0.003, 0.0015);
};

export const MAGAZINES: Record<string, PartBuilder> = { curved, straight, drum, canister, cell };
