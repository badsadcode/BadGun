/**
 * More muzzle devices, with silhouettes of their own (not just longer or
 * fatter versions of the old ones):
 *
 *   birdcage   slotted cage flash hider (closed bottom)
 *   tribrake   flat-topped slab brake with three side ports
 *   flashcone  plain conical flash hider (WW2-era carbines)
 *   shroud     square-section suppressor
 *   boxbrake   huge open-window rectangular brake (heavy rifles)
 *   oilcan     survivor: an oil filter on a pipe coupling, hose clamps
 *   baffle     sci-fi: stacked baffle discs with a glowing core between them
 *   dragon     fantasy: carved beast head, the bore through its jaws
 *   flute      steampunk: long brass horn with trumpet valves and a flare
 *   vented     cyberpunk: angular vented block
 *
 * Same signature as every MuzzleBuilder: `(ctx, comp, a, rb) => length`,
 * the device starts at the barrel tip `a` and extends toward +Z. Sizes scale
 * with the barrel radius `rb`, so the same device fits a pistol or a rifle.
 * Shape genes come from `ctx.rng('muzzle:<name>-look')` only, so a standalone
 * muzzle matches the mounted one.
 */
import { Vec2, box, cylinder, dome, extrudeFront, extrudeSide, lathe, ring, rod, roundedRect, tube } from '../core/geometry.js';
import type { Component } from '../core/weapon.js';
import { BuildContext, put } from './context.js';

type Muzzle = (ctx: BuildContext, c: Component, a: number, rb: number) => number;

/** A plain threaded collar where the device screws onto the barrel. */
function collar(ctx: BuildContext, c: Component, a: number, rb: number, R: number, len: number, slot: 'Barrel' | 'Trim' = 'Barrel'): void {
  put(ctx, c, slot, lathe([[rb * 0.5, a - 0.004], [R, a - 0.004], [R, a + len], [rb * 0.5, a + len]], ctx.seg(0.9)));
}

/** A thin box laid on a round surface at angle `ang` (radius r), long along Z. */
function slat(w: number, t: number, len: number, r: number, ang: number, z: number) {
  return { geo: box([0, 0, 0], [w, t, len]), t: [Math.cos(ang) * r, Math.sin(ang) * r, z] as [number, number, number], r: [0, 0, ang - Math.PI / 2] as [number, number, number] };
}

/** Slotted cage flash hider: bars between a collar and a front ring, the bottom left closed. */
const birdcage: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:birdcage-look');
  const R = rb * g.range(1.4, 1.6), len = 0.048 + ctx.p.length * 0.01;
  const n = g.pick([5, 6, 6, 8]);
  const seg = ctx.seg(0.9);
  put(ctx, c, 'Barrel', lathe([[rb * 0.5, a - 0.004], [R * 1.04, a - 0.004], [R * 1.04, a + 0.011], [R, a + 0.014], [rb * 0.5, a + 0.014]], seg));
  // Wrench flats on the collar.
  for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * R * 1.03, 0, a + 0.004], [0.0012, R * 0.9, 0.009]));
  const zf = a + len;
  put(ctx, c, 'Barrel', tube(R, R * 0.74, zf - 0.008, zf, seg));
  // Dark inside, seen through the slots.
  put(ctx, c, 'Detail', tube(R * 0.76, rb * 0.5, a + 0.012, zf - 0.006, seg));
  const bl = zf - 0.008 - (a + 0.014) + 0.002, bz = (a + 0.014 + zf - 0.008) / 2;
  const w = ((2 * Math.PI * R) / n) * 0.5;
  for (let i = 0; i < n; i++) {
    const ang = Math.PI / 2 + (i / n) * Math.PI * 2;
    // The bar nearest the bottom is wide: a closed bottom keeps dust down.
    const bottom = Math.abs(Math.sin(ang) + 1) < 0.35;
    const s = slat(bottom ? w * 2.6 : w, R * 0.26, bl, R * 0.87, ang, bz);
    put(ctx, c, 'Barrel', s.geo, s.t, s.r);
  }
  // Ported crown: small notches on the front ring.
  if (g.chance(0.5)) for (let i = 0; i < n; i++) {
    const ang = Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    const s = slat(0.0018, R * 0.2, 0.0035, R * 0.9, ang, zf + 0.0005);
    put(ctx, c, 'Detail', s.geo, s.t, s.r);
  }
  return len;
};

