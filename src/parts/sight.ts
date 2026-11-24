/**
 * Sights and optics. Every rifle gets SOCKET_Optic (the mount point) and
 * SOCKET_ADS (where a camera sits to aim down sights), even with no optic.
 */
import { lampOptic, smartOptic } from './punk.js';
import { AXIS_X, AXIS_Y, Vec2, box, cylinder, lathe, tube, ring, dome } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put, side } from './context.js';
import { leafSight } from './era.js';

/** Builds the optic; returns the sight-line height and the optic's rear z. */
export type OpticBuilder = (ctx: BuildContext, c: Component, y: number, z: number) => { eyeY: number; rearZ: number };

/** Lathe profile for a scope-like tube with recessed lenses at both ends. */
function scopeBody(stations: Vec2[], lensRecess = 0.006): Vec2[] {
  const [rBack, zBack] = stations[0];
  const [rFront, zFront] = stations[stations.length - 1];
  return [
    [0, zBack + lensRecess], [rBack * 0.85, zBack + lensRecess], [rBack * 0.85, zBack],
    ...stations,
    [rFront * 0.88, zFront], [rFront * 0.88, zFront - lensRecess], [0, zFront - lensRecess],
  ];
}

function lenses(ctx: BuildContext, c: Component, y: number, z: number, back: [number, number], front: [number, number], recess = 0.006) {
  const seg = ctx.seg(1);
  put(ctx, c, 'Glass', cylinder(back[0] * 0.86, back[1] + recess - 0.0012, back[1] + recess - 0.0002, seg), [0, y, z]);
  put(ctx, c, 'Glass', cylinder(front[0] * 0.89, front[1] - recess + 0.0002, front[1] - recess + 0.0012, seg), [0, y, z]);
}

const irons: OpticBuilder = (ctx, c, y, z) => {
  const { L } = ctx;
  const carry = ctx.style.traits.rails || (ctx.style.traits.era ?? 0) >= 1960;
  // Carry handles belong on flat-topped aluminium-style receivers.
  const odds = (ctx.style.traits.era ?? 0) >= 1960 ? 0.85 : 0.5;
  if (carry && !L.extra.beadSight && ['angular', 'plated'].includes(ctx.chosen.receiver) && ctx.rng('irons').chance(odds)) return carryHandleIrons(ctx, c, y);
  const rz = L.rec.z0 + 0.03;
  put(ctx, c, 'Detail', box([0, y + 0.004, rz], [0.018, 0.008, 0.022], ctx.bevel(0.0015)));
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.0065, y + 0.014, rz], [0.003, 0.014, 0.008], ctx.bevel(0.0008)));
  const ap = y + 0.016;
  put(ctx, c, 'Detail', tube(0.0045, 0.0017, rz - 0.002, rz + 0.002, 10), [0, ap, 0]);
  if (L.extra.beadSight) {
    // Shotguns: a bead at the end of the barrel.
    const bead = ctx.b.component('FrontSight', { kind: 'sight', variant: 'bead', parent: 'Barrel', pivot: [0, L.barrel.radius, L.barrel.z1 - 0.012] });
    put(ctx, bead, 'Trim', cylinder(0.0025, 0, 0.004, 8), [0, L.barrel.radius - 0.0005, L.barrel.z1 - 0.012], AXIS_Y);
    void z;
    return { eyeY: ap, rearZ: rz - 0.01 };
  }
  // Front post on the front sight component (rides on the handguard).
  const fz = L.handguard.z1 - 0.014;
  const fy = Math.max(L.mountY, L.handguard.radius);
  const front = ctx.b.component('FrontSight', { kind: 'sight', variant: 'post', parent: 'Handguard', pivot: [0, fy, fz] });
  put(ctx, front, 'Detail', box([0, fy + 0.004, fz], [0.018, 0.008, 0.02], ctx.bevel(0.0015)));
  for (const s of [1, -1]) put(ctx, front, 'Detail', box([s * 0.0065, fy + 0.015, fz], [0.0025, 0.016, 0.008], ctx.bevel(0.0008)));
  put(ctx, front, 'Detail', box([0, fy + 0.014, fz], [0.0025, 0.014, 0.003]));
  void z;
  return { eyeY: ap, rearZ: rz - 0.01 };
};

