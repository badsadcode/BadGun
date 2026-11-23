/**
 * Shoulder stocks.
 */
import { Vec2, bezier, box, cylinder, roundedRect, smoothPolygon } from '../core/geometry.js';
import { BuildContext, put, side } from './context.js';
import type { PartBuilder } from './receiver.js';

function shoulderSocket(ctx: BuildContext, z: number, y: number): void {
  ctx.b.socket({
    name: 'SOCKET_Shoulder',
    parent: 'Stock',
    position: [0, y, z],
    forward: [0, 0, -1],
    description: 'Butt of the stock, where it meets the shoulder.',
  });
}

function buttPad(ctx: BuildContext, comp: ReturnType<BuildContext['b']['component']>, zb: number, yTop: number, yBot: number, w: number) {
  side(ctx, comp, 'Grip', [[zb + 0.002, yTop], [zb - 0.011, yTop - 0.002], [zb - 0.011, yBot + 0.002], [zb + 0.002, yBot]], w + 0.002, 0.003);
}

const collapsible: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const rec = ctx.b.component(ctx.b.rootName, { kind: 'receiver', variant: '-' });
  const yb = L.rec.top - 0.018;
  const zb = L.stock.z1;
  // Buffer tube (fixed to the receiver).
  put(ctx, rec, 'Detail', cylinder(0.0155, zb + 0.03, L.rec.z0 + 0.004, ctx.seg(0.9), ctx.bevel(0.002)), [0, yb, 0]);
  put(ctx, rec, 'Trim', cylinder(0.019, L.rec.z0 - 0.01, L.rec.z0 + 0.002, 10), [0, yb, 0]);

  const s = ctx.b.component('Stock', {
    kind: 'stock',
    variant: 'collapsible',
    pivot: [0, yb, L.stock.z0],
    motion: { type: 'translate', axis: [0, 0, 1], range: [0, 0.08], purpose: 'adjust length' },
  });
  const zt = zb + 0.15 + p.length * 0.02;
  const drop = L.stock.drop;
  const bot = yb - 0.095 - drop;
  side(ctx, s, 'Stock', [
    [zt, yb + 0.017], [zt - 0.025, yb + 0.022], [zb + 0.01, yb + 0.022], [zb, yb + 0.018],
    [zb, bot], [zb + 0.035, bot - 0.004], [zt - 0.045, yb - 0.035], [zt, yb - 0.019],
  ], 0.04, 0.004);
  buttPad(ctx, s, zb, yb + 0.02, bot, 0.04);
  // Adjustment lever.
  put(ctx, s, 'Detail', box([0, yb - 0.025, zt - 0.03], [0.012, 0.006, 0.03], ctx.bevel(0.0015)));
  shoulderSocket(ctx, zb - 0.011, (yb + bot) / 2);
};

const fixed: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'fixed', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const bot = -0.1 - drop;
  side(ctx, s, 'Stock', [
    [z0 + 0.006, top - 0.004], [zb + 0.012, top - 0.006 - drop * 0.3], [zb, top - 0.01 - drop * 0.3],
    [zb, bot], [zb + 0.024, bot - 0.004], [z0 - 0.06, bottom + 0.004], [z0 + 0.006, bottom + 0.012],
  ], 0.042, 0.005);
  buttPad(ctx, s, zb, top - 0.012 - drop * 0.3, bot, 0.042);
  put(ctx, s, 'Detail', box([0, bot + 0.004, zb + 0.06], [0.01, 0.006, 0.02], ctx.bevel(0.002)));
  shoulderSocket(ctx, zb - 0.011, (top + bot) / 2);
};

