/**
 * Geometry kernel.
 *
 * Conventions (match glTF 2.0):
 *   - Units are meters.
 *   - +Y is up, +Z is "forward" (the muzzle points toward +Z), +X is the
 *     weapon's left side.
 *
 * UVs: every builder writes *physical* UVs in meters (unwrapped per part
 * face/band, so texel density is the same everywhere). The exporter scales
 * them by `UV_UNITS_PER_METER`, which makes tiling textures and trim sheets
 * line up across all generated weapons.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export class Geometry {
  positions: number[] = [];
  normals: number[] = [];
  /** Physical UVs, in meters. */
  uvs: number[] = [];
  indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  addVertex(p: Vec3, n: Vec3, uv: Vec2): number {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.uvs.push(uv[0], uv[1]);
    return this.vertexCount - 1;
  }

  /**
   * Add a triangle, flipping its winding if needed so the face points along
   * `facing` (counter-clockwise = front, as glTF expects).
   */
  addTriangle(a: number, b: number, c: number, facing: Vec3): void {
    const pa = this.pos(a), pb = this.pos(b), pc = this.pos(c);
    const n = cross(sub(pb, pa), sub(pc, pa));
    if (dot(n, facing) < 0) this.indices.push(a, c, b);
    else this.indices.push(a, b, c);
  }

  pos(i: number): Vec3 {
    return [this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]];
  }

  /** Append another geometry into this one. */
  merge(other: Geometry): this {
    const base = this.vertexCount;
    this.positions.push(...other.positions);
    this.normals.push(...other.normals);
    this.uvs.push(...other.uvs);
    for (const i of other.indices) this.indices.push(i + base);
    return this;
  }

  /** Apply a rigid transform (rotation + translation + uniform scale). */
  transform(t: Transform): this {
    const m = composeTransform(t);
    const s = t.scale ?? 1;
    for (let i = 0; i < this.vertexCount; i++) {
      const p = this.pos(i);
      const q = applyMat(m, p);
      this.positions[i * 3] = q[0];
      this.positions[i * 3 + 1] = q[1];
      this.positions[i * 3 + 2] = q[2];
      const n: Vec3 = [this.normals[i * 3], this.normals[i * 3 + 1], this.normals[i * 3 + 2]];
      const r = normalize(applyRot(m, n));
      this.normals[i * 3] = r[0];
      this.normals[i * 3 + 1] = r[1];
      this.normals[i * 3 + 2] = r[2];
      this.uvs[i * 2] *= s;
      this.uvs[i * 2 + 1] *= s;
    }
    return this;
  }

  clone(): Geometry {
    const g = new Geometry();
    g.positions = this.positions.slice();
    g.normals = this.normals.slice();
    g.uvs = this.uvs.slice();
    g.indices = this.indices.slice();
    return g;
  }

  bounds(): { min: Vec3; max: Vec3 } {
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], this.positions[i + k]);
        max[k] = Math.max(max[k], this.positions[i + k]);
      }
    }
    return { min, max };
  }
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// ---------------------------------------------------------------------------
// Transforms (column-major 4x4, like glTF)
// ---------------------------------------------------------------------------

export interface Transform {
  /** Translation in meters. */
  t?: Vec3;
  /** Euler rotation in radians, applied X then Y then Z. */
  r?: Vec3;
  /** Uniform scale. */
  scale?: number;
}

type Mat4 = number[];

function composeTransform(tr: Transform): Mat4 {
  const [rx, ry, rz] = tr.r ?? [0, 0, 0];
  const s = tr.scale ?? 1;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx
  const r00 = cz * cy, r01 = cz * sy * sx - sz * cx, r02 = cz * sy * cx + sz * sx;
  const r10 = sz * cy, r11 = sz * sy * sx + cz * cx, r12 = sz * sy * cx - cz * sx;
  const r20 = -sy, r21 = cy * sx, r22 = cy * cx;
  const [tx, ty, tz] = tr.t ?? [0, 0, 0];
  return [
    r00 * s, r10 * s, r20 * s, 0,
    r01 * s, r11 * s, r21 * s, 0,
    r02 * s, r12 * s, r22 * s, 0,
    tx, ty, tz, 1,
  ];
}

