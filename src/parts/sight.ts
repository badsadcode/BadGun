/**
 * Sights and optics. Every rifle gets SOCKET_Optic (the mount point) and
 * SOCKET_ADS (where a camera sits to aim down sights), even with no optic.
 */
import { lampOptic, smartOptic } from './punk.js';
import { AXIS_X, AXIS_Y, Vec2, Vec3, box, cylinder, lathe, tube, ring, dome, extrudeFront, smoothPolygon } from '../core/geometry.js';
import { OPTIC_BUILDERS_2, flipCap, knob } from './optics2.js';
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
  // Shape genes: tube, open window or boxy housing; riser; sunshade hood.
  const look = ctx.rng('optic:reddot-look');
  const housing = look.weighted(ctx.style.traits.rails || ctx.style.traits.glow ? { tube: 1.2, open: 1, box: 0.8 } : { tube: 1.6, open: 0.4, box: 0.6 });
  const riser = look.chance(0.35) ? 0.01 : 0;
  const hood = look.chance(0.45);
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.022, 0.008, 0.034], ctx.bevel(0.0015)));
  if (riser) side(ctx, c, 'Detail', [[z - 0.017, y + 0.007], [z + 0.017, y + 0.007], [z + 0.013, y + 0.008 + riser], [z - 0.013, y + 0.008 + riser]], 0.02, 0.0012);
  const yb = y + riser;
  if (housing === 'open') {
    // Open reflex: low body, emitter at the back, a big arched window up front.
    const w = 0.03, wh = 0.03, fz = z + 0.012;
    put(ctx, c, 'Sight', box([0, yb + 0.012, z], [0.026, 0.008, 0.046], ctx.bevel(0.002)));
    side(ctx, c, 'Sight', [[z - 0.023, yb + 0.015], [z - 0.004, yb + 0.015], [z - 0.008, yb + 0.022], [z - 0.021, yb + 0.023]], 0.018, 0.0015);
    const outer: Vec2[] = [], inner: Vec2[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      outer.push([(Math.cos(a) * w) / 2, yb + 0.014 + Math.sin(a) * wh]);
      inner.push([Math.cos(a) * (w / 2 - 0.003), yb + 0.014 + Math.sin(a) * (wh - 0.003)]);
    }
    put(ctx, c, 'Sight', extrudeFront([...outer, ...inner.reverse()], fz - (hood ? 0.012 : 0.005), fz + 0.005, ctx.bevel(0.0008)));
    const eye = yb + 0.014 + wh * 0.45;
    const pane = inner.map(([x, yy]) => [x * 0.95, (yy - yb - 0.014) * 0.95] as Vec2);
    put(ctx, c, 'Glass', extrudeFront(pane, -0.0006, 0.0006), [0, yb + 0.0145, fz], [-0.18, 0, 0]);
    put(ctx, c, 'Emissive', box([0, eye, fz - 0.0032], [0.0014, 0.0014, 0.0005]));
    for (let i = 0; i < 2; i++) put(ctx, c, 'Detail', box([0.0135, yb + 0.012, z - 0.012 + i * 0.01], [0.002, 0.004, 0.006], ctx.bevel(0.0005)));
    return { eyeY: eye, rearZ: z - 0.023 };
  }
  if (housing === 'box') {
    // Enclosed box: square window between thick walls, a flat roof that can reach forward as a hood.
    const yw = yb + 0.012, wh = 0.024, z0 = z - 0.022, z1 = z + 0.02, zh = z1 + (hood ? 0.012 : 0);
    put(ctx, c, 'Sight', box([0, yb + 0.01, z], [0.028, 0.006, 0.044], ctx.bevel(0.0015)));
    for (const sx of [1, -1]) put(ctx, c, 'Sight', box([sx * 0.0125, yw + wh / 2, (z0 + zh) / 2], [0.005, wh + 0.002, zh - z0], ctx.bevel(0.0012)));
    side(ctx, c, 'Sight', [[z0, yw + wh - 0.001], [zh, yw + wh - 0.001], [zh, yw + wh + 0.002], [z0 + 0.004, yw + wh + 0.005], [z0, yw + wh + 0.004]], 0.03, 0.0012);
    put(ctx, c, 'Glass', box([0, yw + wh / 2, z1 - 0.002], [0.02, wh, 0.0012]));
    put(ctx, c, 'Glass', box([0, yw + wh / 2, z0 + 0.002], [0.02, wh, 0.0012]));
    put(ctx, c, 'Emissive', box([0, yw + wh / 2, z1 - 0.0034], [0.0014, 0.0014, 0.0005]));
    knob(ctx, c, 'Detail', 0.005, 0.004, [0.015, yw + wh / 2, z - 0.004], 'left');
    for (const sx of [1, -1]) put(ctx, c, 'Detail', box([sx * 0.006, yw + wh + 0.0045, z - 0.008], [0.006, 0.002, 0.005], ctx.bevel(0.0004)));
    return { eyeY: yw + wh / 2, rearZ: z0 };
  }
  const yc = yb + 0.008 + 0.017;
  const zf = hood ? 0.036 : 0.022;
  put(ctx, c, 'Sight', box([0, yb + 0.011, z], [0.02, 0.008, 0.03], ctx.bevel(0.002)));
  put(ctx, c, 'Sight', lathe([[0.0138, -0.022], [0.0165, -0.022], [0.0172, -0.018], [0.0172, 0.016], [0.0185, 0.022], [0.0185, zf], [0.0152, zf], [0.0138, 0.012], [0.0138, -0.022]], seg), [0, yc, z]);
  if (hood) put(ctx, c, 'Trim', tube(0.0193, 0.0178, 0.024, 0.028, seg), [0, yc, z]);
  put(ctx, c, 'Glass', cylinder(0.0139, 0.004, 0.0052, seg), [0, yc, z]);
  put(ctx, c, 'Emissive', box([0, yc, z + 0.0035], [0.0014, 0.0014, 0.0006]));
  if (look.chance(0.5)) put(ctx, c, 'Sight', cylinder(0.006, 0, 0.007, 12, ctx.bevel(0.001)), [-0.0165, yc, z], [0, -Math.PI / 2, 0]);
  else {
    put(ctx, c, 'Sight', cylinder(0.0075, 0, 0.007, 12, ctx.bevel(0.001)), [0.0165, yc, z - 0.006], AXIS_X);
    knob(ctx, c, 'Sight', 0.0055, 0.006, [0, yc + 0.016, z - 0.004], 'up');
  }
  return { eyeY: yc, rearZ: z - 0.022 };
};

