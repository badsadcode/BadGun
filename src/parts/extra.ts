/**
 * More long-gun part variants (receivers, barrels, handguards, grips, stocks,
 * magazines), added in the "arsenal" update. Same rules as the originals:
 * read the layout, pick slots by role, let the style paint them.
 */
import { Vec2, box, cylinder, dome, extrudeFront, lathe, rod, smoothPolygon } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import { BuildContext, put, raked, side } from './context.js';
import { rail, rivetRow, triggerAndGuard } from './receiver.js';
import { MAGAZINES } from './lower.js';

// ---------------------------------------------------------------------------
// Receivers
// ---------------------------------------------------------------------------

/** Stamped steel box with a rounded dust cover and rivets (modern, "AK-ish"). */
const stamped: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'stamped', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  const coverY = top - 0.014;
  side(ctx, rec, 'Body', [
    [z0, bottom + 0.012], [z0 + 0.014, bottom], [z1 - 0.012, bottom], [z1, bottom + 0.014], [z1, coverY], [z0, coverY],
  ], w, 0.0015);
  // Rounded dust cover with stiffening ribs.
  const hw = w * 0.47;
  const arc: Vec2[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    arc.push([Math.cos(a) * hw, coverY + 0.004 + Math.sin(a) * (top - coverY - 0.002)]);
  }
  const cover: Vec2[] = [[-hw, coverY - 0.001], [hw, coverY - 0.001], ...arc];
  put(ctx, rec, 'Body', extrudeFront(cover, z0 - 0.006, z1 - 0.03, ctx.bevel(0.001)));
  const ribs = 2 + Math.round(p.detail * 2);
  for (let i = 0; i < ribs; i++) {
    const z = z0 + 0.04 + i * ((z1 - z0 - 0.1) / Math.max(1, ribs - 1));
    const big = cover.map(([x, y]): Vec2 => [x * 1.06, coverY + (y - coverY) * 1.08]);
    put(ctx, rec, 'Trim', extrudeFront(big, z - 0.003, z + 0.003));
  }
  // Rivets along the lower edge.
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) pts.push([s * (w / 2 + 0.0004), bottom + 0.008, z0 + 0.03 + i * 0.05]);
  rivetRow(ctx, rec, 'Detail', pts, 0.0022);
  // Long selector lever on the right.
  put(ctx, rec, 'Detail', box([0, 0, 0], [0.002, 0.008, 0.07], ctx.bevel(0.0006)), [-w / 2 - 0.0012, coverY - 0.012, z0 + 0.09], [0.12, 0, 0]);
  // Magwell lip.
  put(ctx, rec, 'Detail', box([0, bottom - 0.003, (L.magwell.z0 + L.magwell.z1) / 2], [w * 0.8, 0.006, L.magwell.z1 - L.magwell.z0 + 0.012], ctx.bevel(0.0015)));
  // Charging knob on the right, rides with the bolt.
  const ch = b.component('ChargingHandle', {
    kind: 'charging_handle', variant: 'knob', pivot: [-w / 2, coverY - 0.004, z1 - 0.05],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.08], purpose: 'charge' },
  });
  put(ctx, ch, 'Detail', cylinder(0.005, 0, 0.018, ctx.seg(0.5), ctx.bevel(0.001)), [-w / 2, coverY - 0.004, z1 - 0.05], [0, -Math.PI / 2, 0]);
  if (ctx.style.traits.rails) rail(ctx, rec, z0 + 0.03, z1 - 0.04, top);
  L.mountY = ctx.style.traits.rails ? top + 0.0075 : top;
  triggerAndGuard(ctx, 'Detail', 'square');
};

