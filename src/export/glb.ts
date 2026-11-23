/**
 * Dependency-free glTF 2.0 binary (.glb) writer.
 *
 * Layout:
 *   <weapon name>            (root node, carries the manifest in extras)
 *   ├─ Receiver              (mesh: one primitive per material slot)
 *   │  ├─ Trigger, Magazine, Stock, Grip, Barrel ... (each on its own pivot)
 *   │  │  └─ SOCKET_*        (empty nodes, +Z = socket direction)
 *   ...
 * Materials are shared: one MAT_<Slot> per slot, so a weapon costs at most
 * one draw call per (component, slot) pair and recoloring touches 1 material.
 */
import type { Vec3 } from '../core/geometry.js';
import { normalize, cross, dot } from '../core/geometry.js';
import type { Weapon } from '../core/weapon.js';
import { hexToLinear } from '../materials/palette.js';
import { MATERIAL_SLOTS } from '../types.js';
import { GENERATOR, VERSION, UV_UNITS_PER_METER, UvLayout, buildManifest, usedSlots, weaponName } from './manifest.js';
import { weaponAtlas } from '../texture/atlas.js';
import { bakeTexture } from '../texture/bake.js';
import { encodePNG } from '../texture/png.js';

export interface ExportOptions {
  /**
   * Which UV set is TEXCOORD_0 (the one most tools paint on and most engines
   * sample by default). The other goes to TEXCOORD_1. Default "tiling".
   */
  uv?: UvLayout;
  /**
   * Embed a base color texture (the palette baked into the atlas) so the
   * model opens ready to paint. Size in pixels, or true for 1024.
   */
  texture?: boolean | number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const FLOAT = 5126, UINT16 = 5123, UINT32 = 5125;
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963;

class BinWriter {
  chunks: Uint8Array[] = [];
  length = 0;
  views: Json[] = [];
  accessors: Json[] = [];

  /** Append bytes as a new bufferView (4-byte aligned). Returns view index. */
  view(bytes: Uint8Array, target?: number): number {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) this.push(new Uint8Array(pad));
    const v: Json = { buffer: 0, byteOffset: this.length, byteLength: bytes.byteLength };
    if (target) v.target = target;
    this.push(bytes);
    this.views.push(v);
    return this.views.length - 1;
  }

  private push(b: Uint8Array) {
    this.chunks.push(b);
    this.length += b.byteLength;
  }

  floatAccessor(data: number[], type: 'VEC2' | 'VEC3', withBounds: boolean): number {
    const arr = new Float32Array(data);
    const viewIndex = this.view(new Uint8Array(arr.buffer), ARRAY_BUFFER);
    const n = type === 'VEC2' ? 2 : 3;
    const acc: Json = { bufferView: viewIndex, componentType: FLOAT, count: data.length / n, type };
    if (withBounds) {
      const min = new Array(n).fill(Infinity), max = new Array(n).fill(-Infinity);
      for (let i = 0; i < arr.length; i++) {
        const k = i % n;
        min[k] = Math.min(min[k], arr[i]);
        max[k] = Math.max(max[k], arr[i]);
      }
      acc.min = min;
      acc.max = max;
    }
    this.accessors.push(acc);
    return this.accessors.length - 1;
  }

  indexAccessor(indices: number[], vertexCount: number): number {
    const big = vertexCount > 65535;
    const arr = big ? new Uint32Array(indices) : new Uint16Array(indices);
    const viewIndex = this.view(new Uint8Array(arr.buffer, 0, arr.byteLength), ELEMENT_ARRAY_BUFFER);
    this.accessors.push({ bufferView: viewIndex, componentType: big ? UINT32 : UINT16, count: indices.length, type: 'SCALAR' });
    return this.accessors.length - 1;
  }

  concat(): Uint8Array {
    const pad = (4 - (this.length % 4)) % 4;
    const out = new Uint8Array(this.length + pad);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.byteLength;
    }
    return out;
  }
}