/** Classic carry-handle rear sight with a triangular "A-frame" front sight. */
function carryHandleIrons(ctx: BuildContext, c: Component, y: number): { eyeY: number; rearZ: number } {
  const { L } = ctx;
  const z0 = L.rec.z0 + 0.012, z1 = Math.min(L.rec.z1 - 0.02, z0 + 0.15), h = 0.03;
  side(ctx, c, 'Body', [
    [z0, y], [z0 + 0.014, y], [z0 + 0.02, y + h - 0.012], [z1 - 0.02, y + h - 0.012], [z1 - 0.012, y], [z1, y], [z1 - 0.004, y + h], [z0 + 0.004, y + h + 0.004],
  ], 0.016, 0.0025);
  const ap = y + h + 0.007;
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.006, ap - 0.002, z0 + 0.008], [0.003, 0.012, 0.01], ctx.bevel(0.0008)));
  put(ctx, c, 'Detail', tube(0.004, 0.0015, z0 + 0.006, z0 + 0.01, 10), [0, ap, 0]);
  const fz = L.handguard.z1 - 0.01;
  const fy = Math.max(L.mountY, L.handguard.radius) - 0.004;
  const front = ctx.b.component('FrontSight', { kind: 'sight', variant: 'a-frame', parent: 'Handguard', pivot: [0, fy, fz] });
  const top = ap + 0.002;
  side(ctx, front, 'Body', [[fz - 0.026, fy], [fz + 0.01, fy], [fz + 0.002, top - 0.004], [fz - 0.008, top - 0.004]], 0.012, 0.002);
  put(ctx, front, 'Detail', box([0, top - 0.001, fz - 0.003], [0.0025, 0.008, 0.003]));
  put(ctx, front, 'Body', box([0, fy - 0.004, fz - 0.006], [L.barrel.radius * 2 + 0.008, 0.012, 0.03], ctx.bevel(0.002)));
  return { eyeY: ap, rearZ: z0 - 0.01 };
}

const reddot: OpticBuilder = (ctx, c, y, z) => {
  const seg = ctx.seg(1);
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.022, 0.008, 0.034], ctx.bevel(0.0015)));
  const yc = y + 0.008 + 0.017;
  put(ctx, c, 'Sight', box([0, y + 0.011, z], [0.02, 0.008, 0.03], ctx.bevel(0.002)));
  put(ctx, c, 'Sight', lathe([[0.0138, -0.022], [0.0165, -0.022], [0.0172, -0.018], [0.0172, 0.016], [0.0185, 0.022], [0.0152, 0.022], [0.0138, 0.012], [0.0138, -0.022]], seg), [0, yc, z]);
  put(ctx, c, 'Glass', cylinder(0.0139, 0.004, 0.0052, seg), [0, yc, z]);
  put(ctx, c, 'Emissive', box([0, yc, z + 0.0035], [0.0014, 0.0014, 0.0006]));
  put(ctx, c, 'Sight', cylinder(0.006, 0, 0.007, 12, ctx.bevel(0.001)), [-0.0165, yc, z], [0, -Math.PI / 2, 0]);
  return { eyeY: yc, rearZ: z - 0.022 };
};

