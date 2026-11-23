/**
 * Bake simple textures in atlas space (pure TypeScript, no canvas needed).
 *
 *   basecolor  the palette's base colors painted per material slot: a ready
 *              starting point to paint over (sRGB, like glTF baseColorTexture)
 *   id         one flat, distinct color per material slot: the "ID map" that
 *              texturing tools (e.g. Substance Painter) use to mask by part
 *   layout     a UV template for artists: dimmed slot colors with every chart
 *              outlined, on a dark background
 *
 * Filled areas are grown by a few pixels ("dilation") so texture filtering
 * and mipmaps don't pull the background color into the seams.
 */
import type { Weapon } from '../core/weapon.js';
import type { MaterialSlot } from '../types.js';
import { MATERIAL_SLOTS } from '../types.js';
import { Atlas, weaponAtlas } from './atlas.js';

export type BakeMode = 'basecolor' | 'id' | 'layout';

export interface BakeOptions {
  /** Square texture size in pixels. Default 1024. */
  size?: number;
  /** Pixels to grow filled areas by. Default 3. */
  dilate?: number;
}

export interface Image {
  width: number;
  height: number;
  /** RGBA8, top row first. */
  data: Uint8Array;
}

/** Fixed, well-separated ID colors per material slot (stable across weapons). */
export const ID_COLORS: Record<MaterialSlot, string> = {
  Body: '#ff0000',
  Barrel: '#00ff00',
  Grip: '#0000ff',
  Stock: '#ffff00',
  Magazine: '#ff00ff',
  Sight: '#00ffff',
  Trim: '#ff8000',
  Accent: '#8000ff',
  Detail: '#008040',
  Glass: '#80c0ff',
  Emissive: '#ffffff',
};

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Rasterize one triangle with pixel-center sampling; calls `plot(x, y)`. */
function fillTriangle(size: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, plot: (x: number, y: number) => void): void {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-12) return;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
  const s = area > 0 ? 1 : -1;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * s;
      const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * s;
      const w2 = ((ax - px) * (by - py) - (ay - py) * (bx - px)) * s;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) plot(x, y);
    }
  }
}

function drawLine(size: number, x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor(x0 + ((x1 - x0) * i) / steps), y = Math.floor(y0 + ((y1 - y0) * i) / steps);
    if (x >= 0 && y >= 0 && x < size && y < size) plot(x, y);
  }
}

/**
 * Paint every triangle into a slot-index buffer (-1 = empty). Exposed for
 * tests and tools that want their own coloring.
 */
export function rasterizeSlots(weapon: Weapon, size: number, atlas: Atlas = weaponAtlas(weapon)): Int8Array {
  const ids = new Int8Array(size * size).fill(-1);
  for (const c of weapon.components) {
    for (const [slot, geo] of c.geometry) {
      const uv = atlas.uvs.get(geo);
      if (!uv) continue;
      const id = MATERIAL_SLOTS.indexOf(slot);
      const idx = geo.indices;
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 2, b = idx[t + 1] * 2, d = idx[t + 2] * 2;
        fillTriangle(size, uv[a] * size, uv[a + 1] * size, uv[b] * size, uv[b + 1] * size, uv[d] * size, uv[d + 1] * size, (x, y) => {
          ids[y * size + x] = id;
        });
      }
    }
  }
  return ids;
}

/** Grow filled pixels into empty neighbors, `n` times. */
function dilate(ids: Int8Array, size: number, n: number): Int8Array {
  let cur = ids;
  for (let pass = 0; pass < n; pass++) {
    const next = cur.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (cur[i] >= 0) continue;
        let pick = x > 0 ? cur[i - 1] : -1;
        if (pick < 0 && x < size - 1 && cur[i + 1] >= 0) pick = cur[i + 1];
        if (pick < 0 && y > 0 && cur[i - size] >= 0) pick = cur[i - size];
        if (pick < 0 && y < size - 1 && cur[i + size] >= 0) pick = cur[i + size];
        if (pick >= 0) next[i] = pick;
      }
    }
    cur = next;
  }
  return cur;
}

/** Bake one texture of the weapon's atlas. */
export function bakeTexture(weapon: Weapon, mode: BakeMode, opts: BakeOptions = {}): Image {
  const size = opts.size ?? 1024;
  // Always the weapon's own atlas, so the texture matches the exported UVs.
  // Padding is 4 px at 1024, so it scales with the texture size.
  const atlas = weaponAtlas(weapon);
  const raw = rasterizeSlots(weapon, size, atlas);
  const ids = mode === 'layout' ? raw : dilate(raw, size, opts.dilate ?? 3);
  const colors = MATERIAL_SLOTS.map((s) => rgb(mode === 'id' ? ID_COLORS[s] : weapon.palette[s].color));
  const data = new Uint8Array(size * size * 4);
  const bg = mode === 'layout' ? [24, 26, 31] : mode === 'id' ? [0, 0, 0] : [128, 128, 128];
  for (let i = 0; i < size * size; i++) {
    const id = ids[i];
    let c = id >= 0 ? colors[id] : bg;
    if (mode === 'layout' && id >= 0) c = [Math.round(c[0] * 0.45 + 20), Math.round(c[1] * 0.45 + 20), Math.round(c[2] * 0.45 + 20)];
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  }
  if (mode === 'layout') outlineCharts(weapon, atlas, size, data);
  return { width: size, height: size, data };
}

/** Draw the boundary edges of every chart (edges used by one triangle only). */
function outlineCharts(weapon: Weapon, atlas: Atlas, size: number, data: Uint8Array): void {
  for (const c of weapon.components) {
    for (const [slot, geo] of c.geometry) {
      const uv = atlas.uvs.get(geo);
      if (!uv) continue;
      const [r, g, b] = rgb(weapon.palette[slot].color);
      const line = [Math.min(255, r * 0.6 + 110), Math.min(255, g * 0.6 + 110), Math.min(255, b * 0.6 + 110)];
      const count = new Map<string, number>();
      const idx = geo.indices;
      const key = (a: number, b2: number) => (a < b2 ? `${a},${b2}` : `${b2},${a}`);
      for (let t = 0; t < idx.length; t += 3) {
        for (const [a, b2] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
          const k = key(a, b2);
          count.set(k, (count.get(k) ?? 0) + 1);
        }
      }
      for (const [k, n] of count) {
        if (n !== 1) continue;
        const [a, b2] = k.split(',').map(Number);
        drawLine(size, uv[a * 2] * size, uv[a * 2 + 1] * size, uv[b2 * 2] * size, uv[b2 * 2 + 1] * size, (x, y) => {
          const o = (y * size + x) * 4;
          data[o] = line[0];
          data[o + 1] = line[1];
          data[o + 2] = line[2];
        });
      }
    }
  }
}