const classic: PartBuilder = (ctx) => {
  const { L, p } = ctx;
  const z0 = L.rec.z0 - 0.008;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'classic', pivot: [0, 0, z0] });
  const zb = L.stock.z1, drop = L.stock.drop;
  const R = L.rec.top, bottom = L.rec.bottom;
  const heelY = R * 0.4 - drop * 0.6;
  const toeY = -0.1 - drop - p.bulk * 0.01;
  const bottomLine = bezier([zb + 0.004, toeY], [zb + 0.09, toeY + 0.012], [z0 - 0.09, bottom - 0.01], [z0 - 0.03, bottom + 0.002], 10);
  const prof: Vec2[] = [
    [z0 + 0.012, R * 0.5], [zb + 0.012, heelY], [zb, heelY - 0.004], [zb + 0.004, toeY],
    ...bottomLine, [z0 + 0.012, bottom + 0.006],
  ];
  side(ctx, s, 'Stock', smoothPolygon(prof, ctx.p.smoothness > 0.3 ? 1 : 0), 0.042, 0.008);
  // Brass butt plate.
  side(ctx, s, 'Trim', [[zb + 0.006, heelY + 0.001], [zb - 0.006, heelY - 0.003], [zb - 0.002, toeY - 0.002], [zb + 0.01, toeY + 0.002]], 0.044, 0.002);
  // Inlay plate.
  if (p.ornament > 0.45) {
    const cz = zb + (z0 - zb) * 0.45, cy = (heelY + toeY) / 2 + 0.01;
    const rx = 0.03 + p.ornament * 0.015, ry = 0.016 + p.ornament * 0.006;
    side(ctx, s, 'Trim', [[cz - rx, cy], [cz, cy - ry], [cz + rx, cy], [cz, cy + ry]], 0.0446, 0.0012);
  }
  shoulderSocket(ctx, zb - 0.006, (heelY + toeY) / 2);
};

const skeletal: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'skeletal', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const buttTop = top - drop * 0.3, buttBot = -0.1 - drop;
  const t = 0.014;
  side(ctx, s, 'Stock', [[z0 + 0.01, top - 0.004], [zb + 0.03, buttTop - 0.002], [zb + 0.03, buttTop - 0.002 - t], [z0 + 0.01, top - 0.004 - t * 1.4]], 0.02, 0.004);
  side(ctx, s, 'Stock', [[z0 + 0.01, bottom + 0.004 + t], [zb + 0.03, buttBot + 0.02 + t], [zb + 0.03, buttBot + 0.02], [z0 + 0.01, bottom + 0.004]], 0.02, 0.004);
  const seg = Math.max(2, Math.round(ctx.seg(0.25)));
  side(ctx, s, 'Stock', roundedRect(zb + 0.016, (buttTop + buttBot) / 2, 0.032, buttTop - buttBot, 0.01, seg), 0.038, 0.004);
  if (ctx.style.traits.glow) {
    side(ctx, s, 'Emissive', [[z0 - 0.02, top - 0.009], [zb + 0.045, buttTop - 0.008], [zb + 0.045, buttTop - 0.011], [z0 - 0.02, top - 0.012]], 0.022);
  }
  buttPad(ctx, s, zb, buttTop - 0.002, buttBot + 0.002, 0.038);
  shoulderSocket(ctx, zb - 0.011, (buttTop + buttBot) / 2);
};

const solid: PartBuilder = (ctx) => {
  const { L } = ctx;
  const s = ctx.b.component('Stock', { kind: 'stock', variant: 'solid', pivot: [0, 0, L.stock.z0] });
  const { z0 } = L.stock, zb = L.stock.z1, drop = L.stock.drop;
  const top = L.rec.top, bottom = L.rec.bottom;
  const buttTop = top - 0.004 - drop * 0.3, buttBot = -0.1 - drop;
  const lower = bezier([zb + 0.004, buttBot], [zb + 0.08, buttBot + 0.006], [z0 - 0.07, bottom - 0.01], [z0, bottom + 0.008], 8);
  const prof: Vec2[] = [[z0 + 0.01, top - 0.002], [zb + 0.03, buttTop], [zb, buttTop - 0.012], [zb + 0.002, buttBot], ...lower];
  side(ctx, s, 'Stock', smoothPolygon(prof, 1), 0.04, 0.007);
  const panel: Vec2[] = [[z0 - 0.03, top - 0.016], [zb + 0.06, buttTop - 0.016], [zb + 0.05, buttTop - 0.04], [z0 - 0.06, top - 0.036]];
  side(ctx, s, 'Trim', panel, 0.043, 0.0015);
  if (ctx.style.traits.glow) {
    side(ctx, s, 'Emissive', [[z0 - 0.035, top - 0.04], [zb + 0.07, buttTop - 0.045], [zb + 0.07, buttTop - 0.048], [z0 - 0.035, top - 0.043]], 0.0435);
  }
  buttPad(ctx, s, zb, buttTop - 0.012, buttBot + 0.002, 0.04);
  shoulderSocket(ctx, zb - 0.011, (buttTop + buttBot) / 2);
};

export const STOCKS: Record<string, PartBuilder> = { collapsible, fixed, classic, skeletal, solid };
