/**
 * More attachments, each with a silhouette of its own. Same mount frame as
 * attach.ts: the rail clamp at the origin, the body hanging down (-Y), the
 * front toward +Z. Side attachments are turned a quarter turn by their Mount,
 * so for them "up on the gun" is -X in this frame.
 *
 *   side         strobe       long-throw light, big reflector head on a slim body
 *                rangefinder  box with a receiver lens and an emitter lens
 *                ir           IR illuminator: hexagonal emitter over a battery tube
 *                uvlamp       sci-fi: flat emitter bar with cooling fins
 *                headlamp     dieselpunk: chrome teardrop headlight with a grille
 *                torch        fantasy/survivor: a small brazier with a live flame
 *   underbarrel  bipodgrip    grip whose legs split into a mini bipod
 *                barricade    hand stop with a thumb shelf
 *                shotgun      underbarrel shotgun: barrel, tube magazine, own pump
 *                skeleton     sci-fi open-frame grip
 *                wrapped      survivor: a stick taped on as a grip
 *
 * Shape genes come only from `ctx.rng('<kind>:<name>-look')` and params, so a
 * standalone attachment is identical to the mounted one.
 */
import { Geometry, Vec2, Vec3, box, cylinder, dome, extrudeFront, extrudeSide, extrudeTop, lathe, ring, rod } from '../core/geometry.js';
import type { MaterialSlot } from '../types.js';
import { type AttachmentBuilder, clamp, extrudeFrontLoop } from './attach.js';

const DOWN: Vec3 = [Math.PI / 2, 0, 0]; // turns +Z into -Y

// ---------------------------------------------------------------------------
// Side rail
// ---------------------------------------------------------------------------

/** Long-throw light: slim body, a big flared reflector head well ahead of the clamp. */
const strobe: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:strobe-look');
  const R = 0.0085 + ctx.p.bulk * 0.002, H = R * g.range(2.0, 2.5);
  const y = -(0.011 + H * 0.85), z0 = -0.07, zh = 0.012 + g.range(0, 0.012), z1 = zh + 0.04;
  const seg = ctx.seg(1);
  const at = (geo: Geometry) => geo.transform({ t: [0, y, 0] });
  clamp(ctx, add, 0.03);
  // Riser from the clamp down to the body.
  add('Detail', box([0, (-0.008 + y + R * 0.6) / 2, -0.01], [0.012, -0.008 - (y + R * 0.6) + 0.002, 0.024], ctx.bevel(0.0015)));
  add('Sight', at(lathe([[0, z0], [R * 0.8, z0], [R, z0 + 0.004], [R, zh], [H * 0.92, z1 - 0.012], [H, z1 - 0.008], [H, z1], [H * 0.9, z1]], seg)));
  add('Accent', at(lathe([[0, z0 - 0.006], [R * 0.75, z0 - 0.006], [R * 0.8, z0], [0, z0]], seg)));
  add('Emissive', at(cylinder(H * 0.86, z1 - 0.004, z1 - 0.002, seg)));
  add('Glass', at(cylinder(H * 0.92, z1 - 0.0015, z1 - 0.0005, seg)));
  // Grippy body: long rubber sleeve or spaced rings.
  if (g.chance(0.5)) add('Grip', at(lathe([[R, z0 + 0.01], [R + 0.0012, z0 + 0.012], [R + 0.0012, zh - 0.02], [R, zh - 0.018]], seg)));
  else for (let i = 0; i < 4; i++) add('Trim', at(ring(R + 0.0003, 0.0012, z0 + 0.016 + i * 0.012, seg, 5)));
  // Bezel: crenellated or plain with a cooling-fin collar.
  if (g.chance(0.5)) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      add('Trim', box([0, 0, 0], [H * 0.3, H * 0.14, 0.005], ctx.bevel(0.0006)).transform({ r: [0, 0, a - Math.PI / 2], t: [Math.cos(a) * H * 0.93, y + Math.sin(a) * H * 0.93, z1 + 0.002] }));
    }
  } else {
    for (let i = 0; i < 3; i++) add('Trim', at(lathe([[R * 1.1, zh + 0.004 + i * 0.006], [H * 0.75, zh + 0.006 + i * 0.006], [H * 0.75, zh + 0.008 + i * 0.006], [R * 1.1, zh + 0.009 + i * 0.006]], seg)));
  }
  return { sockets: [['SOCKET_Light', [0, y, z1], [0, 0, 1], 'Flashlight lens: spotlight origin.']] };
};