const scope: OpticBuilder = (ctx, c, y, z) => {
  const seg = ctx.seg(1.2);
  // Proportion genes: tube length, objective bell size, eyepiece size.
  const g = ctx.rng('scope');
  const zK = g.range(0.8, 1.25), objK = g.range(0.85, 1.4), eyeK = g.range(0.9, 1.15);
  // Shape genes, kept period-appropriate: objective bell, turrets, mount, eyepiece, caps or sunshade, ribs.
  const look = ctx.rng('optic:scope-look');
  const era = ctx.style.traits.era ?? 0;
  const old = (era > 0 && era < 1960) || ctx.style.traits.plumbing || !!ctx.style.traits.diesel;
  const bell = look.weighted(old ? { straight: 2, flared: 1 } : { straight: 0.6, flared: 1.5, big: 1 });
  const turrets = look.weighted(old ? { capped: 1, none: 1 } : { capped: 1.4, tall: 1, none: 0.4 });
  const mount = look.weighted(old ? { rings: 1, clamp: 1 } : ctx.style.traits.rails ? { rings: 1, cantilever: 1, clamp: 0.6 } : { rings: 1.2, cantilever: 0.4, clamp: 0.8 });
  const eyepiece = look.weighted({ standard: 1, long: old ? 0.2 : 0.8, tapered: 0.7 });
  const extra = look.weighted(old ? { none: 2, shade: 1 } : { none: 1.2, shade: 0.8, caps: 0.8 });
  const ribbed = look.chance(old ? 0.15 : 0.35);
  const back: Vec2[] = eyepiece === 'long' ? [[0.0185, -0.155], [0.0185, -0.135], [0.0205, -0.13], [0.0205, -0.105], [0.0185, -0.1], [0.0127, -0.078]]
    : eyepiece === 'tapered' ? [[0.0178, -0.155], [0.0162, -0.12], [0.0127, -0.085]]
    : [[0.0195, -0.155], [0.0195, -0.095], [0.0127, -0.078]];
  const sr = turrets === 'none' ? 0.0148 : 0.017;
  const mid: Vec2[] = [[0.0127, -0.03], [sr, -0.026], [sr, 0.026], [0.0127, 0.03]];
  const front: Vec2[] = bell === 'straight' ? [[0.0127, 0.06], [0.0148, 0.07], [0.0148, 0.145]]
    : bell === 'big' ? [[0.0127, 0.048], [0.0265, 0.1], [0.027, 0.15]]
    : [[0.0127, 0.055], [0.0225, 0.09], [0.0225, 0.145]];
  const fK = bell === 'straight' ? Math.min(objK, 1.1) : bell === 'big' ? Math.sqrt(objK) : objK;
  const stations: Vec2[] = [...back, ...mid, ...front].map(([r, sz]) => [r * (sz > 0.06 ? fK : sz < -0.08 ? eyeK : 1), sz * zK] as Vec2);
  const rF = stations[stations.length - 1][0];
  const yc = y + Math.max(0.03 * Math.max(1, objK * 0.95), rF + 0.009);
  put(ctx, c, 'Sight', lathe(scopeBody(stations), seg), [0, yc, z]);
  lenses(ctx, c, yc, z, stations[0], stations[stations.length - 1]);
  const zB = z + stations[0][1], zF = z + stations[stations.length - 1][1];
  // Turrets.
  if (turrets === 'capped') {
    put(ctx, c, 'Sight', cylinder(0.0085, 0, 0.012, 14, ctx.bevel(0.001)), [0, yc + 0.014, z], AXIS_Y);
    put(ctx, c, 'Sight', cylinder(0.0085, 0, 0.012, 14, ctx.bevel(0.001)), [0.014, yc, z], AXIS_X);
    put(ctx, c, 'Trim', cylinder(0.009, 0.012, 0.016, 14, ctx.bevel(0.0008)), [0, yc + 0.014, z], AXIS_Y);
  } else if (turrets === 'tall') {
    knob(ctx, c, 'Sight', 0.0098, 0.022, [0, yc + 0.0155, z], 'up');
    for (const h of [0.006, 0.011, 0.016]) knob(ctx, c, 'Trim', 0.0104, 0.0022, [0, yc + 0.0155 + h, z], 'up', 0.0003);
    knob(ctx, c, 'Sight', 0.0092, 0.016, [-0.0155, yc, z], 'right');
    knob(ctx, c, 'Trim', 0.0098, 0.0022, [-0.0155 - 0.009, yc, z], 'right', 0.0003);
    knob(ctx, c, 'Sight', 0.0075, 0.008, [0.0155, yc, z + 0.004], 'left');
  } else {
    knob(ctx, c, 'Sight', 0.0068, 0.0045, [0, yc + 0.013, z], 'up');
    knob(ctx, c, 'Sight', 0.0068, 0.0045, [0.013, yc, z], 'left');
  }
  // Mounts.
  const ringZ = [-0.05 * zK, (bell === 'big' ? 0.038 : 0.042) * zK];
  if (mount === 'cantilever') {
    const a = z + ringZ[0], b = z + ringZ[1] + 0.012 * zK, ry = yc - 0.0127;
    side(ctx, c, 'Detail', [
      [a - 0.012, y], [a + 0.05, y], [a + 0.05, y + 0.008], [b + 0.007, ry + 0.002], [b - 0.007, ry + 0.002],
      [a + 0.03, y + 0.013], [a + 0.01, y + 0.013], [a + 0.007, ry + 0.002], [a - 0.007, ry + 0.002], [a - 0.012, y + 0.011],
    ], 0.02, 0.0018);
    for (const rz of [a, b]) put(ctx, c, 'Detail', tube(0.0157, 0.0125, rz - 0.007, rz + 0.007, seg), [0, yc, 0]);
  } else if (mount === 'clamp') {
    const a = z + ringZ[0], b = z + ringZ[1];
    put(ctx, c, 'Detail', box([0, y + 0.005, (a + b) / 2], [0.022, 0.01, b - a + 0.03], ctx.bevel(0.0015)));
    for (const rz of [a, b]) {
      side(ctx, c, 'Detail', [[rz - 0.009, y + 0.009], [rz + 0.009, y + 0.009], [rz + 0.006, yc - 0.01], [rz - 0.006, yc - 0.01]], 0.014, 0.001);
      put(ctx, c, 'Detail', tube(0.0152, 0.0125, rz - 0.006, rz + 0.006, seg), [0, yc, 0]);
      for (const sx of [1, -1]) put(ctx, c, 'Detail', dome(0.0016, 0.001, 6, 2), [sx * 0.011, y + 0.005, rz], sx > 0 ? AXIS_X : [0, -Math.PI / 2, 0]);
    }
  } else {
    for (const dz of ringZ) {
      put(ctx, c, 'Detail', box([0, (y + yc - 0.012) / 2, z + dz], [0.02, yc - 0.012 - y, 0.014], ctx.bevel(0.0015)));
      put(ctx, c, 'Detail', tube(0.0157, 0.0125, z + dz - 0.007, z + dz + 0.007, seg), [0, yc, 0]);
    }
  }
  // Ribbed objective, sunshade or flip caps.
  if (ribbed) for (let i = 0; i < 4; i++) put(ctx, c, 'Trim', tube(rF + 0.0012, rF - 0.001, zF - 0.035 * zK + i * 0.006, zF - 0.033 * zK + i * 0.006, seg), [0, yc, 0]);
  if (extra === 'shade') put(ctx, c, 'Sight', tube(rF + 0.0006, rF - 0.0012, zF - 0.004, zF + 0.05 * zK, seg), [0, yc, 0]);
  if (extra === 'caps') {
    flipCap(ctx, c, 'Grip', stations[0][0] + 0.001, yc, zB, -1);
    flipCap(ctx, c, 'Grip', rF + 0.001, yc, zF, 1);
  }
  return { eyeY: yc, rearZ: zB };
};