/** Sharp faceted armor shell with glowing slit vents (sci-fi). */
const faceted: PartBuilder = (ctx) => {
  const { L, b, p } = ctx;
  const rec = b.component('Receiver', { kind: 'receiver', variant: 'faceted', parent: null });
  const { z0, z1, top, bottom, width: w } = L.rec;
  side(ctx, rec, 'Body', [
    [z0, top - 0.02], [z0 + 0.01, bottom + 0.008], [z0 + 0.04, bottom], [L.magwell.z0 - 0.008, bottom], [L.magwell.z0 - 0.008, bottom - 0.01],
    [L.magwell.z1 + 0.01, bottom - 0.01], [z1 - 0.02, bottom + 0.004], [z1 + 0.012, -0.006], [z1, top - 0.016], [z1 - 0.04, top], [z0 + 0.03, top],
  ], w, 0.003);
  // Upper armor plate: narrower, sharper, two-tone.
  side(ctx, rec, 'Trim', [
    [z0 + 0.012, top - 0.008], [z0 + 0.03, top + 0.006], [z1 - 0.06, top + 0.006], [z1 - 0.03, top - 0.01], [z0 + 0.04, top - 0.016],
  ], w * 0.8, 0.0015);
  L.mountY = top + 0.006;
  const n = 3 + Math.round(p.detail * 2);
  for (let i = 0; i < n; i++) {
    const z = z0 + 0.05 + i * 0.016;
    const slot = ctx.style.traits.glow ? 'Emissive' : 'Detail';
    put(ctx, rec, slot, box([0, 0, 0], [w + 0.003, 0.022, 0.004]), [0, (top + bottom) / 2 + 0.004, z], [0.4, 0, 0]);
  }
  triggerAndGuard(ctx, 'Body', 'square');
};

export const EXTRA_RECEIVERS: Record<string, PartBuilder> = { stamped, faceted };

// ---------------------------------------------------------------------------
// Barrels
// ---------------------------------------------------------------------------

function barrelComp(ctx: BuildContext, variant: string) {
  return ctx.b.component('Barrel', { kind: 'barrel', variant, pivot: [0, 0, ctx.L.barrel.z0] });
}

/** Barrel with dark lengthwise flutes on the exposed section. */
const fluted: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = barrelComp(ctx, 'fluted');
  const rb = L.barrel.radius * 1.12;
  put(ctx, c, 'Barrel', lathe([[rb * 0.4, L.barrel.z0], [rb, L.barrel.z0], [rb, L.barrel.z1], [rb * 0.4, L.barrel.z1]], ctx.seg(0.8)));
  const z0 = Math.max(L.handguard.z1, L.barrel.z0) + 0.012, z1 = L.barrel.z1 - 0.014;
  if (z1 - z0 > 0.03) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(ctx, c, 'Detail', box([0, 0, 0], [0.003, 0.0024, z1 - z0]), [Math.cos(a) * rb, Math.sin(a) * rb, (z0 + z1) / 2], [0, 0, a + Math.PI / 2]);
    }
  }
};

/** Thick straight "bull" barrel. */
const bull: PartBuilder = (ctx) => {
  const { L } = ctx;
  const c = barrelComp(ctx, 'bull');
  const rb = L.barrel.radius * 1.4;
  put(ctx, c, 'Barrel', lathe([[rb * 0.35, L.barrel.z0], [rb, L.barrel.z0], [rb, L.barrel.z1 - 0.003], [rb * 0.9, L.barrel.z1], [rb * 0.35, L.barrel.z1]], ctx.seg(0.9)));
};

export const EXTRA_BARRELS: Record<string, PartBuilder> = { fluted, bull };

// ---------------------------------------------------------------------------
// Handguards
// ---------------------------------------------------------------------------

function handguardComp(ctx: BuildContext, variant: string) {
  return ctx.b.component('Handguard', { kind: 'handguard', variant, pivot: [0, 0, ctx.L.handguard.z0] });
}

