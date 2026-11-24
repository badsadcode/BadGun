/**
 * Standalone attachments: optics, muzzle devices, underbarrel and side-rail
 * attachments as their own assets, ready to swap onto any weapon at runtime.
 *
 * Each one is built exactly as it would be on a host weapon (so sizes match),
 * then re-centered so its origin is the mount point:
 *
 *   type         origin (SOCKET_Mount)            weapon socket to snap it to
 *   optic        bottom of the optic's base       SOCKET_Optic
 *   muzzle       where it meets the barrel        SOCKET_Barrel_End
 *   underbarrel  top of the rail clamp            SOCKET_Underbarrel
 *   side         rail clamp, built for the right  SOCKET_Side
 *                side (it extends toward -X)
 *   bayonet      the lug under the barrel         SOCKET_Bayonet
 *   magazine     top of the magazine, in the well SOCKET_Magazine
 *                (pan/top magazines: their seat)  (SOCKET_Magazine_Top)
 *
 * Snapping is a plain translation: every socket and every attachment keeps
 * +Y up and +Z forward. Kits bundle one of each variant that fits a style.
 */
import { Rng } from './core/rng.js';
import type { Vec3 } from './core/geometry.js';
import { WeaponBuilder, finalizeWeapon, type Weapon } from './core/weapon.js';
import { applyOverrides, applyWear } from './materials/palette.js';
import { getStyle } from './styles/index.js';
import { makeContext } from './parts/context.js';
import { getArchetype } from './archetypes/index.js';
import { resolveParams, resolveParts } from './generate.js';
import { OPTIC_BUILDERS } from './parts/sight.js';
import { MUZZLE_BUILDERS } from './parts/front.js';
import { SIDE_BUILDERS, UNDERBARREL_BUILDERS, attachmentWeights, buildAttachment } from './parts/attach.js';
import { BAYONET_BUILDERS, bayonetWeights, buildBayonet } from './parts/bayonets.js';
import { LONGGUN_PARTS } from './archetypes/longgun.js';
import { attachmentStats, mountSocket } from './loadout.js';
import { toGLBArsenal } from './export/glb.js';
import { buildManifest } from './export/manifest.js';
import type { ArchetypeId, Params, PaletteOverrides, Recipe, StyleId } from './types.js';

export type AttachmentType = 'optic' | 'muzzle' | 'underbarrel' | 'side' | 'bayonet' | 'magazine';
export const ATTACHMENT_TYPES: AttachmentType[] = ['optic', 'muzzle', 'underbarrel', 'side', 'bayonet', 'magazine'];

/** Optics that are part of the gun itself (iron sights) can't be detached. */
const FIXED_OPTICS = ['irons', 'leaf', 'ladder', 'none'];
/** Magazines that are part of the gun (or no magazine at all) can't be detached either. */
const FIXED_MAGAZINES = ['none', 'internal', 'tube'];

export interface AttachmentRecipe {
  type: AttachmentType;
  /** Which variant, e.g. "scope", "suppressor", "launcher", "flashlight". Default: picked by style and seed. */
  variant?: string;
  style: StyleId;
  seed: number | string;
  params?: Partial<Params>;
  paletteVariant?: number;
  palette?: PaletteOverrides;
  /** Weapon type to size it for (barrel thickness, handguard, magwell...). Default rifle; magazines need a long gun. */
  host?: ArchetypeId;
}

