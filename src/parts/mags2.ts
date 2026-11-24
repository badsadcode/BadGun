/**
 * More box magazines, and the "look" genes shared by box magazines.
 *
 *   extended  long straight magazine with a +2 baseplate extension
 *   casket    wide quad-stack: a normal neck that swells into a fat body
 *   coupled   two magazines clipped side by side with a molded coupler
 *   windowed  polymer magazine with a see-through strip showing the rounds
 *   pullloop  straight magazine with a fabric pull tab on the baseplate
 *   helical   sci-fi spiral drum lying along the bore under the receiver
 *   banana    long, strongly curved magazine
 *   ribbed    stamped steel with reinforcement ribs and witness holes
 *
 * Look genes (`magLook`): each box magazine draws its baseplate shape, rib
 * pattern, witness holes and follower window from its own random stream
 * (`mag:<variant>-look`), so two "curved" magazines aren't twins.
 *
 * Every magazine hangs from the magwell: its top is at `L.rec.bottom + 0.008`
 * (just inside the well) between `L.magwell.z0` and `L.magwell.z1`, and the
 * Magazine component's pivot is the weapon's SOCKET_Magazine point.
 */
import { AXIS_X, Vec2, Vec3, box, cylinder, dome, extrudeSide, lathe, ring } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, side } from './context.js';

function magComponent(ctx: BuildContext, variant: string, range = 0.25): Component {
  const { L } = ctx;
  return ctx.b.component('Magazine', {
    kind: 'magazine',
    variant,
    pivot: [0, L.rec.bottom, (L.magwell.z0 + L.magwell.z1) / 2],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, range], purpose: 'reload' },
  });
}

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** A box magazine body (side profile) and how to find points on it. */
export interface MagBody {
  m: Component;
  width: number;
  Lm: number;
  curve: number;
  yT: number;
  yE: number;
  bz: number;
  fz: number;
  /** Back z, front z and height at curve parameter t (0 = top, 1 = bottom). */
  at(t: number): { zb: number; zf: number; y: number };
}

/** Draw a box magazine body: the shared outline of every curved/straight box magazine. */
export function magBody(ctx: BuildContext, m: Component, o: { curve: number; lenK?: number; width?: number; slot?: MaterialSlot; x?: number; t0?: number }): MagBody {
  const { L, p } = ctx;
  const { z0: m0, z1: m1 } = L.magwell;
  const Lm = L.magLength * (o.lenK ?? 1);
  const yT = L.rec.bottom + 0.008, yE = L.rec.bottom - Lm;
  const bz = m0 + 0.003, fz = m1 - 0.003, c = o.curve;
  const F = [[fz, yT], [fz, yT - Lm * 0.45], [fz + c * 0.7 + 0.006, yE + Lm * 0.15], [fz + c + 0.006, yE + 0.006]];
  const B = [[bz, yT], [bz, yT - Lm * 0.45], [bz + c * 0.7, yE + Lm * 0.15], [bz + c, yE]];
  const ev = (P: number[][], t: number): Vec2 => [cubic(P[0][0], P[1][0], P[2][0], P[3][0], t), cubic(P[0][1], P[1][1], P[2][1], P[3][1], t)];
  // The outline starts at curve parameter t0 (0 = the top, inside the well).
  const t0 = o.t0 ?? 0;
  const front: Vec2[] = [], back: Vec2[] = [];
  for (let i = 0; i <= 8; i++) {
    front.push(ev(F, t0 + ((1 - t0) * i) / 8));
    back.push(ev(B, t0 + ((1 - t0) * i) / 8));
  }
  const width = o.width ?? 0.023 + p.bulk * 0.004;
  side(ctx, m, o.slot ?? 'Magazine', [back[0], ...front, ...back.slice(1).reverse()], width, 0.002, o.x ?? 0);
  return {
    m, width, Lm, curve: c, yT, yE, bz, fz,
    at: (t) => {
      const f = ev(F, t), b = ev(B, t);
      return { zb: b[0], zf: f[0], y: (f[1] + b[1]) / 2 };
    },
  };
}

