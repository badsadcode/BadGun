/**
 * Bows. The bow stands upright in the YZ plane: limbs go up (+Y) and down
 * (-Y), the arrow flies toward +Z along y = 0, and the string sits behind
 * the grip at the brace height. Modeled at rest (braced) with an arrow
 * nocked; the String component carries the "draw" motion.
 *
 * Layout extras: riser (half height), H (tip height), tipZ, nockZ, limbW, arrowLen.
 */
import { AXIS_X, Vec2, Vec3, box, cylinder, dome, extrudeSide, lathe, rod } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put, side } from './context.js';
import { LimbShape, limbPolygon } from './crossbow.js';
import { crystal, sideGem } from './fantasy.js';
import type { MaterialSlot } from '../types.js';

const ROOT = 'Riser';

/** Riser: full-width grip section below the shelf, offset "sight window" section above. */
function riser(ctx: BuildContext, variant: string, slot: MaterialSlot, opts: { frontBulge?: number; grip?: MaterialSlot } = {}): Component {
  const { L } = ctx;
  const r = ctx.b.component(ROOT, { kind: 'riser', variant, parent: null });
  const R = L.extra.riser, W = 0.03;
  const fb = opts.frontBulge ?? 0;
  side(ctx, r, slot, [
    [-0.012, -R], [0.022, -R], [0.028 + fb, -R * 0.5], [0.026 + fb, -0.004], [-0.014, -0.004], [-0.03, -0.025], [-0.034, -0.06], [-0.026, -0.095], [-0.012, -0.13],
  ], W, 0.004);
  side(ctx, r, slot, [[-0.014, -0.006], [0.026 + fb, -0.006], [0.028 + fb, R * 0.5], [0.022, R], [-0.012, R], [-0.012, 0.03]], W * 0.5, 0.003, -W * 0.25);
  // Grip wrap and arrow shelf.
  side(ctx, r, opts.grip ?? 'Grip', [[-0.016, -0.012], [0.03 + fb * 0.5, -0.012], [0.03 + fb * 0.5, -0.1], [-0.014, -0.11], [-0.035, -0.06], [-0.03, -0.024]], W + 0.003, 0.003);
  put(ctx, r, 'Detail', box([0.004, -0.0045, 0.006], [0.01, 0.002, 0.018], ctx.bevel(0.0005)));
  return r;
}

function limbComponent(ctx: BuildContext, which: 'Top' | 'Bottom') {
  const { L } = ctx;
  const sgn = which === 'Top' ? 1 : -1;
  return ctx.b.component(`Limb${which}`, {
    kind: 'limb', variant: ctx.chosen.bow ?? '-', pivot: [0, sgn * L.extra.riser, 0.005],
    motion: { type: 'rotate', axis: [1, 0, 0], range: [0, sgn * -0.25], purpose: 'flex when drawn' },
  });
}

/** Both limbs from one side-profile shape ([z, y] for the top limb). */
function limbs(ctx: BuildContext, shape: LimbShape, slot: MaterialSlot, steps = 14, width?: number): void {
  const w = width ?? ctx.L.extra.limbW;
  for (const which of ['Top', 'Bottom'] as const) {
    const c = limbComponent(ctx, which);
    const poly = limbPolygon(shape, 0, which === 'Top' ? 1 : -1, steps);
    put(ctx, c, slot, extrudeSide(poly, { width: w, bevel: ctx.bevel(0.002) }));
  }
}

function setTips(ctx: BuildContext, tipZ: number, nockZ = tipZ): void {
  ctx.L.extra.tipZ = tipZ;
  ctx.L.extra.nockZ = nockZ;
}

// ---------------------------------------------------------------------------
// Bows
// ---------------------------------------------------------------------------