function applyMat(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function applyRot(m: Mat4, n: Vec3): Vec3 {
  return [
    m[0] * n[0] + m[4] * n[1] + m[8] * n[2],
    m[1] * n[0] + m[5] * n[1] + m[9] * n[2],
    m[2] * n[0] + m[6] * n[1] + m[10] * n[2],
  ];
}

// ---------------------------------------------------------------------------
// 2D profile helpers
// ---------------------------------------------------------------------------

export function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Return the polygon in counter-clockwise order. */
export function ccw(poly: Vec2[]): Vec2[] {
  return signedArea(poly) < 0 ? poly.slice().reverse() : poly;
}

/** Remove consecutive near-duplicate points (they break bevels and triangulation). */
export function cleanPolygon(poly: Vec2[], eps = 1e-5): Vec2[] {
  const out: Vec2[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > eps) out.push(p);
  }
  while (out.length > 2) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > eps) break;
    out.pop();
  }
  return out;
}

/** Shrink a CCW polygon by `d` (miter offset, clamped so sharp corners stay sane). */
export function insetPolygon(poly: Vec2[], d: number): Vec2[] {
  const n = poly.length;
  return poly.map((p, i) => {
    const prev = poly[(i - 1 + n) % n], next = poly[(i + 1) % n];
    const e1 = norm2([p[0] - prev[0], p[1] - prev[1]]);
    const e2 = norm2([next[0] - p[0], next[1] - p[1]]);
    const n1: Vec2 = [-e1[1], e1[0]]; // inward normal for CCW
    const n2: Vec2 = [-e2[1], e2[0]];
    const m = norm2([n1[0] + n2[0], n1[1] + n2[1]]);
    const cosHalf = Math.max(0.35, m[0] * n1[0] + m[1] * n1[1]);
    const dist = d / cosHalf;
    return [p[0] + m[0] * dist, p[1] + m[1] * dist];
  });
}

function norm2(v: Vec2): Vec2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** Ear-clipping triangulation of a simple polygon. Returns index triples. */
export function triangulate(poly: Vec2[]): number[] {
  const pts = poly;
  const orientation = signedArea(pts) >= 0 ? 1 : -1;
  const idx = pts.map((_, i) => i);
  const tris: number[] = [];
  const isConvex = (a: Vec2, b: Vec2, c: Vec2) =>
    orientation * ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-12;
  const inside = (p: Vec2, a: Vec2, b: Vec2, c: Vec2) => {
    const s1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const s2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
    const s3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
    return orientation > 0 ? s1 >= 0 && s2 >= 0 && s3 >= 0 : s1 <= 0 && s2 <= 0 && s3 <= 0;
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i - 1 + idx.length) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (!isConvex(a, b, c)) continue;
      let blocked = false;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (inside(pts[j], a, b, c)) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push(ia, ib, ic);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      // Degenerate input: fall back to a fan so we never lose the face entirely.
      for (let i = 1; i < idx.length - 1; i++) tris.push(idx[0], idx[i], idx[i + 1]);
      return tris;
    }
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
}

/** Sample a cubic Bezier curve (excluding the start point). */
export function bezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, steps: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Rounded rectangle centered at (cx, cy), counter-clockwise. */
export function roundedRect(cx: number, cy: number, w: number, h: number, r: number, seg: number): Vec2[] {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const out: Vec2[] = [];
  const corners: [number, number, number][] = [
    [cx + w / 2 - r, cy - h / 2 + r, -Math.PI / 2],
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, Math.PI / 2],
    [cx - w / 2 + r, cy - h / 2 + r, Math.PI],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  }
  return cleanPolygon(out);
}

