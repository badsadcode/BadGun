/**
 * FPS loadout metadata: suggested gameplay stats for every attachment.
 *
 * These numbers are *suggestions to tune*, not a balance pass. They give a
 * game a sensible starting point (a 4x scope aims slower than a red dot, a
 * drum holds more than a stick magazine and weighs you down) so a generated
 * weapon can drop straight into a customization screen. Multipliers are
 * relative to the bare weapon (1 = no change, < 1 = less/faster, > 1 =
 * more/slower); times are in seconds, reach in meters.
 *
 *   optic        { magnification, adsTime, sway }
 *   muzzle       { suppressed, recoil, flash }
 *   underbarrel  { recoil, adsTime } (+ launcher: { secondary: 'grenade', capacity: 1 })
 *   side         { light, laser, hipSpread }
 *   bayonet      { reach, damage, mobility }    damage on a 100 hp scale
 *   magazine     { capacity, reloadTime, mobility, reload }
 *
 * Unknown variants (new ones added later) fall back to per-type defaults,
 * guessed from the name where it helps; `attachmentStats` never throws.
 */
import type { Weapon } from './core/weapon.js';
import type { ArchetypeId } from './types.js';

export type LoadoutSlot = 'optic' | 'muzzle' | 'underbarrel' | 'side' | 'bayonet' | 'magazine';
export const LOADOUT_SLOTS: LoadoutSlot[] = ['optic', 'muzzle', 'underbarrel', 'side', 'bayonet', 'magazine'];
export type Stats = Record<string, number | boolean | string>;

const OPTICS: Record<string, [number, number, number]> = {
  // magnification, adsTime, sway
  none: [1, 1, 1], irons: [1, 1, 1], leaf: [1, 1, 1],
  reddot: [1, 1.04, 1], holo: [1.25, 1.07, 1], lamp: [1.5, 1.1, 1.05], smart: [2, 1.1, 0.95],
  rune: [2, 1.14, 1.1], tube: [2.5, 1.2, 1.15], brass: [3, 1.28, 1.25], scope: [4, 1.35, 1.3],
  minidot: [1, 1.02, 1], tubedot: [1, 1.05, 1], hud: [1, 1.02, 0.95], eye: [1.5, 1.1, 1.05], tincan: [1.25, 1.1, 1.1],
  offset: [3, 1.25, 1.15], prism: [2.5, 1.18, 1.1], magnifier: [3, 1.22, 1.12], periscope: [3, 1.3, 1.25],
  nightvision: [3, 1.3, 1.2], digital: [4, 1.3, 1.2], thermal: [4, 1.35, 1.25], longrange: [8, 1.6, 1.5],
};

const MUZZLES: Record<string, [boolean, number, number]> = {
  // suppressed, recoil, flash
  none: [false, 1, 1], crown: [false, 1, 1], flash: [false, 0.97, 0.35], prongs: [false, 0.96, 0.45],
  brake: [false, 0.85, 1.25], heavybrake: [false, 0.75, 1.4], compensator: [false, 0.88, 0.9], bell: [false, 1.05, 1.5],
  suppressor: [true, 0.9, 0.1], can: [true, 0.95, 0.3], bottle: [true, 0.97, 0.4], emitter: [false, 0.95, 1.1],
  crystal: [false, 0.95, 1.2], maw: [false, 1.05, 1.6], exhaust: [false, 0.9, 1.3], smart: [false, 0.9, 0.7],
  birdcage: [false, 0.97, 0.35], flashcone: [false, 0.98, 0.4], tribrake: [false, 0.82, 1.3], boxbrake: [false, 0.75, 1.4],
  vented: [false, 0.88, 0.8], dragon: [false, 1, 1.5], flute: [false, 1.02, 1.4],
  shroud: [true, 0.9, 0.1], baffle: [true, 0.9, 0.12], oilcan: [true, 0.94, 0.3],
};

const UNDERBARREL: Record<string, [number, number]> = {
  // recoil, adsTime
  none: [1, 1], vgrip: [0.9, 1.05], angled: [0.95, 0.94], stubby: [0.93, 1], launcher: [1, 1.15],
  bipodgrip: [0.9, 1.08], barricade: [0.95, 0.97], skeleton: [0.92, 1.02], wrapped: [0.95, 1.06], shotgun: [1, 1.15],
};

const SIDE: Record<string, [boolean, boolean]> = {
  // light, laser
  none: [false, false], flashlight: [true, false], laser: [false, true], combo: [true, true],
  lantern: [true, false], crystal: [true, false], taped: [true, false],
  strobe: [true, false], rangefinder: [false, true], ir: [true, false], uvlamp: [true, false], headlamp: [true, false], torch: [true, false],
};