/** Quaternion rotating +Z onto `dir`. */
function quatFromZ(dir: Vec3): [number, number, number, number] {
  const d = normalize(dir);
  const z: Vec3 = [0, 0, 1];
  const c = dot(z, d);
  if (c > 0.99999) return [0, 0, 0, 1];
  if (c < -0.99999) return [0, 1, 0, 0];
  const axis = normalize(cross(z, d));
  const half = Math.acos(Math.max(-1, Math.min(1, c))) / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function toGLB(weapon: Weapon, opts: ExportOptions = {}): Uint8Array {
  const json = toGltfJson(weapon, opts);
  const bin: Uint8Array = json.__bin;
  delete json.__bin;
  return packGlb(json, bin);
}

/** Build the glTF JSON (with the binary payload stashed on `__bin`). */
export function toGltfJson(weapon: Weapon, opts: ExportOptions = {}): Json {
  return buildGltf([{ weapon, translation: [0, 0, 0] }], weaponName(weapon), { badgun: { recipe: weapon.recipe } }, opts);
}

/**
 * Several weapons in one .glb (e.g. a faction's whole arsenal), each under
 * its own root node at `translation`. Materials are shared by slot; the first
 * weapon that uses a slot defines it (faction members share one palette).
 */
export function toGLBArsenal(items: { weapon: Weapon; translation: Vec3 }[], name: string, extras: Json = {}, opts: Pick<ExportOptions, 'uv'> = {}): Uint8Array {
  const json = buildGltf(items, name, extras, opts);
  const bin: Uint8Array = json.__bin;
  delete json.__bin;
  return packGlb(json, bin);
}

function buildGltf(items: { weapon: Weapon; translation: Vec3 }[], sceneName: string, sceneExtras: Json, opts: ExportOptions = {}): Json {
  for (const it of items) if (!it.weapon.finalized) throw new Error('Weapon must be finalized before export');
  const w = new BinWriter();
  const uvFirst: UvLayout = opts.uv ?? 'tiling';
  const atlasSet = uvFirst === 'atlas' ? 0 : 1;
  // A baked texture belongs to one weapon's atlas, so only single weapons embed one.
  const textureSize = opts.texture ? (opts.texture === true ? 1024 : opts.texture) : 0;
  if (textureSize && items.length !== 1) throw new Error('Embedded textures are only supported for single-weapon exports');
  let texture: Json = null;
  if (textureSize) {
    const img = bakeTexture(items[0].weapon, 'basecolor', { size: textureSize });
    const view = w.view(encodePNG(img.data, img.width, img.height));
    texture = {
      images: [{ name: 'T_BaseColor', mimeType: 'image/png', bufferView: view }],
      // Linear filtering with mipmaps; clamp so atlas edges don't wrap around.
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
      textures: [{ name: 'T_BaseColor', sampler: 0, source: 0 }],
    };
  }

  // Materials: one per used slot (across all weapons), in canonical order.
  const used = new Set(items.flatMap((it) => usedSlots(it.weapon)));
  const slots = MATERIAL_SLOTS.filter((s) => used.has(s));
  const materialIndex = new Map(slots.map((s, i) => [s, i]));
  let usesEmissiveStrength = false;
  const materials = slots.map((slot) => {
    const owner = items.find((it) => usedSlots(it.weapon).includes(slot))!.weapon;
    const m = owner.palette[slot];
    const [r, g, b] = hexToLinear(m.color);
    const opacity = m.opacity ?? 1;
    const mat: Json = {
      name: `MAT_${slot}`,
      pbrMetallicRoughness: texture
        ? { baseColorFactor: [1, 1, 1, opacity], baseColorTexture: { index: 0, texCoord: atlasSet }, metallicFactor: m.metallic, roughnessFactor: m.roughness }
        : { baseColorFactor: [r, g, b, opacity], metallicFactor: m.metallic, roughnessFactor: m.roughness },
      extras: { badgunSlot: slot, label: m.label ?? slot, color: m.color },
    };
    if (opacity < 1) mat.alphaMode = 'BLEND';
    if (m.emissive) {
      const e = hexToLinear(m.emissive);
      const strength = m.emissiveStrength ?? 1;
      mat.emissiveFactor = e;
      if (strength > 1) {
        mat.extensions = { KHR_materials_emissive_strength: { emissiveStrength: strength } };
        usesEmissiveStrength = true;
      }
    }
    return mat;
  });

  const nodes: Json[] = [];
  const meshes: Json[] = [];
  const sceneRoots: number[] = [];

  for (const { weapon, translation } of items) {
    const manifest = buildManifest(weapon, uvFirst);
    const atlas = weaponAtlas(weapon);
    const nodeIndex = new Map<string, number>();
    const pivots = new Map(weapon.components.map((c) => [c.name, c.pivot]));

    for (const c of weapon.components) {
      const node: Json = { name: c.name, extras: { badgun: { kind: c.kind, variant: c.variant, ...(c.motion ? { motion: c.motion } : {}) } } };
      const parentPivot: Vec3 = c.parent ? pivots.get(c.parent) ?? [0, 0, 0] : [0, 0, 0];
      const t = sub3(c.pivot, parentPivot);
      if (t.some((v) => Math.abs(v) > 1e-9)) node.translation = t;
      if (c.geometry.size) {
        const primitives: Json[] = [];
        for (const slot of MATERIAL_SLOTS) {
          const g = c.geometry.get(slot);
          if (!g || g.indices.length === 0) continue;
          const tiling = w.floatAccessor(g.uvs.map((v) => v * UV_UNITS_PER_METER), 'VEC2', false);
          const packed = w.floatAccessor(Array.from(atlas.uvs.get(g)!), 'VEC2', false);
          primitives.push({
            attributes: {
              POSITION: w.floatAccessor(g.positions, 'VEC3', true),
              NORMAL: w.floatAccessor(g.normals, 'VEC3', false),
              TEXCOORD_0: uvFirst === 'atlas' ? packed : tiling,
              TEXCOORD_1: uvFirst === 'atlas' ? tiling : packed,
            },
            indices: w.indexAccessor(g.indices, g.vertexCount),
            material: materialIndex.get(slot),
          });
        }
        meshes.push({ name: `${c.name}_Mesh`, primitives });
        node.mesh = meshes.length - 1;
      }
      nodes.push(node);
      nodeIndex.set(c.name, nodes.length - 1);
    }

    // Sockets as empty child nodes.
    for (const s of weapon.sockets) {
      const parent = pivots.has(s.parent) ? s.parent : weapon.components.find((c) => !c.parent)?.name ?? weapon.components[0].name;
      const node: Json = {
        name: s.name,
        translation: sub3(s.position, pivots.get(parent) ?? [0, 0, 0]),
        extras: { badgun: { socket: true, description: s.description } },
      };
      const q = quatFromZ(s.forward);
      if (q[3] !== 1) node.rotation = q;
      nodes.push(node);
      (nodes[nodeIndex.get(parent)!].children ??= []).push(nodes.length - 1);
    }

    // Hierarchy.
    const roots: number[] = [];
    for (const c of weapon.components) {
      const i = nodeIndex.get(c.name)!;
      if (c.parent && nodeIndex.has(c.parent)) (nodes[nodeIndex.get(c.parent)!].children ??= []).push(i);
      else roots.push(i);
    }
    const root: Json = { name: weaponName(weapon), children: roots, extras: { badgun: manifest } };
    if (translation.some((v) => Math.abs(v) > 1e-9)) root.translation = translation;
    nodes.push(root);
    sceneRoots.push(nodes.length - 1);
  }

  const bin = w.concat();
  const gltf: Json = {
    asset: { version: '2.0', generator: `${GENERATOR} ${VERSION}` },
    scene: 0,
    scenes: [{ name: sceneName, nodes: sceneRoots, extras: sceneExtras }],
    nodes,
    meshes,
    materials,
    accessors: w.accessors,
    bufferViews: w.views,
    buffers: [{ byteLength: bin.byteLength }],
  };
  if (texture) Object.assign(gltf, texture);
  if (usesEmissiveStrength) gltf.extensionsUsed = ['KHR_materials_emissive_strength'];
  gltf.__bin = bin;
  return gltf;
}

function packGlb(json: Json, bin: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  if (jsonPad) {
    const padded = new Uint8Array(jsonBytes.byteLength + jsonPad);
    padded.set(jsonBytes);
    padded.fill(0x20, jsonBytes.byteLength);
    jsonBytes = padded;
  }
  const total = 12 + 8 + jsonBytes.byteLength + 8 + bin.byteLength;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // "glTF"
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.set(jsonBytes, 20);
  const o = 20 + jsonBytes.byteLength;
  dv.setUint32(o, bin.byteLength, true);
  dv.setUint32(o + 4, 0x004e4942, true); // "BIN\0"
  out.set(bin, o + 8);
  return out;
}
