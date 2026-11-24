/**
 * Attachments: things you clip onto a weapon, as opposed to parts it's made of.
 *
 *   underbarrel  vertical grip, angled grip, handstop, grenade launcher
 *                (more in attach2.ts: bipod grip, thumb-shelf stop,
 *                underbarrel shotgun, skeleton grip, taped stick)
 *   side         flashlight, laser, light/laser combo, and world flavors:
 *                brass lantern (steampunk), glowing crystal (fantasy),
 *                taped flashlight (survivor) (more in attach2.ts: strobe,
 *                rangefinder, IR illuminator, UV bar, headlamp, brazier)
 *
 * (Optics and muzzle devices are attachments too; they live in sight.ts and
 * front.ts and are reused as-is.)
 *
 * Every attachment is built in its own *mount frame*: the mounting point at
 * the origin, the body hanging down (-Y), the front toward +Z. `Mount`
 * places that frame on the weapon: under the handguard as is, on the right
 * side rail rotated a quarter turn, or at the origin for a standalone asset.
 * Each attachment is its own component, so games can hide or swap it.
 */
import { Geometry, Vec2, Vec3, box, cylinder, dome, extrudeSide, lathe, rod } from '../core/geometry.js';
import type { PartBuilder } from '../archetypes/archetype.js';
import type { Component } from '../core/weapon.js';
import type { StyleProfile } from '../styles/style.js';
import type { MaterialSlot } from '../types.js';
import { BuildContext } from './context.js';
import { SIDE_BUILDERS_2, UNDERBARREL_BUILDERS_2 } from './attach2.js';

/** Where an attachment's mount frame sits: position, Euler rotation, parent component. */
export interface Mount {
  at: Vec3;
  r?: Vec3;
  parent: string | null;
}

/** Points of interest an attachment reports back (mount frame, before placement). */
export interface Built {
  /** Support hand position (grips). */
  hand?: Vec3;
  /** Extra sockets: name -> [position, forward, description]. */
  sockets?: [string, Vec3, Vec3, string][];
}

export type AttachmentBuilder = (ctx: BuildContext, add: (slot: MaterialSlot, geo: Geometry) => void) => Built;

/** Rotate a point by Euler XYZ (same convention as Geometry.transform). */
function rotate(p: Vec3, r: Vec3 = [0, 0, 0]): Vec3 {
  const [rx, ry, rz] = r;
  let [x, y, z] = p;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x, y, z];
}
const place = (m: Mount, p: Vec3): Vec3 => {
  const q = rotate(p, m.r);
  return [q[0] + m.at[0], q[1] + m.at[1], q[2] + m.at[2]];
};

/** A small rail clamp every attachment sits on. */
export function clamp(ctx: BuildContext, add: (s: MaterialSlot, g: Geometry) => void, len: number, w = 0.02): void {
  add('Detail', box([0, -0.0045, 0], [w, 0.009, len], ctx.bevel(0.0015)));
  for (const z of [-len * 0.3, len * 0.3]) add('Trim', cylinder(0.0022, -w / 2 - 0.0015, -w / 2 + 0.001, 8).transform({ t: [0, -0.005, z], r: [0, Math.PI / 2, 0] }));
}

/** Round light head along Z with glass and a glowing reflector. Returns the lens center. */
export function lightHead(ctx: BuildContext, add: (s: MaterialSlot, g: Geometry) => void, y: number, R: number, z0: number, z1: number, body: MaterialSlot): Vec3 {
  const seg = ctx.seg(0.9);
  add(body, lathe([[0, z0], [R * 0.85, z0], [R, z0 + 0.004], [R, z1 - 0.022], [R * 1.3, z1 - 0.01], [R * 1.3, z1], [R * 1.1, z1]], seg).transform({ t: [0, y, 0] }));
  add('Emissive', cylinder(R * 1.05, z1 - 0.004, z1 - 0.002, seg).transform({ t: [0, y, 0] }));
  add('Glass', cylinder(R * 1.12, z1 - 0.0015, z1 - 0.0005, seg).transform({ t: [0, y, 0] }));
  for (let i = 0; i < 3; i++) {
    const z = z0 + 0.012 + i * 0.008;
    add('Trim', lathe([[R, z - 0.002], [R + 0.0007, z - 0.0015], [R + 0.0007, z + 0.0015], [R, z + 0.002]], seg).transform({ t: [0, y, 0] }));
  }
  add('Accent', dome(R * 0.45, 0.003, Math.max(6, seg / 2), 2).transform({ r: [0, Math.PI, 0], t: [0, y, z0] }));
  return [0, y, z1];
}

