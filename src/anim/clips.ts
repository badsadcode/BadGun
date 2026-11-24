/**
 * Animation clips, built from each component's motion metadata.
 *
 * A clip is a set of tracks. Each track drives one component's motion
 * parameter over time (meters for `translate`, radians for `rotate`, along
 * the component's own motion axis), with smooth easing between keys. A few
 * parts move in two ways at once (a bolt handle lifts, then slides back), so
 * a track can add an extra translation.
 *
 * Clips only use parts the weapon actually has, so every weapon gets the
 * clips that make sense for it:
 *
 *   Fire         trigger, hammer, cylinder, slide/toggle recoil; bows and
 *                crossbows release the string and launch the projectile
 *   Reload       magazine out and in, then charge (handle, slide, bolt or
 *                lever); break actions swing open; revolver cranes swing out; crossbows wind the crank
 *   Cycle        manual action: pump, lever, bolt, or racking the slide/handle
 *   Cock         pull the hammer back (and leave it cocked)
 *   Spin         spin a revolver's cylinder
 *   Draw         bows: pull the string back with the arrow
 *   BipodDeploy, StockFold, StockAdjust, CarryHandleFold   accessories
 *
 * Events (e.g. "shot", "magOut") mark moments a game can hook sounds or
 * effects to. Times are in seconds.
 */
import type { Vec3 } from '../core/geometry.js';
import type { Component, Weapon } from '../core/weapon.js';

export interface Key {
  t: number;
  v: number;
}

export interface Track {
  component: string;
  keys: Key[];
  /** Optional extra translation (component parent space) driven by its own keys. */
  extra?: { axis: Vec3; keys: Key[] };
}

export interface Clip {
  name: string;
  description: string;
  duration: number;
  tracks: Track[];
  events: Record<string, number>;
}

const k = (...pairs: [number, number][]): Key[] => pairs.map(([t, v]) => ({ t, v }));

/** 0 -> peak -> 0: a quick out-and-back. */
const pulse = (t0: number, t1: number, t2: number, peak: number): Key[] => k([t0, 0], [t1, peak], [t2, 0]);

function find(w: Weapon, name: string): Component | undefined {
  return w.components.find((c) => c.name === name && c.motion);
}
const max = (c: Component) => c.motion!.range[1];