/** Laser rangefinder: a box with a big receiver lens and a small emitter, buttons and a readout. */
const rangefinder: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:rangefinder-look');
  const w = g.range(0.034, 0.042), h = g.range(0.02, 0.026), l = g.range(0.045, 0.058);
  const y = -0.009 - h / 2, zf = 0.006 + l / 2;
  clamp(ctx, add, 0.032, 0.022);
  add('Sight', box([0, y, 0.006], [w, h, l], ctx.bevel(0.003)));
  const rr = Math.min(h * 0.38, w * 0.24), er = rr * 0.55;
  const big: Vec3 = [w * 0.22, y, zf], small: Vec3 = [-w * 0.26, y, zf];
  // Receiver lens in a deep hood; emitter lens flush.
  add('Trim', lathe([[rr * 0.8, zf - 0.002], [rr * 1.2, zf - 0.002], [rr * 1.2, zf + 0.006], [rr * 0.95, zf + 0.006], [rr * 0.95, zf + 0.002]], ctx.seg(0.8)).transform({ t: [big[0], big[1], 0] }));
  add('Glass', cylinder(rr * 0.97, zf + 0.0015, zf + 0.0025, ctx.seg(0.8)).transform({ t: [big[0], big[1], 0] }));
  add('Trim', cylinder(er * 1.3, zf - 0.002, zf + 0.002, ctx.seg(0.6)).transform({ t: [small[0], small[1], 0] }));
  add('Emissive', cylinder(er, zf + 0.002, zf + 0.0028, ctx.seg(0.6)).transform({ t: [small[0], small[1], 0] }));
  // Buttons on the outside face, readout on the back.
  for (const dz of [-0.008, 0.006]) add('Accent', cylinder(0.003, 0, 0.002, 8).transform({ r: DOWN, t: [0, y - h / 2, dz] }));
  const zb = 0.006 - l / 2;
  add('Emissive', box([0, y, zb - 0.0004], [w * 0.5, h * 0.4, 0.0008]));
  add('Trim', box([0, y, zb - 0.0012], [w * 0.6, h * 0.55, 0.001]));
  // Battery cap on the side.
  add('Trim', cylinder(h * 0.28, 0, 0.003, 10).transform({ r: [0, Math.PI / 2, 0], t: [w / 2, y, -0.004] }));
  return {
    sockets: [
      ['SOCKET_Laser', [small[0], small[1], zf + 0.0028], [0, 0, 1], 'Rangefinder emitter: beam origin.'],
      ['SOCKET_Light', [big[0], big[1], zf + 0.0025], [0, 0, 1], 'Rangefinder receiver lens.'],
    ],
  };
};