/** Every variant of a type, and the ones that suit a style (with weights). */
export function attachmentVariants(type: AttachmentType, style?: StyleId): Record<string, number> {
  const all: Record<AttachmentType, string[]> = {
    optic: Object.keys(OPTIC_BUILDERS).filter((v) => !FIXED_OPTICS.includes(v)),
    muzzle: Object.keys(MUZZLE_BUILDERS).filter((v) => v !== 'none'),
    underbarrel: Object.keys(UNDERBARREL_BUILDERS),
    side: Object.keys(SIDE_BUILDERS),
    bayonet: Object.keys(BAYONET_BUILDERS),
    magazine: Object.keys(LONGGUN_PARTS.magazine).filter((v) => !FIXED_MAGAZINES.includes(v)),
  };
  const names = all[type];
  if (!style) return Object.fromEntries(names.map((n) => [n, 1]));
  const s = getStyle(style);
  const w: Record<string, number> =
    type === 'optic' ? s.optics : type === 'muzzle' ? s.parts.muzzle ?? {} : type === 'bayonet' ? bayonetWeights(s, 'rifle') : type === 'magazine' ? s.parts.magazine ?? {} : attachmentWeights(s, type, 'rifle');
  const out = Object.fromEntries(names.filter((n) => (w[n] ?? 0) > 0).map((n) => [n, w[n]]));
  // A world with no taste for this type (e.g. WW1 lasers) still gets its most generic option.
  if (!Object.keys(out).length) out[{ optic: 'scope', muzzle: 'compensator', underbarrel: 'vgrip', side: 'flashlight', bayonet: 'knife', magazine: 'straight' }[type]] = 1;
  return out;
}

export function generateAttachment(r: AttachmentRecipe): Weapon {
  const style = getStyle(r.style);
  const variant = r.variant ?? Rng.stream(r.seed, `attachment:${r.type}`).weighted(attachmentVariants(r.type, r.style));
  const valid = Object.keys(attachmentVariants(r.type));
  if (!valid.includes(variant)) throw new Error(`Unknown ${r.type} attachment "${variant}". Available: ${valid.join(', ')}`);

  // A host weapon layout, so the attachment comes out at the right size.
  const host: Recipe = { archetype: r.host ?? 'rifle', style: r.style, seed: r.seed, params: r.params, parts: { config: 'standard' } };
  const arch = getArchetype(host.archetype);
  if (r.type === 'magazine' && arch.parts !== LONGGUN_PARTS) throw new Error(`Standalone magazines are built for long guns (rifle, smg, lmg, sniper, shotgun), not "${host.archetype}".`);
  const params = resolveParams(host);
  const parts = resolveParts(host);
  // Bayonets and magazines shape the layout a little (bare barrel, magwell): lay out the host as if it carried this one.
  if (r.type === 'bayonet' || r.type === 'magazine') parts[r.type] = variant;
  const layout = arch.layout(parts, params, Rng.stream(r.seed, 'layout'), style);
  const name = { optic: 'Optic', muzzle: 'Muzzle', underbarrel: 'Underbarrel', side: 'SideAttachment', bayonet: 'Bayonet', magazine: 'Magazine' }[r.type];
  const b = new WeaponBuilder(name);
  const ctx = makeContext(host.archetype, b, style, params, r.seed, layout, { ...parts, [r.type === 'optic' ? 'sight' : r.type]: variant });

  let origin: Vec3;
  if (r.type === 'optic') {
    origin = [0, layout.mountY, layout.opticZ];
    const c = b.component('Optic', { kind: 'optic', variant, parent: null, pivot: origin });
    const { eyeY, rearZ } = OPTIC_BUILDERS[variant](ctx, c, origin[1], origin[2]);
    b.socket({ name: 'SOCKET_ADS', parent: 'Optic', position: [0, eyeY, rearZ - 0.07], forward: [0, 0, 1], description: 'Eye position when aiming through this optic.' });
  } else if (r.type === 'muzzle') {
    origin = [0, 0, layout.barrel.z1];
    const c = b.component('Muzzle', { kind: 'muzzle', variant, parent: null, pivot: origin });
    const len = MUZZLE_BUILDERS[variant](ctx, c, origin[2], layout.barrel.radius);
    b.socket({ name: 'SOCKET_Muzzle', parent: 'Muzzle', position: [0, 0, origin[2] + len], forward: [0, 0, 1], description: 'Muzzle tip: projectiles, flashes, tracers.' });
  } else if (r.type === 'bayonet') {
    // Built in its own mount frame: the origin is the lug.
    origin = [0, 0, 0];
    buildBayonet(ctx, variant, { at: origin, parent: null });
  } else if (r.type === 'magazine') {
    // The magazine builder hangs it from the host's magwell; its pivot is the weapon's SOCKET_Magazine.
    LONGGUN_PARTS.magazine[variant](ctx);
    const m = b.component('Magazine', { kind: 'magazine', variant });
    origin = [...m.pivot];
    // A lone magazine doesn't animate (its reload motion belongs to the weapon).
    m.motion = undefined;
  } else {
    // Attachments are built in their own mount frame, so the origin is the mount itself.
    origin = [0, 0, 0];
    const hand = buildAttachment(ctx, r.type, variant, { at: origin, r: r.type === 'side' ? [0, 0, -Math.PI / 2] : undefined, parent: null });
    if (hand) b.socket({ name: 'SOCKET_Hand_Support', parent: name, position: hand, forward: [0, 0, 1], description: 'Support hand on this attachment.' });
  }
  b.socket({ name: 'SOCKET_Mount', parent: name, position: origin, forward: [0, 0, 1], description: `Mount point: snap onto the weapon's ${mountSocket(r.type, variant)}.` });

  const pv = r.paletteVariant !== undefined
    ? ((r.paletteVariant % style.palettes.length) + style.palettes.length) % style.palettes.length
    : Rng.stream(r.seed, 'palette').int(0, style.palettes.length - 1);
  const chosen = style.palettes[pv];
  const weapon: Weapon = {
    recipe: { archetype: host.archetype, style: r.style, seed: r.seed, ...(r.params ? { params: r.params } : {}), ...(r.paletteVariant !== undefined ? { paletteVariant: r.paletteVariant } : {}), ...(r.palette ? { palette: r.palette } : {}) },
    params,
    parts: { [r.type]: variant },
    paletteName: chosen.name,
    palette: applyOverrides(applyWear(chosen.materials, params.wear), r.palette),
    components: b.list(),
    sockets: b.sockets,
    finalized: false,
    attachment: { type: r.type, variant, mountsOn: mountSocket(r.type, variant), stats: attachmentStats(r.type, variant, { host: host.archetype, config: 'standard' }) },
  };
  return finalizeWeapon(weapon, origin);
}