/** One-piece wooden longbow with a leather grip and horn tips. */
const longbow: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  riser(ctx, 'longbow', 'Stock', { frontBulge: 0.004 });
  const R = L.extra.riser, H = L.extra.H, T = -0.16 - p.bulk * 0.02;
  limbs(ctx, { ctrl: [[0.006, R], [0.008, R + (H - R) * 0.4], [T * 0.45, R + (H - R) * 0.82], [T, H]], width0: 0.026, width1: 0.011 }, 'Stock', 16);
  for (const [name, s] of [['LimbTop', 1], ['LimbBottom', -1]] as const) {
    const c = ctx.b.component(name, { kind: 'limb', variant: 'longbow' });
    put(ctx, c, ctx.style.traits.plumbing ? 'Trim' : 'Detail', dome(0.007, 0.03, 8, 3), [0, s * (H - 0.004), T], [s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]);
  }
  setTips(ctx, T);
};

/** Recurve: riser with limb pockets, limbs that curl forward at the tips. */
const recurve: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const r = riser(ctx, 'recurve', ctx.style.traits.plumbing ? 'Body' : 'Body', { frontBulge: 0.008 });
  const R = L.extra.riser, H = L.extra.H, T = -0.13;
  limbs(ctx, { ctrl: [[0.012, R], [0.004, R + (H - R) * 0.5], [T - 0.07, H - 0.05], [T, H]], width0: 0.016, width1: 0.008 }, ctx.style.traits.plumbing ? 'Stock' : 'Barrel', 18);
  for (const s of [1, -1]) put(ctx, r, 'Trim', box([0, s * (R - 0.012), 0.008], [0.034, 0.03, 0.03], ctx.bevel(0.003)));
  if (p.detail > 0.4) {
    // Front stabilizer rod.
    put(ctx, r, 'Detail', cylinder(0.006, 0.026, 0.2 + p.length * 0.1, 10), [0, -0.12, 0]);
    put(ctx, r, 'Trim', cylinder(0.011, 0.19 + p.length * 0.1, 0.22 + p.length * 0.1, 12, ctx.bevel(0.002)), [0, -0.12, 0]);
  }
  setTips(ctx, T);
};

/** Compound: short stiff limbs, cams at the tips, cables, sight with glowing pins. */
const compound: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const r = riser(ctx, 'compound', 'Body', { frontBulge: 0.012 });
  const R = L.extra.riser, H = L.extra.H, T = -0.11;
  const camR = 0.028 + p.bulk * 0.006;
  limbs(ctx, { ctrl: [[0.004, R - 0.02], [-0.02, R + 0.03], [-0.07, H - 0.02], [T, H]], width0: 0.026, width1: 0.018 }, 'Stock', 10, 0.01);
  // Split the limb pair: shift the geometry built above to +x and add a mirrored copy at -x.
  for (const which of ['LimbTop', 'LimbBottom']) {
    const c = ctx.b.component(which, { kind: 'limb', variant: 'compound' });
    const g = c.geometry.get('Stock');
    if (g) {
      const other = g.clone().transform({ t: [-0.011, 0, 0] });
      g.transform({ t: [0.011, 0, 0] });
      g.merge(other);
    }
  }
  const seg = ctx.seg(1);
  for (const s of [1, -1]) {
    const c = ctx.b.component(s > 0 ? 'LimbTop' : 'LimbBottom', { kind: 'limb', variant: 'compound' });
    put(ctx, c, 'Detail', cylinder(camR, -0.007, 0.007, seg, ctx.bevel(0.001)), [0, s * H, T], [0, Math.PI / 2, 0]);
    put(ctx, c, 'Trim', cylinder(0.004, -0.016, 0.016, 8), [0, s * H, T], [0, Math.PI / 2, 0]);
    // Cable to the opposite limb root.
    put(ctx, c, 'Detail', rod([0.002, s * H, T + camR * 0.6], [0.002, -s * (R + 0.02), -0.004], 0.0014, 5));
  }
  // Cable guard, sight with glowing pins, stabilizer.
  put(ctx, r, 'Detail', rod([-0.01, -0.03, -0.012], [0.01, -0.03, -0.06], 0.0035, 8));
  const sz = 0.06, sy = 0.06;
  put(ctx, r, 'Detail', box([-0.02, sy, 0.03], [0.006, 0.01, 0.05], ctx.bevel(0.001)));
  put(ctx, r, 'Sight', cylinder(0.022, 0, 0.012, seg, ctx.bevel(0.001)), [0.0, sy, sz]);
  for (let i = 0; i < 3; i++) put(ctx, r, 'Emissive', cylinder(0.0015, 0.004, 0.008, 6), [0, sy + 0.01 - i * 0.008, sz], AXIS_X);
  put(ctx, r, 'Detail', cylinder(0.007, 0.03, 0.22 + p.length * 0.08, 10), [0, -0.12, 0]);
  put(ctx, r, 'Trim', cylinder(0.014, 0.2 + p.length * 0.08, 0.24 + p.length * 0.08, 12, ctx.bevel(0.002)), [0, -0.12, 0]);
  setTips(ctx, T, T - camR);
  ctx.L.extra.camR = camR;
};