/** IR illuminator: a hexagonal emitter head on top, a battery tube underneath, joined by a web. */
const ir: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:ir-look');
  const R = 0.0105 + ctx.p.bulk * 0.002, rb = R * g.range(0.6, 0.8);
  const y1 = -(0.011 + R), y2 = y1 - R - rb - 0.002;
  const z0 = -0.045, z1 = 0.045, seg = ctx.seg(0.9);
  clamp(ctx, add, 0.03);
  // Emitter: hex body with a knurled focus ring.
  add('Sight', lathe([[0, z0 + 0.01], [R * 0.9, z0 + 0.01], [R, z0 + 0.014], [R, z1 - 0.004], [R * 0.95, z1]], 6, Math.PI / 6).transform({ t: [0, y1, 0] }));
  add('Grip', lathe([[R * 1.02, z1 - 0.03], [R * 1.1, z1 - 0.028], [R * 1.1, z1 - 0.014], [R * 1.02, z1 - 0.012]], 12).transform({ t: [0, y1, 0] }));
  add('Emissive', lathe([[0, z1 - 0.0015], [R * 0.82, z1 - 0.0015], [R * 0.82, z1 - 0.0005], [0, z1 - 0.0005]], 6, Math.PI / 6).transform({ t: [0, y1, 0] }));
  add('Glass', lathe([[0, z1 - 0.0004], [R * 0.9, z1 - 0.0004], [R * 0.9, z1], [0, z1]], 6, Math.PI / 6).transform({ t: [0, y1, 0] }));
  // Battery tube: longer, sticking out behind, with a tail cap.
  const zt0 = z0 - g.range(0.005, 0.02), zt1 = z1 - 0.018;
  add('Sight', lathe([[0, zt0], [rb * 0.85, zt0], [rb, zt0 + 0.003], [rb, zt1 - 0.003], [rb * 0.85, zt1], [0, zt1]], seg).transform({ t: [0, y2, 0] }));
  add('Accent', cylinder(rb * 0.9, zt0 - 0.004, zt0, seg).transform({ t: [0, y2, 0] }));
  add('Detail', box([0, (y1 + y2) / 2, (z0 + 0.01 + zt1) / 2], [Math.min(R, rb) * 0.8, y1 - y2, zt1 - z0 - 0.02]));
  // Mode switch on the web.
  add('Accent', box([R * 0.4, (y1 + y2) / 2, -0.01], [0.004, 0.005, 0.008], ctx.bevel(0.0008)));
  return { sockets: [['SOCKET_Light', [0, y1, z1], [0, 0, 1], 'IR illuminator lens: (invisible) spotlight origin.']] };
};

/** Sci-fi: a flat, wide emitter bar with cooling fins. */
const uvlamp: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:uvlamp-look');
  const w = g.range(0.03, 0.04), h = g.range(0.01, 0.013), l = g.range(0.045, 0.065);
  const y = -0.009 - h / 2, z0 = -l / 2 + 0.004, z1 = l / 2 + 0.004;
  clamp(ctx, add, 0.026, 0.02);
  // Housing: a side profile with a chamfered nose.
  add('Sight', extrudeSide([[z0, y + h / 2], [z1 - h * 0.4, y + h / 2], [z1, y + h * 0.1], [z1, y - h / 2], [z0 + h * 0.4, y - h / 2], [z0, y]], { width: w, bevel: ctx.bevel(0.002) }));
  // Emitter strip on the nose.
  add('Emissive', box([0, y - h * 0.2, z1 + 0.0003], [w * 0.82, h * 0.5, 0.0006]));
  add('Glass', box([0, y - h * 0.2, z1 + 0.0009], [w * 0.88, h * 0.58, 0.0006]));
  // Cooling fins on the outer face.
  const fins = g.int(4, 7);
  for (let i = 0; i < fins; i++) {
    const z = z0 + 0.008 + (i / Math.max(1, fins - 1)) * (l - 0.022);
    add('Trim', box([0, y - h / 2 - 0.002, z], [w * 0.8, 0.004, 0.0018]));
  }
  // Glowing edge lines.
  for (const s of [1, -1]) add('Emissive', box([s * (w / 2 + 0.0002), y, (z0 + z1) / 2], [0.0006, 0.0015, l * 0.7]));
  return { sockets: [['SOCKET_Light', [0, y - h * 0.2, z1 + 0.001], [0, 0, 1], 'Emitter bar: area light origin.']] };
};