// ---------------------------------------------------------------------------
// Side-rail (and pistol) attachments: lights and lasers.
// ---------------------------------------------------------------------------

const flashlight: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:flashlight-look');
  const head = g.pick(['smooth', 'crenel', 'square'] as const);
  const grip = g.pick(['rings', 'knurl', 'sleeve'] as const);
  const tail = g.pick(['dome', 'paddle', 'pad'] as const);
  const R = 0.0105 + ctx.p.bulk * 0.003;
  const y = -(0.012 + R), z0 = -0.05, z1 = 0.04;
  const seg = ctx.seg(0.9);
  const at = (geo: Geometry) => geo.transform({ t: [0, y, 0] });
  clamp(ctx, add, 0.028);
  add('Detail', box([0, -0.011, -0.004], [0.012, 0.006, 0.02]));
  let lens: Vec3;
  if (head === 'square') {
    // Boxy head over a round body.
    add('Sight', at(lathe([[0, z0], [R * 0.85, z0], [R, z0 + 0.004], [R, z1 - 0.024], [R * 0.9, z1 - 0.022]], seg)));
    const H = R * 2.5;
    add('Sight', box([0, y, z1 - 0.012], [H, H, 0.024], ctx.bevel(0.003)));
    add('Emissive', box([0, y, z1 + 0.0002], [H * 0.78, H * 0.78, 0.0008]));
    add('Glass', box([0, y, z1 + 0.0009], [H * 0.84, H * 0.84, 0.0006]));
    lens = [0, y, z1 + 0.0012];
  } else {
    add('Sight', at(lathe([[0, z0], [R * 0.85, z0], [R, z0 + 0.004], [R, z1 - 0.022], [R * 1.3, z1 - 0.01], [R * 1.3, z1], [R * 1.1, z1]], seg)));
    add('Emissive', at(cylinder(R * 1.05, z1 - 0.004, z1 - 0.002, seg)));
    add('Glass', at(cylinder(R * 1.12, z1 - 0.0015, z1 - 0.0005, seg)));
    lens = [0, y, z1];
    if (head === 'crenel') {
      // Strike bezel: teeth around the rim.
      const n = 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        add('Trim', box([0, 0, 0], [R * 0.4, R * 0.22, 0.005], ctx.bevel(0.0006)).transform({ r: [0, 0, ang - Math.PI / 2], t: [Math.cos(ang) * R * 1.19, y + Math.sin(ang) * R * 1.19, z1 + 0.0022] }));
      }
    }
  }
  const band = (z: number, h: number, slot: MaterialSlot = 'Trim') => add(slot, at(lathe([[R, z - h], [R + 0.0007, z - h * 0.75], [R + 0.0007, z + h * 0.75], [R, z + h]], seg)));
  if (grip === 'rings') for (let i = 0; i < 3; i++) band(z0 + 0.012 + i * 0.008, 0.002);
  else if (grip === 'knurl') for (let i = 0; i < 9; i++) band(z0 + 0.01 + i * 0.0045, 0.0012, 'Detail');
  else add('Grip', at(lathe([[R, z0 + 0.008], [R + 0.0012, z0 + 0.01], [R + 0.0012, z0 + 0.04], [R, z0 + 0.042]], seg)));
  if (tail === 'dome') add('Accent', dome(R * 0.45, 0.003, Math.max(6, seg / 2), 2).transform({ r: [0, Math.PI, 0], t: [0, y, z0] }));
  else if (tail === 'paddle') {
    // Paddle switch reaching back toward the shooter's thumb.
    add('Accent', at(cylinder(R * 0.75, z0 - 0.004, z0, seg)));
    add('Accent', box([0, y + R * 0.7, z0 - 0.009], [0.008, 0.003, 0.016], ctx.bevel(0.0008)));
  } else {
    // Remote pressure pad on a cable.
    add('Accent', at(cylinder(R * 0.7, z0 - 0.005, z0, seg)));
    add('Detail', rod([0, y, z0 - 0.004], [0, y + R * 0.3, z0 - 0.016], 0.0016, 6));
    add('Detail', rod([0, y + R * 0.3, z0 - 0.016], [0, -0.008, z0 - 0.024], 0.0016, 6));
    add('Accent', box([0, -0.006, z0 - 0.034], [0.014, 0.008, 0.024], ctx.bevel(0.002)));
  }
  return { sockets: [['SOCKET_Light', lens, [0, 0, 1], 'Flashlight lens: spotlight origin.']] };
};

