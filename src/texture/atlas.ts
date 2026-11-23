/**
 * Texture atlas: a second, non-overlapping UV layout for the whole weapon.
 *
 * Builders write *physical* UVs (meters) that tile nicely but overlap. For
 * hand painting, baking (AO, lightmaps) or a unique texture set, every
 * surface needs its own spot. This pass:
 *
 *   1. splits each (component, material slot) mesh into charts: triangles
 *      connected through shared vertices (builders already cut seams by
 *      duplicating vertices, so every chart unwraps without folds);
 *   2. measures each chart's bounding box in meters (texel density stays
 *      uniform across the weapon, because the source UVs are physical);
 *   3. packs all charts into one square with shelf packing, rotating tall
 *      charts flat, keeping `padding` texels between charts at `size`;
 *   4. returns new 0..1 UVs per mesh.
 *
 * Pure and deterministic: the same weapon always gives the same layout.
 */
import type { Geometry } from '../core/geometry.js';
import type { Weapon } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';

export interface AtlasOptions {
  /** Texture size the padding is measured against (pixels). Default 1024. */
  size?: number;
  /** Gap between charts in pixels at `size`. Default 4. */
  padding?: number;
}

export interface Atlas {
  /** Atlas UVs (0..1, glTF orientation: v grows downward) for each mesh. */
  uvs: Map<Geometry, Float32Array>;
  /** Number of charts (UV islands). */
  charts: number;
  /** Share of the square covered by chart bounding boxes (0..1). */
  coverage: number;
  /** Atlas UV units per meter: texels per meter = uvPerMeter × texture size. */
  uvPerMeter: number;
  size: number;
  padding: number;
}

interface Chart {
  geo: Geometry;
  verts: number[];
  minU: number;
  minV: number;
  w: number;
  h: number;
  /** Preferred orientation: lying flat (rotated) when taller than wide. */
  flat: boolean;
  rotated: boolean;
  x: number;
  y: number;
}

/** Union-find over a mesh's vertices; returns one vertex list per chart. */
function chartsOf(geo: Geometry): number[][] {
  const n = geo.vertexCount;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const idx = geo.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]);
    if (b !== a) parent[b] = a;
    if (c !== a && c !== b) parent[find(c)] = a;
  }
  const used = new Uint8Array(n);
  for (const i of idx) used[i] = 1;
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (!used[i]) continue;
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(i);
  }
  return [...groups.values()];
}

/**
 * Skyline (bottom-left) packing into a strip of width `width`: each chart
 * goes where its top edge ends up lowest, trying both orientations. Charts
 * are inflated by `gap`. Returns the used height.
 */
function skylinePack(charts: Chart[], width: number, gap: number): number {
  // Skyline segments: [x, y, w], sorted by x, covering [0, width).
  let sky: [number, number, number][] = [[0, 0, width]];
  let top = 0;
  for (const c of charts) {
    let bestTop = Infinity, bestX = 0, bestY = 0, bestRot = c.flat;
    for (const rot of [c.flat, !c.flat]) {
      const rw = (rot ? c.h : c.w) + gap, rh = (rot ? c.w : c.h) + gap;
      if (rw > width + 1e-9) continue;
      for (let i = 0; i < sky.length; i++) {
        const x = sky[i][0];
        if (x + rw > width + 1e-9) break;
        // Highest skyline under [x, x + rw); give up once it can't win.
        let y = 0;
        const limit = bestTop - rh;
        for (let j = i; j < sky.length && sky[j][0] < x + rw - 1e-12; j++) {
          if (sky[j][1] > y) y = sky[j][1];
          if (y > limit) break;
        }
        const t = y + rh;
        if (t < bestTop - 1e-12 || (t < bestTop + 1e-12 && x < bestX)) {
          bestTop = t;
          bestX = x;
          bestY = y;
          bestRot = rot;
        }
      }
    }
    if (bestTop === Infinity) throw new Error('Atlas chart wider than the atlas');
    c.rotated = bestRot;
    c.x = bestX;
    c.y = bestY;
    const rw = (bestRot ? c.h : c.w) + gap;
    top = Math.max(top, bestTop);
    // Insert the new segment and trim the ones it covers.
    const x0 = bestX, x1 = bestX + rw;
    const next: [number, number, number][] = [];
    for (const [sx, sy, sw] of sky) {
      const e = sx + sw;
      if (e <= x0 || sx >= x1) next.push([sx, sy, sw]);
      else {
        if (sx < x0) next.push([sx, sy, x0 - sx]);
        if (e > x1) next.push([x1, sy, e - x1]);
      }
    }
    next.push([x0, bestTop, rw]);
    next.sort((p, q) => p[0] - q[0]);
    // Merge neighbors of equal height.
    sky = [];
    for (const seg of next) {
      const last = sky[sky.length - 1];
      if (last && Math.abs(last[1] - seg[1]) < 1e-12 && Math.abs(last[0] + last[2] - seg[0]) < 1e-9) last[2] += seg[2];
      else sky.push(seg);
    }
  }
  return top;
}