const holo: OpticBuilder = (ctx, c, y, z) => {
  // Shape genes: window shape, button layout, base length.
  const look = ctx.rng('optic:holo-look');
  const win = look.weighted({ square: 1, rounded: 1, trapezoid: 0.8 });
  const buttons = look.weighted({ rear: 1, side: 1, top: 0.6 });
  const bl = look.range(0.9, 1.3);
  put(ctx, c, 'Detail', box([0, y + 0.004, z], [0.026, 0.008, 0.05], ctx.bevel(0.0015)));
  put(ctx, c, 'Sight', box([0, y + 0.014, z - (bl - 1) * 0.035], [0.032, 0.014, 0.07 * bl], ctx.bevel(0.003)));
  const wy = y + 0.021, wh = 0.026;
  const fz = z + 0.014;
  const zr = z - 0.035 - (bl - 1) * 0.07;
  if (win === 'rounded') {
    const r0 = 0.0165, r1 = 0.0125;
    const outer: Vec2[] = [[r0, wy]], inner: Vec2[] = [[r1, wy]];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      outer.push([Math.cos(a) * r0, wy + wh - 0.01 + Math.sin(a) * 0.016]);
      inner.push([Math.cos(a) * r1, wy + wh - 0.01 + Math.sin(a) * 0.0125]);
    }
    outer.push([-r0, wy]);
    inner.push([-r1, wy]);
    put(ctx, c, 'Sight', extrudeFront([...outer, ...inner.reverse()], fz - 0.015, fz + 0.015, ctx.bevel(0.0012)));
  } else if (win === 'trapezoid') {
    // Leaning-back trapezoid hood, wider at the top.
    const lean: Vec3 = [-0.2, 0, 0], at: Vec3 = [0, wy, fz];
    put(ctx, c, 'Sight', extrudeFront([[0.0165, -0.002], [0.02, wh + 0.005], [-0.02, wh + 0.005], [-0.0165, -0.002], [-0.0125, -0.002], [-0.0155, wh], [0.0155, wh], [0.0125, -0.002]], -0.016, 0.016, ctx.bevel(0.0012)), at, lean);
    put(ctx, c, 'Glass', box([0, wh / 2, 0.006], [0.027, wh, 0.0015]), at, lean);
    put(ctx, c, 'Emissive', ctx.style.traits.glow ? box([0, wh + 0.0058, 0], [0.024, 0.0012, 0.022]) : box([0, wh * 0.55, 0.0055], [0.0016, 0.0016, 0.0005]), at, lean);
  } else {
    for (const s of [1, -1]) put(ctx, c, 'Sight', box([s * 0.0145, wy + wh / 2, fz], [0.004, wh, 0.03], ctx.bevel(0.0012)));
    put(ctx, c, 'Sight', box([0, wy + wh + 0.002, fz], [0.033, 0.005, 0.032], ctx.bevel(0.0015)));
  }
  if (win !== 'trapezoid') {
    put(ctx, c, 'Glass', box([0, wy + wh / 2, fz + 0.006], [0.025, wh, 0.0015]));
    if (ctx.style.traits.glow) put(ctx, c, 'Emissive', box([0, wy + wh + (win === 'rounded' ? 0.0068 : 0.0048), fz], [0.02, 0.0012, 0.022]));
    else put(ctx, c, 'Emissive', box([0, wy + wh * 0.55, fz + 0.0055], [0.0016, 0.0016, 0.0005]));
  }
  if (buttons === 'rear') for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * 0.007, y + 0.016, zr - 0.0005], [0.008, 0.006, 0.002], ctx.bevel(0.0008)));
  else if (buttons === 'side') for (let i = 0; i < 3; i++) put(ctx, c, 'Detail', box([0.0165, y + 0.015, zr + 0.01 + i * 0.009], [0.002, 0.006, 0.006], ctx.bevel(0.0005)));
  else for (let i = 0; i < 2; i++) put(ctx, c, 'Detail', box([0.006 - i * 0.012, y + 0.0215, zr + 0.012], [0.007, 0.002, 0.008], ctx.bevel(0.0005)));
  if (bl > 1.12) knob(ctx, c, 'Detail', 0.0055, 0.004, [-0.016, y + 0.014, zr + 0.016], 'right');
  return { eyeY: wy + wh * 0.55, rearZ: zr };
};

