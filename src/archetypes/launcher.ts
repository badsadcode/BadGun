/**
 * Launchers: shoulder-fired rocket launchers. A tube (the root), pistol grips
 * hanging below it, a shoulder rest, the rocket and a side-mounted sight.
 *
 * The tube is carried on the shoulder: SOCKET_Shoulder is the top of the
 * shoulder (under the tube), and the hands hold the grips below the tube.
 * Preferences come from style traits, like pistols and crossbows.
 */
import type { Vec3 } from '../core/geometry.js';
import type { BuildContext, LongGunLayout } from '../parts/context.js';
import type { ArchetypeDef, Weights } from './archetype.js';
import { LAUNCHER_GRIPS, LAUNCHER_OPTIC_NAMES, LAUNCHER_ROCKETS, LAUNCHER_SHOULDERS, LAUNCHER_TUBES, launcherOptic } from '../parts/launcher.js';

const t = (on: unknown, yes: number, no: number) => (on ? yes : no);

/** Per-tube proportions: length and radius multipliers. */
const PRESETS: Record<string, { lenK: number; rK: number }> = {
  bazooka: { lenK: 1.12, rK: 0.82 },
  rpg: { lenK: 0.86, rK: 0.85 },
  disposable: { lenK: 0.86, rK: 0.86 },
  recoilless: { lenK: 1.08, rK: 1.12 },
  multi: { lenK: 0.82, rK: 1 },
  energy: { lenK: 0.95, rK: 1.05 },
  pipe: { lenK: 0.95, rK: 0.95 },
  brass: { lenK: 0.95, rK: 0.95 },
  arcane: { lenK: 0.9, rK: 1 },
  deco: { lenK: 1, rK: 1 },
  smart: { lenK: 0.95, rK: 1 },
  harpoon: { lenK: 0.72, rK: 0.55 },
  megacannon: { lenK: 1.1, rK: 1.7 },
};

/** Rockets that only make sense with their own tube. */
const SPECIAL_ROCKETS: Record<string, string> = { multi: 'slim', energy: 'plasma', megacannon: 'orb', harpoon: 'spear', arcane: 'crystal' };

