/**
 * Crossbow parts. The bolt rests on the flight rail at y = 0 and flies toward
 * +Z. The prod (the "bow" part) sits at L.extra.prodZ and is modeled *drawn*:
 * the string is pulled back to the latch above the trigger.
 *
 * Layout extras: prodZ, span (half-width of the drawn prod), latchZ, prodY.
 */
import { AXIS_Y, Vec2, Vec3, bezier, box, cylinder, dome, extrudeSide, extrudeTop, lathe, rod, smoothPolygon } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import { BuildContext, put, side } from './context.js';
import { rail, rivetRow, triggerAndGuard } from './receiver.js';
import type { MaterialSlot } from '../types.js';

const ROOT = 'Tiller';

function tiller(ctx: BuildContext, variant: string) {
  return ctx.b.component(ROOT, { kind: 'tiller', variant, parent: null });
}

// ---------------------------------------------------------------------------
// Tillers (the crossbow's body: trigger housing + flight rail)
// ---------------------------------------------------------------------------

/** Modern: machined housing, aluminium flight rail, foregrip, picatinny on top. */
const railTiller: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const t = tiller(ctx, 'rail');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const pz = L.extra.prodZ;
  side(ctx, t, 'Body', [[z0, bottom + 0.012], [z0 + 0.014, bottom], [z1, bottom], [z1 + 0.03, -0.024], [z1 + 0.03, top - 0.008], [z1 - 0.006, top], [z0 + 0.006, top], [z0, top - 0.006]], w, 0.0025);
  // Flight rail with a groove, and the prod mount block.
  side(ctx, t, 'Body', [[z1, -0.004], [pz + 0.03, -0.004], [pz + 0.04, -0.012], [pz + 0.04, -0.03], [pz - 0.03, -0.034], [z1 + 0.04, -0.024], [z1, -0.024]], 0.032, 0.002);
  put(ctx, t, 'Detail', box([0, -0.0035, (z1 + pz) / 2], [0.006, 0.0012, pz - z1]));
  rail(ctx, t, z0 + 0.012, z1 + 0.02, top);
  L.mountY = top + 0.0075;
  // Foregrip under the rail.
  const fz = z1 + (pz - z1) * 0.45;
  side(ctx, t, 'Grip', [[fz - 0.02, -0.024], [fz + 0.025, -0.024], [fz + 0.018, -0.07 - p.bulk * 0.01], [fz - 0.012, -0.07 - p.bulk * 0.01]], 0.026, 0.004);
  // Rail-side accessory slots.
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) put(ctx, t, 'Detail', box([s * 0.0162, -0.014, z1 + 0.06 + i * 0.05], [0.001, 0.007, 0.03]));
  triggerAndGuard(ctx, 'Body', 'round');
};

