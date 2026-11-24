/**
 * Faction insignia: a flat badge in the Accent color with a Trim emblem,
 * placed on both sides of the weapon where it reads best for each archetype.
 */
import type { Vec2 } from '../core/geometry.js';
import type { Insignia } from '../types.js';
import { BuildContext, raked, side } from './context.js';

function outline(shape: Insignia['shape'], r: number): Vec2[] {
  const poly = (n: number, rot: number, rr = r): Vec2[] => Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [Math.cos(a) * rr, Math.sin(a) * rr] as Vec2;
  });
  switch (shape) {
    case 'circle': return poly(16, 0);
    case 'hex': return poly(6, 0);
    case 'diamond': return [[0, -r * 1.15], [r * 0.8, 0], [0, r * 1.15], [-r * 0.8, 0]];
    case 'triangle': return poly(3, Math.PI / 2, r * 1.1);
    case 'star': return Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2, rr = i % 2 ? r * 0.48 : r * 1.12;
      return [Math.cos(a) * rr, Math.sin(a) * rr] as Vec2;
    });
    case 'chevron': return [[-r, r * 0.2], [0, -r * 0.7], [r, r * 0.2], [r, r * 0.75], [0, -r * 0.1], [-r, r * 0.75]];
    case 'shield':
    default: return [[-r * 0.85, r * 0.9], [r * 0.85, r * 0.9], [r * 0.85, 0], [0, -r * 1.1], [-r * 0.85, 0]];
  }
}

/** Where the badge goes: [component, z, y, x (side face)]. */
function anchor(ctx: BuildContext): { comp: string; z: number; y: number; x: number; r: number } {
  const { L, b, archetype } = ctx;
  if (archetype === 'pistol' || archetype === 'revolver') {
    const [z, y] = raked([L.grip.z, L.grip.y], L.grip.angle, [[L.grip.length * 0.45, -(L.extra.gripDepth ?? 0.04) * 0.5]])[0];
    return { comp: 'Grip', z, y, x: L.extra.insigniaX ?? 0.0158, r: 0.0065 };
  }
  if (archetype === 'bow') return { comp: b.rootName, z: 0.003, y: -L.extra.riser * 0.62, x: 0.0162, r: 0.007 };
  const z = L.rec.z0 + (L.rec.z1 - L.rec.z0) * (archetype === 'crossbow' ? 0.35 : 0.24);
  return { comp: b.rootName, z, y: (L.rec.top + L.rec.bottom) / 2, x: L.rec.width / 2 + 0.0012, r: Math.min(0.011, (L.rec.top - L.rec.bottom) * 0.28) };
}

export function insignia(ctx: BuildContext, ins: Insignia): void {
  const a = anchor(ctx);
  const c = ctx.b.component(a.comp, { kind: 'receiver', variant: '-' });
  const at = (pts: Vec2[], k = 1): Vec2[] => pts.map(([u, v]) => [a.z + u * k, a.y + v * k]);
  const shape = outline(ins.shape, a.r);
  const inner: Vec2[] = Array.from({ length: Math.max(3, ins.emblem) * 2 }, (_, i) => {
    const ang = Math.PI / 2 + (i / (Math.max(3, ins.emblem) * 2)) * Math.PI * 2, rr = i % 2 ? a.r * 0.18 : a.r * 0.45;
    return [Math.cos(ang) * rr, Math.sin(ang) * rr] as Vec2;
  });
  for (const s of [1, -1]) {
    side(ctx, c, 'Accent', at(shape), 0.0012, 0, s * a.x);
    side(ctx, c, 'Trim', at(inner), 0.0012, 0, s * (a.x + 0.0009));
  }
}
