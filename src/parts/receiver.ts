/**
 * Receivers: the central housing. Also owns small mechanical bits that live
 * on it: trigger, trigger guard, charging handle / hammer, rails, gauges.
 */
import { AXIS_X, Vec2, Vec3, box, bezier, cylinder, dome, lathe, smoothPolygon } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put, side } from './context.js';

export type PartBuilder = (ctx: BuildContext) => void;

// ---------------------------------------------------------------------------
// Shared mechanical bits
// ---------------------------------------------------------------------------

function triggerAndGuard(ctx: BuildContext, guardSlot: 'Detail' | 'Trim' | 'Body', guardStyle: 'square' | 'round'): void {
  const { L, b } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: '-' });
  const y = L.rec.bottom;
  const zt = L.trigger.z;
  const trig = b.component('Trigger', {
    kind: 'trigger',
    variant: 'blade',
    pivot: [0, L.trigger.y, zt],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, 0.3], purpose: 'fire' },
  });
  side(ctx, trig, 'Detail', [
    [zt - 0.003, y + 0.006],
    [zt + 0.003, y + 0.006],
    [zt + 0.004, y - 0.008],
    [zt + 0.001, y - 0.019],
    [zt - 0.004, y - 0.02],
    [zt - 0.001, y - 0.01],
  ], 0.006, 0.0015);

  // Trigger guard: a single U-shaped profile (open at the top).
  const g0 = L.grip.z - 0.004, g1 = L.magwell.z0 + 0.002;
  const depth = 0.03, t = 0.0045;
  let guard: Vec2[];
  if (guardStyle === 'round') {
    const outer = bezier([g0, y], [g0 - 0.004, y - depth * 1.2], [g1 + 0.004, y - depth * 1.2], [g1, y], 10);
    const inner = bezier([g1 - t, y], [g1 - t + 0.003, y - (depth - t) * 1.15], [g0 + t - 0.003, y - (depth - t) * 1.15], [g0 + t, y], 10);
    guard = [[g0, y], ...outer, ...inner];
  } else {
    guard = [
      [g0, y], [g0, y - depth + 0.004], [g0 + 0.006, y - depth], [g1, y - depth], [g1, y],
      [g1 - t, y], [g1 - t, y - depth + t], [g0 + t + 0.004, y - depth + t], [g0 + t, y - depth + t + 0.004], [g0 + t, y],
    ];
  }
  side(ctx, rec, guardSlot, guard, 0.011, 0.0015);
}

/** Picatinny-style rail: base strip plus cross slots, across [z0, z1] at height y. */
export function rail(ctx: BuildContext, comp: Component, z0: number, z1: number, y: number): void {
  const w = 0.021;
  put(ctx, comp, 'Detail', box([0, y + 0.002, (z0 + z1) / 2], [w * 0.8, 0.004, z1 - z0], ctx.bevel(0.0008)));
  const pitch = 0.01;
  for (let z = z0 + 0.004; z + 0.005 < z1; z += pitch) {
    put(ctx, comp, 'Detail', box([0, y + 0.0055, z + 0.0026], [w, 0.0035, 0.0052], ctx.bevel(0.0006)));
  }
}