/** Steampunk: one long wooden tiller, brass plates, rivets and a crank winch. */
const woodTiller: PartBuilder = (ctx) => {
  const { L, p, b } = ctx;
  const t = tiller(ctx, 'wood');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const pz = L.extra.prodZ;
  side(ctx, t, 'Stock', smoothPolygon([
    [z0, top - 0.006], [z0 + 0.004, bottom + 0.01], [z0 + 0.03, bottom], [z1 + 0.02, -0.03], [pz - 0.03, -0.03], [pz + 0.04, -0.022],
    [pz + 0.045, -0.004], [z1 + 0.01, -0.004], [z1 - 0.01, top - 0.004], [z0 + 0.02, top],
  ], 1), w * 0.85, 0.006);
  // Brass side plates at the latch.
  for (const s of [1, -1]) side(ctx, t, 'Trim', [[z0 + 0.03, bottom + 0.008], [z1 - 0.01, bottom + 0.008], [z1 - 0.01, top - 0.008], [z0 + 0.03, top - 0.008]], 0.001, 0.0005, s * (w * 0.425 + 0.0006));
  const pts: Vec3[] = [];
  for (const s of [1, -1]) for (const z of [z0 + 0.04, z1 - 0.02]) for (const y of [bottom + 0.014, top - 0.014]) pts.push([s * (w * 0.425 + 0.0012), y, z]);
  rivetRow(ctx, t, 'Detail', pts, 0.0024);
  // Brass groove plate on top of the rail.
  put(ctx, t, 'Trim', box([0, -0.0035, (z1 + pz) / 2], [0.012, 0.0014, pz - z1 - 0.01]));
  // Crank winch (cranequin) on the right side.
  const gz = z0 + 0.06, gy = -0.002, gx = -w * 0.425 - 0.006;
  const crank = b.component('Crank', {
    kind: 'crank', variant: 'winch', pivot: [gx, gy, gz],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, Math.PI * 6], purpose: 'wind the string back' },
  });
  const gr = 0.026 + p.bulk * 0.006;
  const seg = ctx.seg(1.2);
  put(ctx, crank, 'Trim', cylinder(gr, 0, 0.006, seg, ctx.bevel(0.001)), [gx - 0.003, gy, gz], [0, -Math.PI / 2, 0]);
  const teeth = 14;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    put(ctx, crank, 'Trim', box([0, 0, 0], [0.006, 0.005, 0.004]), [gx - 0.006, gy + Math.sin(a) * gr, gz + Math.cos(a) * gr], [-a, 0, 0]);
  }
  put(ctx, crank, 'Detail', dome(gr * 0.3, 0.004, seg, 2), [gx - 0.009, gy, gz], [0, -Math.PI / 2, 0]);
  const handle: Vec3 = [gx - 0.03, gy - gr * 0.9, gz - gr * 0.5];
  put(ctx, crank, 'Detail', rod([gx - 0.009, gy, gz], [gx - 0.03, gy - gr * 0.9, gz - gr * 0.5], 0.003, 8));
  put(ctx, crank, 'Grip', cylinder(0.0055, 0, 0.022, 10, ctx.bevel(0.002)), handle, [0, -Math.PI / 2, 0]);
  triggerAndGuard(ctx, 'Trim', 'round');
};

/** Sci-fi: smooth shell, inset panels, glowing flight groove. */
const sleekTiller: PartBuilder = (ctx) => {
  const { L } = ctx;
  const t = tiller(ctx, 'sleek');
  const { z0, z1, top, bottom, width: w } = L.rec;
  const pz = L.extra.prodZ;
  side(ctx, t, 'Body', smoothPolygon([
    [z0, top - 0.012], [z0 + 0.006, bottom + 0.012], [z0 + 0.04, bottom], [z1 + 0.03, -0.028], [pz - 0.02, -0.026], [pz + 0.05, -0.014],
    [pz + 0.05, -0.004], [z1 + 0.02, -0.004], [z1 - 0.02, top], [z0 + 0.04, top + 0.006],
  ], 1), w, 0.006);
  side(ctx, t, 'Trim', smoothPolygon([[z0 + 0.03, bottom + 0.012], [z1 + 0.04, -0.02], [pz - 0.04, -0.019], [pz - 0.05, -0.008], [z1 - 0.01, top - 0.012], [z0 + 0.04, top - 0.008]], 1), w + 0.004, 0.0015);
  put(ctx, t, ctx.style.traits.glow ? 'Emissive' : 'Detail', box([0, -0.0036, (z1 + pz) / 2 + 0.01], [0.004, 0.0012, pz - z1 + 0.02]));
  L.mountY = top + 0.006;
  triggerAndGuard(ctx, 'Body', 'round');
};

export const TILLERS: Record<string, PartBuilder> = { rail: railTiller, wood: woodTiller, sleek: sleekTiller };

// ---------------------------------------------------------------------------
// Prods (the bow): limbs + string + stirrup. Records limb tips for the string.
// ---------------------------------------------------------------------------

interface LimbShape {
  /** Bezier control points (z offset from prod, x) for the right (+X) limb. */
  ctrl: [Vec2, Vec2, Vec2, Vec2];
  width0: number;
  width1: number;
}

/** Top-view polygon of one limb ([z, x]), built around a Bezier centerline. */
function limbPolygon(shape: LimbShape, pz: number, mirror: number, steps: number): Vec2[] {
  const [a, b, c, d] = shape.ctrl.map(([z, x]) => [pz + z, x * mirror] as Vec2);
  const line: Vec2[] = [a, ...bezier(a, b, c, d, steps)];
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i], q = line[Math.min(i + 1, line.length - 1)], o = line[Math.max(i - 1, 0)];
    const dz = q[0] - o[0], dx = q[1] - o[1];
    const l = Math.hypot(dz, dx) || 1;
    const nz = -dx / l, nx = dz / l;
    const w = (shape.width0 + (shape.width1 - shape.width0) * (i / (line.length - 1))) / 2;
    left.push([p[0] + nz * w, p[1] + nx * w]);
    right.push([p[0] - nz * w, p[1] - nx * w]);
  }
  return [...left, ...right.reverse()];
}