/** Energy bow: faceted riser, blade limbs with light strips, emitter tips. */
const energy: PartBuilder = (ctx) => {
  const { L } = ctx;
  const r = riser(ctx, 'energy', 'Body', { frontBulge: 0.016, grip: 'Grip' });
  const R = L.extra.riser, H = L.extra.H, T = -0.13;
  const glow: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  const shape: LimbShape = { ctrl: [[0.016, R], [0.04, R + (H - R) * 0.45], [-0.05, H - 0.06], [T, H]], width0: 0.026, width1: 0.008 };
  limbs(ctx, shape, 'Body', 5);
  for (const which of ['Top', 'Bottom'] as const) {
    const c = limbComponent(ctx, which);
    const strip = limbPolygon({ ...shape, width0: 0.006, width1: 0.003 }, 0.003, which === 'Top' ? 1 : -1, 5);
    put(ctx, c, glow, extrudeSide(strip, { width: L.extra.limbW + 0.003 }));
    put(ctx, c, glow, dome(0.008, 0.01, 10, 3), [0, (which === 'Top' ? 1 : -1) * H, T], [which === 'Top' ? -Math.PI / 2 : Math.PI / 2, 0, 0]);
  }
  side(ctx, r, 'Trim', [[0.02, -R * 0.4], [0.04, -0.02], [0.04, 0.02], [0.02, R * 0.4]], 0.02, 0.002);
  setTips(ctx, T);
  L.extra.glowString = ctx.style.traits.glow ? 1 : 0;
};

/** Survivor bow: two lengths of pipe taped to a plank, paracord string. */
const pvc: PartBuilder = (ctx) => {
  const { L } = ctx;
  riser(ctx, 'pvc', 'Stock', { grip: 'Grip' });
  const R = L.extra.riser, H = L.extra.H, T = -0.15;
  const seg = Math.max(6, ctx.seg(0.6));
  for (const s of [1, -1]) {
    const c = limbComponent(ctx, s > 0 ? 'Top' : 'Bottom');
    const ctrl: Vec2[] = [[0.0, R - 0.05], [-0.01, R + (H - R) * 0.5], [-0.09, H - 0.06], [T, H]];
    const pts: Vec3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, u = 1 - t;
      const z = u * u * u * ctrl[0][0] + 3 * u * u * t * ctrl[1][0] + 3 * u * t * t * ctrl[2][0] + t * t * t * ctrl[3][0];
      const y = u * u * u * ctrl[0][1] + 3 * u * u * t * ctrl[1][1] + 3 * u * t * t * ctrl[2][1] + t * t * t * ctrl[3][1];
      pts.push([0, s * y, z]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      put(ctx, c, 'Trim', rod(pts[i], pts[i + 1], 0.011, seg));
      if (i > 0) put(ctx, c, 'Trim', dome(0.011, 0.011, seg, 2), pts[i], [s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]);
    }
    // Tape where the pipe meets the plank, and an end cap.
    put(ctx, c, 'Accent', lathe([[0.0125, -0.025], [0.0135, -0.024], [0.0135, 0.024], [0.0125, 0.025]], seg), [0, s * (R - 0.02), -0.002], [s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]);
    put(ctx, c, 'Detail', cylinder(0.013, -0.008, 0.004, seg), [0, s * H, T], [s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]);
  }
  setTips(ctx, T);
};

