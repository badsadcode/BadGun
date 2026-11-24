/**
 * The "bodies" update: ten more long-gun receivers, each with its own
 * silhouette. Generic, original shapes (not replicas of real guns).
 *
 *   battle      tall slab-sided battle rifle, big ejection port, side charging tube
 *   skeletal    open truss frame you can see through, bolt carrier inside
 *   boxy        welded sheet-metal box with rectangular cooling holes
 *   capsule     rounded sci-fi pod with seams and a glowing window
 *   brick       heavy machine-gun box with a hinged feed cover and sling lugs
 *   hunter      sporting rifle: low rounded receiver, engraved panel, bolt shroud
 *   drum        revolving rifle: an open frame around a fluted cylinder
 *   carved      wood-panelled body with metal inlays (fantasy / steampunk)
 *   industrial  exposed hydraulic pistons and lines (diesel / cyber)
 *   organic     a curved spine wrapped in ribs (sci-fi / fantasy)
 *
 * Same contract as receiver.ts: create the root `Receiver`, draw around
 * `L.rec`, set `L.mountY`, call `triggerAndGuard`.
 */
import { AXIS_X, Geometry, Vec2, Vec3, bezier, box, cylinder, dome, extrudeFront, lathe, ring, rod, roundedRect, smoothPolygon } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext, put, side } from './context.js';
import { rail, rivetRow, triggerAndGuard } from './receiver.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bullpups carry the butt below the receiver: the rear drops this much. */
const rearDrop = (ctx: BuildContext) => (ctx.chosen.config === 'bullpup' ? 0.02 : 0);

/**
 * Bottom edge of a body, rear to front, from zA to zB at height y. Bullpups
 * get a lowered rear section that houses the magazine (and meets the butt).
 */
function bottomEdge(ctx: BuildContext, zA: number, zB: number, y: number): Vec2[] {
  const drop = rearDrop(ctx);
  if (!drop) return [[zA, y], [zB, y]];
  const zs = ctx.L.magwell.z1 + 0.014;
  return [[zA, y - drop], [zs, y - drop], [zs + 0.012, y], [zB, y]];
}

/** Flared magazine well below the body (skipped when the magazine has none). */
function magwell(ctx: BuildContext, comp: Component, slot: MaterialSlot, width: number, k = 1): void {
  const { L, p } = ctx;
  if (L.magwell.flare === false) return;
  const { z0: m0, z1: m1 } = L.magwell;
  const y = L.rec.bottom - rearDrop(ctx) + 0.004;
  const f = (0.016 + p.bulk * 0.006) * k;
  side(ctx, comp, slot, [[m0 - 0.008, y], [m0 - 0.011, y - f], [m1 + 0.004, y - f], [m1 + 0.014, y]], width, 0.002);
}

/** Squash a geometry across X (keeps normals right), for oval cross-sections. */
function squashX(g: Geometry, k: number): Geometry {
  for (let i = 0; i < g.vertexCount; i++) {
    g.positions[i * 3] *= k;
    const nx = g.normals[i * 3] / k, ny = g.normals[i * 3 + 1], nz = g.normals[i * 3 + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    g.normals[i * 3] = nx / l;
    g.normals[i * 3 + 1] = ny / l;
    g.normals[i * 3 + 2] = nz / l;
  }
  return g;
}

/** A straight bar between two side-profile points, `t` thick. */
function bar(a: Vec2, b: Vec2, t: number): Vec2[] {
  const dz = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dz, dy) || 1;
  const nz = (-dy / l) * (t / 2), ny = (dz / l) * (t / 2);
  return [[a[0] + nz, a[1] + ny], [b[0] + nz, b[1] + ny], [b[0] - nz, b[1] - ny], [a[0] - nz, a[1] - ny]];
}

/** A thick polyline (side profile) of varying width, for scrolls and veins. */
function strip(line: Vec2[], w0: number, w1: number): Vec2[] {
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i], q = line[Math.min(i + 1, line.length - 1)], o = line[Math.max(i - 1, 0)];
    const dz = q[0] - o[0], dy = q[1] - o[1];
    const l = Math.hypot(dz, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, line.length - 1))) / 2;
    left.push([p[0] - (dy / l) * w, p[1] + (dz / l) * w]);
    right.push([p[0] + (dy / l) * w, p[1] - (dz / l) * w]);
  }
  return [...left, ...right.reverse()];
}

/**
 * Lower frame for round/pod bodies: holds the trigger, grip and magazine.
 * Spans from behind the grip to in front of the magwell (or to the butt on a bullpup).
 */
function lowerFrame(ctx: BuildContext, comp: Component, slot: MaterialSlot, yTop: number, width: number, smooth = 0): void {
  const { L } = ctx;
  const zLo = rearDrop(ctx) ? L.rec.z0 + 0.004 : Math.min(L.grip.z - 0.022, L.magwell.z0 - 0.014);
  const zHi = Math.min(L.rec.z1 - 0.02, Math.max(L.magwell.z1 + 0.016, L.trigger.z + 0.034));
  const pts: Vec2[] = [[zLo, yTop], [zHi + 0.01, yTop], [zHi, L.rec.bottom + 0.008], [zHi - 0.008, L.rec.bottom], ...bottomEdge(ctx, zLo + 0.01, zHi - 0.008, L.rec.bottom).reverse()];
  pts.push([zLo, L.rec.bottom - rearDrop(ctx) + 0.008]);
  side(ctx, comp, slot, smooth ? smoothPolygon(pts, smooth) : pts, width, 0.002);
}

function chargingHandle(ctx: BuildContext, variant: string, pivot: Vec3, travel: number) {
  return ctx.b.component('ChargingHandle', {
    kind: 'charging_handle', variant, pivot,
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, travel], purpose: 'charge' },
  });
}

const receiver = (ctx: BuildContext, variant: string) => ctx.b.component('Receiver', { kind: 'receiver', variant, parent: null });
const glowSlot = (ctx: BuildContext): MaterialSlot => (ctx.style.traits.glow || ctx.style.traits.magic ? 'Emissive' : 'Accent');

// ---------------------------------------------------------------------------
// Receivers
// ---------------------------------------------------------------------------