/** Dieselpunk: a chrome teardrop headlight with a grille, on a stalk. */
const headlamp: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:headlamp-look');
  const R = 0.014 + ctx.p.bulk * 0.003, L = R * g.range(2.6, 3.4);
  const y = -(0.016 + R), z1 = 0.006 + L * 0.3, z0 = z1 - L;
  const seg = ctx.seg(1);
  clamp(ctx, add, 0.026, 0.02);
  // Teardrop shell: pointed tail swelling to the rim.
  const prof: Vec2[] = [[0, z0]];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    prof.push([R * Math.sin((t * Math.PI) / 2) ** 0.8, z0 + (L - 0.006) * t]);
  }
  prof.push([R * 1.08, z1 - 0.004], [R * 1.08, z1], [R * 0.95, z1]);
  add('Trim', lathe(prof, seg).transform({ t: [0, y, 0] }));
  add('Emissive', cylinder(R * 0.92, z1 - 0.004, z1 - 0.002, seg).transform({ t: [0, y, 0] }));
  add('Glass', dome(R * 0.98, 0.004, seg, 3).transform({ t: [0, y, z1 - 0.002] }));
  // Grille: horizontal (or vertical) bars across the lens.
  const vertical = g.chance(0.4), bars = g.int(3, 5);
  for (let i = 0; i < bars; i++) {
    const o = ((i + 1) / (bars + 1) - 0.5) * 2 * R * 0.95;
    const span = 2 * Math.sqrt(Math.max(0, (R * 1.02) ** 2 - o * o));
    add('Body', box(vertical ? [o, y, z1 + 0.004] : [0, y + o, z1 + 0.004], vertical ? [0.0018, span, 0.0018] : [span, 0.0018, 0.0018]));
  }
  add('Body', box([0, y, z1 + 0.004], vertical ? [2 * R * 1.02, 0.0018, 0.0018] : [0.0018, 2 * R * 1.02, 0.0018]));
  // Stalk and a fin along the back.
  add('Detail', rod([0, -0.008, 0.002], [0, y + R * 0.6, 0.002], 0.0035, 8));
  add('Detail', box([0, -0.009, 0], [0.012, 0.004, 0.014], ctx.bevel(0.001)));
  if (g.chance(0.6)) add('Trim', extrudeSide([[z0 + L * 0.15, y + R * 0.2], [z0 + L * 0.6, y + R * 0.75], [z0 + L * 0.65, y + R * 0.95], [z0 + L * 0.1, y + R * 0.3]], { width: 0.0025 }));
  return { sockets: [['SOCKET_Light', [0, y, z1 + 0.002], [0, 0, 1], 'Headlamp lens: spotlight origin.']] };
};

/** Fantasy / survivor: a little brazier hanging off the rail, its flame pointing up the gun (-X here). */
const torch: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('side:torch-look');
  const cr = 0.013 + ctx.p.ornament * 0.003, ch = cr * g.range(0.9, 1.3);
  const yc = -0.03 - cr;
  const toUp: Vec3 = [0, -Math.PI / 2, 0]; // lathe axis +Z -> -X (up on the gun)
  const seg = Math.max(6, ctx.seg(0.7));
  const xb = cr * 0.6; // cup base, "below" the flame
  add('Trim', box([0, -0.004, 0], [0.016, 0.008, 0.024], ctx.bevel(0.0015)));
  // Hanging arm from the clamp to the cup.
  add('Trim', rod([0, -0.008, 0], [0, yc + cr * 0.4, 0], 0.0028, 6));
  add('Trim', rod([0, yc + cr * 0.4, 0], [xb, yc, 0], 0.0024, 6));
  // Cup (wall with a rolled rim), seen from the side.
  add('Trim', lathe([[0, 0], [cr * 0.45, 0], [cr, ch * 0.75], [cr * 1.08, ch], [cr * 0.94, ch], [cr * 0.82, ch * 0.75], [cr * 0.3, ch * 0.15], [0, ch * 0.15]], seg).transform({ r: toUp, t: [xb, yc, 0] }));
  // Flame: a teardrop of light rising from the cup.
  const fh = cr * g.range(2.0, 2.8);
  const flame: Vec2[] = [[0, ch * 0.1], [cr * 0.7, ch * 0.4], [cr * 0.75, ch * 0.4 + fh * 0.25], [cr * 0.4, ch * 0.4 + fh * 0.65], [0, ch * 0.4 + fh]];
  add('Emissive', lathe(flame, seg, g.range(0, 1)).transform({ r: toUp, t: [xb, yc, 0] }));
  // Cage prongs or a lantern chimney.
  if (g.chance(0.5)) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const rim: Vec3 = [xb - ch, yc + Math.cos(a) * cr, Math.sin(a) * cr];
      const tip: Vec3 = [xb - ch - fh * 0.6, yc + Math.cos(a) * cr * 0.45, Math.sin(a) * cr * 0.45];
      add('Accent', rod(rim, tip, 0.0013, 5));
    }
  } else {
    add('Glass', lathe([[cr * 0.85, ch * 0.9], [cr * 0.85, ch + fh * 0.75]], seg).transform({ r: toUp, t: [xb, yc, 0] }));
    add('Accent', ring(cr * 0.88, 0.0016, ch + fh * 0.75, seg, 5).transform({ r: toUp, t: [xb, yc, 0] }));
  }
  return { sockets: [['SOCKET_Light', [xb - ch - fh * 0.4, yc, 0], [-1, 0, 0], 'Flame: point light origin.']] };
};

