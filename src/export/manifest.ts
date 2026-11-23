/**
 * The manifest describes a generated weapon in plain JSON: recipe, parts,
 * materials, sockets, bounds and stats. It's embedded in the .glb (scene
 * extras, which Blender shows as custom properties) and also written as a
 * sidecar .json so engines and tools can read it without parsing glTF.
 */
import type { Vec3 } from '../core/geometry.js';
import type { Weapon } from '../core/weapon.js';
import { MATERIAL_SLOTS } from '../types.js';
import type { MaterialDef, MaterialSlot } from '../types.js';

export const GENERATOR = 'BadGun';
export const VERSION = '0.1.0';
/** 1 UV unit = 0.25 m. Same texel density on every part of every weapon. */
export const UV_UNITS_PER_METER = 4;

export interface Manifest {
  generator: string;
  version: string;
  name: string;
  recipe: Weapon['recipe'];
  resolved: { params: Weapon['params']; parts: Weapon['parts']; palette: string };
  conventions: Record<string, string>;
  materials: { name: string; slot: MaterialSlot; def: MaterialDef }[];
  components: {
    name: string;
    kind: string;
    variant: string;
    parent: string | null;
    pivot: Vec3;
    motion?: Weapon['components'][number]['motion'];
    materials: string[];
    triangles: number;
  }[];
  sockets: { name: string; parent: string; position: Vec3; forward: Vec3; description: string }[];
  bounds: { min: Vec3; max: Vec3; size: Vec3 };
  collision: { type: 'box'; center: Vec3; size: Vec3 };
  stats: { triangles: number; vertices: number; meshes: number; primitives: number; materials: number };
}

export function weaponName(w: Weapon): string {
  const seed = String(w.recipe.seed).replace(/[^A-Za-z0-9_-]/g, '_');
  return `BadGun_${w.recipe.archetype}_${w.recipe.style}_${seed}`;
}

/** Materials actually used by the weapon, in canonical slot order. */
export function usedSlots(w: Weapon): MaterialSlot[] {
  const used = new Set<MaterialSlot>();
  for (const c of w.components) for (const s of c.geometry.keys()) used.add(s);
  return MATERIAL_SLOTS.filter((s) => used.has(s));
}

/** Weapon-space position of a component's pivot (pivots are already in weapon space). */
export function buildManifest(w: Weapon): Manifest {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let triangles = 0, vertices = 0, primitives = 0, meshes = 0;
  const components: Manifest['components'] = [];
  for (const c of w.components) {
    let tris = 0;
    if (c.geometry.size) meshes++;
    for (const g of c.geometry.values()) {
      tris += g.indices.length / 3;
      vertices += g.vertexCount;
      primitives++;
      const bb = g.bounds();
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], bb.min[k] + c.pivot[k]);
        max[k] = Math.max(max[k], bb.max[k] + c.pivot[k]);
      }
    }
    triangles += tris;
    components.push({
      name: c.name,
      kind: c.kind,
      variant: c.variant,
      parent: c.parent,
      pivot: round3(c.pivot),
      motion: c.motion,
      materials: [...c.geometry.keys()].map((s) => `MAT_${s}`),
      triangles: tris,
    });
  }
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: Vec3 = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2];
  const slots = usedSlots(w);
  return {
    generator: GENERATOR,
    version: VERSION,
    name: weaponName(w),
    recipe: w.recipe,
    resolved: { params: roundParams(w.params), parts: w.parts, palette: w.paletteName },
    conventions: {
      units: 'meters',
      up: '+Y',
      forward: '+Z (muzzle direction)',
      left: '+X (the ejection port is on the right, -X)',
      origin: 'Trigger hand on the pistol grip (SOCKET_Hand_Grip)',
      uv: `TEXCOORD_0 is a physical unwrap: 1 UV unit = ${1 / UV_UNITS_PER_METER} m, consistent texel density, tiling-friendly (islands may overlap)`,
      materials: 'One shared material per semantic slot (MAT_<Slot>); names are stable across regenerations',
      sockets: 'Empty nodes named SOCKET_*; their +Z axis is the socket forward direction',
    },
    materials: slots.map((slot) => ({ name: `MAT_${slot}`, slot, def: w.palette[slot] })),
    components,
    sockets: w.sockets.map((s) => ({ ...s, position: round3(s.position), forward: round3(s.forward) })),
    bounds: { min: round3(min), max: round3(max), size: round3(size) },
    collision: { type: 'box', center: round3(center), size: round3(size) },
    stats: { triangles, vertices, meshes, primitives, materials: slots.length },
  };
}

function round3(v: Vec3): Vec3 {
  return [r4(v[0]), r4(v[1]), r4(v[2])];
}
const r4 = (x: number) => Math.round(x * 10000) / 10000 + 0; // +0 turns -0 into 0

function roundParams<T extends object>(p: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  return out as T;
}