/** Battle rifle: a tall slab with a big ejection port, pressed ribs and a side charging tube. */
const battle: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = receiver(ctx, 'battle');
  const { z0, z1, bottom, width: w } = L.rec;
  const T = L.rec.top + 0.008 + p.bulk * 0.004;
  L.rec.top = T;
  side(ctx, rec, 'Body', [
    ...bottomEdge(ctx, z0 + 0.008, z1 - 0.012, bottom), [z1, bottom + 0.012], [z1, T - 0.008], [z1 - 0.012, T],
    [z0 + 0.03, T], [z0, T - 0.018], [z0, bottom - rearDrop(ctx) + 0.008],
  ], w, 0.002);
  // Pressed stiffening ribs along both sides.
  const yr = (T + bottom) / 2 + 0.008;
  side(ctx, rec, 'Body', [[z0 + 0.03, yr - 0.003], [z1 - 0.03, yr - 0.003], [z1 - 0.034, yr + 0.003], [z0 + 0.034, yr + 0.003]], w + 0.003, 0.001);
  // Big ejection port on the right (-X): a frame with a dark opening and the bolt face inside.
  const ez = z0 + (z1 - z0) * 0.56, ey = 0.003, el = 0.07 + p.bulk * 0.01;
  put(ctx, rec, 'Trim', box([-w / 2 - 0.0006, ey, ez], [0.0016, 0.024, el + 0.008], ctx.bevel(0.0008)));
  put(ctx, rec, 'Detail', box([-w / 2 - 0.001, ey, ez], [0.0018, 0.017, el]));
  put(ctx, rec, 'Barrel', box([-w / 2 - 0.0016, ey, ez - el * 0.2], [0.0012, 0.012, el * 0.35], ctx.bevel(0.0005)));
  magwell(ctx, rec, 'Body', w * 0.92, 1.25);
  // Paddle magazine release behind the well.
  if (L.magwell.flare !== false) put(ctx, rec, 'Detail', box([0, bottom - 0.008, L.magwell.z0 - 0.016], [w * 0.5, 0.012, 0.004], ctx.bevel(0.0008)), undefined, undefined);
  // Selector lever on the left.
  put(ctx, rec, 'Detail', cylinder(0.006, 0, 0.0025, ctx.seg(0.6)), [w / 2, bottom + 0.014, L.trigger.z - 0.02], AXIS_X);
  put(ctx, rec, 'Detail', box([w / 2 + 0.003, bottom + 0.017, L.trigger.z - 0.026], [0.002, 0.004, 0.016], ctx.bevel(0.0005)), undefined, [0.5, 0, 0]);
  // Charging tube along the upper left side, with a folding knob that rides in it.
  const ty = T - 0.012, tx = w / 2 + 0.004, tz0 = z0 + (z1 - z0) * 0.45, tz1 = z1 - 0.004;
  put(ctx, rec, 'Detail', cylinder(0.0055, tz0, tz1, ctx.seg(0.6), ctx.bevel(0.001)), [tx, ty, 0]);
  const kz = z1 - 0.03;
  const ch = chargingHandle(ctx, 'side-knob', [tx, ty, kz], 0.08);
  put(ctx, ch, 'Detail', rod([tx, ty, kz], [tx + 0.02, ty + 0.002, kz - 0.006], 0.0026, ctx.seg(0.4)));
  put(ctx, ch, 'Grip', cylinder(0.0045, -0.007, 0.007, ctx.seg(0.5), ctx.bevel(0.001)), [tx + 0.022, ty + 0.002, kz - 0.006], [-Math.PI / 2, 0, 0]);
  // Rear sight ears / rail.
  if (ctx.style.traits.rails) {
    rail(ctx, rec, z0 + 0.03, z1 - 0.008, T);
    L.mountY = T + 0.0075;
  } else {
    L.mountY = T;
    if (p.detail > 0.4) rivetRow(ctx, rec, 'Detail', [[w / 2 + 0.0004, bottom + 0.008, z0 + 0.03], [w / 2 + 0.0004, bottom + 0.008, z1 - 0.03], [-w / 2 - 0.0004, bottom + 0.008, z0 + 0.03], [-w / 2 - 0.0004, bottom + 0.008, z1 - 0.03]], 0.0024);
  }
  triggerAndGuard(ctx, 'Body', 'square');
};