/** Elven bow: long elegant recurve, leaf-shaped tips, a gem in the riser, glowing runes. */
const elven: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const r = riser(ctx, 'elven', 'Stock', { frontBulge: 0.01 });
  const R = L.extra.riser, H = L.extra.H, T = -0.12;
  const shape: LimbShape = { ctrl: [[0.012, R], [0.03, R + (H - R) * 0.45], [T - 0.09, H - 0.08], [T, H]], width0: 0.02, width1: 0.008 };
  limbs(ctx, shape, 'Stock', 20);
  const glow: MaterialSlot = ctx.style.traits.magic ? 'Emissive' : 'Trim';
  for (const which of ['Top', 'Bottom'] as const) {
    const s = which === 'Top' ? 1 : -1;
    const c = limbComponent(ctx, which);
    const strip = limbPolygon({ ...shape, width0: 0.004, width1: 0.002 }, 0.0015, s, 20);
    put(ctx, c, glow, extrudeSide(strip, { width: L.extra.limbW + 0.002 }));
    // Leaf-shaped tip ornament.
    const leaf: Vec2[] = [[T, s * (H - 0.002)], [T + 0.02, s * (H + 0.03)], [T + 0.004, s * (H + 0.07)], [T - 0.012, s * (H + 0.03)]];
    put(ctx, c, 'Trim', extrudeSide(leaf, { width: 0.004, bevel: ctx.bevel(0.001) }));
  }
  sideGem(ctx, r, 0.0155, 0.06, 0.012, 0.007 + p.ornament * 0.003);
  setTips(ctx, T);
  L.extra.glowString = 0;
};

export const BOWS: Record<string, PartBuilder> = { longbow, recurve, compound, energy, pvc, elven };

// ---------------------------------------------------------------------------
// String and arrows
// ---------------------------------------------------------------------------

export function bowString(ctx: BuildContext): void {
  const { L, b } = ctx;
  const H = L.extra.H, tipZ = L.extra.tipZ, nockZ = L.extra.nockZ;
  const camR = L.extra.camR ?? 0;
  const s = b.component('String', {
    kind: 'string', variant: L.extra.glowString ? 'energy' : 'cord', pivot: [0, 0, nockZ],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, L.extra.arrowLen * 0.85], purpose: 'draw (pull back toward the face)' },
  });
  const slot: MaterialSlot = L.extra.glowString ? 'Emissive' : 'Detail';
  const top: Vec3 = [0, H, tipZ - camR], bot: Vec3 = [0, -H, tipZ - camR];
  put(ctx, s, slot, rod(top, [0, 0, nockZ], 0.0015, 5));
  put(ctx, s, slot, rod([0, 0, nockZ], bot, 0.0015, 5));
  put(ctx, s, 'Accent', cylinder(0.0028, -0.012, 0.012, 6), [0, 0, nockZ], [-Math.PI / 2, 0, 0]);
}

function arrowBase(ctx: BuildContext, variant: string): { c: Component; z0: number; z1: number; seg: number } {
  const { L, b } = ctx;
  const z0 = L.extra.nockZ - 0.006, z1 = z0 + L.extra.arrowLen;
  const c = b.component('Arrow', {
    kind: 'projectile', variant, pivot: [0, 0, z0],
    motion: { type: 'translate', axis: [0, 0, 1], range: [0, 1], purpose: 'fire' },
  });
  b.socket({ name: 'SOCKET_Muzzle', parent: 'Arrow', position: [0, 0, z1], forward: [0, 0, 1], description: 'Arrow tip: where the projectile starts its flight.' });
  return { c, z0, z1, seg: Math.max(6, ctx.seg(0.4)) };
}

function vanes(ctx: BuildContext, c: Component, z0: number, slot: MaterialSlot, len = 0.07, h = 0.011): void {
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    put(ctx, c, slot, extrudeSide([[z0 + 0.012, 0.0035], [z0 + 0.012 + len, 0.0035], [z0 + 0.008 + len, h * 0.6], [z0 + 0.02, h]], { width: 0.0008 }), [0, 0, 0], [0, 0, a - Math.PI / 2]);
  }
}