const brass: OpticBuilder = (ctx, c, y, z) => {
  const { p } = ctx;
  const seg = ctx.seg(1);
  // Shape genes: telescoping draw tube, ornate end bells, ring count, scrolled brackets.
  const look = ctx.rng('optic:brass-look');
  const draw = look.chance(0.45);
  const ends = look.weighted({ plain: 1, trumpet: 1, crown: 0.6 });
  const scroll = look.chance(0.45);
  const len = 0.24 + p.length * 0.08;
  const yc = y + 0.03;
  const zb = -len / 2, zf = len / 2;
  const stations: Vec2[] = draw
    ? [[0.0135, zb], [0.0135, zb + 0.012], [0.0094, zb + 0.018], [0.0094, zb + 0.06], [0.0114, zb + 0.062], [0.0114, zf - 0.1], [0.013, zf - 0.098], [0.013, zf - 0.06], [0.0155, zf - 0.05], [0.0165, zf]]
    : [[0.0145, zb], [0.0145, zb + 0.04], [0.0118, zb + 0.05], [0.0105, zf - 0.08], [0.0155, zf - 0.05], [0.0165, zf]];
  put(ctx, c, 'Sight', lathe(scopeBody(stations, 0.005), seg), [0, yc, z]);
  lenses(ctx, c, yc, z, stations[0], [0.0165, zf], 0.005);
  const rings = Math.max(2, 3 + Math.round(p.ornament * 2) + look.int(-1, 1));
  for (let i = 0; i < rings; i++) {
    const rz = zb + 0.006 + (i / (rings - 1)) * (len - 0.012);
    put(ctx, c, 'Trim', lathe([[0.0085, rz - 0.004], [0.0185, rz - 0.003], [0.0185, rz + 0.003], [0.0085, rz + 0.004]], seg), [0, yc, z]);
  }
  if (ends === 'trumpet') {
    put(ctx, c, 'Trim', lathe([[0.0158, zf - 0.016], [0.0175, zf - 0.008], [0.0235, zf + 0.004], [0.021, zf + 0.004], [0.0158, zf - 0.002]], seg), [0, yc, z]);
    put(ctx, c, 'Trim', lathe([[0.0118, zb + 0.012], [0.017, zb - 0.006], [0.0185, zb - 0.006], [0.0125, zb + 0.014]], seg), [0, yc, z]);
  } else if (ends === 'crown') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      put(ctx, c, 'Trim', dome(0.0024, 0.006, 6, 2), [Math.cos(a) * 0.0172, yc + Math.sin(a) * 0.0172, z + zf - 0.002]);
    }
  }
  for (const dz of [-0.05, 0.05]) {
    if (scroll) side(ctx, c, 'Trim', smoothPolygon([[z + dz - 0.014, y], [z + dz + 0.014, y], [z + dz + 0.004, y + 0.006], [z + dz + 0.009, yc - 0.012], [z + dz - 0.009, yc - 0.012], [z + dz - 0.004, y + 0.006]], 2), 0.006, 0.001);
    else put(ctx, c, 'Detail', box([0, (y + yc) / 2 - 0.004, z + dz], [0.007, yc - y - 0.008, 0.007], ctx.bevel(0.0012)));
    put(ctx, c, 'Trim', tube(0.0148, 0.0108, z + dz - 0.005, z + dz + 0.005, seg), [0, yc, 0]);
  }
  return { eyeY: yc, rearZ: z + zb - (ends === 'trumpet' ? 0.006 : 0) };
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

export const OPTIC_BUILDERS: Record<string, OpticBuilder> = { irons, reddot, scope, holo, brass, tube: tube_, rune: runeSight, leaf, lamp: lampOptic, smart: smartOptic, ...OPTIC_BUILDERS_2 };
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