/** Flat-topped slab brake: three D-shaped chunks with open ports between them. */
const tribrake: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:tribrake-look');
  const hw = rb * g.range(1.7, 2.0), top = rb * g.range(1.15, 1.45);
  const arc = Math.max(4, ctx.seg(0.35));
  const prof: Vec2[] = [[-hw, top], [-hw, 0]];
  for (let i = 1; i < arc; i++) {
    const t = Math.PI + (i / arc) * Math.PI;
    prof.push([Math.cos(t) * hw, Math.sin(t) * hw]);
  }
  prof.push([hw, 0], [hw, top]);
  const ports = g.pick([3, 3, 2]);
  const chunk = 0.012, gap = g.range(0.007, 0.01);
  let z = a - 0.004;
  put(ctx, c, 'Barrel', extrudeFront(prof, z, z + chunk + 0.004, ctx.bevel(0.0015)));
  z += chunk + 0.004;
  const z0 = z;
  for (let i = 0; i < ports; i++) {
    z += gap;
    put(ctx, c, 'Barrel', extrudeFront(prof, z, z + chunk * (i === ports - 1 ? 1.3 : 0.8), ctx.bevel(0.0015)));
    z += chunk * (i === ports - 1 ? 1.3 : 0.8);
  }
  // Flat top strap closing the ports from above; bore core seen through the ports.
  put(ctx, c, 'Barrel', box([0, top - 0.002, (a + z) / 2], [hw * 1.7, 0.004, z - a], ctx.bevel(0.001)));
  put(ctx, c, 'Detail', cylinder(rb * 1.15, z0 - 0.001, z - 0.002, ctx.seg(0.8)));
  put(ctx, c, 'Detail', cylinder(rb * 0.55, z - 0.0015, z + 0.0004, ctx.seg(0.6)));
  return z - a;
};

/** Plain conical flash hider, flaring forward, with a bayonet lug underneath. */
const flashcone: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:flashcone-look');
  const len = 0.045 + g.range(0, 0.02), flare = rb * g.range(2.2, 2.7);
  const seg = ctx.seg(1);
  put(ctx, c, 'Barrel', lathe([
    [rb * 0.5, a - 0.004], [rb * 1.35, a - 0.004], [rb * 1.35, a + 0.012], [flare, a + len], [flare - 0.0015, a + len + 0.0005],
    [flare - 0.003, a + len], [rb * 1.05, a + 0.014], [rb * 0.5, a + 0.014],
  ], seg));
  put(ctx, c, 'Trim', ring(rb * 1.38, 0.0018, a + 0.004, seg, 6));
  if (g.chance(0.6)) {
    // Bayonet lug under the collar.
    put(ctx, c, 'Detail', box([0, -rb * 1.35 - 0.003, a + 0.004], [0.006, 0.007, 0.016], ctx.bevel(0.001)));
  }
  return len;
};

/** Square-section suppressor with grooved faces and a front cap. */
const shroud: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:shroud-look');
  const S = rb * (2.0 + ctx.p.bulk * 0.4), len = 0.12 + ctx.p.length * 0.05;
  const tall = g.range(1, 1.25);
  collar(ctx, c, a, rb, rb * 1.4, 0.016);
  const sec = roundedRect(0, 0, S * 2, S * 2 * tall, S * g.range(0.15, 0.4), 2);
  put(ctx, c, 'Barrel', extrudeFront(sec, a + 0.012, a + len - 0.005, ctx.bevel(0.003)));
  // A slightly bigger rear band and a front cap.
  put(ctx, c, 'Trim', extrudeFront(roundedRect(0, 0, S * 2 + 0.002, S * 2 * tall + 0.002, S * 0.3, 2), a + 0.014, a + 0.024, ctx.bevel(0.001)));
  put(ctx, c, 'Trim', extrudeFront(roundedRect(0, 0, S * 1.7, S * 1.7 * tall, S * 0.3, 2), a + len - 0.006, a + len, ctx.bevel(0.0015)));
  put(ctx, c, 'Detail', cylinder(rb * 0.6, a + len - 0.0004, a + len + 0.0004, ctx.seg(0.6)));
  // Long grooves on the side and top faces.
  const grooves = g.int(1, 3);
  for (let i = 0; i < grooves; i++) {
    const o = (i - (grooves - 1) / 2) * S * 0.45;
    const gl = len - 0.05;
    for (const s of [1, -1]) put(ctx, c, 'Detail', box([s * (S + 0.0002), o * tall, a + 0.028 + gl / 2], [0.001, 0.0022, gl]));
    put(ctx, c, 'Detail', box([o, S * tall + 0.0002, a + 0.028 + gl / 2], [0.0022, 0.001, gl]));
  }
  return len;
};