/** Square tube with an accessory rail on every face. */
const quad: PartBuilder = (ctx) => {
  const { L } = ctx;
  const h = handguardComp(ctx, 'quad');
  const { z0, z1, radius } = L.handguard;
  const R = radius * 1.05;
  const A = R * Math.cos(Math.PI / 4);
  put(ctx, h, 'Body', lathe([[L.barrel.radius + 0.003, z0], [R * 0.92, z0], [R, z0 + 0.004], [R, z1 - 0.004], [R * 0.92, z1], [L.barrel.radius + 0.003, z1]], 4, Math.PI / 4));
  const faces = L.extra.topRail ? [0, Math.PI, -Math.PI / 2] : [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const ang of faces) {
    const dir = [Math.cos(ang), Math.sin(ang)];
    const r = ang - Math.PI / 2;
    put(ctx, h, 'Detail', box([0, 0, 0], [0.016, 0.004, z1 - z0 - 0.01]), [dir[0] * (A + 0.002), dir[1] * (A + 0.002), (z0 + z1) / 2], [0, 0, r]);
    for (let z = z0 + 0.01; z + 0.006 < z1; z += 0.01) {
      put(ctx, h, 'Detail', box([0, 0, 0], [0.021, 0.0035, 0.0052]), [dir[0] * (A + 0.0055), dir[1] * (A + 0.0055), z + 0.0026], [0, 0, r]);
    }
  }
  if (!L.extra.topRail && L.rec.top > A + 0.007) {
    put(ctx, h, 'Body', box([0, (A + L.rec.top) / 2, (z0 + z1) / 2], [0.016, L.rec.top - A, z1 - z0 - 0.01]));
  }
};

/** Slim rounded furniture handguard with vent slots. */
const slim: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const h = handguardComp(ctx, 'slim');
  const { z0, z1, radius } = L.handguard;
  const R = radius * 0.95;
  const seg = ctx.seg(1);
  put(ctx, h, 'Stock', lathe([[L.barrel.radius + 0.003, z0], [R * 0.85, z0], [R, z0 + 0.02], [R * 0.96, z1 - 0.015], [R * 0.75, z1], [L.barrel.radius + 0.003, z1]], seg));
  const rows = p.detail > 0.4 ? 2 : 1;
  const n = Math.floor((z1 - z0 - 0.05) / 0.028);
  for (let i = 0; i < n; i++) {
    const z = z0 + 0.035 + i * 0.028;
    for (let r = 0; r < rows; r++) {
      const ang = rows === 1 ? 0 : (r === 0 ? 0.35 : -0.35);
      for (const s of [1, -1]) {
        const a = s > 0 ? ang : Math.PI - ang;
        put(ctx, h, 'Detail', box([0, 0, 0], [0.0016, 0.006, 0.016], ctx.bevel(0.0006)), [Math.cos(a) * (R * 0.97), Math.sin(a) * (R * 0.97), z], [0, 0, a]);
      }
    }
  }
  put(ctx, h, 'Trim', lathe([[R * 0.86, z0 - 0.004], [R * 0.9, z0 - 0.004], [R * 0.9, z0 + 0.004], [R * 0.86, z0 + 0.004]], seg));
};

/** Steampunk cage: brass rings joined by copper rods around the barrel. */
const cage: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const h = handguardComp(ctx, 'cage');
  const { z0, z1, radius } = L.handguard;
  const R = radius * 1.05;
  const seg = ctx.seg(1);
  const rings = [z0 + 0.008, (z0 + z1) / 2, z1 - 0.008];
  for (const z of rings) put(ctx, h, 'Trim', lathe([[L.barrel.radius, z - 0.007], [R + 0.004, z - 0.006], [R + 0.004, z + 0.006], [L.barrel.radius, z + 0.007]], seg));
  const rods = 5 + Math.round(p.ornament * 3);
  for (let i = 0; i < rods; i++) {
    const a = (i / rods) * Math.PI * 2 + Math.PI / 2;
    put(ctx, h, 'Accent', cylinder(0.0032, z0, z1, Math.max(5, ctx.seg(0.4))), [Math.cos(a) * R, Math.sin(a) * R, 0]);
  }
};