export const launcher: ArchetypeDef = {
  id: 'launcher',
  name: 'Launcher',
  description: 'Shoulder-fired rocket launchers: bazookas, recoilless tubes, rocket pods, harpoons and energy cannons.',
  parts: { tube: LAUNCHER_TUBES, grip: LAUNCHER_GRIPS, shoulder: LAUNCHER_SHOULDERS, rocket: LAUNCHER_ROCKETS },
  optics: ['none', ...LAUNCHER_OPTIC_NAMES],

  weights(style, kind): Weights | undefined {
    const { rails, plumbing, glow } = style.traits;
    const { era, scrap, magic, diesel, cyber } = style.traits;
    const modern = rails && !cyber;
    if (kind === 'tube') {
      if (era) {
        if (era < 1930) return { brass: 1, recoilless: 1.2, bazooka: 0.3, pipe: 0.1 };
        if (era < 1955) return { bazooka: 2.5, rpg: 1.2, recoilless: 0.8, deco: 0.15 };
        return { disposable: 2, rpg: 1.6, recoilless: 1.2, bazooka: 0.3 };
      }
      return {
        disposable: t(modern, 3, 0.02),
        recoilless: t(modern, 2, 0.05),
        multi: t(modern, 2, 0) + t(cyber, 2, 0),
        rpg: 0.05 + t(scrap, 1.5, 0) + t(modern, 0.5, 0) + t(diesel, 0.3, 0),
        bazooka: t(diesel, 2, 0.2),
        energy: t(glow && !cyber, 3, 0),
        pipe: t(scrap, 4, 0.02),
        brass: t(plumbing, 4, 0.02),
        arcane: t(magic, 4, 0),
        deco: t(diesel, 4, 0),
        smart: t(cyber, 4, 0),
        harpoon: t(scrap, 1, 0) + t(plumbing, 1, 0) + t(diesel, 0.8, 0) + t(modern, 0.5, 0),
        megacannon: t(glow, 1.2, 0) + t(magic, 0.8, 0),
      };
    }
    if (kind === 'rocket') {
      return {
        heat: 1.5 + t(era, 1, 0),
        slim: t(rails, 2, 0.4),
        bulb: t(diesel, 2, 0.3) + t(era && era < 1955, 1, 0),
        plasma: t(glow, 3, 0),
        firework: t(scrap || plumbing, 2, 0),
        crystal: t(magic, 2, 0),
      };
    }
    if (kind === 'grip') {
      return {
        pistol: t(rails, 3, 0.4) + t(era && era > 1955, 1.5, 0) + t(scrap, 1, 0),
        wood: t(plumbing, 3, 0) + t(magic, 3, 0) + t(era && era < 1955, 3, 0) + t(diesel, 1.5, 0) + t(scrap, 1, 0) + 0.1,
        skeletal: t(glow, 3, 0.1),
      };
    }
    if (kind === 'shoulder') return { pad: 2, wire: t((era && era < 1955) || diesel || scrap, 2, 0.3), none: t(glow, 1.2, 0.4) + t(magic, 1, 0) };
    return undefined;
  },

  opticWeights(style): Weights {
    const { rails, plumbing, glow, era, scrap, magic, diesel, cyber } = style.traits;
    return {
      none: 0.4,
      frame: t(era || scrap || diesel, 2, 0.6),
      reddot: t(rails, 1.5, 0.1),
      scope: t(rails, 0.6, 0.1) + t(era && era > 1955, 0.5, 0),
      holo: t(glow, 1, 0),
      brass: t(plumbing, 2, 0),
      tube: t(scrap, 0.8, 0),
      rune: t(magic, 2, 0),
      lamp: t(diesel, 1, 0),
      smart: t(cyber, 1.5, 0),
      prism: t(rails && !cyber, 0.8, 0),
      thermal: t(cyber, 0.6, 0) + t(rails && !cyber, 0.3, 0),
    };
  },

  layout(chosen, p, rng): LongGunLayout {
    const tube = chosen.tube;
    const pr = PRESETS[tube] ?? { lenK: 1, rK: 1 };
    const R = (0.042 + p.bulk * 0.024) * pr.rK * rng.range(0.94, 1.06);
    const len = (0.92 + p.length * 0.42) * pr.lenK * rng.range(0.95, 1.05);
    const gz = 0;
    const shZ = gz - 0.19 - rng.range(0, 0.03);
    const zr = shZ - len * rng.range(0.27, 0.31);
    const zf = zr + len;
    const fgZ = gz + 0.22 + p.length * 0.05 + rng.range(-0.01, 0.02);
    let sideX = R, under = -R, round = 1, cols = 0, rows = 0, pitch = 0, rc = 0;
    if (tube === 'multi') {
      cols = rng.chance(0.5) ? 3 : 2;
      rows = 2;
      rc = R * 0.56;
      pitch = rc * 2 + 0.008;
      sideX = (cols * pitch + 0.016) / 2;
      under = -(rows * pitch + 0.016) / 2;
      round = 0;
    } else if (tube === 'smart') {
      sideX = R * 1.08;
      under = -R * 1.02;
      round = 0;
    } else if (tube === 'megacannon') {
      sideX = R * 1.06;
    }
    const yTop = under - 0.022;
    const gripAngle = 0.22 + rng.range(-0.05, 0.06), gripLen = 0.1 + p.bulk * 0.012, gripDepth = 0.042;
    return {
      rec: { z0: zr, z1: zf, top: -under, bottom: under, width: round ? 2 * R : 2 * sideX },
      magwell: { z0: gz, z1: gz, y: under, flare: false },
      magLength: 0,
      trigger: { z: gz + 0.024, y: yTop },
      grip: { z: gz, y: yTop, angle: gripAngle, length: gripLen },
      handguard: { z0: fgZ - 0.04, z1: fgZ + 0.04, radius: R },
      barrel: { z0: zr, z1: zf, radius: R },
      stock: { z0: shZ, z1: shZ, drop: 0 },
      mountY: 0.014,
      opticZ: gz + 0.02,
      extra: { R, len, zr, zf, gz, fgZ, shZ, under, sideX, round, cols, rows, pitch, rc, yTop, gripAngle, gripLen, gripDepth },
    };
  },

  build(ctx: BuildContext, chosen) {
    for (const kind of ['tube', 'grip', 'shoulder', 'rocket']) {
      const fn = launcher.parts[kind][chosen[kind]];
      if (!fn) throw new Error(`Unknown ${kind} variant "${chosen[kind]}". Available: ${Object.keys(launcher.parts[kind]).join(', ')}`);
      fn(ctx);
    }
    launcherOptic(ctx, chosen.sight);

    const { L, b } = ctx;
    const E = L.extra;
    const a = E.gripAngle;
    const hand: Vec3 = [0, E.yTop - 0.035 * Math.cos(a), E.gz - E.gripDepth * 0.45 - 0.035 * Math.sin(a)];
    b.socket({ name: 'SOCKET_Hand_Grip', parent: 'Grip', position: hand, forward: [0, 0, 1], description: 'Trigger hand on the rear pistol grip.' });
    b.socket({ name: 'SOCKET_Hand_Support', parent: 'FrontGrip', position: [0, E.under - 0.06, E.fgZ], forward: [0, 0, 1], description: 'Support hand on the front grip.' });
    b.socket({ name: 'SOCKET_Muzzle', parent: 'Tube', position: [0, 0, E.zf], forward: [0, 0, 1], description: 'Front of the tube: where the rocket leaves (launch flash VFX).' });
    b.socket({ name: 'SOCKET_Backblast', parent: 'Tube', position: [0, 0, E.zr], forward: [0, 0, -1], description: 'Rear of the tube: where exhaust and backblast VFX go (keep this area clear).' });
    b.socket({ name: 'SOCKET_Shoulder', parent: 'Tube', position: [0, E.shoulderY ?? E.under, E.shZ], forward: [0, 0, 1], description: 'Top of the shoulder: the tube rests here, above the hands.' });
    b.socket({
      name: 'SOCKET_Magazine', parent: 'Tube', position: [0, 0, E.loadFront ? E.zf : E.zr], forward: [0, 0, E.loadFront ? 1 : -1],
      description: E.loadFront ? 'Loading point: rockets go in at the muzzle.' : 'Loading point: rockets go in at the rear (breech).',
    });
  },

  fixup: (chosen, forced) => {
    if (!forced.has('rocket')) {
      const special = SPECIAL_ROCKETS[chosen.tube];
      if (special) chosen.rocket = special;
      else if (chosen.tube === 'rpg' && !['heat', 'bulb'].includes(chosen.rocket)) chosen.rocket = 'heat';
      else if (Object.values(SPECIAL_ROCKETS).includes(chosen.rocket)) chosen.rocket = 'heat';
    }
    if (!forced.has('sight') && chosen.tube === 'disposable') chosen.sight = 'frame';
    if (!forced.has('shoulder') && chosen.tube === 'bazooka') chosen.shoulder = 'wire';
    if (!forced.has('grip') && ['energy', 'megacannon', 'smart'].includes(chosen.tube) && chosen.grip === 'wood') chosen.grip = 'skeletal';
  },

  origin: (ctx) => ctx.b.sockets.find((s) => s.name === 'SOCKET_Hand_Grip')?.position ?? [0, 0, 0],
};