/** Put geometry in the baseplate frame (origin at the middle of the bottom edge, tilted with it). */
function atBase(body: MagBody, geo: ReturnType<typeof box>): ReturnType<typeof box> {
  const { bz, fz, curve, yE } = body;
  const len = fz + curve + 0.006 - (bz + curve);
  const tilt = Math.atan2(0.006, len);
  return geo.transform({ r: [-tilt, 0, 0], t: [0, yE + 0.003, (bz + fz) / 2 + curve + 0.003] });
}

export type BaseKind = 'flat' | 'extended' | 'bumper' | 'flared' | 'plus2';

/** Floorplate shapes. */
export function magBase(ctx: BuildContext, body: MagBody, kind: BaseKind): void {
  const { m, width: w, bz, fz } = body;
  const len = fz - bz + 0.006;
  const add = (slot: MaterialSlot, g: ReturnType<typeof box>) => ctx.b.add(m, slot, atBase(body, g));
  if (kind === 'flat') add('Detail', box([0, -0.001, 0], [w + 0.003, 0.008, len + 0.01], ctx.bevel(0.002)));
  else if (kind === 'bumper') add('Grip', box([0, -0.002, 0.001], [w + 0.005, 0.011, len + 0.012], ctx.bevel(0.004)));
  else if (kind === 'flared') {
    add('Detail', extrudeSide([[-len / 2 - 0.004, 0.003], [len / 2 + 0.004, 0.003], [len / 2 + 0.013, -0.001], [len / 2 + 0.009, -0.007], [-len / 2 - 0.004, -0.006]], { width: w + 0.006, bevel: ctx.bevel(0.0015) }));
  } else {
    // Extended / +2: a sleeve that lengthens the body, then a chunky plate with a grip step.
    const h = kind === 'plus2' ? 0.02 : 0.013;
    add('Magazine', box([0, -h / 2 + 0.002, 0], [w + 0.0016, h, len + 0.002], ctx.bevel(0.0015)));
    add('Detail', extrudeSide([[-len / 2 - 0.004, -h + 0.003], [len / 2 + 0.004, -h + 0.003], [len / 2 + 0.006, -h - 0.002], [len / 2 - 0.004, -h - 0.007], [-len / 2 - 0.002, -h - 0.007], [-len / 2 - 0.005, -h - 0.002]], { width: w + 0.004, bevel: ctx.bevel(0.002) }));
    for (let i = 0; i < 3; i++) add('Detail', box([0, -h * (0.3 + i * 0.2), len / 2 + 0.0012], [w * 0.8, 0.0018, 0.002]));
  }
}

/** Raised ribs: horizontal bands or two long stamped ribs following the curve. */
export function magRibs(ctx: BuildContext, body: MagBody, kind: 'none' | 'horizontal' | 'vertical'): void {
  const { m, width: w, bz, fz, Lm, yT, curve } = body;
  if (kind === 'horizontal') {
    for (let i = 1; i <= 3; i++) {
      const t = 0.2 + i * 0.12;
      put(ctx, m, 'Magazine', box([0, 0, 0], [w + 0.002, 0.003, (fz - bz) * 0.7], ctx.bevel(0.001)), [0, yT - Lm * t, bz + (fz - bz) / 2 + curve * t * t + 0.002]);
    }
  } else if (kind === 'vertical') {
    for (const frac of [0.3, 0.72]) {
      const line: Vec2[] = [];
      for (let i = 0; i <= 6; i++) {
        const a = body.at(0.12 + (i / 6) * 0.7);
        line.push([a.zb + (a.zf - a.zb) * frac, a.y]);
      }
      side(ctx, m, 'Magazine', strip(line, 0.0032), w + 0.0018, 0.0006);
    }
  }
}

/** Small round holes on both sides showing how many rounds are left. */
export function witnessHoles(ctx: BuildContext, body: MagBody, n = 5): void {
  const { m, width: w } = body;
  for (let i = 0; i < n; i++) {
    const a = body.at(0.16 + (i / Math.max(1, n - 1)) * 0.6);
    const z = a.zb + 0.006;
    put(ctx, m, 'Detail', cylinder(0.0017, -w / 2 - 0.0004, w / 2 + 0.0004, 8), [0, a.y, z], AXIS_X);
  }
}