const scope: OpticBuilder = (ctx, c, y, z) => {
  const seg = ctx.seg(1.2);
  // Proportion genes: tube length, objective bell size, eyepiece size.
  const g = ctx.rng('scope');
  const zK = g.range(0.8, 1.25), objK = g.range(0.85, 1.4), eyeK = g.range(0.9, 1.15);
  const yc = y + 0.03 * Math.max(1, objK * 0.95);
  const stations: Vec2[] = ([
    [0.0195, -0.155], [0.0195, -0.095], [0.0127, -0.078], [0.0127, -0.03], [0.017, -0.026], [0.017, 0.026],
    [0.0127, 0.03], [0.0127, 0.055], [0.0225, 0.09], [0.0225, 0.145],
  ] as Vec2[]).map(([r, sz]) => [r * (sz > 0.06 ? objK : sz < -0.08 ? eyeK : 1), sz * zK] as Vec2);
  put(ctx, c, 'Sight', lathe(scopeBody(stations), seg), [0, yc, z]);
  lenses(ctx, c, yc, z, stations[0], stations[stations.length - 1]);
  // Turrets.
  put(ctx, c, 'Sight', cylinder(0.0085, 0, 0.012, 14, ctx.bevel(0.001)), [0, yc + 0.014, z], AXIS_Y);
  put(ctx, c, 'Sight', cylinder(0.0085, 0, 0.012, 14, ctx.bevel(0.001)), [0.014, yc, z], AXIS_X);
  put(ctx, c, 'Trim', cylinder(0.009, 0.012, 0.016, 14, ctx.bevel(0.0008)), [0, yc + 0.014, z], AXIS_Y);
  // Rings and mounts.
  for (const dz of [-0.05 * zK, 0.042 * zK]) {
    put(ctx, c, 'Detail', box([0, (y + yc - 0.012) / 2, z + dz], [0.02, yc - 0.012 - y, 0.014], ctx.bevel(0.0015)));
    put(ctx, c, 'Detail', tube(0.0157, 0.0125, z + dz - 0.007, z + dz + 0.007, seg), [0, yc, 0]);
  }
  return { eyeY: yc, rearZ: z - 0.155 * zK };
};

const holo: OpticBuilder = (ctx, c, y, z) => {
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.026, 0.008, 0.05], ctx.bevel(0.0015)));
  put(ctx, c, 'Sight', box([0, y + 0.014, z], [0.032, 0.014, 0.07], ctx.bevel(0.003)));
  const wy = y + 0.021, wh = 0.026;
  const fz = z + 0.014;
  for (const s of [1, -1]) put(ctx, c, 'Sight', box([s * 0.0145, wy + wh / 2, fz], [0.004, wh, 0.03], ctx.bevel(0.0012)));
  put(ctx, c, 'Sight', box([0, wy + wh + 0.002, fz], [0.033, 0.005, 0.032], ctx.bevel(0.0015)));
  put(ctx, c, 'Glass', box([0, wy + wh / 2, fz + 0.006], [0.025, wh, 0.0015]));
  if (ctx.style.traits.glow) put(ctx, c, 'Emissive', box([0, wy + wh + 0.0048, fz], [0.02, 0.0012, 0.022]));
  else put(ctx, c, 'Emissive', box([0, wy + wh * 0.55, fz + 0.0055], [0.0016, 0.0016, 0.0005]));
  // Buttons on the back.
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.007, y + 0.016, z - 0.0355], [0.008, 0.006, 0.002], ctx.bevel(0.0008)));
  return { eyeY: wy + wh * 0.55, rearZ: z - 0.035 };
};

const brass: OpticBuilder = (ctx, c, y, z) => {
  const { p } = ctx;
  const seg = ctx.seg(1);
  const len = 0.24 + p.length * 0.08;
  const yc = y + 0.03;
  const zb = -len / 2, zf = len / 2;
  const stations: Vec2[] = [
    [0.0145, zb], [0.0145, zb + 0.04], [0.0118, zb + 0.05], [0.0105, zf - 0.08], [0.0155, zf - 0.05], [0.0165, zf],
  ];
  put(ctx, c, 'Sight', lathe(scopeBody(stations, 0.005), seg), [0, yc, z]);
  lenses(ctx, c, yc, z, [0.0145, zb], [0.0165, zf], 0.005);
  const rings = 3 + Math.round(p.ornament * 2);
  for (let i = 0; i < rings; i++) {
    const rz = zb + 0.006 + (i / (rings - 1)) * (len - 0.012);
    put(ctx, c, 'Trim', lathe([[0.0105, rz - 0.004], [0.0185, rz - 0.003], [0.0185, rz + 0.003], [0.0105, rz + 0.004]], seg), [0, yc, z]);
  }
  for (const dz of [-0.05, 0.05]) {
    put(ctx, c, 'Detail', box([0, (y + yc) / 2 - 0.004, z + dz], [0.007, yc - y - 0.008, 0.007], ctx.bevel(0.0012)));
    put(ctx, c, 'Trim', tube(0.0148, 0.0108, z + dz - 0.005, z + dz + 0.005, seg), [0, yc, 0]);
  }
  return { eyeY: yc, rearZ: z + zb };
};

