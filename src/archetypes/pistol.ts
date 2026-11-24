/**
 * Handguns: slide pistols, revolvers, blasters.
 *
 * Preferences come from style *traits* (rails -> slide pistol, plumbing ->
 * revolver, glow -> blaster), so a brand new style gets sensible handguns
 * without touching this file. Styles can still override via `byArchetype`.
 */
import { decoPistol, smartgun } from '../parts/punk.js';
import type { Vec3 } from '../core/geometry.js';
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { ArchetypeDef, Weights } from './archetype.js';
import { PISTOL_FRAMES, PISTOL_GRIPS } from '../parts/pistol.js';
import { MUZZLES } from '../parts/front.js';
import { pipePistol, tapedPistolGrip } from '../parts/scrap.js';
import { flintlock, scrollGrip } from '../parts/fantasy.js';
import { broomGrip, broomhandle, toggle } from '../parts/era.js';
import { buildOptic } from '../parts/sight.js';
import { PISTOL_RAIL_FRAMES, PISTOL_UNDERBARREL_PARTS, pistolAttachmentWeights, pistolMount } from '../parts/attach.js';

const t = (on: boolean, yes: number, no: number) => (on ? yes : no);

export const pistol: ArchetypeDef = {
  id: 'pistol',
  name: 'Pistol',
  description: 'Handguns: slide pistols, revolvers and blasters.',
  parts: { frame: { ...PISTOL_FRAMES, deco: decoPistol, smartgun, pipe: pipePistol, flintlock, broomhandle, toggle }, grip: { ...PISTOL_GRIPS, taped: tapedPistolGrip, scroll: scrollGrip, broom: broomGrip }, muzzle: MUZZLES, underbarrel: PISTOL_UNDERBARREL_PARTS },
  optics: ['none', 'reddot', 'holo', 'rune'],

  weights(style, kind): Weights | undefined {
    if (kind === 'underbarrel') return pistolAttachmentWeights(style);
    const { rails, plumbing, glow } = style.traits;
    const era = style.traits.era;
    if (era) {
      // Historical: period handguns only.
      if (kind === 'frame') return { revolver: 1.2, broomhandle: era < 1950 ? 1.2 : 0, toggle: era < 1950 ? 1 : 0, slide: era > 1930 ? 1.6 : 0.6, flare: 0.15 };
      if (kind === 'grip') return { block: era > 1950 ? 1 : 0.4, birdshead: 1, broom: era < 1950 ? 0.8 : 0 };
      if (kind === 'muzzle') return { none: 1 };
    }
    const scrap = !!style.traits.scrap, magic = !!style.traits.magic;
    if (kind === 'frame') return { slide: t(rails, 3, 0.4), revolver: t(plumbing, 3, 0.4) + t(magic, 0.6, 0), blaster: t(glow, 3, 0.3), loop: t(glow, 2.5, 0) + t(rails, 0.2, 0), cannon: t(glow, 1, 0) + t(rails, 0.6, 0) + t(plumbing, 0.3, 0), flare: t(scrap, 1, 0) + t(rails, 0.25, 0) + t(plumbing, 0.3, 0.02), pipe: t(scrap, 3, 0.03), flintlock: t(magic, 3, 0) + t(plumbing, 0.8, 0.05) };
    if (kind === 'grip') return { block: t(rails, 3, 0.4), birdshead: t(plumbing, 3, 0.4), swept: t(glow, 3, 0.3), taped: t(scrap, 3, 0.05), scroll: t(magic, 3, 0.1) };
    if (kind === 'muzzle') {
      return {
        none: 3,
        compensator: t(rails, 0.5, 0.1),
        suppressor: t(rails, 0.5, 0),
        bell: t(plumbing, 0.5, 0),
        can: t(scrap, 0.7, 0),
        bottle: t(scrap, 0.7, 0),
        crystal: t(magic, 1.5, 0),
        maw: t(magic, 0.6, 0),
        crown: t(plumbing, 0.4, 0),
        emitter: t(glow, 1.5, 0),
        prongs: t(glow, 0.8, 0),
      };
    }
    return undefined;
  },

  opticWeights: (style): Weights => style.traits.era ? { none: 1 } : ({ none: 3, reddot: t(style.traits.rails, 1, 0.2), holo: t(style.traits.glow, 0.4, 0), rune: t(!!style.traits.magic, 0.8, 0) }),

  layout(chosen, p, rng): LongGunLayout {
    const { bulk, length } = p;
    const frame = chosen.frame;
    const z0 = -0.09;
    const len = frame === 'revolver' || frame === 'flintlock' || frame === 'cannon' || frame === 'broomhandle' ? 0.2 + length * 0.12 : frame === 'flare' ? 0.15 + length * 0.04 : 0.17 + length * 0.06;
    const z1 = z0 + len + rng.range(-0.005, 0.01);
    const top = 0.016 + bulk * 0.004;
    const bottom = -0.022 - bulk * 0.004;
    const gripDepth = (frame === 'revolver' ? 0.036 : 0.045) + bulk * 0.006;
    const gz = z0 + (frame === 'broomhandle' ? 0.035 : frame === 'toggle' ? 0.05 : frame === 'revolver' || frame === 'cannon' ? 0.03 : frame === 'blaster' || frame === 'loop' || frame === 'deco' || frame === 'smartgun' ? 0.065 : frame === 'pipe' || frame === 'flare' ? 0.05 : 0.07);
    const gy = bottom + 0.002;
    return {
      rec: { z0, z1, top, bottom, width: 0.025 + bulk * 0.006 },
      magwell: { z0: gz - gripDepth, z1: gz, y: bottom, flare: false },
      magLength: 0.1,
      trigger: { z: gz + 0.022, y: bottom },
      grip: { z: gz, y: gy, angle: (frame === 'revolver' ? 0.42 : 0.26) + rng.range(-0.05, 0.06), length: (frame === 'revolver' ? 0.085 : 0.095) + bulk * 0.014 },
      handguard: { z0: gz + 0.055, z1: z1 - 0.004, radius: 0.014 },
      barrel: { z0: z0 + 0.02, z1: frame === 'blaster' ? z1 + 0.03 + length * 0.02 : frame === 'revolver' || frame === 'flintlock' || frame === 'flare' || frame === 'broomhandle' || frame === 'toggle' ? z1 : frame === 'loop' ? z1 + 0.025 : frame === 'deco' ? z1 + 0.035 + length * 0.02 : frame === 'smartgun' ? z1 + 0.025 : frame === 'cannon' ? z1 + 0.012 : z1 + 0.003, radius: 0.0062 + bulk * 0.0015 },
      stock: { z0, z1: z0, drop: 0 },
      mountY: top,
      opticZ: z0 + 0.045,
      extra: { gripDepth },
    };
  },

  build(ctx: BuildContext, chosen) {
    const order = ['frame', 'grip', 'muzzle', 'underbarrel'];
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
    if (PISTOL_RAIL_FRAMES.includes(chosen.frame)) {
      b.socket({ name: 'SOCKET_Underbarrel', parent: 'Frame', position: pistolMount(ctx).at, forward: [0, 0, 1], description: 'Under-frame mount for a light or laser. Attachments hang down from here.' });
    }
    b.socket({
      name: 'SOCKET_Eject', parent: b.has('Slide') ? 'Slide' : 'Frame',
      position: [-L.rec.width / 2 - 0.004, L.rec.top - 0.002, L.rec.z0 + (L.rec.z1 - L.rec.z0) * 0.55], forward: [-1, 0.6, -0.1],
      description: 'Where casings (or heat) come out, right side.',
    });
  },

  // Lights and lasers need a rail-like frame (no revolvers, flintlocks or zip guns).
  fixup: (chosen, forced) => {
    if (!forced.has('underbarrel') && !PISTOL_RAIL_FRAMES.includes(chosen.frame)) chosen.underbarrel = 'none';
  },
  origin: (ctx) => ctx.b.sockets.find((s) => s.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0],
};