// ---------------------------------------------------------------------------
// Underbarrel
// ---------------------------------------------------------------------------

/** A grip whose two legs split into a mini bipod (shown half-deployed). */
const bipodgrip: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:bipodgrip-look');
  const hl = 0.026, ll = 0.075 + ctx.p.bulk * 0.015, splay = g.range(0.12, 0.42);
  const seg = ctx.seg(0.8);
  clamp(ctx, add, 0.034, 0.024);
  // Housing with the release button.
  add('Grip', lathe([[0, 0.006], [0.0135, 0.006], [0.0145, 0.012], [0.0135, hl], [0, hl]], seg).transform({ r: DOWN }));
  add('Accent', box([0, -0.016, 0.0135], [0.008, 0.008, 0.003], ctx.bevel(0.0008)));
  add('Trim', cylinder(0.004, -0.014, 0.014, 8).transform({ r: [0, Math.PI / 2, 0], t: [0, -hl, 0] }));
  // Two half-round legs splaying out sideways, rubber feet.
  for (const s of [1, -1]) {
    const top: Vec3 = [s * 0.006, -hl, 0];
    const foot: Vec3 = [s * (0.006 + Math.sin(splay) * ll), -hl - Math.cos(splay) * ll, 0];
    add('Grip', rod(top, foot, 0.0068, Math.max(6, ctx.seg(0.5))));
    const fd: Vec3 = [Math.sin(splay) * s, -Math.cos(splay), 0];
    add('Accent', rod(foot, [foot[0] + fd[0] * 0.012, foot[1] + fd[1] * 0.012, 0], 0.0082, Math.max(6, ctx.seg(0.5))));
  }
  return { hand: [0, -hl * 0.6, 0] };
};

/** Hand stop with a flat thumb shelf reaching out to the left. */
const barricade: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:barricade-look');
  const d = 0.024 + ctx.p.bulk * 0.006, reach = g.range(0.022, 0.032);
  clamp(ctx, add, 0.05, 0.024);
  add('Grip', extrudeSide([[-0.032, -0.008], [0.028, -0.008], [0.032, -0.012], [0.026, -d], [0.016, -d - 0.002], [-0.022, -0.015], [-0.032, -0.011]], { width: 0.024, bevel: ctx.bevel(0.003) }));
  // Thumb shelf: a flat plate cantilevered to the left (+X), ridged on top.
  const shelf: Vec2[] = [[-0.026, 0.008], [0.024, 0.008], [0.02, reach], [0.012, reach + 0.004], [-0.018, reach + 0.003], [-0.024, reach - 0.004]];
  add('Grip', extrudeTop(shelf, 0.005, -0.012, ctx.bevel(0.0012)));
  for (let i = 0; i < 4; i++) add('Detail', box([0.012 + i * 0.0045 * (reach / 0.03), -0.0094, 0], [0.0016, 0.0012, 0.03]));
  // Barricade notch: a V cut in the front face.
  if (g.chance(0.6)) add('Detail', box([0, -d * 0.6, 0.0285], [0.025, 0.003, 0.004]));
  return { hand: [0.014, -0.012, 0] };
};