function clip(name: string, description: string, tracks: (Track | null | undefined)[], events: Record<string, number> = {}, tail = 0.1): Clip | null {
  const real = tracks.filter((t): t is Track => !!t);
  if (!real.length) return null;
  const last = Math.max(...real.flatMap((t) => [...t.keys, ...(t.extra?.keys ?? [])].map((key) => key.t)), ...Object.values(events));
  return { name, description, duration: round(last + tail), tracks: real, events };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Track helper: keys scaled from 0..1 to the component's range. */
function track(c: Component | undefined, keys: Key[]): Track | null {
  return c ? { component: c.name, keys: keys.map(({ t, v }) => ({ t, v: v * max(c) })) } : null;
}

/** Bolt-action cycle: lift, pull back, push forward, turn down. */
function boltCycle(bolt: Component, t0: number): Track {
  const travel = 0.08;
  return {
    component: bolt.name,
    keys: k([t0, 0], [t0 + 0.12, max(bolt)], [t0 + 0.4, max(bolt)], [t0 + 0.52, 0]),
    extra: { axis: [0, 0, -1], keys: k([t0 + 0.12, 0], [t0 + 0.26, travel], [t0 + 0.4, 0]) },
  };
}

export function weaponClips(w: Weapon): Clip[] {
  const c = (n: string) => find(w, n);
  const trigger = c('Trigger'), hammer = c('Hammer'), cylinder = c('Cylinder'), slide = c('Slide'), toggle = c('Toggle');
  const mag = c('Magazine'), handle = c('ChargingHandle'), bolt = c('BoltHandle'), lever = c('Lever'), pump = w.components.find((x) => x.name === 'Handguard' && x.motion?.purpose === 'pump');
  const barrel = w.components.find((x) => x.name === 'Barrel' && x.motion?.purpose.startsWith('break open'));
  const crane = c('Crane');
  const string = c('String'), crank = c('Crank'), arrow = c('Arrow'), crossBolt = c('Bolt');
  const limbs = ['LimbTop', 'LimbBottom'].map(c).filter((x): x is Component => !!x);
  const clips: (Clip | null)[] = [];
  const archetype = w.recipe.archetype;

  if (archetype === 'bow' && string) {
    const draw = max(string);
    clips.push(
      clip('Draw', 'Nock and draw: the string comes back with the arrow and the limbs flex.', [
        { component: string.name, keys: k([0.1, 0], [0.9, draw]) },
        ...limbs.map((l) => track(l, k([0.1, 0], [0.9, 1]))),
        arrow ? { component: arrow.name, keys: k([0.1, 0], [0.9, -draw]) } : null,
      ], { drawStart: 0.1, fullDraw: 0.9 }, 0.2),
      clip('Fire', 'Release from full draw: the string snaps forward and the arrow flies (starts from the Draw end pose).', [
        { component: string.name, keys: k([0, draw], [0.05, 0]) },
        ...limbs.map((l) => track(l, k([0, 1], [0.05, 0]))),
        arrow ? { component: arrow.name, keys: k([0, -draw], [0.05, 0], [0.25, max(arrow)]) } : null,
      ], { release: 0 }, 0.05),
    );
    return clips.filter((x): x is Clip => !!x);
  }

  const rocket = c('Rocket');
  if (archetype === 'launcher') {
    // Front-loaded tubes take the new rocket at the muzzle, the rest at the breech.
    const at = (n: string) => w.sockets.find((s) => s.name === n)?.position[2] ?? 0;
    const front = Math.abs(at('SOCKET_Magazine') - at('SOCKET_Muzzle')) < 1e-6;
    const from = front ? 0.7 : -0.7;
    clips.push(
      clip('Fire', 'Pull the trigger: the rocket leaves the tube.', [
        track(trigger, pulse(0, 0.05, 0.2, 1)),
        rocket ? { component: rocket.name, keys: k([0.05, 0], [0.35, max(rocket)]) } : null,
      ], { shot: 0.05 }),
      clip('Reload', `Slide a new rocket in from the ${front ? 'muzzle' : 'rear'} (starts from the Fire end pose).`, [
        rocket ? { component: rocket.name, keys: k([0, max(rocket)], [0.3, max(rocket)], [0.301, from], [1.3, 0]) } : null,
      ], { loadStart: 0.3, rocketIn: 1.3 }, 0.15),
    );
  } else if (archetype === 'crossbow') {
    clips.push(
      clip('Fire', 'Pull the trigger: the string snaps forward and the bolt leaves the rail.', [
        track(trigger, pulse(0, 0.05, 0.2, 1)),
        string ? { component: string.name, keys: k([0.05, 0], [0.09, max(string)]) } : null,
        crossBolt ? { component: crossBolt.name, keys: k([0.05, 0], [0.25, max(crossBolt)]) } : null,
      ], { shot: 0.05 }),
      clip('Reload', 'Wind the string back and lay a new bolt on the rail (starts from the Fire end pose).', [
        crank ? { component: crank.name, keys: k([0.2, 0], [1.6, max(crank)]) } : null,
        string ? { component: string.name, keys: k([0.2, max(string)], [1.6, 0]) } : null,
        // The old bolt is long gone; the new one slides in from behind the latch.
        crossBolt ? { component: crossBolt.name, keys: k([0, max(crossBolt)], [1.65, max(crossBolt)], [1.651, -0.15], [1.95, 0]) } : null,
      ], { windStart: 0.2, cocked: 1.6, boltIn: 1.95 }, 0.15),
    );
  } else {
    // ---- Fire: trigger, then whatever the shot moves.
    const shot = 0.06;
    clips.push(
      clip('Fire', 'Pull the trigger and fire one shot.', [
        track(trigger, pulse(0, shot, 0.2, 1)),
        hammer ? track(hammer, k([0, 0], [shot - 0.01, 1], [shot, 0])) : null,
        track(cylinder, k([0, 0], [shot - 0.01, 1])),
        track(slide, pulse(shot, shot + 0.035, shot + 0.11, 1)),
        track(toggle, pulse(shot, shot + 0.04, shot + 0.12, 1)),
      ], { shot }, 0.12),
    );

    // ---- Reload.
    if (barrel) {
      clips.push(clip('Reload', 'Break open, swap shells, snap shut.', [track(barrel, k([0.1, 0], [0.4, 1], [1.2, 1], [1.4, 0]))], { open: 0.4, shellsIn: 0.9, close: 1.4 }, 0.15));
    } else if (mag) {
      const tracks: (Track | null)[] = [];
      const events: Record<string, number> = {};
      let t = 0.1;
      // Bolt actions open the bolt first, swap, then close it.
      let boltTrack: Track | null = null;
      if (bolt) {
        boltTrack = { component: bolt.name, keys: k([t, 0], [t + 0.12, max(bolt)]), extra: { axis: [0, 0, -1], keys: k([t + 0.12, 0], [t + 0.26, 0.08]) } };
        tracks.push(boltTrack);
        events.boltOpen = round(t + 0.26);
        t += 0.35;
      }
      tracks.push(track(mag, k([t, 0], [t + 0.35, 1], [t + 0.85, 1], [t + 1.2, 0])));
      events.magOut = round(t + 0.35);
      events.magIn = round(t + 1.2);
      t += 1.35;
      if (bolt && boltTrack) {
        boltTrack.keys.push(...k([t + 0.14, max(bolt)], [t + 0.26, 0]));
        boltTrack.extra!.keys.push(...k([t, 0.08], [t + 0.14, 0]));
        events.boltClosed = round(t + 0.26);
      } else if (lever) {
        tracks.push(track(lever, pulse(t, t + 0.2, t + 0.4, 1)));
        events.chambered = round(t + 0.4);
      } else if (handle) {
        tracks.push(track(handle, pulse(t, t + 0.14, t + 0.22, 1)));
        events.chambered = round(t + 0.22);
      } else if (slide) {
        tracks.push(track(slide, pulse(t, t + 0.14, t + 0.22, 1)));
        events.chambered = round(t + 0.22);
      } else if (pump) {
        tracks.push(track(pump, pulse(t, t + 0.15, t + 0.3, 1)));
        events.chambered = round(t + 0.3);
      }
      clips.push(clip('Reload', 'Swap the magazine, then chamber a round.', tracks, events, 0.15));
    } else if (crane) {
      // Swing-out revolvers: the crane (cylinder on it) swings out, reload, swing back.
      clips.push(clip('Reload', 'Swing the cylinder out, eject and reload, swing it back in.', [track(crane, k([0.1, 0], [0.35, 1], [1.2, 1], [1.4, 0]))], { open: 0.35, shellsIn: 0.9, close: 1.4 }, 0.15));
    }

    // ---- Cycle: the manual action, on its own.
    if (pump) clips.push(clip('Cycle', 'Rack the pump.', [track(pump, pulse(0.05, 0.2, 0.36, 1))], { back: 0.2, forward: 0.36 }));
    else if (lever) clips.push(clip('Cycle', 'Work the lever.', [track(lever, pulse(0.05, 0.25, 0.45, 1))], { down: 0.25, up: 0.45 }));
    else if (bolt) clips.push(clip('Cycle', 'Work the bolt: lift, back, forward, down.', [boltCycle(bolt, 0.05)], { open: 0.31, closed: 0.57 }));
    else if (handle) clips.push(clip('Cycle', 'Pull and release the charging handle.', [track(handle, pulse(0.05, 0.2, 0.28, 1))], { back: 0.2, release: 0.28 }));
    else if (slide) clips.push(clip('Cycle', 'Rack the slide.', [track(slide, pulse(0.05, 0.2, 0.28, 1))], { back: 0.2, release: 0.28 }));

    if (hammer) clips.push(clip('Cock', 'Thumb the hammer back (it stays cocked).', [track(hammer, k([0.05, 0], [0.3, 1]))], { cocked: 0.3 }));
    if (cylinder) clips.push(clip('Spin', 'Give the cylinder a flashy spin.', [track(cylinder, k([0.05, 0], [1.2, 12]))], {}, 0.1));
  }

  // ---- Accessories.
  const bipod = c('Bipod'), stock = w.components.find((x) => x.name === 'Stock' && x.motion), carry = c('CarryHandle');
  if (bipod) clips.push(clip('BipodDeploy', 'Swing the bipod legs out.', [track(bipod, k([0.05, 0], [0.5, 1]))], { deployed: 0.5 }));
  if (stock?.motion?.purpose === 'fold') clips.push(clip('StockFold', 'Fold the stock.', [track(stock, k([0.05, 0], [0.6, 1]))], { folded: 0.6 }));
  if (stock?.motion?.purpose.startsWith('adjust')) clips.push(clip('StockAdjust', 'Extend the stock.', [track(stock, k([0.05, 0], [0.35, 1]))], { extended: 0.35 }));
  if (carry) clips.push(clip('CarryHandleFold', 'Fold the carry handle down.', [track(carry, k([0.05, 0], [0.45, 1]))], { folded: 0.45 }));

  return clips.filter((x): x is Clip => !!x);
}

/** Smoothly eased value of a key list at time t (holds the ends). */
export function sampleKeys(keys: Key[], t: number): number {
  if (!keys.length) return 0;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      const e = u * u * (3 - 2 * u);
      return a.v + (b.v - a.v) * e;
    }
  }
  return keys[keys.length - 1].v;
}