const laser: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:laser-look');
  const shape = g.pick(['classic', 'long', 'tall', 'flat'] as const);
  const [w, h, l] = { classic: [0.022, 0.02, 0.058], long: [0.018, 0.016, 0.08], tall: [0.02, 0.03, 0.05], flat: [0.032, 0.013, 0.06] }[shape];
  const layout = g.pick(['single', 'twin', 'turret'] as const);
  clamp(ctx, add, 0.03);
  const y = -0.009 - h / 2, zf = 0.004 + l / 2;
  add('Sight', box([0, y, 0.004], [w, h, l], ctx.bevel(0.003)));
  // Windage and elevation adjusters.
  add('Trim', box([w / 2 + 0.0005, y + h * 0.15, -0.012], [0.0015, Math.min(0.006, h * 0.3), 0.006]));
  add('Trim', cylinder(0.0028, 0, 0.004, 8).transform({ r: [-Math.PI / 2, 0, 0], t: [0, y - h / 2 - 0.003, -0.004] }));
  add('Accent', box([0, y + h / 2 + 0.0005, -l / 2 + 0.012], [Math.min(0.008, w * 0.4), 0.002, 0.01]));
  const aperture = (x: number, yy: number, r: number, slot: MaterialSlot = 'Emissive'): Vec3 => {
    add('Glass', cylinder(r * 2, zf - 0.003, zf - 0.0005, 10).transform({ t: [x, yy, 0] }));
    add(slot, cylinder(r, zf - 0.0005, zf + 0.0005, 8).transform({ t: [x, yy, 0] }));
    return [x, yy, zf];
  };
  let ap: Vec3;
  const extra: [string, Vec3, Vec3, string][] = [];
  if (layout === 'single') ap = aperture(w * 0.18, y, 0.0022);
  else if (layout === 'twin') {
    // Visible laser on top, IR laser under it.
    ap = aperture(0, y + h * 0.22, 0.0019);
    const ir = aperture(0, y - h * 0.22, 0.0019, 'Detail');
    extra.push(['SOCKET_Laser_IR', ir, [0, 0, 1], 'Infrared laser aperture: night-vision beam origin.']);
  } else {
    // A round lens turret standing out of the front.
    const r = Math.min(w, h) * 0.36;
    add('Trim', cylinder(r, zf - 0.002, zf + 0.008, ctx.seg(0.6), ctx.bevel(0.0008)).transform({ t: [0, y, 0] }));
    add('Glass', cylinder(r * 0.7, zf + 0.008, zf + 0.0088, ctx.seg(0.6)).transform({ t: [0, y, 0] }));
    add('Emissive', cylinder(r * 0.25, zf + 0.0088, zf + 0.0094, 8).transform({ t: [0, y, 0] }));
    ap = [0, y, zf + 0.0094];
  }
  return { sockets: [['SOCKET_Laser', ap, [0, 0, 1], 'Laser aperture: beam origin.'], ...extra] };
};

const combo: AttachmentBuilder = (ctx, add) => {
  clamp(ctx, add, 0.034, 0.022);
  const h = 0.026, y = -0.009 - h / 2;
  add('Sight', box([0, y, 0], [0.03, h, 0.07], ctx.bevel(0.003)));
  add('Accent', box([0.0155, y + 0.004, -0.02], [0.0015, 0.006, 0.012]));
  const light: Vec3 = [-0.004, y, 0.035];
  add('Trim', cylinder(0.0115, 0.033, 0.037, ctx.seg(0.9)).transform({ t: [light[0], light[1], 0] }));
  add('Emissive', cylinder(0.0095, 0.035, 0.037, ctx.seg(0.9)).transform({ t: [light[0], light[1], 0] }));
  add('Glass', cylinder(0.01, 0.037, 0.038, ctx.seg(0.9)).transform({ t: [light[0], light[1], 0] }));
  const ap: Vec3 = [0.0105, y + 0.006, 0.036];
  add('Emissive', cylinder(0.002, 0.034, 0.036, 8).transform({ t: [ap[0], ap[1], 0] }));
  return {
    sockets: [
      ['SOCKET_Light', [light[0], light[1], 0.038], [0, 0, 1], 'Flashlight lens: spotlight origin.'],
      ['SOCKET_Laser', ap, [0, 0, 1], 'Laser aperture: beam origin.'],
    ],
  };
};