/** A see-through strip down the side; with `rounds`, brass shows through it. */
export function followerWindow(ctx: BuildContext, body: MagBody, rounds: boolean, t0 = 0.1, t1 = 0.72): void {
  const { m, width: w } = body;
  const line: Vec2[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = body.at(t0 + (i / 6) * (t1 - t0));
    line.push([a.zb + (a.zf - a.zb) * 0.55, a.y]);
  }
  side(ctx, m, 'Glass', strip(line, 0.0065), w + 0.0008);
  if (!rounds) return;
  const n = Math.round(((body.at(t0).y - body.at(t1).y) / 0.0072));
  for (let i = 0; i < n; i++) {
    const a = body.at(t0 + ((i + 0.5) / n) * (t1 - t0));
    const z = a.zb + (a.zf - a.zb) * 0.55 + (i % 2 ? 0.0012 : -0.0012);
    put(ctx, m, 'Trim', box([0, a.y, z], [w + 0.0012, 0.0042, 0.0058]));
  }
}

/** A closed strip of thickness t along a polyline [z, y]. */
function strip(pts: Vec2[], t: number): Vec2[] {
  const l: Vec2[] = [], r: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dz = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dz, dy) || 1;
    l.push([pts[i][0] - (dy / n) * (t / 2), pts[i][1] + (dz / n) * (t / 2)]);
    r.push([pts[i][0] + (dy / n) * (t / 2), pts[i][1] - (dz / n) * (t / 2)]);
  }
  return [...l, ...r.reverse()];
}

/**
 * Shape genes for a box magazine: baseplate, ribs, witness holes, follower
 * window. Drawn from `mag:<variant>-look`, never from the host's other parts.
 */