/** Pump-action forend: slides back to cycle. Wraps barrel and tube magazine. */
const pump: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const { z0, z1 } = L.handguard;
  const h = ctx.b.component('Handguard', {
    kind: 'handguard', variant: 'pump', pivot: [0, 0, z0],
    motion: { type: 'translate', axis: [0, 0, -1], range: [0, 0.08], purpose: 'pump' },
  });
  const tubeY = L.extra.tubeY ?? -L.barrel.radius * 2.4;
  const tubeR = L.extra.tubeR ?? L.barrel.radius;
  const yTop = -L.barrel.radius * 0.3, yBot = tubeY - tubeR - 0.01 - p.bulk * 0.004;
  side(ctx, h, 'Stock', [
    [z0, yTop], [z1 - 0.012, yTop], [z1, yTop - 0.008], [z1, yBot + 0.008], [z1 - 0.014, yBot], [z0 + 0.014, yBot], [z0, yBot + 0.01],
  ], 0.046 + p.bulk * 0.006, 0.006);
  const ribs = 5 + Math.round(p.detail * 4);
  for (let i = 0; i < ribs; i++) {
    const z = z0 + 0.025 + (i / (ribs - 1)) * (z1 - z0 - 0.05);
    put(ctx, h, 'Stock', box([0, (yTop + yBot) / 2 - 0.003, z], [0.05 + p.bulk * 0.006, (yTop - yBot) * 0.62, 0.005], ctx.bevel(0.0015)));
  }
};

export const EXTRA_HANDGUARDS: Record<string, PartBuilder> = { quad, slim, cage, pump };

// ---------------------------------------------------------------------------
// Grips
// ---------------------------------------------------------------------------

function gripComp(ctx: BuildContext, variant: string) {
  return ctx.b.component('Grip', { kind: 'grip', variant, pivot: [0, ctx.L.grip.y, ctx.L.grip.z] });
}

/** Ergonomic grip with a palm swell and a contrasting backstrap. */
const ergo: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = gripComp(ctx, 'ergo');
  const D = 0.034 + p.bulk * 0.006, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', smoothPolygon(raked(o, L.grip.angle, [
    [-0.008, 0.002], [0.03, 0.003], [0.06, 0.0], [Lg, 0.004], [Lg + 0.006, -D * 0.4], [Lg + 0.002, -D - 0.004],
    [Lg * 0.55, -D - 0.008], [0.02, -D - 0.002], [-0.002, -D - 0.008], [-0.008, -D * 0.5],
  ]), 1), 0.03, 0.004);
  side(ctx, g, 'Accent', raked(o, L.grip.angle, [
    [0.01, -D + 0.004], [Lg * 0.55, -D - 0.002], [Lg - 0.004, -D + 0.002], [Lg - 0.004, -D - 0.006], [Lg * 0.55, -D - 0.011], [0.01, -D - 0.004],
  ]), 0.026, 0.002);
};

/** Open skeleton grip: front strap and back strap joined at the bottom. */
const skeleton: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = gripComp(ctx, 'skeleton');
  const D = 0.034 + p.bulk * 0.004, Lg = L.grip.length, t = 0.009;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', raked(o, L.grip.angle, [[-0.006, 0.002], [Lg, 0.004], [Lg + 0.008, -0.004], [Lg + 0.008, -D], [Lg, -D], [Lg, -t], [-0.006, -t + 0.002]]), 0.024, 0.003);
  side(ctx, g, 'Grip', raked(o, L.grip.angle, [[-0.006, -D + t], [Lg, -D + t], [Lg, -D - 0.002], [-0.004, -D - 0.006]]), 0.024, 0.003);
  side(ctx, g, ctx.style.traits.glow ? 'Emissive' : 'Trim', raked(o, L.grip.angle, [[0.01, -t - 0.002], [Lg - 0.004, -t - 0.002], [Lg - 0.004, -D + t + 0.002], [0.01, -D + t + 0.002]]), 0.006);
};