function prodComponent(ctx: BuildContext, variant: string) {
  return ctx.b.component('Prod', { kind: 'prod', variant, pivot: [0, ctx.L.extra.prodY, ctx.L.extra.prodZ] });
}

function stirrup(ctx: BuildContext, slot: MaterialSlot): void {
  const { L } = ctx;
  const s = ctx.b.component('Stirrup', { kind: 'stirrup', variant: 'loop', pivot: [0, -0.02, L.extra.prodZ + 0.04] });
  const z0 = L.extra.prodZ + 0.035, len = 0.075, hw = 0.04, t = 0.007;
  const outer: Vec2[] = [[z0, hw * 0.55], [z0 + len * 0.8, hw], [z0 + len, hw * 0.6], [z0 + len, -hw * 0.6], [z0 + len * 0.8, -hw], [z0, -hw * 0.55]];
  const inner: Vec2[] = [[z0, -hw * 0.55 + t], [z0 + len * 0.8 - t * 0.6, -hw + t], [z0 + len - t, -hw * 0.6 + t * 0.4], [z0 + len - t, hw * 0.6 - t * 0.4], [z0 + len * 0.8 - t * 0.6, hw - t], [z0, hw * 0.55 - t]];
  put(ctx, s, slot, extrudeTop([...outer, ...inner], 0.006, -0.02, ctx.bevel(0.0012)));
}

/** Recurve steel prod: two thick limbs that curl forward at the tips. */
const recurve: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = prodComponent(ctx, 'recurve');
  const W = L.extra.span, pz = L.extra.prodZ, y = L.extra.prodY;
  const shape: LimbShape = {
    ctrl: [[0, 0.03], [0.01, W * 0.45], [-0.09, W * 0.85], [-0.05, W]],
    width0: 0.036 + p.bulk * 0.008, width1: 0.016,
  };
  const h = 0.013 + p.bulk * 0.004;
  for (const m of [1, -1]) put(ctx, c, 'Barrel', extrudeTop(limbPolygon(shape, pz, m, 14), h, y, ctx.bevel(0.002)));
  put(ctx, c, 'Body', box([0, y, pz], [0.07, h + 0.012, 0.05], ctx.bevel(0.004)));
  for (const m of [1, -1]) put(ctx, c, 'Trim', dome(0.008, 0.01, 10, 3), [m * W, y, pz - 0.05], [0, (m * Math.PI) / 2, 0]);
  if (p.ornament > 0.5) for (const m of [1, -1]) put(ctx, c, 'Trim', box([m * W * 0.35, y + h / 2 + 0.001, pz - 0.004], [0.04, 0.002, 0.03], ctx.bevel(0.0008)));
  L.extra.tipX = W;
  L.extra.tipZ = pz - 0.05;
  stirrup(ctx, 'Detail');
};

/** Compound prod: split limbs with cam wheels and cables. */
const compound: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = prodComponent(ctx, 'compound');
  const W = L.extra.span * 0.82, pz = L.extra.prodZ, y = L.extra.prodY;
  const shape: LimbShape = { ctrl: [[0, 0.03], [-0.01, W * 0.45], [-0.06, W * 0.8], [-0.1, W]], width0: 0.03, width1: 0.022 };
  const gap = 0.012 + p.bulk * 0.004, h = 0.008;
  for (const m of [1, -1]) for (const dy of [gap, -gap]) put(ctx, c, 'Stock', extrudeTop(limbPolygon(shape, pz, m, 12), h, y + dy, ctx.bevel(0.0015)));
  put(ctx, c, 'Body', box([0, y, pz - 0.004], [0.08, gap * 2 + h + 0.01, 0.045], ctx.bevel(0.004)));
  const camR = 0.02 + p.bulk * 0.004;
  const seg = ctx.seg(1);
  for (const m of [1, -1]) {
    const cz = pz - 0.1, cx = m * W;
    put(ctx, c, 'Detail', cylinder(camR, -0.005, 0.005, seg, ctx.bevel(0.001)), [cx, y, cz], AXIS_Y);
    put(ctx, c, 'Trim', cylinder(0.004, -gap - 0.006, gap + 0.006, 10), [cx, y, cz], AXIS_Y);
    // Cables cross toward the other side.
    put(ctx, c, 'Detail', rod([cx, y + 0.003, cz + m * 0], [-cx * 0.15, y + 0.003, pz - 0.03], 0.0012, 5));
  }
  L.extra.tipX = W + camR;
  L.extra.tipZ = pz - 0.1;
  stirrup(ctx, 'Detail');
};