/** Underbarrel shotgun: barrel over a tube magazine, its own pump and a small receiver with a trigger. */
const shotgun: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:shotgun-look');
  const Rb = 0.0115 + ctx.p.bulk * 0.002, Rm = Rb * g.range(0.7, 0.85), len = 0.19 + ctx.p.length * 0.05;
  const seg = ctx.seg(0.9);
  const y = -0.012 - Rb, ym = y - Rb - Rm + 0.001, z0 = -0.08, z1 = z0 + len;
  add('Detail', box([0, -0.006, z0 + len * 0.45], [0.022, 0.012, len * 0.7], ctx.bevel(0.002)));
  add('Barrel', lathe([[Rb * 0.7, z1], [Rb, z1 - 0.003], [Rb, z0], [0, z0]], seg).transform({ t: [0, y, 0] }));
  add('Barrel', cylinder(Rb * 0.72, z1 - 0.02, z1 - 0.0005, seg).transform({ t: [0, y, 0] }));
  const mz1 = z1 - g.range(0.025, 0.05);
  add('Magazine', lathe([[0, z0], [Rm, z0], [Rm, mz1 - 0.004], [Rm * 0.8, mz1], [0, mz1]], seg).transform({ t: [0, ym, 0] }));
  // Band clamping barrel and magazine together.
  const bz = mz1 - 0.012;
  add('Trim', extrudeFront([[-Rb - 0.002, y + Rb * 0.3], [Rb + 0.002, y + Rb * 0.3], [Rm + 0.002, ym - Rm * 0.7], [-Rm - 0.002, ym - Rm * 0.7]], bz - 0.005, bz + 0.005, ctx.bevel(0.001)));
  // Pump forend wrapping both tubes, with grooves.
  const pz0 = z0 + 0.03, pz1 = pz0 + 0.075;
  const pw = Rb + 0.0035, ptop = y + Rb * 0.6, pbot = ym - Rm - 0.003;
  const fore: Vec2[] = [[-pw, ptop], [pw, ptop], [pw * 1.05, (ptop + pbot) / 2], [pw * 0.8, pbot], [-pw * 0.8, pbot], [-pw * 1.05, (ptop + pbot) / 2]];
  add('Grip', extrudeFront(fore, pz0, pz1, ctx.bevel(0.003)));
  for (let i = 0; i < 5; i++) add('Detail', box([0, (ptop + pbot) / 2, pz0 + 0.012 + i * 0.012], [pw * 2.12, (ptop - pbot) * 0.55, 0.002]));
  // Receiver, trigger guard and a bolt knob on the left.
  add('Body', extrudeSide([[z0 - 0.05, -0.008], [z0 + 0.012, -0.008], [z0 + 0.012, ym - Rm * 0.5], [z0 - 0.03, ym - Rm * 0.7], [z0 - 0.05, y - Rb * 0.2]], { width: 0.028, bevel: ctx.bevel(0.003) }));
  const yg = ym - Rm * 0.7;
  add('Detail', extrudeSide([[z0 - 0.032, yg], [z0 - 0.028, yg], [z0 - 0.026, yg - 0.018], [z0 - 0.03, yg - 0.018]], { width: 0.006 }));
  add('Detail', extrudeSide([[z0 - 0.042, yg], [z0 - 0.038, yg], [z0 - 0.038, yg - 0.022], [z0 - 0.006, yg - 0.022], [z0 - 0.006, yg], [z0 - 0.002, yg], [z0 - 0.002, yg - 0.026], [z0 - 0.042, yg - 0.026]], { width: 0.008 }));
  add('Trim', rod([0.014, y, z0 - 0.02], [0.026, y, z0 - 0.022], 0.0022, 6));
  add('Accent', dome(0.0045, 0.004, 8, 2).transform({ r: [0, Math.PI / 2, 0], t: [0.026, y, z0 - 0.022] }));
  return {
    hand: [0, (ptop + pbot) / 2, (pz0 + pz1) / 2],
    sockets: [['SOCKET_Shotgun_Muzzle', [0, y, z1], [0, 0, 1], 'Underbarrel shotgun muzzle: pellet spawn.']],
  };
};