export function magLook(ctx: BuildContext, body: MagBody, variant: string, o: { bases?: BaseKind[]; ribs?: boolean; holes?: number; window?: number } = {}): void {
  const r = ctx.rng(`mag:${variant}-look`);
  const base = r.pick<BaseKind>(o.bases ?? ['flat', 'flat', 'extended', 'bumper', 'flared']);
  const rib = r.pick(['horizontal', 'horizontal', 'vertical', 'none'] as const);
  const holes = r.chance(o.holes ?? 0.3);
  const window = !holes && r.chance(o.window ?? 0.25);
  magBase(ctx, body, base);
  if (o.ribs !== false && ctx.p.detail > 0.35) magRibs(ctx, body, ctx.p.detail > 0.5 || rib !== 'horizontal' ? rib : 'none');
  if (holes) witnessHoles(ctx, body);
  if (window) followerWindow(ctx, body, false);
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const extended: PartBuilder = (ctx) => {
  const m = magComponent(ctx, 'extended', 0.32);
  const body = magBody(ctx, m, { curve: 0.006, lenK: 1.4 });
  magBase(ctx, body, 'plus2');
  magRibs(ctx, body, 'horizontal');
  const r = ctx.rng('mag:extended-look');
  if (r.chance(0.5)) witnessHoles(ctx, body, 7);
};

const casket: PartBuilder = (ctx) => {
  const { p } = ctx;
  const m = magComponent(ctx, 'casket', 0.3);
  // The neck is a normal double stack; below the well it swells into a fat quad stack.
  magBody(ctx, m, { curve: 0.004, lenK: 1.1 });
  const body = magBody(ctx, m, { curve: 0.004, lenK: 1.1, width: 0.036 + p.bulk * 0.006, t0: 0.1 });
  magBase(ctx, body, ctx.rng('mag:casket-look').pick(['flat', 'bumper', 'extended'] as BaseKind[]));
  magRibs(ctx, body, 'vertical');
  // Shoulder where the neck widens (a chamfered collar).
  const a = body.at(0.1);
  put(ctx, m, 'Detail', box([0, a.y, (a.zb + a.zf) / 2], [body.width + 0.002, 0.004, a.zf - a.zb + 0.002], ctx.bevel(0.001)));
};

const coupled: PartBuilder = (ctx) => {
  const m = magComponent(ctx, 'coupled', 0.3);
  const body = magBody(ctx, m, { curve: 0.012 });
  magBase(ctx, body, 'bumper');
  if (ctx.rng('mag:coupled-look').chance(0.6)) followerWindow(ctx, body, true);
  // The spare: same magazine, beside it on the left, a little lower and forward.
  const off: Vec3 = [body.width + 0.004, -0.032, 0.01];
  const copies = [...m.geometry.entries()].map(([slot, g]) => [slot, g.clone().transform({ t: off })] as const);
  for (const [slot, g] of copies) ctx.b.add(m, slot, g);
  // Molded coupler with two screws.
  for (const t of [0.4, 0.75]) {
    const a = body.at(t);
    const zc = (a.zb + a.zf) / 2 + off[2] / 2, y = a.y + off[1] / 2;
    put(ctx, m, 'Detail', box([off[0] / 2, y, zc], [off[0] + body.width + 0.004, 0.012, a.zf - a.zb - 0.004], ctx.bevel(0.0015)));
    put(ctx, m, 'Trim', dome(0.0022, 0.0012, 6, 2), [off[0] + body.width / 2 + 0.002, y, zc], [0, Math.PI / 2, 0]);
  }
};

const windowed: PartBuilder = (ctx) => {
  const m = magComponent(ctx, 'windowed');
  const body = magBody(ctx, m, { curve: 0.014 });
  magLook(ctx, body, 'windowed', { holes: 0, window: 0 });
  followerWindow(ctx, body, true, 0.08, 0.8);
};

const pullloop: PartBuilder = (ctx) => {
  const m = magComponent(ctx, 'pullloop');
  const body = magBody(ctx, m, { curve: 0.005 });
  magLook(ctx, body, 'pullloop', { bases: ['flat', 'flared'], window: 0.35 });
  // Fabric pull tab: a loop of webbing hanging from the baseplate.
  const r = ctx.rng('mag:pullloop-tab');
  const drop = 0.022 + r.range(0, 0.014), zc = (body.bz + body.fz) / 2 + body.curve + 0.003 + r.range(-0.006, 0.006);
  const y0 = body.yE - 0.002, t = 0.0028, wz = 0.01;
  const loop: Vec2[] = [
    [zc - wz, y0], [zc - wz - 0.002, y0 - drop * 0.6], [zc - wz * 0.6, y0 - drop], [zc + wz * 0.6, y0 - drop], [zc + wz + 0.002, y0 - drop * 0.6], [zc + wz, y0],
    [zc + wz - t, y0], [zc + wz + 0.002 - t, y0 - drop * 0.6 + t * 0.3], [zc + wz * 0.6 - t * 0.4, y0 - drop + t], [zc - wz * 0.6 + t * 0.4, y0 - drop + t], [zc - wz - 0.002 + t, y0 - drop * 0.6 + t * 0.3], [zc - wz + t, y0],
  ];
  put(ctx, m, 'Accent', extrudeSide(loop, { width: 0.012 }));
  put(ctx, m, 'Detail', box([0, y0 - 0.001, zc], [0.0135, 0.003, wz * 2 + 0.004]));
};

const banana: PartBuilder = (ctx) => {
  const bull = ctx.chosen.config === 'bullpup';
  const r = ctx.rng('mag:banana-look');
  const m = magComponent(ctx, 'banana', 0.32);
  const body = magBody(ctx, m, { curve: (bull ? 0.035 : 0.055) + r.range(0, 0.022), lenK: bull ? 1.15 : 1.32 });
  magBase(ctx, body, r.pick(['flat', 'flat', 'flared'] as BaseKind[]));
  magRibs(ctx, body, 'vertical');
  // Stamped reinforcement bands near the top, like old steel mags.
  for (const t of [0.06, 0.14]) {
    const a = body.at(t);
    put(ctx, m, 'Magazine', box([0, a.y, (a.zb + a.zf) / 2 + 0.001], [body.width + 0.002, 0.004, a.zf - a.zb + 0.001], ctx.bevel(0.001)));
  }
};

const ribbed: PartBuilder = (ctx) => {
  const r = ctx.rng('mag:ribbed-look');
  const m = magComponent(ctx, 'ribbed');
  const body = magBody(ctx, m, { curve: 0.008 + r.range(0, 0.02) });
  magBase(ctx, body, 'flared');
  // Horizontal ribs all the way down, plus stamped side ribs and witness holes.
  const n = 5 + Math.round(ctx.p.detail * 3);
  for (let i = 0; i < n; i++) {
    const a = body.at(0.08 + (i / (n - 1)) * 0.82);
    put(ctx, m, 'Magazine', box([0, a.y, (a.zb + a.zf) / 2 + 0.0015], [body.width + 0.0024, 0.0028, (a.zf - a.zb) * 0.82], ctx.bevel(0.0008)));
  }
  witnessHoles(ctx, body, 4 + r.int(0, 3));
};

/** Spiral drum along the bore under the receiver (fed from the back, extending forward). */
const helical: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const m = magComponent(ctx, 'helical', 0.15);
  m.motion = { type: 'translate', axis: ctx.chosen.config === 'bullpup' ? [0, -0.196, -0.981] : [0, -0.196, 0.981], range: [0, 0.18], purpose: 'reload' };
  const R = 0.024 + p.bulk * 0.006;
  const { z0: m0, z1: m1 } = L.magwell;
  const yB = L.rec.bottom;
  const len = Math.max(0.16, L.magLength * 1.5) + p.length * 0.03;
  // Forward under the handguard; a bullpup has its grip in front of the well, so there it runs back under the butt.
  const back = ctx.chosen.config === 'bullpup';
  const zb = back ? m1 + 0.004 - len : m0 + 0.002, zf = zb + len, yc = yB - 0.012 - R;
  const seg = ctx.seg(1.1);
  // Feed neck into the magwell.
  side(ctx, m, 'Magazine', [[m0 + 0.004, yB + 0.008], [m1 - 0.004, yB + 0.008], [m1 - 0.002, yc + R * 0.5], [m0 + 0.002, yc + R * 0.5]], 0.022, 0.0015);
  // The drum: a long cylinder with domed ends.
  put(ctx, m, 'Magazine', lathe([[0, zb - 0.006], [R * 0.7, zb - 0.004], [R, zb + 0.006], [R, zf - 0.008], [R * 0.75, zf + 0.002], [0, zf + 0.004]], seg), [0, yc, 0]);
  put(ctx, m, 'Detail', dome(R * 0.4, 0.006, seg, 2), [0, yc, zf + 0.002]);
  // The spiral: rings tilted along the drum read as a helix.
  const n = Math.max(5, Math.round((len - 0.03) / 0.018));
  for (let i = 0; i < n; i++) {
    const z = zb + 0.014 + (i / (n - 1)) * (len - 0.03);
    put(ctx, m, 'Trim', ring(R, 0.0014, 0, seg, 4), [0, yc, z], [0.16, 0, 0]);
  }
  // A round counter strip on the left side.
  const glow = ctx.style.traits.glow;
  put(ctx, m, glow ? 'Emissive' : 'Glass', box([R - 0.001, yc, (zb + zf) / 2], [0.003, R * 0.5, len * 0.6]));
  put(ctx, m, 'Detail', box([R - 0.0014, yc, (zb + zf) / 2], [0.0026, R * 0.64, len * 0.64], ctx.bevel(0.001)));
};

export const MAGAZINES2: Record<string, PartBuilder> = { extended, casket, coupled, windowed, pullloop, helical, banana, ribbed };

/** Box magazines that fit up a machine pistol's grip. */
export const GRIP_MAGAZINES = ['straight', 'stick', 'extended', 'pullloop', 'windowed', 'ribbed'];