function rivetRow(ctx: BuildContext, comp: Component, slot: 'Trim' | 'Detail', pts: Vec3[], radius: number): void {
  for (const p of pts) {
    const sideSign = p[0] >= 0 ? 1 : -1;
    put(ctx, comp, slot, dome(radius, radius * 0.6, Math.max(5, ctx.seg(0.4)), 2), p, [0, (sideSign * Math.PI) / 2, 0]);
  }
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/** Modern: stacked upper/lower, chamfered aluminium, rail on top. */
const angular: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rng = ctx.rng('receiver');
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'angular', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const split = -0.006;

  // Upper receiver
  side(ctx, rec, 'Body', [
    [z0, split], [z1, split], [z1, top - 0.006], [z1 - 0.008, top], [z0 + 0.006, top], [z0, top - 0.005],
  ], w, 0.0025);

  // Lower receiver with magwell flare.
  const { z0: m0, z1: m1 } = L.magwell;
  const flare = 0.018 + p.bulk * 0.006;
  side(ctx, rec, 'Body', [
    [z0 + 0.004, split], [z0 + 0.004, bottom + 0.012], [z0 + 0.016, bottom],
    [m0 - 0.006, bottom], [m0 - 0.009, bottom - flare], [m1 + 0.004, bottom - flare],
    [m1 + 0.012, bottom - 0.004], [z1 - 0.03, split - 0.006], [z1 - 0.03, split],
  ], w * 0.9, 0.0025);

  // Ejection port cover on the right (-X) side.
  put(ctx, rec, 'Detail', box([-w / 2 - 0.0006, 0.004, z0 + (z1 - z0) * 0.55], [0.0016, 0.014, 0.06], ctx.bevel(0.0006)));
  // Forward assist / bolt-release bumps when detail is high.
  if (p.detail > 0.45) {
    put(ctx, rec, 'Detail', cylinder(0.006, 0, 0.018, ctx.seg(0.6), ctx.bevel(0.001)), [-w / 2 - 0.004, 0.006, z0 + (z1 - z0) * 0.86], [0, -0.5, 0]);
    put(ctx, rec, 'Detail', box([w / 2 * 0.9 + 0.001, bottom + 0.012, m0 - 0.01], [0.003, 0.012, 0.016], ctx.bevel(0.0008)));
  }
  // Selector switch on the left.
  put(ctx, rec, 'Detail', cylinder(0.006, 0, 0.002, ctx.seg(0.6)), [w * 0.45, bottom + 0.012, L.trigger.z - 0.025], AXIS_X);
  put(ctx, rec, 'Detail', box([w * 0.45 + 0.002, bottom + 0.014, L.trigger.z - 0.03], [0.002, 0.004, 0.012]));

  // Charging handle (moves back to charge).
  const ch = b.component('ChargingHandle', {
    kind: 'charging_handle',
    variant: 'T-handle',
    pivot: [0, top - 0.006, z0],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.07], purpose: 'charge' },
  });
  put(ctx, ch, 'Detail', box([0, top - 0.006, z0 - 0.004], [0.012, 0.006, 0.012], ctx.bevel(0.001)));
  put(ctx, ch, 'Detail', box([0, top - 0.006, z0 - 0.012], [0.04, 0.007, 0.008], ctx.bevel(0.0015)));

  // Top rail across receiver and handguard.
  if (ctx.style.traits.rails) rail(ctx, rec, z0 + 0.004, L.handguard.z1 - 0.008, top);

  triggerAndGuard(ctx, 'Body', rng.chance(0.5) ? 'square' : 'round');
};

/** Steampunk: a brass cylinder over a steel frame, with gauge and hammer. */
const cylindrical: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rng = ctx.rng('receiver');
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'cylindrical', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const R = top;
  const seg = ctx.seg(1.2);

  // Main boiler tube with domed back and stepped nose.
  put(ctx, rec, 'Body', lathe([
    [0, z0 - 0.016], [R * 0.45, z0 - 0.014], [R * 0.78, z0 - 0.009], [R * 0.95, z0 - 0.003], [R, z0 + 0.002],
    [R, z1 - 0.012], [R * 0.82, z1 - 0.006], [R * 0.82, z1], [L.barrel.radius * 1.6, z1],
  ], seg));

  // Brass bands
  const bands = 2 + Math.round(p.ornament * 2);
  for (let i = 0; i < bands; i++) {
    const z = z0 + 0.01 + (i / (bands - 1)) * (z1 - z0 - 0.034);
    put(ctx, rec, 'Trim', lathe([[R, z - 0.006], [R + 0.0035, z - 0.004], [R + 0.0035, z + 0.004], [R, z + 0.006]], seg));
  }

  // Steel frame below the tube (holds trigger and magwell).
  side(ctx, rec, 'Detail', [
    [z0 + 0.012, -R * 0.4], [z1 - 0.04, -R * 0.4], [z1 - 0.05, bottom + 0.006],
    [L.magwell.z1 + 0.008, bottom], [L.magwell.z0 - 0.008, bottom], [z0 + 0.03, bottom], [z0 + 0.012, bottom + 0.014],
  ], w * 0.62, 0.002);

  if (ctx.style.traits.rivets) {
    const n = 3 + Math.round(p.ornament * 4);
    const pts: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const z = z0 + 0.025 + (i / Math.max(1, n - 1)) * (z1 - z0 - 0.08);
      for (const s of [1, -1]) pts.push([s * w * 0.31, bottom + 0.008, z]);
    }
    rivetRow(ctx, rec, 'Trim', pts, 0.0025);
  }

  // Pressure gauge on the left side.
  if (ctx.style.traits.plumbing) {
    const gz = z0 + (z1 - z0) * rng.range(0.3, 0.45);
    const gy = R * 0.15;
    const gr = 0.017 + p.ornament * 0.004;
    const gx = R * 0.92;
    const gauge = cylinder(gr, 0, 0.012, seg, ctx.bevel(0.002));
    put(ctx, rec, 'Trim', gauge, [gx, gy, gz], AXIS_X);
    put(ctx, rec, 'Emissive', cylinder(gr * 0.8, 0, 0.0128, seg), [gx, gy, gz], AXIS_X);
    put(ctx, rec, 'Glass', dome(gr * 0.82, 0.004, seg, 3), [gx + 0.0128, gy, gz], AXIS_X);
    put(ctx, rec, 'Detail', box([gx + 0.0132, gy + gr * 0.3, gz + gr * 0.1], [0.0008, gr * 0.6, 0.0016]));
    // Copper pipe from gauge running forward.
    const pipeY = R * 0.55;
    const pipeX = R * 0.62;
    const pz0 = gz + gr * 0.5, pz1 = L.handguard.z1 - 0.01;
    put(ctx, rec, 'Accent', cylinder(0.0042, pz0, pz1, ctx.seg(0.5)), [pipeX, pipeY, 0]);
    put(ctx, rec, 'Accent', cylinder(0.0042, 0, 0.022, ctx.seg(0.5)), [gx - 0.004, pipeY, pz0], [0, -Math.PI / 2, 0]);
    for (const z of [pz0 + 0.004, (pz0 + pz1) / 2, pz1 - 0.004]) {
      put(ctx, rec, 'Trim', cylinder(0.0062, z - 0.004, z + 0.004, ctx.seg(0.5), ctx.bevel(0.001)), [pipeX, pipeY, 0]);
    }
  }

  // Hammer (cocks back).
  const hz = z0 - 0.004, hy = R * 0.35;
  const hammer = b.component('Hammer', {
    kind: 'hammer',
    variant: 'spur',
    pivot: [0, hy - 0.01, hz + 0.006],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.6], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [
    [hz + 0.012, hy - 0.016], [hz + 0.004, hy - 0.016], [hz - 0.004, hy + 0.012], [hz - 0.016, hy + 0.024],
    [hz - 0.02, hy + 0.02], [hz - 0.008, hy + 0.006], [hz + 0.006, hy - 0.008],
  ], 0.008, 0.0015);

  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Sci-fi: a smooth composite shell with inset side panels and light strips. */