/** Sci-fi open-frame grip: struts around an empty middle, a light strip inside. */
const skeleton: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:skeleton-look');
  const len = 0.065 + ctx.p.bulk * 0.015, rake = g.range(0, 0.014), w = 0.02;
  const e = ctx.bevel(0.0025);
  clamp(ctx, add, 0.034, 0.024);
  const f0 = 0.014, b0 = -0.014, yb = -len;
  // Top plate, front and back struts, foot.
  add('Grip', extrudeSide([[b0 - 0.004, -0.008], [f0 + 0.004, -0.008], [f0 + 0.004, -0.015], [b0 - 0.004, -0.015]], { width: w, bevel: e }));
  add('Grip', extrudeSide([[f0 - 0.006, -0.012], [f0 + 0.002, -0.012], [f0 - rake + 0.002, yb + 0.004], [f0 - rake - 0.006, yb + 0.004]], { width: w * 0.8, bevel: e }));
  add('Grip', extrudeSide([[b0 - 0.002, -0.012], [b0 + 0.006, -0.012], [b0 - rake + 0.006, yb + 0.004], [b0 - rake - 0.002, yb + 0.004]], { width: w * 0.8, bevel: e }));
  const foot = g.pick(['flat', 'hook'] as const);
  add('Grip', extrudeSide(foot === 'flat'
    ? [[b0 - rake - 0.006, yb + 0.007], [f0 - rake + 0.006, yb + 0.007], [f0 - rake + 0.008, yb - 0.002], [b0 - rake - 0.008, yb - 0.002]]
    : [[b0 - rake - 0.004, yb + 0.007], [f0 - rake + 0.004, yb + 0.007], [f0 - rake + 0.014, yb - 0.004], [f0 - rake + 0.01, yb - 0.008], [b0 - rake - 0.004, yb - 0.002]], { width: w, bevel: e }));
  // Diagonal brace and a light strip down the front strut.
  if (g.chance(0.5)) add('Trim', rod([b0 + 0.002, -0.014, 0], [f0 - rake - 0.002, yb + 0.006, 0], 0.0022, 6));
  const strip: MaterialSlot = ctx.style.traits.glow || ctx.style.traits.cyber ? 'Emissive' : 'Accent';
  for (const s of [1, -1]) add(strip, rod([s * (w * 0.4 + 0.0004), -0.016, f0 - 0.002], [s * (w * 0.4 + 0.0004), yb + 0.008, f0 - rake - 0.002], 0.0011, 5));
  return { hand: [0, -len * 0.55, -rake * 0.5] };
};

/** Survivor: a stick taped on under the handguard. */
const wrapped: AttachmentBuilder = (ctx, add) => {
  const g = ctx.rng('underbarrel:wrapped-look');
  const len = 0.07 + g.range(0, 0.02), r = 0.0095 + ctx.p.bulk * 0.002, tilt = g.range(0.05, 0.3);
  const seg = Math.max(5, ctx.seg(0.45));
  const lay = (geo: Geometry) => geo.transform({ r: [Math.PI / 2 + tilt, 0, 0], t: [0, -0.008, 0] });
  // A crude wooden block on the rail and the stick, slightly lumpy.
  add('Stock', box([0, -0.006, 0], [0.022, 0.012, 0.04], ctx.bevel(0.002)));
  const prof: Vec2[] = [[0, -0.004], [r * 0.9, -0.004]];
  for (let i = 1; i <= 5; i++) prof.push([r * (1 + (g.next() - 0.5) * 0.18), (len * i) / 5 - 0.004]);
  prof.push([r * 0.7, len + 0.001], [0, len + 0.001]);
  add('Stock', lay(lathe(prof, seg, g.range(0, 1))));
  // Tape: loops around the block and rail, and a grip wrap on the stick.
  for (const z of [-0.012, 0.012]) {
    const loop: Vec2[] = [[0.0118, -0.0125], [0.0118, 0.002], [-0.0118, 0.002], [-0.0118, -0.0125]];
    add('Accent', extrudeFrontLoop(loop, z - 0.005, z + 0.005));
  }
  const w0 = len * g.range(0.3, 0.45), w1 = w0 + len * g.range(0.25, 0.4);
  add('Accent', lay(lathe([[r * 1.08, w0], [r * 1.14, w0 + 0.002], [r * 1.14, w1 - 0.002], [r * 1.08, w1]], seg)));
  return { hand: [0, -0.008 - len * 0.5 * Math.cos(tilt), -len * 0.5 * Math.sin(tilt)] };
};

export const SIDE_BUILDERS_2: Record<string, AttachmentBuilder> = { strobe, rangefinder, ir, uvlamp, headlamp, torch };
export const UNDERBARREL_BUILDERS_2: Record<string, AttachmentBuilder> = { bipodgrip, barricade, shotgun, skeleton, wrapped };
