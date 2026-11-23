/**
 * Material palettes: style-appropriate PBR defaults, recolor overrides and
 * wear. Everything here works on the 11 semantic slots, so recoloring never
 * needs a geometry rebuild.
 */
import { MATERIAL_SLOTS } from '../types.js';
import type { MaterialDef, Palette, PaletteOverrides } from '../types.js';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** sRGB (0..1) to linear, which is what glTF factors expect. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function hexToLinear(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

/** Blend two hex colors. */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/**
 * Wear makes surfaces rougher, slightly duller and a little dustier.
 * Glass and emissive parts are only lightly affected.
 */
export function applyWear(palette: Palette, wear: number): Palette {
  const out = {} as Palette;
  for (const slot of MATERIAL_SLOTS) {
    const m = { ...palette[slot] };
    const k = slot === 'Emissive' || slot === 'Glass' ? 0.25 : 1;
    const w = Math.max(0, Math.min(1, wear)) * k;
    m.roughness = Math.min(1, m.roughness + w * 0.3 * (1 - m.roughness));
    // Dust: drift toward a warm grey, more on rough non-metals.
    const dust = w * (m.metallic > 0.5 ? 0.12 : 0.18);
    m.color = mixHex(m.color, '#8a8172', dust);
    if (m.emissiveStrength !== undefined) m.emissiveStrength *= 1 - w * 0.3;
    out[slot] = m;
  }
  return out;
}

export function applyOverrides(palette: Palette, overrides: PaletteOverrides | undefined): Palette {
  if (!overrides) return palette;
  const out = { ...palette };
  for (const [slot, ov] of Object.entries(overrides) as [keyof Palette, string | Partial<MaterialDef>][]) {
    if (!(slot in out) || ov === undefined) continue;
    out[slot] = typeof ov === 'string' ? { ...out[slot], color: ov } : { ...out[slot], ...ov };
  }
  return out;
}