const sleek: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rng = ctx.rng('receiver');
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'sleek', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const hump = rng.range(0.004, 0.014);

  const shell: Vec2[] = smoothPolygon([
    [z0, top - 0.012], [z0 + 0.004, bottom + 0.016], [z0 + 0.03, bottom], [L.magwell.z0 - 0.01, bottom],
    [L.magwell.z0 - 0.01, bottom - 0.012], [L.magwell.z1 + 0.012, bottom - 0.012], [z1 - 0.01, bottom * 0.55],
    [z1 + 0.01, -0.004], [z1 - 0.012, top * 0.75], [z1 - 0.05, top], [z0 + 0.06, top + hump], [z0 + 0.012, top + hump * 0.6],
  ], ctx.p.smoothness > 0.3 ? 1 : 0);
  side(ctx, rec, 'Body', shell, w, 0.006);

  // Inset side panels (protrude slightly so they read as separate plates).
  const panel: Vec2[] = smoothPolygon([
    [z0 + 0.035, bottom + 0.012], [z1 - 0.05, bottom + 0.01], [z1 - 0.035, top * 0.4], [z1 - 0.07, top - 0.012], [z0 + 0.05, top - 0.008],
  ], 1);
  side(ctx, rec, 'Trim', panel, w + 0.005, 0.0018);

  // Light strip along the panel.
  if (ctx.style.traits.glow) {
    const yS = (bottom + top) * 0.5 - 0.002;
    side(ctx, rec, 'Emissive', [[z0 + 0.06, yS - 0.002], [z1 - 0.07, yS - 0.002], [z1 - 0.075, yS + 0.002], [z0 + 0.065, yS + 0.002]], w + 0.008);
    // Status lights on the back.
    for (let i = 0; i < 2 + Math.round(p.detail * 2); i++) {
      put(ctx, rec, 'Emissive', box([0, top - 0.005 - i * 0.007, z0 - 0.0005], [0.012, 0.003, 0.003]));
    }
  }

  // Top vents.
  if (p.detail > 0.3) {
    const n = 3 + Math.round(p.detail * 3);
    for (let i = 0; i < n; i++) {
      const z = z0 + 0.09 + i * 0.014;
      put(ctx, rec, 'Detail', box([0, 0, 0], [w * 0.55, 0.004, 0.006], ctx.bevel(0.001)), [0, top + hump * 0.8 - 0.0005, z], [0.35, 0, 0]);
    }
  }

  // Charging slider on the side (moves back).
  const ch = b.component('ChargingHandle', {
    kind: 'charging_handle',
    variant: 'slider',
    pivot: [w / 2, top * 0.5, z1 - 0.06],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.05], purpose: 'charge' },
  });
  put(ctx, ch, 'Accent', box([w / 2 + 0.004, top * 0.5, z1 - 0.06], [0.008, 0.008, 0.02], ctx.bevel(0.002)));

  triggerAndGuard(ctx, 'Body', 'round');
};

export const RECEIVERS: Record<string, PartBuilder> = { angular, cylindrical, sleek };