/** Chaikin corner-cutting: softens a closed polygon. */
export function smoothPolygon(poly: Vec2[], iterations: number): Vec2[] {
  let pts = poly;
  for (let k = 0; k < iterations; k++) {
    const out: Vec2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
      out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    pts = out;
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export interface ExtrudeOptions {
  /** Total thickness along the extrusion axis (X). */
  width: number;
  /** Chamfer size on both faces. 0 = hard edges. */
  bevel?: number;
  /** Center of the extrusion along X. */
  x?: number;
}

/**
 * Extrude a *side profile* (points are [z, y], i.e. how the part looks from
 * the side) across the weapon's width (X axis). This is the workhorse:
 * receivers, stocks, grips, magazines and housings are all side profiles.
 */
export function extrudeSide(profile: Vec2[], opts: ExtrudeOptions): Geometry {
  const g = new Geometry();
  const outer = ccw(cleanPolygon(profile));
  const w = opts.width / 2;
  const x0 = opts.x ?? 0;
  const b = Math.min(opts.bevel ?? 0, w * 0.45);
  const inner = b > 0 ? insetPolygon(outer, b) : outer;
  const toP = (p: Vec2, x: number): Vec3 => [x0 + x, p[1], p[0]];

  // Caps
  const tris = triangulate(inner);
  for (const side of [1, -1]) {
    const x = side * w;
    const normal: Vec3 = [side, 0, 0];
    const ids = inner.map((p) => g.addVertex(toP(p, x), normal, [p[0] * side, p[1]]));
    for (let i = 0; i < tris.length; i += 3) g.addTriangle(ids[tris[i]], ids[tris[i + 1]], ids[tris[i + 2]], normal);
  }

  // Side bands: (inner @ +w) -> (outer @ +w-b) -> (outer @ -w+b) -> (inner @ -w)
  const rings: { poly: Vec2[]; x: number }[] =
    b > 0
      ? [
          { poly: inner, x: w },
          { poly: outer, x: w - b },
          { poly: outer, x: -w + b },
          { poly: inner, x: -w },
        ]
      : [
          { poly: outer, x: w },
          { poly: outer, x: -w },
        ];

  const n = outer.length;
  let perimeter = 0;
  const along: number[] = [0];
  for (let i = 0; i < n; i++) {
    const p = outer[i], q = outer[(i + 1) % n];
    perimeter += Math.hypot(q[0] - p[0], q[1] - p[1]);
    along.push(perimeter);
  }

  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = toP(A.poly[i], A.x), a1 = toP(A.poly[j], A.x);
      const b0 = toP(B.poly[i], B.x), b1 = toP(B.poly[j], B.x);
      // Outward normal of this profile edge. For a CCW [z, y] profile the
      // interior is on the left, so the right-hand normal points outward.
      const du = outer[j][0] - outer[i][0], dv = outer[j][1] - outer[i][1];
      const outward = normalize([0, -du, dv]);
      // Chamfer bands also lean toward their own face (+X or -X).
      const lean = b > 0 && r === 0 ? 1 : b > 0 && r === rings.length - 2 ? -1 : 0;
      const expected = normalize(add(outward, [lean, 0, 0]));
      let fn = normalize(cross(sub(a1, a0), sub(b0, a0)));
      if (dot(fn, expected) < 0) fn = scale3(fn, -1);
      const u0 = along[i], u1 = along[i + 1];
      const i0 = g.addVertex(a0, fn, [u0, A.x]);
      const i1 = g.addVertex(a1, fn, [u1, A.x]);
      const i2 = g.addVertex(b1, fn, [u1, B.x]);
      const i3 = g.addVertex(b0, fn, [u0, B.x]);
      g.addTriangle(i0, i1, i2, fn);
      g.addTriangle(i0, i2, i3, fn);
    }
  }
  return g;
}

/** Axis-aligned box centered at `center`, optionally chamfered. */
export function box(center: Vec3, size: Vec3, bevel = 0): Geometry {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const profile: Vec2[] = [
    [cz - sz / 2, cy - sy / 2],
    [cz + sz / 2, cy - sy / 2],
    [cz + sz / 2, cy + sy / 2],
    [cz - sz / 2, cy + sy / 2],
  ];
  if (bevel > 0) {
    const b = Math.min(bevel, sy * 0.45, sz * 0.45);
    const chamfered: Vec2[] = [
      [cz - sz / 2 + b, cy - sy / 2],
      [cz + sz / 2 - b, cy - sy / 2],
      [cz + sz / 2, cy - sy / 2 + b],
      [cz + sz / 2, cy + sy / 2 - b],
      [cz + sz / 2 - b, cy + sy / 2],
      [cz - sz / 2 + b, cy + sy / 2],
      [cz - sz / 2, cy + sy / 2 - b],
      [cz - sz / 2, cy - sy / 2 + b],
    ];
    return extrudeSide(chamfered, { width: sx, bevel: Math.min(b, sx * 0.3), x: cx });
  }
  return extrudeSide(profile, { width: sx, x: cx });
}

/**
 * Lathe: revolve a profile of [radius, z] points around the Z axis.
 * List the outer surface from back (low z) to front. Radius 0 closes caps.
 * Each profile segment gets its own band, so edges along the profile stay
 * crisp while the surface stays smooth around the axis.
 */
