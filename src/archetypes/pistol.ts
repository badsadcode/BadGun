/**
 * Handguns: slide pistols, revolvers, blasters.
 *
 * Preferences come from style *traits* (rails -> slide pistol, plumbing ->
 * revolver, glow -> blaster), so a brand new style gets sensible handguns
 * without touching this file. Styles can still override via `byArchetype`.
 */
import type { Vec3 } from '../core/geometry.js';
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { ArchetypeDef, Weights } from './archetype.js';
import { PISTOL_FRAMES, PISTOL_GRIPS } from '../parts/pistol.js';
import { MUZZLES } from '../parts/front.js';
import { buildOptic } from '../parts/sight.js';

const t = (on: boolean, yes: number, no: number) => (on ? yes : no);

export const pistol: ArchetypeDef = {
  id: 'pistol',
  name: 'Pistol',
  description: 'Handguns: slide pistols, revolvers and blasters.',
  parts: { frame: PISTOL_FRAMES, grip: PISTOL_GRIPS, muzzle: MUZZLES },
  optics: ['none', 'reddot', 'holo'],

  weights(style, kind): Weights | undefined {
    const { rails, plumbing, glow } = style.traits;
    if (kind === 'frame') return { slide: t(rails, 3, 0.4), revolver: t(plumbing, 3, 0.4), blaster: t(glow, 3, 0.3) };
    if (kind === 'grip') return { block: t(rails, 3, 0.4), birdshead: t(plumbing, 3, 0.4), swept: t(glow, 3, 0.3) };
    if (kind === 'muzzle') {
      return {
        none: 3,
        compensator: t(rails, 0.5, 0.1),
        suppressor: t(rails, 0.5, 0),
        bell: t(plumbing, 0.5, 0),
        crown: t(plumbing, 0.4, 0),
        emitter: t(glow, 1.5, 0),
        prongs: t(glow, 0.8, 0),
      };
    }
    return undefined;
  },

  opticWeights: (style) => ({ none: 3, reddot: t(style.traits.rails, 1, 0.2), holo: t(style.traits.glow, 0.4, 0) }),

  layout(chosen, p, rng): LongGunLayout {
    const { bulk, length } = p;
    const frame = chosen.frame;
    const z0 = -0.09;
    const len = frame === 'revolver' ? 0.2 + length * 0.12 : 0.17 + length * 0.06;
    const z1 = z0 + len + rng.range(-0.005, 0.01);
    const top = 0.016 + bulk * 0.004;
    const bottom = -0.022 - bulk * 0.004;
    const gripDepth = (frame === 'revolver' ? 0.036 : 0.045) + bulk * 0.006;
    const gz = z0 + (frame === 'revolver' ? 0.03 : frame === 'blaster' ? 0.065 : 0.07);
    const gy = bottom + 0.002;
    return {
      rec: { z0, z1, top, bottom, width: 0.025 + bulk * 0.006 },
      magwell: { z0: gz - gripDepth, z1: gz, y: bottom, flare: false },
      magLength: 0.1,
      trigger: { z: gz + 0.022, y: bottom },
      grip: { z: gz, y: gy, angle: (frame === 'revolver' ? 0.42 : 0.26) + rng.range(-0.05, 0.06), length: (frame === 'revolver' ? 0.085 : 0.095) + bulk * 0.014 },
      handguard: { z0: gz + 0.055, z1: z1 - 0.004, radius: 0.014 },
      barrel: { z0: z0 + 0.02, z1: frame === 'blaster' ? z1 + 0.03 + length * 0.02 : frame === 'revolver' ? z1 : z1 + 0.003, radius: 0.0062 + bulk * 0.0015 },
      stock: { z0, z1: z0, drop: 0 },
      mountY: top,
      opticZ: z0 + 0.045,
      extra: { gripDepth },
    };
  },

  build(ctx: BuildContext, chosen) {
    const order = ['frame', 'grip', 'muzzle'];
    for (const kind of order) {
      const fn = pistol.parts[kind][chosen[kind]];
      if (!fn) throw new Error(`Unknown ${kind} variant "${chosen[kind]}". Available: ${Object.keys(pistol.parts[kind]).join(', ')}`);
      fn(ctx);
    }
    buildOptic(ctx, chosen.sight);
    // Optics ride on the slide when there is one.
    if (ctx.b.has('Optic') && ctx.b.has('Slide')) ctx.b.component('Optic', { kind: 'optic', variant: '-' }).parent = 'Slide';

    const { L, b } = ctx;
    const a = L.grip.angle;
    const D = L.extra.gripDepth;
    const hand: Vec3 = [0, L.grip.y - 0.035 * Math.cos(a), L.grip.z - D * 0.45 - 0.035 * Math.sin(a)];
    b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Grip', position: hand, forward: [0, 0, 1], description: 'Shooting hand on the grip.' });
    b.socket({ name: 'SOCKET_Hand_Support', parent: 'Grip', position: [0.02, hand[1] - 0.01, hand[2] + 0.005], forward: [0, 0, 1], description: 'Support hand wrapped around the shooting hand (left side).' });
    const base: Vec3 = [0, L.grip.y - (L.grip.length + 0.008) * Math.cos(a), L.grip.z - D / 2 - (L.grip.length + 0.008) * Math.sin(a)];
    b.socket({ name: 'SOCKET_Magazine', parent: 'Frame', position: base, forward: [0, -Math.cos(a), -Math.sin(a)], description: L.extra.revolver ? 'Bottom of the grip (revolvers load through the cylinder).' : 'Magazine well at the bottom of the grip.' });
    b.socket({
      name: 'SOCKET_Eject', parent: b.has('Slide') ? 'Slide' : 'Frame',
      position: [-L.rec.width / 2 - 0.004, L.rec.top - 0.002, L.rec.z0 + (L.rec.z1 - L.rec.z0) * 0.55], forward: [-1, 0.6, -0.1],
      description: 'Where casings (or heat) come out, right side.',
    });
  },

  origin: (ctx) => ctx.b.sockets.find((s) => s.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0],
};