/** Leather-wrapped grip bound with brass rings. */
const wrapped: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const g = gripComp(ctx, 'wrapped');
  const D = 0.034 + p.bulk * 0.006, Lg = L.grip.length;
  const o: Vec2 = [L.grip.z, L.grip.y];
  side(ctx, g, 'Grip', smoothPolygon(raked(o, L.grip.angle, [
    [-0.01, 0.003], [Lg, 0.002], [Lg + 0.004, -D * 0.5], [Lg, -D - 0.002], [-0.004, -D - 0.004], [-0.01, -D * 0.5],
  ]), 1), 0.029, 0.006);
  const rings = 2 + Math.round(p.ornament * 2);
  for (let i = 0; i < rings; i++) {
    const t = 0.012 + (i / Math.max(1, rings - 1)) * (Lg - 0.02);
    side(ctx, g, 'Trim', raked(o, L.grip.angle, [[t - 0.0025, 0.0045], [t + 0.0025, 0.0045], [t + 0.0025, -D - 0.0045], [t - 0.0025, -D - 0.0045]]), 0.032, 0.001);
  }
};

export const EXTRA_GRIPS: Record<string, PartBuilder> = { ergo, skeleton, wrapped };

// ---------------------------------------------------------------------------
// Stocks
// ---------------------------------------------------------------------------

/** Folding wire stock: two rods and a butt plate, folds to the side. */
const wire: PartBuilder = (ctx) => {
  const { L } = ctx;
  const { z0 } = L.stock, zb = L.stock.z1 + 0.03, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const s = ctx.b.component('Stock', {
    kind: 'stock', variant: 'wire', pivot: [L.rec.width / 2, 0, z0],
    motion: { type: 'rotate', axis: [0, 1, 0], range: [0, Math.PI], purpose: 'fold' },
  });
  const bt = top - 0.004 - drop * 0.3, bb = -0.085 - drop;
  const seg = Math.max(5, ctx.seg(0.35));
  for (const x of [0.013, -0.013]) {
    put(ctx, s, 'Detail', rod([x, top - 0.01, z0], [x, bt - 0.006, zb + 0.006], 0.0035, seg));
    put(ctx, s, 'Detail', rod([x, bottom + 0.008, z0 - 0.004], [x, bb + 0.01, zb + 0.006], 0.0035, seg));
  }
  put(ctx, s, 'Detail', rod([0.013, (top + bottom) / 2, z0 - 0.08], [-0.013, (top + bottom) / 2, z0 - 0.08], 0.003, seg));
  side(ctx, s, 'Stock', [[zb + 0.01, bt], [zb - 0.004, bt], [zb - 0.004, bb], [zb + 0.01, bb]], 0.036, 0.003);
  side(ctx, s, 'Grip', [[zb - 0.004, bt - 0.002], [zb - 0.012, bt - 0.004], [zb - 0.012, bb + 0.004], [zb - 0.004, bb + 0.002]], 0.037, 0.002);
  ctx.b.socket({ name: 'SOCKET_Shoulder', parent: 'Stock', position: [0, (bt + bb) / 2, zb - 0.012], forward: [0, 0, -1], description: 'Butt of the stock, where it meets the shoulder.' });
};

export const EXTRA_STOCKS: Record<string, PartBuilder> = { wire };

// ---------------------------------------------------------------------------
// Magazines
// ---------------------------------------------------------------------------