/** Huge open-window brake: rear plate, baffle and front plate tied by top and bottom straps. */
const boxbrake: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:boxbrake-look');
  const W = rb * g.range(4, 4.8), H = rb * g.range(2.6, 3.2), len = 0.065 + ctx.p.bulk * 0.02;
  const e = ctx.bevel(0.002);
  collar(ctx, c, a, rb, rb * 1.4, 0.012);
  const z0 = a + 0.008, z1 = a + 0.008 + len;
  const strap = H * 0.2;
  for (const s of [1, -1]) put(ctx, c, 'Barrel', box([0, s * (H / 2 - strap / 2), (z0 + z1) / 2], [W, strap, len], e));
  const plates = g.pick([3, 3, 4]);
  for (let i = 0; i < plates; i++) {
    const t = i / (plates - 1);
    const thick = i === 0 ? 0.01 : i === plates - 1 ? 0.012 : 0.007;
    const z = z0 + thick / 2 + t * (len - thick);
    put(ctx, c, 'Barrel', box([0, 0, z], [W * (i === 0 || i === plates - 1 ? 1 : 0.94), H - strap * 0.4, thick], e));
  }
  // Bore through the plates; the front shows a dark exit.
  put(ctx, c, 'Detail', cylinder(rb * 0.9, z0, z1 - 0.004, ctx.seg(0.8)));
  put(ctx, c, 'Detail', cylinder(rb * 0.75, z1 - 0.001, z1 + 0.0004, ctx.seg(0.8)));
  // Bolts through the straps.
  for (const z of [z0 + 0.006, z1 - 0.007]) for (const x of [W * 0.35, -W * 0.35]) {
    put(ctx, c, 'Trim', cylinder(0.0024, 0, 0.0015, 6), [x, H / 2, z], [-Math.PI / 2, 0, 0]);
  }
  return z1 - a;
};

/** Survivor: an automotive oil filter on a pipe coupling, held by hose clamps. */
const oilcan: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:oilcan-look');
  const R = Math.max(rb * 2.6, 0.026) * g.range(1, 1.2), len = 0.085 + g.range(0, 0.035);
  const seg = ctx.seg(1.2);
  const Rc = rb * 1.55, zs = a + 0.022;
  // Pipe coupling over the barrel, two hose clamps with screw housings.
  put(ctx, c, 'Accent', lathe([[rb * 1.0, a - 0.02], [Rc, a - 0.02], [Rc, zs + 0.004], [rb * 1.0, zs + 0.004]], seg));
  for (const z of [a - 0.012, a + 0.008]) {
    put(ctx, c, 'Trim', lathe([[Rc, z - 0.003], [Rc + 0.0012, z - 0.0025], [Rc + 0.0012, z + 0.0025], [Rc, z + 0.003]], seg));
    put(ctx, c, 'Trim', box([0, Rc + 0.002, z], [0.006, 0.004, 0.008]));
  }
  // Filter can: base plate with holes, painted body, domed closed end.
  const zb = zs;
  put(ctx, c, 'Trim', lathe([[rb * 0.9, zb], [R * 0.96, zb], [R * 1.02, zb + 0.004], [R * 1.02, zb + 0.008], [R * 0.98, zb + 0.009]], seg));
  put(ctx, c, 'Magazine', lathe([
    [R * 0.98, zb + 0.008], [R, zb + 0.012], [R, zb + len - 0.014], [R * 0.93, zb + len - 0.004], [R * 0.7, zb + len], [rb * 0.7, zb + len],
  ], seg));
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.3;
    put(ctx, c, 'Detail', cylinder(R * 0.1, zb - 0.0006, zb + 0.0004, 6), [Math.cos(ang) * R * 0.6, Math.sin(ang) * R * 0.6, 0]);
  }
  // Wrench grip flutes near the closed end.
  const flutes = g.pick([12, 16, 20]);
  for (let i = 0; i < flutes; i++) {
    const ang = (i / flutes) * Math.PI * 2;
    const s = slat(0.0028, 0.0018, 0.016, R + 0.0006, ang, zb + len - 0.024);
    put(ctx, c, 'Trim', s.geo, s.t, s.r);
  }
  // Label band, and a third hose clamp holding the can on.
  put(ctx, c, 'Accent', lathe([[R + 0.0004, zb + 0.02], [R + 0.0004, zb + 0.02 + len * 0.35]], seg));
  if (g.chance(0.6)) {
    const z = zb + 0.016;
    put(ctx, c, 'Trim', lathe([[R, z - 0.003], [R + 0.0014, z - 0.0025], [R + 0.0014, z + 0.0025], [R, z + 0.003]], seg));
    put(ctx, c, 'Trim', box([0, R + 0.0025, z], [0.007, 0.005, 0.009]));
  }
  return zb + len - a;
};