export interface AttachmentKit {
  style: StyleId;
  seed: number | string;
  items: Weapon[];
}

/** One of every attachment variant that suits the style, all in the same paint. */
export function generateAttachmentKit(k: { style: StyleId; seed: number | string; paletteVariant?: number; params?: Partial<Params>; types?: AttachmentType[] }): AttachmentKit {
  const pv = k.paletteVariant ?? Rng.stream(k.seed, 'palette').int(0, getStyle(k.style).palettes.length - 1);
  const items: Weapon[] = [];
  for (const type of k.types ?? ATTACHMENT_TYPES) {
    for (const variant of Object.keys(attachmentVariants(type, k.style))) {
      items.push(generateAttachment({ type, variant, style: k.style, seed: k.seed, paletteVariant: pv, params: k.params }));
    }
  }
  return { style: k.style, seed: k.seed, items };
}

/** The whole kit in one .glb: one row per attachment type, laid out left to right. */
export function kitToGLB(kit: AttachmentKit, gap = 0.04): Uint8Array {
  const rows = new Map<string, Weapon[]>();
  for (const w of kit.items) rows.set(w.attachment!.type, [...(rows.get(w.attachment!.type) ?? []), w]);
  const placed: { weapon: Weapon; translation: Vec3 }[] = [];
  let y = 0;
  for (const row of rows.values()) {
    const bounds = row.map((w) => buildManifest(w).bounds);
    const rowTop = Math.max(...bounds.map((b) => b.max[1]));
    const rowBottom = Math.min(...bounds.map((b) => b.min[1]));
    y -= rowTop;
    let z = 0;
    row.forEach((w, i) => {
      z -= bounds[i].min[2];
      placed.push({ weapon: w, translation: [0, y, z] });
      z += bounds[i].max[2] + gap;
    });
    y += rowBottom - gap * 1.5;
  }
  return toGLBArsenal(placed, `BadGun_kit_${kit.style}_${kit.seed}`, { badgun: { kit: { style: kit.style, seed: kit.seed, items: kit.items.map((w) => w.attachment) } } });
}
