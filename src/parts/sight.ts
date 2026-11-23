/**
 * Sights and optics. Every rifle gets SOCKET_Optic (the mount point) and
 * SOCKET_ADS (where a camera sits to aim down sights), even with no optic.
 */
import { AXIS_X, AXIS_Y, Vec2, box, cylinder, lathe, tube } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put } from './context.js';

/** Builds the optic; returns the sight-line height and the optic's rear z. */
type OpticBuilder = (ctx: BuildContext, c: Component, y: number, z: number) => { eyeY: number; rearZ: number };

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
  const rz = L.rec.z0 + 0.03;
  put(ctx, c, 'Detail', box([0, y + 0.004, rz], [0.018, 0.008, 0.022], ctx.bevel(0.0015)));
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.0065, y + 0.014, rz], [0.003, 0.014, 0.008], ctx.bevel(0.0008)));
  const ap = y + 0.016;
  put(ctx, c, 'Detail', tube(0.0045, 0.0017, rz - 0.002, rz + 0.002, 10), [0, ap, 0]);
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
  const yc = y + 0.03;
  const stations: Vec2[] = [
    [0.0195, -0.155], [0.0195, -0.095], [0.0127, -0.078], [0.0127, -0.03], [0.017, -0.026], [0.017, 0.026],
    [0.0127, 0.03], [0.0127, 0.055], [0.0225, 0.09], [0.0225, 0.145],
  ];
  put(ctx, c, 'Sight', lathe(scopeBody(stations), seg), [0, yc, z]);
  lenses(ctx, c, yc, z, [0.0195, -0.155], [0.0225, 0.145]);
  // Turrets.
  put(ctx, c, 'Sight', cylinder(0.0085, 0, 0.012, 14, ctx.bevel(0.001)), [0, yc + 0.014, z], AXIS_Y);
  put(ctx, c, 'Sight', cylinder(0.0085, 0, 0.012, 14, ctx.bevel(0.001)), [0.014, yc, z], AXIS_X);
  put(ctx, c, 'Trim', cylinder(0.009, 0.012, 0.016, 14, ctx.bevel(0.0008)), [0, yc + 0.014, z], AXIS_Y);
  // Rings and mounts.
  for (const dz of [-0.05, 0.042]) {
    put(ctx, c, 'Detail', box([0, (y + yc - 0.012) / 2, z + dz], [0.02, yc - 0.012 - y, 0.014], ctx.bevel(0.0015)));
    put(ctx, c, 'Detail', tube(0.0157, 0.0125, z + dz - 0.007, z + dz + 0.007, seg), [0, yc, 0]);
  }
  return { eyeY: yc, rearZ: z - 0.155 };
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

const OPTICS: Record<string, OpticBuilder> = { irons, reddot, scope, holo, brass };
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