/** Steampunk: a little brass lantern with glass panes and a glowing wick. */
const lantern: AttachmentBuilder = (ctx, add) => {
  clamp(ctx, add, 0.024);
  const s = 0.03 + ctx.p.bulk * 0.006, yc = -0.012 - s / 2;
  add('Glass', box([0, yc, 0], [s * 0.86, s * 0.9, s * 0.86]));
  add('Emissive', cylinder(0.005, -0.005, 0.005, 8).transform({ r: [-Math.PI / 2, 0, 0], t: [0, yc - s * 0.1, 0] }));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add('Trim', rod([x * s * 0.45, yc - s / 2, z * s * 0.45], [x * s * 0.45, yc + s / 2, z * s * 0.45], 0.0018, 6));
  for (const y of [yc - s / 2, yc + s / 2]) add('Trim', box([0, y, 0], [s, 0.004, s], ctx.bevel(0.001)));
  // Domed cap on top (dome() faces +Z; a -90° turn about X points it up).
  add('Trim', dome(s * 0.42, s * 0.3, ctx.seg(0.8), 3).transform({ r: [-Math.PI / 2, 0, 0], t: [0, yc + s / 2 + 0.002, 0] }));
  add('Trim', rod([0, -0.009, 0], [0, yc + s / 2, 0], 0.003, 8));
  // A brass lens ring on the front pane.
  add('Trim', lathe([[s * 0.3, s * 0.43], [s * 0.36, s * 0.43], [s * 0.36, s * 0.47], [s * 0.3, s * 0.47]], ctx.seg(0.8)).transform({ t: [0, yc, 0] }));
  return { sockets: [['SOCKET_Light', [0, yc, s * 0.47], [0, 0, 1], 'Lantern front: spotlight origin.']] };
};