/** Shotgun tube magazine under the barrel (fixed). */
const tubeMag: PartBuilder = (ctx) => {
  const { L } = ctx;
  const r = L.extra.tubeR ?? L.barrel.radius;
  const y = L.extra.tubeY ?? -L.barrel.radius * 2.4;
  const z0 = L.rec.z1 - 0.01, z1 = L.barrel.z1 - 0.025 - (L.extra.tubeShort ?? 0);
  const m = ctx.b.component('Magazine', { kind: 'magazine', variant: 'tube', pivot: [0, y, z0] });
  const seg = ctx.seg(0.8);
  put(ctx, m, 'Barrel', lathe([[0, z0], [r, z0], [r, z1 - 0.012], [r * 1.12, z1 - 0.012]], seg), [0, y, 0]);
  put(ctx, m, 'Trim', lathe([[r * 1.12, z1 - 0.012], [r * 1.18, z1 - 0.009], [r * 1.18, z1], [r * 0.7, z1 + 0.004], [0, z1 + 0.004]], seg), [0, y, 0]);
  // Barrel clamp tying barrel and tube together.
  put(ctx, m, 'Detail', box([0, (y + 0) / 2, z1 - 0.03], [r * 2.2, -y + r * 2.4, 0.012], ctx.bevel(0.002)));
};

/** LMG ammo box with a short belt feeding into the receiver. */
const ammobox: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const zc = (L.magwell.z0 + L.magwell.z1) / 2;
  const top = L.rec.bottom - 0.002;
  const m = ctx.b.component('Magazine', {
    kind: 'magazine', variant: 'ammobox', pivot: [0, L.rec.bottom, zc],
    motion: { type: 'translate', axis: [0, -1, 0], range: [0, 0.2], purpose: 'reload' },
  });
  const hgt = 0.1 + p.bulk * 0.03, wid = 0.06 + p.bulk * 0.014, len = 0.12 + p.bulk * 0.02;
  const xc = 0.012;
  put(ctx, m, 'Magazine', box([xc, top - hgt / 2, zc], [wid, hgt, len], ctx.bevel(0.004)));
  put(ctx, m, 'Detail', box([xc, top - 0.004, zc], [wid + 0.004, 0.008, len + 0.004], ctx.bevel(0.002)));
  // Ribs and handle.
  for (const dz of [-len * 0.3, 0, len * 0.3]) put(ctx, m, 'Magazine', box([xc, top - hgt / 2, zc + dz], [wid + 0.003, hgt * 0.8, 0.006], ctx.bevel(0.0015)));
  put(ctx, m, 'Detail', box([xc + wid / 2 + 0.006, top - hgt * 0.35, zc], [0.006, 0.008, len * 0.6], ctx.bevel(0.002)));
  // Belt: a few rounds climbing into the left side of the receiver.
  const seg = Math.max(6, ctx.seg(0.4));
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const x = xc + wid * 0.25 + t * 0.012, y = top + 0.004 + t * (L.rec.bottom * -0.2 + 0.02);
    put(ctx, m, 'Trim', cylinder(0.0045, -0.022, 0.012, seg), [x, y, zc + 0.01 - i * 0.002], undefined);
    put(ctx, m, 'Detail', dome(0.0045, 0.012, seg, 3), [x, y, zc + 0.022 - i * 0.002]);
  }
};

/** Two curved magazines taped side by side ("jungle style"). */
const twin: PartBuilder = (ctx) => {
  MAGAZINES.curved(ctx);
  const m = ctx.b.component('Magazine', { kind: 'magazine', variant: 'twin' });
  m.variant = 'twin';
  const copies = [...m.geometry.entries()].map(([slot, g]) => [slot, g.clone().transform({ t: [0.026, -0.03, -0.006] })] as const);
  for (const [slot, g] of copies) ctx.b.add(m, slot, g);
  const { L } = ctx;
  const zc = (L.magwell.z0 + L.magwell.z1) / 2;
  for (const dy of [0.05, 0.1]) {
    put(ctx, m, 'Accent', box([0.013, L.rec.bottom - dy, zc + 0.004 + dy * 0.12], [0.056, 0.014, L.magwell.z1 - L.magwell.z0 + 0.004], ctx.bevel(0.001)));
  }
};

export const EXTRA_MAGAZINES: Record<string, PartBuilder> = { tube: tubeMag, ammobox, twin };