/** Skeletal: an open truss frame (see-through), bolt carrier and spring visible inside. */
const skeletal: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = receiver(ctx, 'skeletal');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const drop = rearDrop(ctx);
  const beam = 0.009;
  // Top beam (full width), bottom beam, solid front trunnion block and rear post.
  side(ctx, rec, 'Body', [[z0, top - beam], [z1, top - beam], [z1, top], [z0 + 0.01, top], [z0, top - 0.004]], w, 0.0015);
  side(ctx, rec, 'Body', [...bottomEdge(ctx, z0, z1 - 0.02, bottom), [z1 - 0.02, bottom + beam], [z0, bottom + beam]], w * 0.9, 0.0015);
  side(ctx, rec, 'Body', [[z1 - 0.032, bottom + 0.004], [z1, bottom + 0.012], [z1, top - 0.004], [z1 - 0.032, top - 0.004]], w, 0.002);
  side(ctx, rec, 'Body', [[z0, bottom - drop + 0.004], [z0 + 0.012, bottom - drop + 0.004], [z0 + 0.012, top - 0.004], [z0, top - 0.004]], w, 0.0015);
  // Side trusses: thin plates on each side, so you can see in between.
  const za = z0 + 0.012, zb = z1 - 0.032, yb = bottom + beam - 0.002, yt = top - beam + 0.002;
  const n = 3 + Math.round(p.detail * 2);
  const d = (zb - za) / n, t = 0.0065, xs = w / 2 - 0.003;
  for (let i = 0; i < n; i++) {
    const zA = za + i * d, zB = zA + d;
    const diag = i % 2 === 0 ? bar([zA, yb], [zB, yt], t) : bar([zA, yt], [zB, yb], t);
    for (const s of [1, -1]) {
      side(ctx, rec, 'Body', diag, 0.005, 0.0008, s * xs);
      if (i > 0) side(ctx, rec, 'Body', bar([zA, yb], [zA, yt], t * 0.8), 0.005, 0.0008, s * xs);
    }
  }
  // Magazine well block (solid), and the butt housing on bullpups.
  const { z0: m0, z1: m1 } = L.magwell;
  if (L.magwell.flare !== false || !drop) side(ctx, rec, 'Body', [[m0 - 0.01, bottom + beam], [m1 + 0.01, bottom + beam], [m1 + 0.01, bottom - 0.004 - drop], [m0 - 0.01, bottom - 0.004 - drop]], w * 0.86, 0.0015);
  if (drop) side(ctx, rec, 'Body', [[z0, bottom - drop], [m1 + 0.012, bottom - drop], [m1 + 0.012, bottom + beam], [z0, bottom + beam]], w * 0.88, 0.0015);
  magwell(ctx, rec, 'Body', w * 0.86, 0.8);
  // Inside: bolt carrier on the bore axis and a recoil spring above it.
  const seg = ctx.seg(0.7);
  put(ctx, rec, 'Barrel', cylinder(Math.min(0.012, (top - bottom) * 0.2), z0 + 0.012, zb, seg, ctx.bevel(0.002)));
  const sy = top - beam - 0.005;
  put(ctx, rec, 'Detail', cylinder(0.0022, z0 + 0.012, zb, 6), [0, sy, 0]);
  const coils = 8 + Math.round(p.detail * 6);
  for (let i = 0; i < coils; i++) put(ctx, rec, 'Trim', ring(0.004, 0.0009, z0 + 0.02 + (i / coils) * (zb - z0 - 0.03), 8, 4), [0, sy, 0]);
  // Charging knob sticks out of the right side through the truss.
  const kz = z0 + (z1 - z0) * 0.5, ky = 0.006;
  const ch = chargingHandle(ctx, 'bolt-knob', [-w / 2, ky, kz], 0.06);
  put(ctx, ch, 'Detail', cylinder(0.003, 0, w / 2 + 0.008, ctx.seg(0.4)), [0, ky, kz], [0, -Math.PI / 2, 0]);
  put(ctx, ch, 'Accent', cylinder(0.006, 0, 0.008, ctx.seg(0.5), ctx.bevel(0.0015)), [-w / 2 - 0.006, ky, kz], [0, -Math.PI / 2, 0]);
  if (ctx.style.traits.rails) {
    rail(ctx, rec, z0 + 0.012, z1 - 0.006, top);
    L.mountY = top + 0.0075;
  } else L.mountY = top;
  void b;
  triggerAndGuard(ctx, 'Body', 'round');
};

/** Boxy: a welded sheet-metal box with weld beads and rectangular cooling holes. */
const boxy: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = receiver(ctx, 'boxy');
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, rec, 'Body', [...bottomEdge(ctx, z0, z1, bottom), [z1, top], [z0, top]], w, 0.0006);
  // Weld beads along the top edges and the front seam.
  const seg = Math.max(5, ctx.seg(0.3));
  for (const s of [1, -1]) {
    put(ctx, rec, 'Detail', cylinder(0.0013, z0 + 0.002, z1 - 0.002, seg), [s * w / 2, top, 0]);
    put(ctx, rec, 'Detail', rod([s * w / 2, bottom + 0.003, z1 - 0.018], [s * w / 2, top - 0.003, z1 - 0.018], 0.0012, seg));
  }
  // Cooling holes: one or two rows of dark rectangles through the box.
  const rows = p.detail > 0.6 ? 2 : 1;
  const hz0 = z0 + (z1 - z0) * 0.42, hz1 = z1 - 0.03;
  const n = Math.max(3, Math.floor((hz1 - hz0) / 0.02));
  const hh = (top - 0.006) / rows - 0.004;
  for (let r = 0; r < rows; r++) {
    const y = top - 0.005 - hh / 2 - r * (hh + 0.004);
    for (let i = 0; i < n; i++) put(ctx, rec, 'Detail', box([0, y, hz0 + (i + 0.5) * ((hz1 - hz0) / n)], [w + 0.001, hh, ((hz1 - hz0) / n) * 0.62]));
  }
  // Square magazine housing (no flare), like a welded-on sleeve.
  if (L.magwell.flare !== false) {
    const { z0: m0, z1: m1 } = L.magwell;
    const y = bottom - rearDrop(ctx);
    side(ctx, rec, 'Body', [[m0 - 0.006, y + 0.004], [m1 + 0.006, y + 0.004], [m1 + 0.006, y - 0.024], [m0 - 0.006, y - 0.02]], w * 0.82, 0.0008);
    put(ctx, rec, 'Detail', box([0, y - 0.012, m1 + 0.0075], [w * 0.4, 0.016, 0.004], ctx.bevel(0.0006)));
  }
  // End plate at the back, with a screw cap.
  side(ctx, rec, 'Trim', [[z0 - 0.004, bottom - rearDrop(ctx) + 0.002], [z0 + 0.001, bottom - rearDrop(ctx) + 0.002], [z0 + 0.001, top + 0.001], [z0 - 0.004, top + 0.001]], w + 0.002, 0.0008);
  // Cocking slot on top-left and a hook-shaped handle.
  put(ctx, rec, 'Detail', box([w * 0.3, top + 0.0004, (z0 + z1) / 2 + 0.02], [0.004, 0.001, (z1 - z0) * 0.5]));
  const kz = z1 - 0.04, ky = top - 0.01;
  const ch = chargingHandle(ctx, 'hook', [w / 2, ky, kz], 0.07);
  side(ctx, ch, 'Detail', [[kz - 0.006, ky - 0.004], [kz + 0.006, ky - 0.004], [kz + 0.006, ky + 0.008], [kz - 0.012, ky + 0.012], [kz - 0.012, ky + 0.006], [kz - 0.006, ky + 0.004]], 0.004, 0.0008, w / 2 + 0.002);
  put(ctx, ch, 'Detail', box([w / 2 + 0.009, ky + 0.01, kz - 0.009], [0.014, 0.004, 0.005], ctx.bevel(0.0008)));
  if (ctx.style.traits.rails) {
    rail(ctx, rec, z0 + 0.02, z1 - 0.06, top);
    L.mountY = top + 0.0075;
  } else L.mountY = top;
  triggerAndGuard(ctx, 'Body', 'square');
};