/** Energy prod: angular limbs with glowing strips and emitter tips. */
const energy: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const c = prodComponent(ctx, 'energy');
  const W = L.extra.span * 0.95, pz = L.extra.prodZ, y = L.extra.prodY;
  const shape: LimbShape = { ctrl: [[0, 0.03], [0.02, W * 0.4], [-0.03, W * 0.7], [-0.08, W]], width0: 0.04 + p.bulk * 0.01, width1: 0.014 };
  const h = 0.012;
  const glow = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  for (const m of [1, -1]) {
    put(ctx, c, 'Body', extrudeTop(limbPolygon(shape, pz, m, 6), h, y, ctx.bevel(0.002)));
    const strip: LimbShape = { ...shape, width0: 0.008, width1: 0.004 };
    put(ctx, c, glow, extrudeTop(limbPolygon(strip, pz, m, 6), 0.002, y + h / 2 + 0.001));
    put(ctx, c, glow, dome(0.008, 0.012, 10, 3), [m * W, y, pz - 0.08], [0, (m * Math.PI) / 2, 0]);
  }
  put(ctx, c, 'Trim', box([0, y, pz], [0.08, h + 0.014, 0.05], ctx.bevel(0.005)));
  L.extra.tipX = W;
  L.extra.tipZ = pz - 0.08;
  L.extra.glowString = ctx.style.traits.glow ? 1 : 0;
  stirrup(ctx, 'Trim');
};

export const PRODS: Record<string, PartBuilder> = { recurve, compound, energy };

/** String (drawn to the latch) and the loaded bolt. Call after the prod. */
export function stringAndBolt(ctx: BuildContext): void {
  const { L, b, p } = ctx;
  const y = L.extra.prodY, latch = L.extra.latchZ;
  const tipX = L.extra.tipX, tipZ = L.extra.tipZ;
  const s = b.component('String', {
    kind: 'string', variant: L.extra.glowString ? 'energy' : 'cord', parent: 'Prod', pivot: [0, -0.001, latch],
    motion: { type: 'translate', axis: [0, 0, 1], range: [0, tipZ - latch], purpose: 'release (snaps forward when fired)' },
  });
  const slot: MaterialSlot = L.extra.glowString ? 'Emissive' : 'Detail';
  for (const m of [1, -1]) put(ctx, s, slot, rod([m * tipX, y, tipZ], [0, -0.001, latch], 0.0016, 5));

  const bolt = b.component('Bolt', {
    kind: 'projectile', variant: 'bolt', pivot: [0, 0, latch],
    motion: { type: 'translate', axis: [0, 0, 1], range: [0, 1], purpose: 'fire (leaves the rail)' },
  });
  const len = L.extra.prodZ - latch + 0.07 + p.length * 0.03;
  const tip = latch + len;
  const seg = Math.max(6, ctx.seg(0.4));
  put(ctx, bolt, 'Detail', cylinder(0.0035, latch, tip - 0.025, seg));
  put(ctx, bolt, 'Barrel', lathe([[0.0035, tip - 0.025], [0.0055, tip - 0.022], [0.0045, tip - 0.012], [0, tip]], seg));
  for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]) {
    // Fletching vane: a thin side profile, rotated around the shaft.
    put(ctx, bolt, 'Accent', extrudeSide([[latch + 0.006, 0.0035], [latch + 0.05, 0.0035], [latch + 0.045, 0.012], [latch + 0.01, 0.013]], { width: 0.0008 }), [0, 0, 0], [0, 0, a - Math.PI / 2]);
  }
  b.socket({ name: 'SOCKET_Muzzle', parent: 'Bolt', position: [0, 0, tip], forward: [0, 0, 1], description: 'Bolt tip: where the projectile starts its flight.' });
  b.socket({ name: 'SOCKET_Nock', parent: ctx.b.rootName, position: [0, 0, latch], forward: [0, 0, 1], description: 'Latch / nock point: load new bolts here.' });
}