/** Sci-fi: a stack of baffle discs on spines, the glowing core showing in the gaps. */
const baffle: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:baffle-look');
  const sides = g.pick([6, 8, ctx.seg(1)]);
  const phase = sides <= 8 ? Math.PI / sides : 0;
  const n = g.int(4, 7), th = 0.0055, gap = g.range(0.004, 0.0065);
  const R = rb * (2.0 + ctx.p.bulk * 0.4);
  const taper = g.pick([0, 0.25, -0.2]);
  const core: 'Emissive' | 'Detail' = ctx.style.traits.glow ? 'Emissive' : 'Detail';
  collar(ctx, c, a, rb, rb * 1.5, 0.012, 'Trim');
  let z = a + 0.012;
  const zc0 = z;
  for (let i = 0; i < n; i++) {
    const r = R * (1 - taper * (i / Math.max(1, n - 1)));
    put(ctx, c, 'Barrel', lathe([[rb * 1.2, z], [r * 0.92, z], [r, z + 0.0015], [r, z + th - 0.0015], [r * 0.92, z + th], [rb * 1.2, z + th]], sides, phase));
    z += th + (i < n - 1 ? gap : 0);
  }
  put(ctx, c, core, cylinder(rb * 1.25, zc0, z, ctx.seg(0.8)));
  // Spines holding the stack together.
  const spines = sides === 6 ? 3 : 4;
  for (let i = 0; i < spines; i++) {
    const ang = Math.PI / 2 + (i / spines) * Math.PI * 2;
    const rr = R * (1 - Math.max(0, taper)) * 0.88;
    const s = slat(0.0035, 0.004, z - zc0, rr, ang, (zc0 + z) / 2);
    put(ctx, c, 'Trim', s.geo, s.t, s.r);
  }
  // Front cap with a nozzle.
  const capR = R * (1 - taper) * 0.85;
  put(ctx, c, 'Trim', lathe([[rb * 1.2, z], [capR, z], [capR, z + 0.006], [rb * 1.3, z + 0.012], [rb * 0.7, z + 0.012]], sides, phase));
  put(ctx, c, core, cylinder(rb * 0.7, z + 0.0115, z + 0.0125, ctx.seg(0.6)));
  return z + 0.012 - a;
};