/** Capsule: a rounded oval pod with seam bands and a glowing window, over a slim lower. */
const capsule: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = receiver(ctx, 'capsule');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const ry = (top - bottom) * 0.42, yc = top - ry;
  const k = (w / 2) / ry;
  const seg = Math.max(10, ctx.seg(1.3));
  const nose = Math.max(L.handguard.radius * 1.05, ry * 0.55);
  const pod: Vec2[] = [[0, z0 - 0.012], [ry * 0.5, z0 - 0.01], [ry * 0.8, z0 - 0.002], [ry * 0.96, z0 + 0.014], [ry, z0 + 0.03],
    [ry, z1 - 0.07], [ry * 0.92, z1 - 0.03], [nose, z1 - 0.004], [nose * 0.9, z1], [0, z1]];
  put(ctx, rec, 'Body', squashX(lathe(pod, seg), k), [0, yc, 0]);
  // Seam bands.
  const bands = [z0 + (z1 - z0) * 0.3, z1 - 0.08];
  for (const z of bands) put(ctx, rec, 'Trim', squashX(lathe([[ry * 0.99, z - 0.004], [ry + 0.0016, z - 0.003], [ry + 0.0016, z + 0.003], [ry * 0.99, z + 0.004]], seg), k), [0, yc, 0]);
  // Glowing windows on both sides, with bezels.
  const wz = (bands[0] + bands[1]) / 2, wl = Math.min(0.07, (bands[1] - bands[0]) * 0.6);
  for (const s of [1, -1]) {
    side(ctx, rec, 'Trim', roundedRect(wz, yc + 0.002, wl + 0.008, 0.02, 0.006, 3), 0.004, 0.0008, s * (w / 2 - 0.0012));
    side(ctx, rec, ctx.style.traits.glow ? 'Emissive' : 'Glass', roundedRect(wz, yc + 0.002, wl, 0.013, 0.004, 3), 0.004, 0, s * (w / 2 - 0.0004));
  }
  // Lower frame under the pod.
  lowerFrame(ctx, rec, 'Trim', yc - ry * 0.4, w * 0.62, 1);
  magwell(ctx, rec, 'Trim', w * 0.6, 0.7);
  // Flush mounting strip on top.
  put(ctx, rec, 'Detail', box([0, top - 0.0005, z0 + (z1 - z0) * 0.5], [w * 0.34, 0.004, (z1 - z0) * 0.55], ctx.bevel(0.001)));
  L.mountY = top + 0.0015;
  // Status lights on the back of the pod.
  if (ctx.style.traits.glow) for (let i = 0; i < 2 + Math.round(p.detail * 2); i++) put(ctx, rec, 'Emissive', box([0, yc + 0.006 - i * 0.006, z0 - 0.0105 + 0.0005], [0.01, 0.0025, 0.002]));
  // Charging fin on the right.
  const kz = z1 - 0.07, ky = yc + ry * 0.35;
  const ch = chargingHandle(ctx, 'fin', [-w / 2, ky, kz], 0.05);
  side(ctx, ch, 'Accent', smoothPolygon([[kz - 0.012, ky - 0.004], [kz + 0.012, ky - 0.004], [kz + 0.006, ky + 0.006], [kz - 0.014, ky + 0.004]], 1), 0.008, 0.001, -w / 2 * 0.92 - 0.003);
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Brick: a heavy machine-gun box with a hinged top feed cover, feed tray and sling lugs. */
const brick: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = receiver(ctx, 'brick');
  const { z0, z1, bottom } = L.rec;
  const w = L.rec.width * 1.06;
  const T = L.rec.top + 0.004;
  side(ctx, rec, 'Body', [...bottomEdge(ctx, z0 + 0.006, z1 - 0.006, bottom), [z1, bottom + 0.006], [z1, T - 0.004], [z1 - 0.004, T], [z0 + 0.004, T], [z0, T - 0.004], [z0, bottom - rearDrop(ctx) + 0.006]], w, 0.0015);
  // Front trunnion block, a little proud, bolted.
  const tz = z1 - 0.028;
  side(ctx, rec, 'Trim', [[tz, bottom + 0.004], [z1 + 0.004, bottom + 0.004], [z1 + 0.004, T - 0.002], [tz, T - 0.002]], w + 0.005, 0.0015);
  rivetRow(ctx, rec, 'Detail', [-1, 1].flatMap((s) => [[s * (w / 2 + 0.0025), bottom + 0.012, tz + 0.014], [s * (w / 2 + 0.0025), T - 0.01, tz + 0.014]] as Vec3[]), 0.0026);
  // Hinged feed cover (opens upward from the rear hinge).
  const c0 = z0 + 0.024, c1 = tz - 0.006, ch0 = 0.014 + p.bulk * 0.004;
  const cover = b.component('FeedCover', {
    kind: 'feed_cover', variant: 'hinged', pivot: [0, T, c0],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -1.1], purpose: 'open the feed cover (belt loading)' },
  });
  side(ctx, cover, 'Body', [[c0, T - 0.002], [c1, T - 0.002], [c1, T + ch0 * 0.55], [c1 - 0.02, T + ch0], [c0 + 0.006, T + ch0], [c0, T + ch0 - 0.006]], w * 0.9, 0.002);
  const ribs = 2 + Math.round(p.detail * 3);
  for (let i = 0; i < ribs; i++) put(ctx, cover, 'Trim', box([0, T + ch0 - 0.0005, c0 + 0.02 + i * ((c1 - c0 - 0.05) / Math.max(1, ribs - 1))], [w * 0.92, 0.003, 0.004], ctx.bevel(0.0006)));
  put(ctx, cover, 'Detail', box([0, T + ch0 * 0.5, c1 + 0.002], [w * 0.5, ch0 * 0.5, 0.006], ctx.bevel(0.001)));
  put(ctx, rec, 'Detail', cylinder(0.004, -w / 2 - 0.002, w / 2 + 0.002, ctx.seg(0.5)), [0, T + 0.001, c0], [0, Math.PI / 2, 0]);
  L.rec.top = T + ch0;
  // Feed tray on the left (+X), where a belt comes in.
  const fz = c0 + 0.03;
  side(ctx, rec, 'Detail', [[fz, T - 0.02], [fz + 0.05, T - 0.02], [fz + 0.05, T - 0.004], [fz, T - 0.004]], 0.016, 0.001, w / 2 + 0.006);
  // Sling lugs on the left side.
  for (const z of [z0 + 0.02, tz - 0.02]) {
    put(ctx, rec, 'Detail', box([w / 2 + 0.003, bottom + 0.012, z], [0.006, 0.008, 0.012], ctx.bevel(0.001)));
    put(ctx, rec, 'Trim', ring(0.006, 0.0016, 0, 10, 5), [w / 2 + 0.006, bottom + 0.004, z], [0, Math.PI / 2, 0]);
  }
  magwell(ctx, rec, 'Body', w * 0.9, 1.1);
  // Big cocking handle on the right (-X).
  const kz = z0 + (z1 - z0) * 0.62, ky = bottom * 0.3;
  const handle = chargingHandle(ctx, 'bar', [-w / 2, ky, kz], 0.1);
  put(ctx, handle, 'Detail', box([-w / 2 - 0.01, ky, kz], [0.02, 0.006, 0.01], ctx.bevel(0.001)));
  put(ctx, handle, 'Grip', box([-w / 2 - 0.022, ky, kz], [0.008, 0.024, 0.012], ctx.bevel(0.002)));
  put(ctx, rec, 'Detail', box([-w / 2 - 0.0004, ky, kz - 0.05], [0.0012, 0.005, 0.12]));
  if (ctx.style.traits.rails) {
    rail(ctx, cover, c0 + 0.01, c1 - 0.024, T + ch0);
    L.mountY = T + ch0 + 0.0075;
  } else L.mountY = T + ch0;
  triggerAndGuard(ctx, 'Detail', 'square');
};