export function lathe(profile: Vec2[], segments: number, phase = 0): Geometry {
  const g = new Geometry();
  for (let k = 0; k < profile.length - 1; k++) {
    const [r0, z0] = profile[k];
    const [r1, z1] = profile[k + 1];
    const dr = r1 - r0, dz = z1 - z0;
    const len = Math.hypot(dr, dz);
    if (len < 1e-7) continue;
    const nr = dz / len, nz = -dr / len;
    const v0 = profileLength(profile, k), v1 = v0 + len;
    const ring0: number[] = [], ring1: number[] = [];
    for (let s = 0; s <= segments; s++) {
      const a = phase + (s / segments) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const n: Vec3 = [c * nr, sn * nr, nz];
      const arc = a * Math.max(r0, r1, 0.001);
      ring0.push(g.addVertex([c * r0, sn * r0, z0], n, [arc, v0]));
      ring1.push(g.addVertex([c * r1, sn * r1, z1], n, [arc, v1]));
    }
    for (let s = 0; s < segments; s++) {
      const a = phase + ((s + 0.5) / segments) * Math.PI * 2;
      const facing: Vec3 = [Math.cos(a) * nr, Math.sin(a) * nr, nz];
      g.addTriangle(ring0[s], ring0[s + 1], ring1[s + 1], facing);
      g.addTriangle(ring0[s], ring1[s + 1], ring1[s], facing);
    }
  }
  return g;
}

function profileLength(profile: Vec2[], upTo: number): number {
  let l = 0;
  for (let i = 0; i < upTo; i++) l += Math.hypot(profile[i + 1][0] - profile[i][0], profile[i + 1][1] - profile[i][1]);
  return l;
}

/** Closed cylinder along Z from z0 to z1. */
export function cylinder(radius: number, z0: number, z1: number, segments: number, bevel = 0): Geometry {
  const b = Math.min(bevel, radius * 0.4, Math.abs(z1 - z0) * 0.3);
  const profile: Vec2[] =
    b > 0
      ? [[0, z0], [radius - b, z0], [radius, z0 + b], [radius, z1 - b], [radius - b, z1], [0, z1]]
      : [[0, z0], [radius, z0], [radius, z1], [0, z1]];
  return lathe(profile, segments);
}

/** Hollow tube along Z (a barrel with a visible bore). */
export function tube(outer: number, inner: number, z0: number, z1: number, segments: number): Geometry {
  return lathe(
    [
      [inner, z0],
      [outer, z0],
      [outer, z1],
      [inner, z1],
      [inner, z0],
    ],
    segments,
  );
}

/** Torus-like ring around Z (a lathe of a small circle). */
export function ring(majorRadius: number, minorRadius: number, z: number, segments: number, minorSegments = 6): Geometry {
  const profile: Vec2[] = [];
  for (let i = 0; i <= minorSegments; i++) {
    const a = -Math.PI / 2 + (i / minorSegments) * Math.PI * 2;
    profile.push([majorRadius + Math.cos(a) * minorRadius, z + Math.sin(a) * minorRadius]);
  }
  // The circle is traversed counter-clockwise in (r, z), so each band's
  // normal already faces away from the tube center; smooth them radially.
  const g = lathe(profile, segments);
  for (let i = 0; i < g.vertexCount; i++) {
    const p = g.pos(i);
    const ang = Math.atan2(p[1], p[0]);
    const center: Vec3 = [Math.cos(ang) * majorRadius, Math.sin(ang) * majorRadius, z];
    const n = normalize(sub(p, center));
    g.normals[i * 3] = n[0];
    g.normals[i * 3 + 1] = n[1];
    g.normals[i * 3 + 2] = n[2];
  }
  return g;
}

/** Small dome (rivet, bolt head, gem) facing +Z, centered at origin. */
export function dome(radius: number, height: number, segments: number, rings = 3): Geometry {
  const profile: Vec2[] = [[0, 0], [radius, 0]];
  for (let i = 1; i <= rings; i++) {
    const a = (i / rings) * (Math.PI / 2);
    profile.push([Math.cos(a) * radius, Math.sin(a) * height]);
  }
  profile[profile.length - 1] = [0, height];
  return lathe(profile, segments);
}

/** Rotate a Z-axis-built part so its axis points along +X (sideways) or +Y (up). */
export const AXIS_X: Vec3 = [0, Math.PI / 2, 0];
export const AXIS_Y: Vec3 = [-Math.PI / 2, 0, 0];