/** Fantasy: a carved beast head; the shot leaves through its open jaws. */
const dragon: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:dragon-look');
  const k = rb * g.range(0.95, 1.15);
  const W = rb * 3.0, L = 0.075 + ctx.p.ornament * 0.012;
  const e = ctx.bevel(0.002);
  const z = (t: number) => a + t * L;
  // Neck collar with a band.
  put(ctx, c, 'Trim', lathe([[rb * 0.5, a - 0.006], [rb * 1.6, a - 0.006], [rb * 1.7, a + 0.012], [rb * 1.4, a + 0.02], [rb * 0.5, a + 0.02]], ctx.seg(0.9)));
  put(ctx, c, 'Accent', ring(rb * 1.62, 0.0018, a - 0.001, ctx.seg(0.9), 5));
  // Skull and upper jaw.
  const snub = g.range(0.85, 1.15);
  put(ctx, c, 'Trim', extrudeSide([
    [z(0.08), k * 1.0], [z(0.1), k * 2.0], [z(0.28), k * 2.6], [z(0.45), k * 2.7], [z(0.56), k * 2.15], [z(0.86 * snub), k * 1.75],
    [z(1.0), k * 1.3], [z(0.98), k * 0.85], [z(0.75), k * 0.95], [z(0.42), k * 0.75], [z(0.25), k * 0.6],
  ], { width: W, bevel: e }));
  // Lower jaw, hanging open.
  const gape = g.range(0.9, 1.4);
  put(ctx, c, 'Trim', extrudeSide([
    [z(0.08), -k * 1.0], [z(0.3), -k * 0.65], [z(0.88), -k * 0.95 * gape], [z(0.93), -k * 1.35 * gape], [z(0.6), -k * 1.6 * gape], [z(0.25), -k * 1.9], [z(0.08), -k * 1.6],
  ], { width: W * 0.86, bevel: e }));
  // Dark throat between the jaws.
  put(ctx, c, 'Detail', box([0, 0, z(0.3)], [W * 0.7, k * 1.5, L * 0.3]));
  // Fangs.
  for (const t of [0.62, 0.84]) for (const s of [1, -1]) {
    put(ctx, c, 'Accent', extrudeSide([[z(t) - 0.003, k * 0.95], [z(t) + 0.003, k * 0.95], [z(t), k * 0.95 - 0.006]], { width: 0.0025, x: s * W * 0.32 }));
    put(ctx, c, 'Accent', extrudeSide([[z(t) - 0.0025, -k * 1.0 * gape], [z(t) + 0.0025, -k * 1.0 * gape], [z(t), -k * gape + 0.005]], { width: 0.0022, x: s * W * 0.28 }));
  }
  // Glowing eyes on both sides of the brow.
  const eye: 'Emissive' | 'Accent' = ctx.style.traits.magic || ctx.style.traits.glow ? 'Emissive' : 'Accent';
  for (const s of [1, -1]) put(ctx, c, eye, dome(k * 0.38, k * 0.22, Math.max(6, ctx.seg(0.4)), 2), [s * W / 2, k * 2.0, z(0.48)], [0, (s * Math.PI) / 2, 0]);
  // Horns sweeping back.
  const horn = g.range(0.9, 1.3);
  for (const s of [1, -1]) {
    const p0: [number, number, number] = [s * W * 0.3, k * 2.4, z(0.3)];
    const p1: [number, number, number] = [s * W * 0.48, k * (2.4 + 1.1 * horn), z(0.3) - 0.016 * horn];
    const p2: [number, number, number] = [s * W * 0.56, k * (2.6 + 1.5 * horn), z(0.3) - 0.034 * horn];
    put(ctx, c, 'Accent', rod(p0, p1, k * 0.38, 6));
    put(ctx, c, 'Accent', rod(p1, p2, k * 0.24, 6));
  }
  return L;
};