/** Hunter: a low, rounded sporting receiver with an engraved side panel and a bolt shroud. */
const hunter: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = receiver(ctx, 'hunter');
  const { z0, z1, top, bottom } = L.rec;
  const w = L.rec.width * 0.86;
  const T = top * 0.85;
  const R = w / 2;
  const roofY = T - R * 0.9;
  // Lower body: flat sides with a rounded tang at the back.
  side(ctx, rec, 'Body', smoothPolygon([
    ...bottomEdge(ctx, z0 + 0.016, z1 - 0.01, bottom + 0.004), [z1, bottom + 0.014], [z1, roofY], [z0 + 0.004, roofY], [z0 - 0.004, roofY - 0.012], [z0 + 0.004, bottom - rearDrop(ctx) + 0.016],
  ], 1), w, 0.002);
  // Rounded roof: a half-cylinder along the top.
  const arc: Vec2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    arc.push([Math.cos(a) * R, roofY + Math.sin(a) * (T - roofY)]);
  }
  put(ctx, rec, 'Body', extrudeFront([[-R, roofY - 0.002], [R, roofY - 0.002], ...arc], z0 + 0.004, z1, ctx.bevel(0.0015)));
  L.rec.top = T;
  // Engraved panel on both sides: a plate with scrollwork.
  const pz0 = z0 + 0.025, pz1 = z0 + (z1 - z0) * 0.62, py0 = bottom + 0.01, py1 = roofY - 0.002;
  const panel = smoothPolygon([[pz0, py0], [pz1, py0], [pz1 + 0.012, (py0 + py1) / 2], [pz1, py1], [pz0, py1]], 2);
  const scroll = (zc: number, yc: number, r: number, dir: number): Vec2[] => {
    const pts: Vec2[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2.2;
      const rr = r * (1 - i / 18);
      pts.push([zc + Math.cos(a) * rr * dir, yc + Math.sin(a) * rr]);
    }
    return pts;
  };
  for (const s of [1, -1]) {
    side(ctx, rec, 'Trim', panel, 0.0012, 0.0004, s * (w / 2 + 0.0004));
    if (p.ornament > 0.15 || ctx.style.traits.plumbing || ctx.style.traits.magic) {
      const ym = (py0 + py1) / 2, r = (py1 - py0) * 0.3;
      const line: Vec2[] = [[pz0 + 0.01, ym], ...bezier([pz0 + 0.01, ym], [pz0 + 0.03, ym + r * 1.4], [pz1 - 0.04, ym - r * 1.4], [pz1 - 0.01, ym], 10)];
      side(ctx, rec, 'Detail', strip(line, 0.0018, 0.0008), 0.0008, 0, s * (w / 2 + 0.0012));
      side(ctx, rec, 'Detail', strip(scroll(pz0 + 0.022, ym + r * 0.2, r, 1), 0.0014, 0.0006), 0.0008, 0, s * (w / 2 + 0.0012));
      side(ctx, rec, 'Detail', strip(scroll(pz1 - 0.022, ym - r * 0.2, r, -1), 0.0014, 0.0006), 0.0008, 0, s * (w / 2 + 0.0012));
    }
  }
  // Ejection port: a long oval on the right.
  side(ctx, rec, 'Detail', roundedRect(z0 + (z1 - z0) * 0.72, roofY + 0.002, 0.05, 0.011, 0.005, 3), 0.002, 0, -w / 2 - 0.0002);
  // Bolt shroud out the back: a tapered sleeve with a cocking indicator.
  const seg = ctx.seg(0.9);
  const sr = R * 0.75;
  put(ctx, rec, 'Detail', lathe([[0, z0 - 0.034], [sr * 0.55, z0 - 0.034], [sr * 0.8, z0 - 0.026], [sr, z0 - 0.008], [sr, z0 + 0.01], [0, z0 + 0.01]], seg), [0, roofY - 0.002, 0]);
  put(ctx, rec, 'Accent', cylinder(0.0022, z0 - 0.038, z0 - 0.034, 8), [0, roofY - 0.002, 0]);
  // Scope bases: two dovetail blocks on the roof.
  for (const z of [z0 + 0.03, z1 - 0.035]) put(ctx, rec, 'Detail', box([0, T + 0.0015, z], [R * 1.1, 0.004, 0.016], ctx.bevel(0.0008)));
  L.mountY = T + 0.0035;
  // Sporting bolt knob (snipers bring their own bolt handle).
  if (ctx.archetype !== 'sniper' && ctx.chosen.magazine !== 'none') {
    const kz = z0 + (z1 - z0) * 0.55, ky = roofY - 0.002;
    const ch = chargingHandle(ctx, 'bolt-knob', [-w / 2, ky, kz], 0.07);
    const knob: Vec3 = [-w / 2 - 0.026, ky - 0.016, kz - 0.01];
    put(ctx, ch, 'Detail', rod([-w / 2 + 0.004, ky, kz], knob, 0.0032, ctx.seg(0.4)));
    put(ctx, ch, 'Detail', dome(0.0075, 0.0075, ctx.seg(0.5), 3), knob);
    put(ctx, ch, 'Detail', dome(0.0075, 0.0075, ctx.seg(0.5), 3), knob, [0, Math.PI, 0]);
  }
  magwell(ctx, rec, 'Body', w * 0.85, 0.6);
  void b;
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Drum: a revolving action. An open frame (top strap, front and rear blocks) around a fluted cylinder. */
const drum: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rng = ctx.rng('receiver');
  const rec = receiver(ctx, 'drum');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const len = z1 - z0;
  const H = top - bottom;
  const R = Math.min(H * 0.42, w * 0.62);
  const cy = -R * 0.56;
  const cz0 = z0 + len * 0.36, cz1 = Math.min(z1 - 0.04, cz0 + Math.max(0.06, Math.min(0.1, len * 0.34)));
  const yLow = Math.min(bottom, cy - R - 0.006);
  const drop = rearDrop(ctx);
  // Frame: rear block, front block, top strap and the bottom bar under the cylinder.
  side(ctx, rec, 'Body', [[z0, bottom - drop + 0.006], [z0 + 0.008, bottom - drop], [cz0, bottom - drop], [cz0, top], [z0 + 0.016, top], [z0, top - 0.012]], w, 0.002);
  side(ctx, rec, 'Body', [[cz1, yLow], [z1 - 0.012, bottom * 0.6], [z1, -0.01], [z1, top - 0.008], [z1 - 0.01, top], [cz1, top]], w * 0.92, 0.002);
  side(ctx, rec, 'Body', [[cz0 - 0.004, cy + R + 0.0015], [cz1 + 0.004, cy + R + 0.0015], [cz1 + 0.004, top], [cz0 - 0.004, top]], w * 0.7, 0.0015);
  side(ctx, rec, 'Body', [[cz0 - 0.004, yLow], [cz1 + 0.004, yLow], [cz1 + 0.004, cy - R - 0.0015], [cz0 - 0.004, cy - R - 0.0015]], w * 0.66, 0.0015);
  // A lower housing that drops to cover the loading plate (from behind the trigger to the magwell).
  const mz0 = Math.min(L.magwell.z0, cz0) - 0.006, mz1 = Math.max(L.magwell.z1, cz0) + 0.006;
  if (mz0 > L.trigger.z + 0.012) side(ctx, rec, 'Body', [[mz0, bottom], [mz1, bottom], [mz1, bottom - 0.008], [mz0 + 0.004, bottom - 0.008]], w * 0.66, 0.0015);
  // Cylinder (advances one chamber per shot).
  const n = rng.pick([5, 6, 6, 7, 8]);
  const cyl = b.component('Cylinder', {
    kind: 'cylinder', variant: `${n}-shot`, pivot: [0, cy, cz0],
    motion: { type: 'rotate', axis: [0, 0, 1], range: [0, (Math.PI * 2) / n], purpose: 'advance one chamber' },
  });
  const seg = Math.max(12, ctx.seg(1.4));
  put(ctx, cyl, 'Barrel', lathe([[0, cz0], [R * 0.82, cz0], [R, cz0 + 0.006], [R, cz1 - 0.004], [R * 0.9, cz1], [0, cz1]], seg), [0, cy, 0]);
  const fl = (cz1 - cz0) * 0.62;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    put(ctx, cyl, 'Detail', box([0, 0, 0], [0.004, R * 0.34, fl], ctx.bevel(0.0008)), [Math.cos(a) * (R - 0.0012), cy + Math.sin(a) * (R - 0.0012), cz0 + (cz1 - cz0) * 0.55], [0, 0, a]);
  }
  // Chamber mouths at the back face, peeking past the frame.
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (i / n) * Math.PI * 2;
    put(ctx, cyl, 'Trim', cylinder(R * 0.24, cz0 - 0.002, cz0 + 0.0005, Math.max(6, ctx.seg(0.4))), [Math.cos(a) * -cy, cy + Math.sin(a) * -cy, 0]);
  }
  put(ctx, rec, 'Detail', cylinder(0.003, cz0 - 0.003, cz1 + 0.003, 8), [0, cy, 0]);
  // Ejector rod housing under the barrel, ahead of the frame.
  put(ctx, rec, 'Detail', cylinder(0.0035, z1 - 0.004, z1 + 0.02 + p.length * 0.02, 8, ctx.bevel(0.001)), [0, cy * 0.9, 0]);
  // Hammer at the back of the frame.
  const hz = z0 + 0.012, hy = top - 0.004;
  const hammer = b.component('Hammer', {
    kind: 'hammer', variant: 'spur', pivot: [0, hy - 0.012, hz + 0.004],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, -0.6], purpose: 'cock' },
  });
  side(ctx, hammer, 'Detail', [[hz + 0.01, hy - 0.016], [hz + 0.002, hy - 0.016], [hz - 0.006, hy + 0.008], [hz - 0.018, hy + 0.018], [hz - 0.021, hy + 0.013], [hz - 0.008, hy + 0.002], [hz + 0.006, hy - 0.006]], 0.007, 0.0012);
  // Loading gate on the right of the rear block.
  side(ctx, rec, 'Trim', roundedRect(cz0 - 0.012, cy, 0.018, R * 1.1, 0.004, 2), 0.0016, 0.0004, -w / 2 - 0.0004);
  if (ctx.style.traits.rivets) rivetRow(ctx, rec, 'Trim', [1, -1].flatMap((s) => [[s * (w / 2 + 0.0003), top - 0.008, z0 + 0.03], [s * (w * 0.46 + 0.0003), top - 0.008, z1 - 0.02]] as Vec3[]), 0.0022);
  L.mountY = top;
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Carved: a slim metal core with carved wooden side panels and metal inlays. */
const carved: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = receiver(ctx, 'carved');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const drop = rearDrop(ctx);
  // Metal core.
  side(ctx, rec, 'Body', [...bottomEdge(ctx, z0 + 0.006, z1 - 0.006, bottom), [z1, bottom + 0.008], [z1, top - 0.004], [z1 - 0.006, top], [z0 + 0.006, top], [z0, top - 0.006], [z0, bottom - drop + 0.008]], w * 0.7, 0.0015);
  // Carved wood panels with a scalloped edge.
  const pz0 = z0 + 0.008, pz1 = z1 - 0.014;
  const wave: Vec2[] = [];
  const nw = 5 + Math.round(p.ornament * 4);
  for (let i = 0; i <= nw * 2; i++) {
    const z = pz1 - (i / (nw * 2)) * (pz1 - pz0);
    wave.push([z, top - 0.004 - (i % 2 ? 0.004 : 0)]);
  }
  const panel = smoothPolygon([...bottomEdge(ctx, pz0, pz1, bottom + 0.002), [pz1 + 0.006, (top + bottom) / 2], ...wave], 1);
  side(ctx, rec, 'Stock', panel, w, 0.004);
  // Metal top strap and end caps.
  put(ctx, rec, 'Trim', box([0, top + 0.001, (z0 + z1) / 2], [w * 0.5, 0.004, z1 - z0 - 0.004], ctx.bevel(0.001)));
  for (const z of [z0 + 0.004, z1 - 0.008]) side(ctx, rec, 'Trim', [[z - 0.004, bottom - (z < (z0 + z1) / 2 ? drop : 0) + 0.002], [z + 0.004, bottom - (z < (z0 + z1) / 2 ? drop : 0) + 0.002], [z + 0.004, top - 0.002], [z - 0.004, top - 0.002]], w + 0.003, 0.001);
  // Inlays: a curling metal line and diamonds along the panel.
  const ym = (top + bottom) / 2 + 0.002;
  const line: Vec2[] = [[pz0 + 0.02, ym], ...bezier([pz0 + 0.02, ym], [pz0 + 0.06, ym + 0.012], [pz1 - 0.06, ym - 0.012], [pz1 - 0.02, ym], 12)];
  const gem: MaterialSlot = ctx.style.traits.magic ? 'Emissive' : 'Accent';
  for (const s of [1, -1]) {
    side(ctx, rec, 'Trim', strip(line, 0.0026, 0.0014), 0.0012, 0, s * (w / 2 + 0.0004));
    const nd = 2 + Math.round(p.ornament * 2);
    for (let i = 0; i < nd; i++) {
      const z = pz0 + 0.03 + (i + 0.5) * ((pz1 - pz0 - 0.06) / nd);
      const y = bottom + 0.009;
      side(ctx, rec, i === Math.floor(nd / 2) ? gem : 'Trim', [[z - 0.005, y], [z, y - 0.004], [z + 0.005, y], [z, y + 0.004]], 0.0014, 0, s * (w / 2 + 0.0004));
    }
  }
  if (ctx.style.traits.rivets) rivetRow(ctx, rec, 'Trim', [1, -1].flatMap((s) => [[s * (w / 2 + 0.0015), top - 0.008, z0 + 0.016], [s * (w / 2 + 0.0015), top - 0.008, z1 - 0.02]] as Vec3[]), 0.0022);
  magwell(ctx, rec, 'Body', w * 0.66, 0.8);
  // Small hammer-shaped charging lever on the right.
  const kz = z0 + (z1 - z0) * 0.5, ky = top - 0.012;
  const ch = chargingHandle(ctx, 'lever', [-w / 2, ky, kz], 0.06);
  put(ctx, ch, 'Trim', rod([-w / 2, ky, kz], [-w / 2 - 0.016, ky + 0.004, kz - 0.008], 0.0022, ctx.seg(0.4)));
  put(ctx, ch, 'Trim', dome(0.0045, 0.006, ctx.seg(0.4), 2), [-w / 2 - 0.016, ky + 0.004, kz - 0.008], [0, -Math.PI / 2, 0]);
  L.mountY = top + 0.003;
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Industrial: a blocky body with exposed hydraulic pistons, lines and fittings. */
const industrial: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = receiver(ctx, 'industrial');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const step = z0 + (z1 - z0) * 0.4;
  // Stepped body: tall at the back, lower and narrower in front.
  side(ctx, rec, 'Body', [...bottomEdge(ctx, z0 + 0.006, z1 - 0.008, bottom), [z1, bottom + 0.008], [z1, top - 0.01], [step + 0.012, top - 0.01], [step, top], [z0 + 0.006, top], [z0, top - 0.006], [z0, bottom - rearDrop(ctx) + 0.006]], w, 0.0018);
  // Hazard stripe band at the front.
  side(ctx, rec, 'Accent', [[z1 - 0.026, bottom + 0.003], [z1 - 0.014, bottom + 0.003], [z1 - 0.014, top - 0.013], [z1 - 0.026, top - 0.013]], w + 0.002);
  // Two hydraulic pistons on the right (-X): barrel, chrome rod, clevis blocks.
  const seg = Math.max(8, ctx.seg(0.6));
  const px = -w / 2 - 0.009;
  const pistons = [top - 0.016, bottom + 0.016];
  const pz0 = z0 + 0.024, pz1 = z1 - 0.03, mid = pz0 + (pz1 - pz0) * 0.55;
  for (const y of pistons) {
    put(ctx, rec, 'Body', cylinder(0.0075, pz0, mid, seg, ctx.bevel(0.0015)), [px, y, 0]);
    put(ctx, rec, 'Trim', cylinder(0.0085, mid - 0.005, mid, seg), [px, y, 0]);
    put(ctx, rec, 'Barrel', cylinder(0.0035, mid, pz1, seg), [px, y, 0]);
    for (const z of [pz0 - 0.004, pz1 + 0.002]) put(ctx, rec, 'Detail', box([px + 0.004, y, z], [0.016, 0.01, 0.01], ctx.bevel(0.0012)));
  }
  // Hydraulic lines: hoses from each piston barrel back into the body.
  const hose = (a: Vec3, b2: Vec3, c: Vec3) => {
    put(ctx, rec, 'Accent', rod(a, b2, 0.0022, 6));
    put(ctx, rec, 'Accent', rod(b2, c, 0.0022, 6));
    for (const q of [a, c]) put(ctx, rec, 'Trim', cylinder(0.0034, -0.003, 0.003, 8), q, AXIS_X);
  };
  for (const y of pistons) {
    const a: Vec3 = [px - 0.006, y, pz0 + 0.012];
    hose(a, [px - 0.012, (y + (top + bottom) / 2) / 2, pz0 + 0.004], [-w / 2 - 0.003, (top + bottom) / 2, z0 + 0.012 + (y > 0 ? 0.008 : 0)]);
  }
  // Heat-sink fins on the left side.
  const nf = 4 + Math.round(p.detail * 4);
  for (let i = 0; i < nf; i++) put(ctx, rec, 'Detail', box([w / 2 + 0.003, (top + bottom) / 2 + 0.002, step + 0.01 + i * ((z1 - step - 0.05) / nf)], [0.006, (top - bottom) * 0.55, 0.0025]));
  // Hex bolts on the step.
  rivetRow(ctx, rec, 'Detail', [-1, 1].flatMap((s) => [[s * (w / 2 + 0.0004), top - 0.007, z0 + 0.016], [s * (w / 2 + 0.0004), bottom + 0.007, z0 + 0.016]] as Vec3[]), 0.0028);
  magwell(ctx, rec, 'Body', w * 0.88, 1);
  // T-handle charging lever on the left, behind the fins.
  const kz = step - 0.012, ky = top - 0.012;
  const ch = chargingHandle(ctx, 'T-lever', [w / 2, ky, kz], 0.07);
  put(ctx, ch, 'Detail', rod([w / 2, ky, kz], [w / 2 + 0.018, ky, kz], 0.0028, 8));
  put(ctx, ch, 'Accent', cylinder(0.0045, -0.008, 0.008, 10, ctx.bevel(0.001)), [w / 2 + 0.02, ky, kz], [-Math.PI / 2, 0, 0]);
  if (ctx.style.traits.rails) {
    rail(ctx, rec, z0 + 0.01, step - 0.004, top);
    rail(ctx, rec, step + 0.016, z1 - 0.004, top - 0.01);
    L.mountY = top + 0.0075;
  } else L.mountY = top;
  triggerAndGuard(ctx, 'Detail', 'square');
};