/** Fantasy: a glowing crystal held in a golden claw. */
const crystal: AttachmentBuilder = (ctx, add) => {
  add('Trim', box([0, -0.004, 0], [0.016, 0.008, 0.024], ctx.bevel(0.0015)));
  const h = 0.024 + ctx.p.ornament * 0.01, yc = -0.012 - h;
  add('Trim', rod([0, -0.008, 0], [0, yc + h * 0.6, 0], 0.0025, 6));
  add('Emissive', lathe([[0, -h], [h * 0.42, 0], [0, h]], 6, Math.PI / 6).transform({ r: [-Math.PI / 2, 0, 0], t: [0, yc, 0] }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const tip: Vec3 = [Math.cos(a) * h * 0.5, yc - h * 0.2, Math.sin(a) * h * 0.5];
    add('Trim', rod([0, yc + h * 0.6, 0], tip, 0.0014, 5));
  }
  return { sockets: [['SOCKET_Light', [0, yc, 0], [0, 0, 1], 'Crystal center: glow / light origin.']] };
};

/** Survivor: a cheap plastic flashlight held on with duct tape. */
const taped: AttachmentBuilder = (ctx, add) => {
  const R = 0.012 + ctx.p.bulk * 0.003, y = -(0.004 + R);
  const lens = lightHead(ctx, add, y, R, -0.055, 0.035, 'Magazine');
  for (const z of [-0.03, 0.005]) {
    const w = 0.012;
    // A band around the light and the rail: an extruded loop seen from the front.
    const loop: Vec2[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      loop.push([Math.cos(a) * (R + 0.0012), y + Math.sin(a) * (R + 0.0012)]);
    }
    loop.push([R + 0.0012, 0.002], [-R - 0.0012, 0.002]);
    add('Accent', extrudeFrontLoop(loop, z - w / 2, z + w / 2));
  }
  return { sockets: [['SOCKET_Light', lens, [0, 0, 1], 'Flashlight lens: spotlight origin.']] };
};

/** A thin closed band (front-view outline [x, y]) extruded along Z. */
export function extrudeFrontLoop(outline: Vec2[], z0: number, z1: number): Geometry {
  // Build it as a side extrusion in a rotated frame: profile [z, y] at each x is
  // awkward for loops, so sweep quads around the outline instead.
  const g = new Geometry();
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    const nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const l = Math.hypot(nx, ny) || 1;
    const nrm: Vec3 = [nx / l, ny / l, 0];
    const u0 = 0, u1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const v0 = g.addVertex([a[0], a[1], z0], nrm, [u0, z0]);
    const v1 = g.addVertex([b[0], b[1], z0], nrm, [u1, z0]);
    const v2 = g.addVertex([b[0], b[1], z1], nrm, [u1, z1]);
    const v3 = g.addVertex([a[0], a[1], z1], nrm, [u0, z1]);
    g.addTriangle(v0, v1, v2, nrm);
    g.addTriangle(v0, v2, v3, nrm);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Underbarrel attachments.
// ---------------------------------------------------------------------------

const vgrip: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:vgrip-look');
  const form = g.pick(['tapered', 'cylinder', 'squared', 'fingers'] as const);
  const cap = g.chance(0.5);
  const len = 0.06 + ctx.p.bulk * 0.02;
  clamp(ctx, add, 0.034, 0.024);
  if (form === 'cylinder') {
    // Round tube grip with rubber rings (a lathe along Z turned to point down).
    const R = 0.0125 + ctx.p.bulk * 0.002, seg = ctx.seg(0.9);
    const down = (geo: Geometry, y = 0) => geo.transform({ r: [Math.PI / 2, 0, 0], t: [0, y, 0] });
    add('Grip', down(lathe([[0, 0.008], [R * 0.9, 0.008], [R, 0.012], [R * 1.05, len * 0.6], [R, len - 0.002], [R * 0.85, len], [0, len]], seg)));
    for (let i = 1; i <= 3; i++) add('Detail', down(lathe([[R * 1.03, 0], [R * 1.08, 0.0015], [R * 1.08, 0.003], [R * 1.03, 0.0045]], seg), -0.008 - (len * i) / 4.5));
    if (cap) add('Trim', down(cylinder(R * 1.1, 0, 0.005, seg, ctx.bevel(0.001)), -len));
    return { hand: [0, -len * 0.55, 0] };
  }
  if (form === 'squared') {
    add('Grip', extrudeSide([[-0.013, -0.008], [0.013, -0.008], [0.013, -len + 0.004], [0.016, -len], [-0.016, -len], [-0.013, -len + 0.004]], { width: 0.024, bevel: ctx.bevel(0.006) }));
    // Horizontal grip grooves on both sides.
    for (let i = 0; i < 5; i++) for (const s of [1, -1]) add('Detail', box([s * 0.0121, -0.016 - i * (len - 0.02) / 4.5, 0], [0.001, 0.002, 0.02]));
  } else if (form === 'fingers') {
    // Front edge scalloped for three fingers.
    const prof: Vec2[] = [[-0.013, -0.008], [0.012, -0.008]];
    for (let i = 0; i < 3; i++) {
      const y0 = -0.012 - (i * (len - 0.01)) / 3, y1 = y0 - (len - 0.01) / 3;
      prof.push([0.015, y0], [0.0105, (y0 + y1) / 2]);
      if (i === 2) prof.push([0.015, y1]);
    }
    prof.push([0.012, -len - 0.006], [-0.01, -len - 0.004], [-0.014, -len + 0.004]);
    add('Grip', extrudeSide(prof, { width: 0.026, bevel: ctx.bevel(0.004) }));
  } else {
    add('Grip', extrudeSide([[-0.012, -0.008], [0.012, -0.008], [0.016, -len], [0.012, -len - 0.006], [-0.01, -len - 0.004], [-0.014, -len + 0.004]], { width: 0.026, bevel: ctx.bevel(0.004) }));
    for (let i = 1; i <= 3; i++) add('Detail', box([0, -0.008 - (len * i) / 4, 0.0135 + (i * 0.003) / 3], [0.024, 0.003, 0.003]));
  }
  if (cap) add('Trim', box([0, -len - 0.006, 0.001], [0.028, 0.006, 0.03], ctx.bevel(0.002)));
  return { hand: [0, -len * 0.55, 0.002] };
};

const angled: AttachmentBuilder = (ctx, add) => {
  clamp(ctx, add, 0.05, 0.024);
  const d = 0.03 + ctx.p.bulk * 0.006;
  add('Grip', extrudeSide([[-0.04, -0.008], [0.03, -0.008], [0.024, -0.016], [-0.022, -d], [-0.034, -d], [-0.042, -d + 0.008]], { width: 0.024, bevel: ctx.bevel(0.004) }));
  add('Detail', box([0, -0.012, 0.012], [0.025, 0.004, 0.012]));
  return { hand: [0, -d * 0.6, -0.018] };
};

const stubby: AttachmentBuilder = (ctx, add) => {
  clamp(ctx, add, 0.03, 0.024);
  add('Grip', extrudeSide([[-0.014, -0.008], [0.014, -0.008], [0.012, -0.024], [0.004, -0.03], [-0.004, -0.03], [-0.012, -0.024]], { width: 0.024, bevel: ctx.bevel(0.004) }));
  return { hand: [0, -0.02, -0.03] };
};

/** Underbarrel grenade launcher: a fat tube, a receiver block with its own trigger, a leaf sight. */
const launcher: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:launcher-look');
  const end = g.pick(['flat', 'crown', 'cone'] as const);
  const ladder = g.chance(0.55);
  const ribs = g.pick([0, 3, 3, 6]);
  const seg = ctx.seg(1);
  const R = 0.02 + ctx.p.bulk * 0.003, len = 0.2 + ctx.p.length * 0.06;
  const y = -0.012 - R, z0 = -0.09, z1 = z0 + len;
  const at = (geo: Geometry) => geo.transform({ t: [0, y, 0] });
  add('Detail', box([0, -0.006, z0 + len * 0.45], [0.024, 0.012, len * 0.7], ctx.bevel(0.002)));
  if (end === 'cone') {
    // The tube necks down to a slimmer, flared muzzle.
    add('Barrel', at(lathe([[R * 0.78, z1], [R * 0.9, z1 - 0.003], [R * 0.82, z1 - 0.03], [R, z1 - 0.05], [R, z0 + 0.02], [R * 0.8, z0], [0, z0]], seg)));
    add('Barrel', at(cylinder(R * 0.68, z1 - 0.02, z1 - 0.0005, seg)));
  } else {
    add('Barrel', at(lathe([[R * 0.7, z1], [R, z1 - 0.004], [R, z0 + 0.02], [R * 0.8, z0], [0, z0]], seg)));
    add('Barrel', at(cylinder(R * 0.72, z1 - 0.02, z1 - 0.0005, seg)));
    if (end === 'crown') {
      // Fat muzzle ring with notches.
      add('Trim', at(lathe([[R * 0.9, z1 - 0.018], [R * 1.12, z1 - 0.016], [R * 1.12, z1 + 0.002], [R * 0.75, z1 + 0.002]], seg)));
      for (let i = 0; i < 4; i++) {
        const ang = Math.PI / 4 + (i / 4) * Math.PI * 2;
        add('Detail', box([0, 0, 0], [0.004, 0.003, 0.006]).transform({ r: [0, 0, ang - Math.PI / 2], t: [Math.cos(ang) * R * 1.1, y + Math.sin(ang) * R * 1.1, z1 - 0.002] }));
      }
    }
  }
  for (let i = 0; i < ribs; i++) {
    const zz = z1 - 0.07 - i * 0.012;
    add('Trim', at(lathe([[R, zz], [R + 0.0008, zz + 0.001], [R + 0.0008, zz + 0.005], [R, zz + 0.006]], seg)));
  }
  // Receiver block and trigger guard behind the tube.
  add('Body', extrudeSide([[z0 - 0.045, -0.008], [z0 + 0.01, -0.008], [z0 + 0.01, y - R * 0.8], [z0 - 0.03, y - R * 0.9], [z0 - 0.045, y - R * 0.4]], { width: 0.03, bevel: ctx.bevel(0.003) }));
  add('Detail', extrudeSide([[z0 - 0.03, y - R * 0.9], [z0 - 0.026, y - R * 0.9], [z0 - 0.024, y - R - 0.02], [z0 - 0.028, y - R - 0.02]], { width: 0.006 }));
  add('Detail', extrudeSide([[z0 - 0.04, y - R * 0.88], [z0 - 0.036, y - R * 0.88], [z0 - 0.036, y - R - 0.024], [z0 - 0.002, y - R - 0.024], [z0 - 0.002, y - R * 0.86], [z0 + 0.002, y - R * 0.86], [z0 + 0.002, y - R - 0.028], [z0 - 0.04, y - R - 0.028]], { width: 0.008 }));
  if (ladder) {
    // Flip-out ladder sight on the left side of the tube (a quadrant sight).
    const x = R + 0.002, zs = z0 + 0.035;
    add('Detail', box([x, y, zs], [0.008, 0.01, 0.02], ctx.bevel(0.001)));
    for (const dz of [-0.007, 0.007]) add('Trim', box([x + 0.018, y, zs + dz], [0.032, 0.0015, 0.0025]));
    for (let i = 0; i < 4; i++) add('Trim', box([x + 0.009 + i * 0.007, y, zs], [0.0012, 0.0012, 0.016]));
    add('Accent', box([x + 0.034, y, zs], [0.004, 0.0018, 0.017]));
  }
  return {
    hand: [0, y, z0 + len * 0.6],
    sockets: [['SOCKET_Launcher_Muzzle', [0, y, z1], [0, 0, 1], 'Grenade launcher muzzle: projectile spawn.']],
  };
};