/** Steampunk: a long brass horn with trumpet valves, a tuning loop and a flared bell. */
const flute: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:flute-look');
  const R = rb * 1.25, straight = 0.06 + g.range(0, 0.025), flare = 0.04 + ctx.p.ornament * 0.015;
  const lip = rb * g.range(2.6, 3.4);
  const seg = ctx.seg(1);
  const zf = a + straight;
  const out: Vec2[] = [[rb * 0.5, a - 0.004], [R, a - 0.004], [R, zf]];
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    out.push([R + (lip - R) * Math.pow(t, 2.6), zf + flare * t]);
  }
  out.push([lip, zf + flare + 0.002], [lip - 0.0025, zf + flare + 0.002]);
  for (let i = 7; i >= 1; i--) {
    const t = i / 7;
    out.push([R * 0.8 + (lip - 0.003 - R * 0.8) * Math.pow(t, 2.6), zf + flare * t]);
  }
  out.push([R * 0.8, zf - 0.01]);
  put(ctx, c, 'Trim', lathe(out, seg));
  for (const z of [a + 0.004, zf - 0.004]) put(ctx, c, 'Accent', ring(R * 1.05, 0.0018, z, seg, 6));
  // Piston valves on top.
  const valves = g.int(2, 3);
  const vs = straight * 0.6 / valves;
  for (let i = 0; i < valves; i++) {
    const vz = a + 0.016 + i * vs;
    const vr = rb * 0.62, h = rb * 2.2;
    put(ctx, c, 'Trim', cylinder(vr, 0, R * 0.6 + h, Math.max(6, ctx.seg(0.6))), [0, 0, vz], [-Math.PI / 2, 0, 0]);
    put(ctx, c, 'Accent', cylinder(vr * 1.2, R * 0.6 + h, R * 0.6 + h + 0.003, Math.max(6, ctx.seg(0.6))), [0, 0, vz], [-Math.PI / 2, 0, 0]);
    put(ctx, c, 'Accent', dome(vr * 1.1, vr * 0.8, Math.max(6, ctx.seg(0.6)), 2), [0, R * 0.6 + h + 0.003, vz], [-Math.PI / 2, 0, 0]);
  }
  // Tuning loop underneath.
  const ly = -R - rb * g.range(1.4, 2.2), lz0 = a + 0.012, lz1 = a + 0.012 + straight * 0.5;
  const lr = rb * 0.45;
  put(ctx, c, 'Trim', rod([0, -R * 0.6, lz0], [0, ly, lz0], lr, 6));
  put(ctx, c, 'Trim', rod([0, ly, lz0 - lr], [0, ly, lz1 + lr], lr, 6));
  put(ctx, c, 'Trim', rod([0, ly, lz1], [0, -R * 0.6, lz1], lr, 6));
  return straight + flare + 0.002;
};

/** Cyberpunk: an angular vented block with slanted side vents and top slots. */
const vented: Muzzle = (ctx, c, a, rb) => {
  const g = ctx.rng('muzzle:vented-look');
  const W = rb * g.range(2.8, 3.4), L = 0.05 + g.range(0, 0.02);
  const top = rb * g.range(1.6, 2.1), bot = -rb * g.range(1.3, 1.7);
  const e = ctx.bevel(0.0015);
  const nose = g.pick(['wedge', 'chisel', 'step']);
  const prof: Vec2[] =
    nose === 'wedge'
      ? [[a - 0.004, bot], [a + L * 0.8, bot], [a + L, bot * 0.4], [a + L, top * 0.45], [a + L * 0.75, top], [a + 0.004, top], [a - 0.004, top * 0.6]]
      : nose === 'chisel'
        ? [[a - 0.004, bot * 0.7], [a + 0.01, bot], [a + L, bot * 0.55], [a + L, top * 0.6], [a + L * 0.9, top], [a - 0.004, top]]
        : [[a - 0.004, bot], [a + L, bot], [a + L, top * 0.35], [a + L * 0.62, top * 0.35], [a + L * 0.62, top], [a - 0.004, top]];
  put(ctx, c, 'Barrel', extrudeSide(prof, { width: W, bevel: e }));
  // Slanted side vents.
  const vents = g.int(3, 5), lean = g.pick([0.5, -0.5, 0]);
  const glow: 'Emissive' | 'Detail' = ctx.style.traits.glow || ctx.style.traits.cyber ? 'Emissive' : 'Detail';
  for (let i = 0; i < vents; i++) {
    const vz = a + 0.012 + (i / Math.max(1, vents - 1)) * (L * 0.55);
    for (const s of [1, -1]) put(ctx, c, i === 0 ? glow : 'Detail', box([0, 0, 0], [0.0012, (top - bot) * 0.5, 0.0035]), [s * (W / 2 + 0.0002), (top + bot) * 0.25, vz], [lean, 0, 0]);
  }
  // Top slots.
  const slots = g.int(2, 4);
  for (let i = 0; i < slots; i++) put(ctx, c, 'Detail', box([0, top + 0.0002, a + 0.01 + i * 0.008], [W * 0.6, 0.001, 0.0035]));
  // Muzzle exit.
  put(ctx, c, 'Detail', cylinder(rb * 0.75, a + L - 0.001, a + L + 0.0004, ctx.seg(0.7)));
  return L;
};

export const MUZZLES_2: Record<string, Muzzle> = { birdcage, tribrake, flashcone, shroud, boxbrake, oilcan, baffle, dragon, flute, vented };