export function buildAtlas(weapon: Weapon, opts: AtlasOptions = {}): Atlas {
  const size = opts.size ?? 1024, padding = opts.padding ?? 4;
  const charts: Chart[] = [];
  const meshes: Geometry[] = [];
  for (const c of weapon.components) {
    for (const [, geo] of [...c.geometry.entries()].sort((a, b) => slotOrder(a[0]) - slotOrder(b[0]))) {
      if (!geo.indices.length) continue;
      meshes.push(geo);
      for (const verts of chartsOf(geo)) {
        let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
        for (const i of verts) {
          const u = geo.uvs[i * 2], v = geo.uvs[i * 2 + 1];
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        const w = Math.max(maxU - minU, 1e-5), h = Math.max(maxV - minV, 1e-5);
        charts.push({ geo, verts, minU, minV, w, h, flat: h > w, rotated: h > w, x: 0, y: 0 });
      }
    }
  }

  // Tallest (in the flat orientation) first; ties by width, then creation order.
  const height = (c: Chart) => Math.min(c.w, c.h);
  const width = (c: Chart) => Math.max(c.w, c.h);
  charts.sort((a, b) => height(b) - height(a) || width(b) - width(a));

  const area = charts.reduce((s, c) => s + c.w * c.h, 0) || 1e-6;
  const longest = charts.reduce((m, c) => Math.max(m, c.w, c.h), 0);
  // Padding is in texels, but texel size depends on the final scale, which
  // depends on the packing. Two rounds settle it: guess a scale, try a few
  // strip widths around the ideal square, keep the smallest square side.
  let uvPerMeter = Math.sqrt(0.6 / area);
  let gap = 0, bestWidth = 0, side = Infinity;
  for (let iter = 0; iter < 2; iter++) {
    gap = padding / size / uvPerMeter;
    const padded = charts.reduce((s, c) => s + (c.w + gap) * (c.h + gap), 0);
    const widths = iter === 0 ? [1.06, 1.14, 1.24].map((f) => Math.sqrt(padded) * f) : [0.97, 1, 1.03].map((f) => bestWidth * f);
    side = Infinity;
    for (const w0 of widths) {
      const width = Math.max(longest + gap, w0);
      const s = Math.max(width + gap, skylinePack(charts, width, gap) + gap);
      if (s < side) {
        side = s;
        bestWidth = width;
      }
    }
    uvPerMeter = 1 / side;
  }
  // Final layout with the winning width. The gap came from the previous
  // round's scale, which is within a hair of the final one.
  skylinePack(charts, bestWidth, gap);

  const uvs = new Map<Geometry, Float32Array>();
  for (const g of meshes) uvs.set(g, new Float32Array(g.vertexCount * 2));
  let covered = 0;
  for (const c of charts) {
    const out = uvs.get(c.geo)!;
    covered += c.w * c.h;
    for (const i of c.verts) {
      const u = c.geo.uvs[i * 2] - c.minU, v = c.geo.uvs[i * 2 + 1] - c.minV;
      // Rotating 90° maps (u, v) -> (v, w - u): keeps the chart unmirrored.
      const lu = c.rotated ? v : u, lv = c.rotated ? c.w - u : v;
      out[i * 2] = (gap + c.x + lu) * uvPerMeter;
      out[i * 2 + 1] = (gap + c.y + lv) * uvPerMeter;
    }
  }
  return { uvs, charts: charts.length, coverage: covered * uvPerMeter * uvPerMeter, uvPerMeter, size, padding };
}

const ORDER: MaterialSlot[] = ['Body', 'Barrel', 'Grip', 'Stock', 'Magazine', 'Sight', 'Trim', 'Accent', 'Detail', 'Glass', 'Emissive'];
const slotOrder = (s: MaterialSlot) => ORDER.indexOf(s);

const cache = new WeakMap<Weapon, Atlas>();

/** The weapon's atlas with default options (computed once, then cached). */
export function weaponAtlas(weapon: Weapon): Atlas {
  if (!weapon.finalized) throw new Error('Weapon must be finalized before building its atlas');
  let a = cache.get(weapon);
  if (!a) cache.set(weapon, (a = buildAtlas(weapon)));
  return a;
}