const noop: PartBuilder = () => {};

export const SIDE_BUILDERS: Record<string, AttachmentBuilder> = { flashlight, laser, combo, lantern, crystal, taped, ...SIDE_BUILDERS_2 };
export const UNDERBARREL_BUILDERS: Record<string, AttachmentBuilder> = { vgrip, angled, stubby, launcher, ...UNDERBARREL_BUILDERS_2 };

/**
 * Build one attachment as its own component at a mount. Returns the support
 * hand position (weapon space) if it's a grip.
 */
export function buildAttachment(ctx: BuildContext, type: 'side' | 'underbarrel', variant: string, mount: Mount): Vec3 | undefined {
  const table = type === 'side' ? SIDE_BUILDERS : UNDERBARREL_BUILDERS;
  const fn = table[variant];
  if (!fn) throw new Error(`Unknown ${type} attachment "${variant}". Available: none, ${Object.keys(table).join(', ')}`);
  const name = type === 'side' ? 'SideAttachment' : 'Underbarrel';
  const c: Component = ctx.b.component(name, { kind: type === 'side' ? 'side_attachment' : 'underbarrel', variant, parent: mount.parent, pivot: mount.at });
  const built = fn(ctx, (slot, geo) => {
    geo.transform({ r: mount.r, t: mount.at });
    ctx.b.add(c, slot, geo);
  });
  for (const [sname, pos, fwd, description] of built.sockets ?? []) {
    ctx.b.socket({ name: sname, parent: name, position: place(mount, pos), forward: rotate(fwd, mount.r), description });
  }
  return built.hand ? place(mount, built.hand) : undefined;
}

