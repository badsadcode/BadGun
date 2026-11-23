/**
 * Accessories that archetypes bolt on: bipods, bolt handles, carry handles,
 * shell holders. They aren't "part kinds" you pick from a menu; the
 * archetype decides when a weapon needs one (sniper -> bolt handle).
 */
import { box, cylinder, dome, rod } from '../core/geometry.js';
import { BuildContext, put, side } from './context.js';

/** Folding bipod under the front of the handguard (folded forward). */
export function bipod(ctx: BuildContext): void {
  const { L } = ctx;
  const zc = L.handguard.z1 - 0.03;
  const yc = -L.handguard.radius - 0.004;
  const c = ctx.b.component('Bipod', {
    kind: 'bipod', variant: 'folding', parent: 'Handguard', pivot: [0, yc, zc],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 1.45], purpose: 'deploy' },
  });
  put(ctx, c, 'Detail', box([0, yc - 0.004, zc], [0.03, 0.012, 0.026], ctx.bevel(0.002)));
  const legLen = 0.15 + ctx.p.length * 0.05;
  const seg = Math.max(6, ctx.seg(0.4));
  for (const x of [0.011, -0.011]) {
    put(ctx, c, 'Detail', rod([x, yc - 0.008, zc], [x * 1.3, yc - 0.012, zc + legLen], 0.0042, seg));
    put(ctx, c, 'Trim', rod([x, yc - 0.008, zc + legLen * 0.45], [x * 1.15, yc - 0.01, zc + legLen * 0.55], 0.0052, seg));
    put(ctx, c, 'Grip', dome(0.007, 0.008, seg, 3), [x * 1.3, yc - 0.012, zc + legLen]);
  }
}

/** Bolt-action handle on the right side, with a round knob. */
export function boltHandle(ctx: BuildContext): void {
  const { L } = ctx;
  const z = L.rec.z0 + 0.05;
  const x0 = -L.rec.width / 2;
  const c = ctx.b.component('BoltHandle', {
    kind: 'bolt', variant: 'turn-bolt', pivot: [0, 0.004, z],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, -1.2], purpose: 'cycle (lift, then pull back 0.08 m)' },
  });
  const seg = Math.max(6, ctx.seg(0.5));
  const knob: [number, number, number] = [x0 - 0.036, -0.018, z - 0.012];
  put(ctx, c, 'Detail', rod([x0 + 0.004, 0.004, z], knob, 0.0045, seg));
  put(ctx, c, 'Detail', dome(0.009, 0.009, seg, 4), knob);
  put(ctx, c, 'Detail', dome(0.009, 0.009, seg, 4), knob, [0, Math.PI, 0]);
  put(ctx, c, 'Detail', cylinder(0.008, 0, 0.006, seg), [x0 + 0.002, 0.004, z - 0.003]);
}

/** Folding carry handle over the front of the receiver. */
export function carryHandle(ctx: BuildContext): void {
  const { L } = ctx;
  const z0 = L.handguard.z0 + 0.02, z1 = z0 + 0.11;
  const y0 = Math.max(L.mountY, L.rec.top);
  const c = ctx.b.component('CarryHandle', {
    kind: 'carry_handle', variant: 'folding', pivot: [0, y0, z0],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, 1.5], purpose: 'fold' },
  });
  const h = 0.045;
  side(ctx, c, 'Detail', [
    [z0, y0], [z0 + 0.012, y0], [z0 + 0.016, y0 + h - 0.012], [z1 - 0.016, y0 + h - 0.012], [z1 - 0.012, y0], [z1, y0],
    [z1 - 0.006, y0 + h], [z0 + 0.006, y0 + h],
  ], 0.014, 0.0025);
  put(ctx, c, 'Grip', box([0, y0 + h - 0.002, (z0 + z1) / 2], [0.02, 0.012, z1 - z0 - 0.03], ctx.bevel(0.004)));
}

/** Vertical foregrip under the handguard. Returns where the support hand goes. */
export function foregrip(ctx: BuildContext): [number, number, number] {
  const { L, p } = ctx;
  const zc = L.handguard.z0 + (L.handguard.z1 - L.handguard.z0) * ctx.rng('foregrip').range(0.35, 0.6);
  const yT = -L.handguard.radius * 0.92;
  const c = ctx.b.component('Foregrip', { kind: 'foregrip', variant: 'vertical', parent: 'Handguard', pivot: [0, yT, zc] });
  const len = 0.06 + p.bulk * 0.02;
  side(ctx, c, 'Detail', [[zc - 0.016, yT + 0.002], [zc + 0.016, yT + 0.002], [zc + 0.014, yT - 0.008], [zc - 0.014, yT - 0.008]], 0.024, 0.002);
  side(ctx, c, 'Grip', [[zc - 0.012, yT - 0.006], [zc + 0.012, yT - 0.006], [zc + 0.016, yT - len], [zc + 0.012, yT - len - 0.006], [zc - 0.01, yT - len - 0.004], [zc - 0.014, yT - len + 0.004]], 0.026, 0.004);
  return [0, yT - len * 0.5, zc + 0.002];
}

/** Shotgun shell holder on the left side of the receiver. */
export function sideSaddle(ctx: BuildContext): void {
  const { L, p } = ctx;
  const rec = ctx.b.component(ctx.b.rootName, { kind: 'receiver', variant: '-' });
  const x = L.rec.width / 2 + 0.002;
  const n = 4 + Math.round(p.detail * 2);
  const zc = (L.rec.z0 + L.rec.z1) / 2;
  const span = n * 0.022;
  put(ctx, rec, 'Detail', box([x, -0.004, zc], [0.004, 0.05, span + 0.01], ctx.bevel(0.0015)));
  const seg = Math.max(6, ctx.seg(0.45));
  for (let i = 0; i < n; i++) {
    const z = zc - span / 2 + 0.011 + i * 0.022;
    put(ctx, rec, 'Accent', cylinder(0.0098, -0.03, 0.02, seg), [x + 0.012, 0, z], [Math.PI / 2, 0, 0]);
    put(ctx, rec, 'Trim', cylinder(0.0102, 0.02, 0.031, seg), [x + 0.012, 0, z], [Math.PI / 2, 0, 0]);
  }
}