const field: PartBuilder = (ctx) => {
  const { c, z0, z1, seg } = arrowBase(ctx, 'field');
  put(ctx, c, 'Detail', cylinder(0.0034, z0 + 0.006, z1 - 0.02, seg));
  put(ctx, c, 'Barrel', lathe([[0.0036, z1 - 0.02], [0.004, z1 - 0.012], [0, z1]], seg));
  put(ctx, c, 'Accent', cylinder(0.0036, z0, z0 + 0.008, seg));
  vanes(ctx, c, z0, 'Accent');
};

const broadhead: PartBuilder = (ctx) => {
  const { c, z0, z1, seg } = arrowBase(ctx, 'broadhead');
  put(ctx, c, 'Detail', cylinder(0.0034, z0 + 0.006, z1 - 0.035, seg));
  put(ctx, c, 'Barrel', lathe([[0.004, z1 - 0.035], [0.0045, z1 - 0.03], [0.002, z1 - 0.004], [0, z1]], seg));
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    put(ctx, c, 'Trim', extrudeSide([[z1 - 0.034, 0.002], [z1 - 0.004, 0.0015], [z1 - 0.03, 0.014]], { width: 0.0008 }), [0, 0, 0], [0, 0, a]);
  }
  put(ctx, c, 'Accent', cylinder(0.0036, z0, z0 + 0.008, seg));
  vanes(ctx, c, z0, 'Accent');
};

const wooden: PartBuilder = (ctx) => {
  const { c, z0, z1, seg } = arrowBase(ctx, 'wooden');
  put(ctx, c, 'Stock', cylinder(0.0038, z0, z1 - 0.025, seg));
  put(ctx, c, 'Trim', lathe([[0.0042, z1 - 0.025], [0.006, z1 - 0.022], [0.0025, z1 - 0.006], [0, z1]], seg));
  vanes(ctx, c, z0, 'Grip', 0.085, 0.013);
};

const energyArrow: PartBuilder = (ctx) => {
  const { c, z0, z1, seg } = arrowBase(ctx, 'energy');
  put(ctx, c, 'Body', cylinder(0.0034, z0, z1 - 0.03, seg));
  const glow: MaterialSlot = ctx.style.traits.glow ? 'Emissive' : 'Accent';
  put(ctx, c, glow, lathe([[0.003, z1 - 0.03], [0.0055, z1 - 0.024], [0.0045, z1 - 0.01], [0, z1]], seg));
  vanes(ctx, c, z0, glow, 0.05, 0.009);
};

const scrapArrow: PartBuilder = (ctx) => {
  const { c, z0, z1, seg } = arrowBase(ctx, 'scrap');
  put(ctx, c, 'Stock', cylinder(0.004, z0, z1 - 0.03, Math.max(5, seg - 2)));
  // A flattened nail / sheet-metal point, taped on.
  put(ctx, c, 'Barrel', extrudeSide([[z1 - 0.034, -0.007], [z1 - 0.034, 0.007], [z1, 0]], { width: 0.0015 }));
  put(ctx, c, 'Accent', cylinder(0.0048, z1 - 0.04, z1 - 0.026, 6));
  vanes(ctx, c, z0, 'Accent', 0.06, 0.012);
};

const crystalArrow: PartBuilder = (ctx) => {
  const { c, z0, z1, seg } = arrowBase(ctx, 'crystal');
  put(ctx, c, 'Stock', cylinder(0.0036, z0, z1 - 0.03, seg));
  put(ctx, c, 'Trim', cylinder(0.0045, z1 - 0.034, z1 - 0.028, seg));
  crystal(ctx, c, [0, 0, z1 - 0.014], 0.03, 0.0055);
  vanes(ctx, c, z0, 'Grip', 0.09, 0.014);
};

export const ARROWS: Record<string, PartBuilder> = { field, broadhead, wooden, energy: energyArrow, scrap: scrapArrow, crystal: crystalArrow };