/** Where attachments go on a long gun (weapon space). */
export function longGunMounts(ctx: BuildContext): { underbarrel: Mount; side: Mount; barrelEnd: Vec3 } {
  const { L } = ctx;
  const hg = L.handguard;
  const parent = ctx.b.has('Handguard') ? 'Handguard' : null;
  return {
    underbarrel: { at: [0, -hg.radius, hg.z0 + (hg.z1 - hg.z0) * 0.5], parent },
    side: { at: [-hg.radius, 0, hg.z1 - 0.055], r: [0, 0, -Math.PI / 2], parent },
    barrelEnd: [0, 0, L.barrel.z1],
  };
}

/** Long-gun part builders for the "underbarrel" and "side" kinds. */
export const UNDERBARREL_PARTS: Record<string, PartBuilder> = {
  none: noop,
  ...Object.fromEntries(Object.keys(UNDERBARREL_BUILDERS).map((v) => [v, (ctx: BuildContext) => {
    const hand = buildAttachment(ctx, 'underbarrel', v, longGunMounts(ctx).underbarrel);
    if (hand) [ctx.L.extra.supportX, ctx.L.extra.supportY, ctx.L.extra.supportZ] = hand;
  }])),
};
export const SIDE_PARTS: Record<string, PartBuilder> = {
  none: noop,
  ...Object.fromEntries(Object.keys(SIDE_BUILDERS).map((v) => [v, (ctx: BuildContext) => {
    buildAttachment(ctx, 'side', v, longGunMounts(ctx).side);
  }])),
};

/**
 * Default attachment odds from style traits (a style can override them with
 * its own `parts.underbarrel` / `parts.side`). Mostly "none": attachments
 * should be a treat, not a uniform.
 */