/** Organic: a curved spine wrapped in swept-back ribs, with a glowing vein. */
const organic: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = receiver(ctx, 'organic');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const drop = rearDrop(ctx);
  const ym = (top + bottom) / 2;
  // Spine: a smooth, slightly hunched body.
  side(ctx, rec, 'Body', smoothPolygon([
    [z0 - 0.012, ym + 0.004], [z0 + 0.006, top - 0.002], [z0 + (z1 - z0) * 0.35, top + 0.004], [z1 - 0.03, top - 0.004], [z1 + 0.006, ym * 0.2 + 0.006],
    [z1, bottom * 0.5], ...bottomEdge(ctx, z0 + 0.03, Math.min(z1 - 0.03, Math.max(L.magwell.z1, L.trigger.z) + 0.03), bottom).reverse(), [z0 - 0.004, bottom - drop + 0.006],
  ], 2), w * 0.78, 0.004);
  // Ribs: arches over the top, open underneath, swept back.
  const nr = 4 + Math.round(p.detail * 3);
  const a0 = -0.35, a1 = Math.PI + 0.35;
  for (let i = 0; i < nr; i++) {
    const t = (i + 0.5) / nr;
    const k = 0.75 + 0.25 * Math.sin(Math.PI * t);
    const ax = (w / 2 + 0.003) * k, ay = (top - ym + 0.006) * k;
    const out: Vec2[] = [], inn: Vec2[] = [];
    for (let s = 0; s <= 12; s++) {
      const a = a0 + (s / 12) * (a1 - a0);
      out.push([Math.cos(a) * ax, Math.sin(a) * ay]);
      inn.push([Math.cos(a) * (ax - 0.005), Math.sin(a) * (ay - 0.005)]);
    }
    const rib = extrudeFront([...out, ...inn.reverse()], -0.0045, 0.0045, ctx.bevel(0.0015));
    const z = z0 + 0.03 + t * (z1 - z0 - 0.07);
    put(ctx, rec, 'Trim', rib, [0, ym + 0.003, z], [0.32, 0, 0]);
  }
  // Glowing vein along each flank.
  const line: Vec2[] = [[z0 + 0.01, ym], ...bezier([z0 + 0.01, ym], [z0 + 0.08, ym - 0.012], [z1 - 0.1, ym + 0.01], [z1 - 0.01, ym - 0.004], 14)];
  for (const s of [1, -1]) side(ctx, rec, glowSlot(ctx), strip(line, 0.0045, 0.0015), 0.0012, 0, s * (w * 0.39 + 0.0003));
  magwell(ctx, rec, 'Body', w * 0.7, 0.8);
  // Charging nub: a little bony hook on the right.
  const kz = z1 - 0.05, ky = ym + 0.004;
  const ch = chargingHandle(ctx, 'hook', [-w * 0.39, ky, kz], 0.05);
  side(ctx, ch, 'Accent', smoothPolygon([[kz - 0.01, ky - 0.004], [kz + 0.008, ky - 0.004], [kz - 0.004, ky + 0.01], [kz - 0.014, ky + 0.008]], 1), 0.006, 0.001, -w * 0.39 - 0.004);
  L.mountY = top + 0.006;
  triggerAndGuard(ctx, 'Body', 'round');
};

export const RECEIVERS2: Record<string, PartBuilder> = { battle, skeletal, boxy, capsule, brick, hunter, drum, carved, industrial, organic };