/** Scavenged scope: a steel pipe with bottle-glass lenses, taped to a wooden riser. */
const tube_: OpticBuilder = (ctx, c, y, z) => {
  const seg = ctx.seg(1);
  const yc = y + 0.028;
  const R = 0.016, len = 0.17;
  put(ctx, c, 'Stock', box([0, y + 0.007, z], [0.018, 0.014, 0.08], ctx.bevel(0.001)));
  put(ctx, c, 'Barrel', tube(R, R * 0.82, z - len / 2, z + len / 2, seg), [0, yc, 0]);
  put(ctx, c, 'Glass', cylinder(R * 0.83, z - len / 2 + 0.01, z - len / 2 + 0.012, seg), [0, yc, 0]);
  put(ctx, c, 'Glass', cylinder(R * 0.83, z + len / 2 - 0.012, z + len / 2 - 0.01, seg), [0, yc, 0]);
  for (const dz of [-0.025, 0.025]) {
    put(ctx, c, 'Accent', lathe([[R, z + dz - 0.008], [R + 0.0012, z + dz - 0.007], [R + 0.0012, z + dz + 0.007], [R, z + dz + 0.008]], seg), [0, yc, 0]);
    put(ctx, c, 'Accent', box([0, (y + 0.014 + yc) / 2, z + dz], [0.02, yc - y - 0.012, 0.014]));
  }
  return { eyeY: yc, rearZ: z - len / 2 };
};

/** Rune sight: two glowing rune circles floating on gold posts. */
const runeSight: OpticBuilder = (ctx, c, y, z) => {
  const glow = ctx.style.traits.magic ? 'Emissive' : 'Trim';
  const seg = ctx.seg(1.4);
  const yc = y + 0.03;
  for (const [dz, R] of [[-0.05, 0.012], [0.05, 0.018]] as [number, number][]) {
    put(ctx, c, 'Trim', box([0, (y + yc - R) / 2, z + dz], [0.004, yc - R - y, 0.004], ctx.bevel(0.0008)));
    put(ctx, c, glow, ring(R, 0.0013, 0, seg, 4), [0, yc, z + dz]);
    put(ctx, c, glow, ring(R * 0.55, 0.0008, 0, seg, 4), [0, yc, z + dz]);
  }
  put(ctx, c, glow, dome(0.0018, 0.0018, 6, 2), [0, yc, z + 0.05]);
  return { eyeY: yc, rearZ: z - 0.05 };
};

const leaf: OpticBuilder = (ctx, c, y) => leafSight(ctx, c, y);

export const OPTIC_BUILDERS: Record<string, OpticBuilder> = { irons, reddot, scope, holo, brass, tube: tube_, rune: runeSight, leaf, lamp: lampOptic, smart: smartOptic };
const OPTICS = OPTIC_BUILDERS;
export const OPTIC_NAMES = Object.keys(OPTICS);

export function buildOptic(ctx: BuildContext, choice: string): void {
  const { L } = ctx;
  const y = L.mountY, z = L.opticZ;
  ctx.b.socket({
    name: 'SOCKET_Optic',
    parent: 'Receiver',
    position: [0, y, z],
    forward: [0, 0, 1],
    description: 'Optic mount point on top of the weapon.',
  });
  let eyeY = y + 0.03, rearZ = z - 0.05;
  if (choice !== 'none') {
    const fn = OPTICS[choice];
    if (!fn) throw new Error(`Unknown optic "${choice}". Available: none, ${OPTIC_NAMES.join(', ')}`);
    const c = ctx.b.component('Optic', { kind: 'optic', variant: choice, pivot: [0, y, z] });
    ({ eyeY, rearZ } = fn(ctx, c, y, z));
  }
  ctx.b.socket({
    name: 'SOCKET_ADS',
    parent: 'Receiver',
    position: [0, eyeY, rearZ - 0.07],
    forward: [0, 0, 1],
    description: 'Eye position when aiming down sights (place the camera here).',
  });
}