export function attachmentWeights(style: StyleProfile, kind: 'underbarrel' | 'side', archetype: string): Record<string, number> {
  if (style.parts[kind]) return style.parts[kind];
  const t = style.traits, era = t.era ?? 2000;
  const on = (b: unknown, v: number) => (b ? v : 0);
  if (kind === 'underbarrel') {
    if (era < 1960) return { none: 1 };
    return {
      none: 3,
      vgrip: on(t.rails, 1) + on(t.glow, 0.5) + on(t.scrap, 0.4) + on(t.diesel, 0.3),
      angled: on(t.rails, 0.6) + on(t.cyber, 0.8) + on(t.glow, 0.3),
      stubby: on(t.rails, 0.4) + on(t.glow, 0.3),
      launcher: archetype === 'rifle' ? on(t.rails, 0.3) + on(t.glow, 0.15) + on(era < 1980, 0.5) + on(t.diesel, 0.3) : 0,
      bipodgrip: on(t.rails, 0.4) + on(t.diesel, 0.2),
      barricade: on(t.rails, 0.4) + on(t.cyber, 0.4),
      shotgun: archetype === 'rifle' ? on(t.rails, 0.2) + on(t.diesel, 0.3) + on(t.scrap, 0.15) : 0,
      skeleton: on(t.glow && !t.magic, 0.6) + on(t.cyber, 0.5),
      wrapped: on(t.scrap, 1),
    };
  }
  if (era < 1960) return { none: 1 };
  return {
    none: 3,
    flashlight: on(t.rails, 0.8) + on(t.diesel, 0.5) + on(era < 1980, 0.4) + on(t.glow && !t.magic, 0.2),
    laser: on(t.rails, 0.5) + on(t.glow && !t.magic, 0.6) + on(t.cyber, 0.4),
    combo: on(t.rails, 0.4) + on(t.cyber, 0.5),
    lantern: on(t.plumbing, 1),
    crystal: on(t.magic, 1),
    taped: on(t.scrap, 1),
    strobe: on(t.rails, 0.4) + on(era < 1980, 0.3) + on(t.diesel, 0.2),
    rangefinder: on(t.rails, 0.3) + on(t.cyber, 0.3),
    ir: on(t.rails, 0.3) + on(t.cyber, 0.3),
    uvlamp: on(t.glow && !t.magic, 0.7) + on(t.cyber, 0.3),
    headlamp: on(t.diesel, 0.9) + on(t.plumbing, 0.3),
    torch: on(t.magic, 0.6) + on(t.scrap, 0.4),
  };
}

/** Frames with a rail-like dust cover under the barrel, where a pistol light fits. */
export const PISTOL_RAIL_FRAMES = ['slide', 'smartgun', 'blaster', 'deco', 'compact', 'longslide', 'polymer', 'magnum', 'holdout'];
const PISTOL_ATTACHMENTS = ['flashlight', 'laser', 'combo', 'taped', 'crystal', 'rangefinder', 'uvlamp', 'headlamp'];

/**
 * Where a pistol light goes: under the frame, ahead of the trigger guard. The
 * frames differ a lot underneath, so measure the built frame instead of guessing.
 */
export function pistolMount(ctx: BuildContext): Mount {
  const { L } = ctx;
  const za = Math.max(L.grip.z + 0.03, L.rec.z1 - 0.065), zb = L.rec.z1 - 0.012;
  let low = Infinity;
  for (const name of [ctx.b.rootName, 'Slide', 'Barrel']) {
    if (!ctx.b.has(name)) continue;
    for (const g of ctx.b.component(name, { kind: '-', variant: '-' }).geometry.values()) {
      for (let i = 0; i < g.positions.length; i += 3) {
        const z = g.positions[i + 2];
        if (z >= za && z <= zb && Math.abs(g.positions[i]) < 0.02) low = Math.min(low, g.positions[i + 1]);
      }
    }
  }
  return { at: [0, Number.isFinite(low) ? low : L.rec.bottom, (za + zb) / 2 - 0.01], parent: ctx.b.rootName };
}

export const PISTOL_UNDERBARREL_PARTS: Record<string, PartBuilder> = {
  none: noop,
  ...Object.fromEntries(PISTOL_ATTACHMENTS.map((v) => [v, (ctx: BuildContext) => {
    buildAttachment(ctx, 'side', v, pistolMount(ctx));
  }])),
};

/** Pistol light/laser odds: the side-rail odds, minus what doesn't fit a handgun. */
export function pistolAttachmentWeights(style: StyleProfile): Record<string, number> {
  const w = attachmentWeights(style, 'side', 'pistol');
  return Object.fromEntries(Object.entries(w).filter(([k]) => k === 'none' || PISTOL_ATTACHMENTS.includes(k)).map(([k, v]) => [k, k === 'none' ? v * 1.5 : v]));
}
