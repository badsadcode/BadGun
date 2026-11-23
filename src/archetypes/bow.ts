/**
 * Bows: a riser + limbs (one "bow" part, since they must match), a string,
 * and an arrow. Upright in the YZ plane, arrow along +Z, origin in the bow
 * hand. Built braced (at rest); the String component carries the draw motion.
 */
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { ArchetypeDef, Weights } from './archetype.js';
import { ARROWS, BOWS, bowString } from '../parts/bow.js';

const t = (on: boolean, yes: number, no: number) => (on ? yes : no);

/** Tip height (half the bow's length) and riser half-height, per bow type. */
const SIZES: Record<string, { H: [number, number]; riser: number; limbW: number }> = {
  longbow: { H: [0.78, 0.92], riser: 0.12, limbW: 0.028 },
  recurve: { H: [0.66, 0.8], riser: 0.27, limbW: 0.036 },
  compound: { H: [0.38, 0.46], riser: 0.31, limbW: 0.01 },
  energy: { H: [0.55, 0.66], riser: 0.22, limbW: 0.03 },
  pvc: { H: [0.64, 0.78], riser: 0.17, limbW: 0.02 },
  elven: { H: [0.74, 0.88], riser: 0.22, limbW: 0.026 },
};

export const bow: ArchetypeDef = {
  id: 'bow',
  name: 'Bow',
  description: 'Bows: longbow, recurve, compound, energy and a pipe bow, with a nocked arrow.',
  parts: { bow: BOWS, arrow: ARROWS },
  optics: ['none'],

  weights(style, kind): Weights | undefined {
    const { rails, plumbing, glow } = style.traits;
    const scrap = !!style.traits.scrap, magic = !!style.traits.magic;
    if (kind === 'bow') {
      return { elven: t(magic, 3, 0.05), longbow: t(plumbing, 1.5, 0.3) + t(scrap, 0.4, 0) + t(magic, 1, 0), recurve: t(plumbing, 2, 0.5) + t(rails, 1, 0), compound: t(rails, 3, 0.2), energy: t(glow, 3, 0.1), pvc: t(scrap, 3, 0.02) };
    }
    if (kind === 'arrow') {
      return { field: t(rails, 1, 0.2), broadhead: t(rails, 1.5, 0.2), wooden: t(plumbing, 3, 0.3), energy: t(glow, 3, 0.05), scrap: t(scrap, 3, 0.02), crystal: t(magic, 3, 0.03) };
    }
    return undefined;
  },

  opticWeights: () => ({ none: 1 }),

  layout(chosen, p, rng): LongGunLayout {
    const size = SIZES[chosen.bow] ?? SIZES.recurve;
    const H = size.H[0] + (size.H[1] - size.H[0]) * (0.25 * rng.next() + 0.75 * p.length);
    const R = size.riser * (0.92 + p.bulk * 0.12);
    const arrowLen = 0.7 + p.length * 0.1;
    return {
      rec: { z0: -0.035, z1: 0.03, top: R, bottom: -R, width: 0.03 },
      magwell: { z0: 0, z1: 0, y: 0, flare: false },
      magLength: 0,
      trigger: { z: 0, y: -0.05 },
      grip: { z: 0, y: -0.01, angle: 0, length: 0.1 },
      handguard: { z0: 0, z1: 0.03, radius: 0.02 },
      barrel: { z0: 0, z1: arrowLen, radius: 0.004 },
      stock: { z0: 0, z1: 0, drop: 0 },
      mountY: R,
      opticZ: 0,
      extra: { riser: R, H, limbW: size.limbW * (0.9 + p.bulk * 0.2), arrowLen, tipZ: -0.15, nockZ: -0.15 },
    };
  },

  build(ctx: BuildContext, chosen) {
    const fn = BOWS[chosen.bow];
    if (!fn) throw new Error(`Unknown bow variant "${chosen.bow}". Available: ${Object.keys(BOWS).join(', ')}`);
    fn(ctx);
    bowString(ctx);
    const arrow = ARROWS[chosen.arrow];
    if (!arrow) throw new Error(`Unknown arrow variant "${chosen.arrow}". Available: ${Object.keys(ARROWS).join(', ')}`);
    arrow(ctx);
    const { L, b } = ctx;
    const nock = L.extra.nockZ;
    b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Riser', position: [0, -0.055, -0.006], forward: [0, 0, 1], description: 'Bow hand around the grip.' });
    b.socket({ name: 'SOCKET_Hand_Draw', parent: 'String', position: [0, 0, nock - 0.01], forward: [0, 0, -1], description: 'Draw hand on the string (pull toward -Z to draw).' });
    b.socket({ name: 'SOCKET_Nock', parent: 'String', position: [0, 0, nock], forward: [0, 0, 1], description: 'Nocking point: arrows clip onto the string here.' });
    b.socket({ name: 'SOCKET_ADS', parent: 'Riser', position: [0.03, 0.06, nock - L.extra.arrowLen * 0.75], forward: [0, 0, 1], description: 'Eye position at full draw (anchor point).' });
  },

  origin: (ctx) => ctx.b.sockets.find((s) => s.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0],
};