const BAYONETS: Record<string, [number, number, number]> = {
  // reach (m), damage, mobility
  none: [0, 0, 1], knife: [0.2, 70, 0.99], spike: [0.24, 75, 0.98], sword: [0.45, 90, 0.94], blade: [0.24, 75, 0.98],
  energy: [0.26, 100, 0.98], rune: [0.27, 85, 0.97], kitchen: [0.2, 55, 0.99], saw: [0.2, 80, 0.97], cleaver: [0.18, 85, 0.96],
};

/** Magazines: capacity on a rifle, reload time, mobility, how it's loaded. */
const MAGS: Record<string, [number, number, number, string]> = {
  none: [1, 2.4, 1, 'single'], internal: [5, 2.8, 1, 'clip'], tube: [7, 0.45, 1, 'single'],
  straight: [20, 2, 1, 'magazine'], curved: [30, 2.2, 1, 'magazine'], stick: [32, 2.2, 0.98, 'magazine'], twin: [30, 1.6, 0.96, 'magazine'],
  smartmag: [30, 1.9, 1, 'magazine'], cell: [30, 1.8, 1, 'cell'], crystal: [25, 1.8, 1, 'cell'], orb: [40, 2.4, 0.95, 'cell'],
  canister: [40, 2.6, 0.95, 'magazine'], can: [40, 3, 0.9, 'magazine'], top: [30, 2.4, 0.97, 'magazine'], pan: [47, 3, 0.92, 'magazine'],
  drum: [75, 3.2, 0.88, 'magazine'], jerrycan: [100, 4, 0.85, 'magazine'], ammobox: [150, 5.5, 0.8, 'belt'],
  extended: [40, 2.4, 0.95, 'magazine'], casket: [50, 2.6, 0.93, 'magazine'], coupled: [30, 1.5, 0.94, 'magazine'],
  windowed: [30, 2.1, 1, 'magazine'], pullloop: [30, 1.9, 1, 'magazine'], helical: [64, 3, 0.92, 'magazine'],
  banana: [40, 2.5, 0.95, 'magazine'], ribbed: [30, 2.2, 0.98, 'magazine'],
};
/** Capacities that don't scale with the host (clips, tubes, belts handled per host below). */
const FIXED_CAPACITY = ['none', 'internal', 'tube'];
/** Box-magazine capacity per host, relative to a rifle. */
const HOST_SCALE: Partial<Record<ArchetypeId, number>> = { rifle: 1, smg: 1.15, lmg: 1, sniper: 0.3, shotgun: 0.27 };

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Suggested gameplay stats for one attachment. `host` is the weapon type it
 * goes on (magazine capacity depends on it); `config` the long-gun layout
 * (a machine pistol's grip magazine is shorter). Never throws.
 */
export function attachmentStats(type: string, variant: string, opts: { host?: ArchetypeId; config?: string } = {}): Stats {
  const v = String(variant ?? 'none').toLowerCase();
  const has = (...words: string[]) => words.some((w) => v.includes(w));
  switch (type) {
    case 'optic': {
      const [magnification, adsTime, sway] = OPTICS[v] ?? (has('scope', 'sniper', 'telescope') ? [4, 1.35, 1.3] : has('dot', 'holo', 'reflex', 'iron') ? [1, 1.05, 1] : [1.5, 1.1, 1.05]);
      return { magnification, adsTime, sway };
    }
    case 'muzzle': {
      const [suppressed, recoil, flash] = MUZZLES[v] ?? (has('supp', 'silenc', 'can', 'baffle') ? [true, 0.92, 0.15] : has('brake', 'comp') ? [false, 0.85, 1.2] : has('flash', 'hider') ? [false, 0.97, 0.4] : [false, 0.95, 0.9]);
      return { suppressed, recoil, flash };
    }
    case 'underbarrel':
    case 'side': {
      // Pistols carry lights on their "underbarrel" slot: read those as side attachments.
      if (type === 'side' || (!(v in UNDERBARREL) && v in SIDE)) {
        const [light, laser] = SIDE[v] ?? [!has('laser') || has('combo', 'light'), has('laser', 'combo')];
        return { light, laser, hipSpread: laser ? 0.85 : 1 };
      }
      if (v === 'launcher' || has('launcher', 'grenade', 'shotgun', 'masterkey')) {
        const [recoil, adsTime] = UNDERBARREL[v] ?? [1, 1.15];
        return { recoil, adsTime, secondary: has('shotgun', 'masterkey') ? 'shotgun' : 'grenade', capacity: has('shotgun', 'masterkey') ? 4 : 1 };
      }
      const [recoil, adsTime] = UNDERBARREL[v] ?? [0.95, 1.03];
      return { recoil, adsTime };
    }
    case 'bayonet': {
      const [reach, damage, mobility] = BAYONETS[v] ?? [0.22, 70, 0.98];
      return { reach, damage, mobility };
    }
    case 'magazine': {
      const host = opts.host ?? 'rifle';
      const [base, reloadTime, mobility, reload] = MAGS[v] ?? (has('drum', 'pan', 'helical') ? [60, 3, 0.9, 'magazine'] : has('box', 'belt') ? [100, 5, 0.82, 'belt'] : [30, 2.2, 0.98, 'magazine']);
      let capacity = base;
      if (v === 'tube') capacity = host === 'shotgun' ? 7 : 8;
      else if (v === 'none') capacity = 1;
      else if (!FIXED_CAPACITY.includes(v)) {
        if (host === 'lmg' && ['drum', 'ammobox', 'jerrycan'].includes(v)) capacity = v === 'drum' ? 100 : 200;
        else capacity = Math.max(5, Math.round(base * (HOST_SCALE[host] ?? 1)));
        if (opts.config === 'machinepistol') capacity = Math.min(capacity, v === 'extended' ? 33 : 20);
      }
      return { capacity, reloadTime: r2(reloadTime), mobility, reload };
    }
    default:
      return {};
  }
}

/** Rounds before a reload, for a whole weapon. */
export function weaponCapacity(w: Weapon): number {
  const P = w.parts, a = w.recipe.archetype;
  if (a === 'revolver') {
    const cyl = w.components.find((c) => c.name === 'Cylinder' && c.motion);
    const step = cyl ? Math.abs(cyl.motion!.range[1]) : 0;
    return step > 0 ? Math.round((Math.PI * 2) / step) : 6;
  }
  if (a === 'pistol') return PISTOL_CAPACITY[P.frame] ?? 15;
  if (a === 'crossbow') return P.tiller === 'repeater' ? 10 : 1;
  if (a === 'bow') return 1;
  if (a === 'launcher') return P.tube === 'multi' ? 4 : 1;
  if (P.magazine === 'none' || P.magazine === undefined) return P.barrel === 'double' || P.barrel === 'overunder' ? 2 : 1;
  return attachmentStats('magazine', P.magazine, { host: a, config: P.config }).capacity as number;
}

const PISTOL_CAPACITY: Record<string, number> = {
  revolver: 6, flintlock: 1, flare: 1, cannon: 1, derringer: 2, taser: 1, wand: 12, holdout: 6, compact: 10, magnum: 7,
  machine: 30, needler: 30, nailgun: 50, broomhandle: 10, toggle: 8, polymer: 17, service: 15, longslide: 15, gyro: 6, coil: 12,
};

export interface LoadoutEntry {
  slot: LoadoutSlot;
  variant: string;
  /** The weapon socket this attachment sits on (null if the weapon has none). */
  socket: string | null;
  /** Part of the gun itself (iron sights, internal magazine...), not swappable. */
  fixed: boolean;
  stats: Stats;
}

export interface Loadout {
  /** Rounds before a reload (magazine, cylinder, tube, or 1 for bows and launchers). */
  capacity: number;
  slots: LoadoutEntry[];
  note: string;
}

const SOCKETS: Record<LoadoutSlot, string> = {
  optic: 'SOCKET_Optic', muzzle: 'SOCKET_Barrel_End', underbarrel: 'SOCKET_Underbarrel', side: 'SOCKET_Side', bayonet: 'SOCKET_Bayonet', magazine: 'SOCKET_Magazine',
};
const FIXED: Record<string, string[]> = { optic: ['none', 'irons', 'leaf'], magazine: ['none', 'internal', 'tube'] };

/** The socket a standalone attachment of this type/variant snaps onto. */
export function mountSocket(type: string, variant: string): string {
  if (type === 'magazine' && (variant === 'pan' || variant === 'top')) return 'SOCKET_Magazine_Top';
  return SOCKETS[type as LoadoutSlot] ?? 'SOCKET_Mount';
}

/** Every attachment slot a weapon has, what's in it and its suggested stats. */
export function weaponLoadout(w: Weapon): Loadout {
  const slots: LoadoutEntry[] = [];
  const sockets = new Set(w.sockets.map((s) => s.name));
  for (const slot of LOADOUT_SLOTS) {
    const variant = w.parts[slot === 'optic' ? 'sight' : slot];
    if (variant === undefined) continue;
    let socket: string | null = mountSocket(slot, variant);
    if (!sockets.has(socket)) socket = slot === 'muzzle' && sockets.has('SOCKET_Muzzle') ? 'SOCKET_Muzzle' : null;
    slots.push({
      slot,
      variant,
      socket,
      fixed: (FIXED[slot] ?? []).includes(variant) || (slot === 'muzzle' && variant === 'none'),
      stats: attachmentStats(slot, variant, { host: w.recipe.archetype, config: w.parts.config }),
    });
  }
  return { capacity: weaponCapacity(w), slots, note: 'Suggested gameplay stats, a starting point to tune. Multipliers are relative to the bare weapon (1 = unchanged); times in seconds, reach in meters, damage on a 100 hp scale.' };
}
