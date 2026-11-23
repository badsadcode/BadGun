/**
 * The in-memory weapon asset: a hierarchy of named components, each with
 * geometry grouped by material slot, plus sockets and metadata.
 *
 * Authoring happens in *weapon space* (all coordinates relative to the same
 * origin). `finalize()` converts to node-local space so each component's
 * origin sits on its pivot. That way a magazine rotates/slides around the
 * magwell, a trigger around its pin, etc.
 */
import { Geometry, Vec3 } from './geometry.js';
import type { MaterialSlot, Palette, Recipe, Params } from '../types.js';

/** How a moving part is expected to move. Purely descriptive metadata. */
export interface Motion {
  type: 'translate' | 'rotate';
  /** Axis in the component's local space. */
  axis: Vec3;
  /** Travel in meters (translate) or radians (rotate). */
  range: [number, number];
  /** What this motion is for, e.g. "reload", "fire", "cock". */
  purpose: string;
}

export interface Component {
  /** Stable name, e.g. "Receiver", "Magazine". Exported as the node name. */
  name: string;
  /** Category of part, e.g. "magazine". */
  kind: string;
  /** Which part variant built it, e.g. "drum". */
  variant: string;
  parent: string | null;
  /** Pivot in weapon space (becomes the node origin). */
  pivot: Vec3;
  motion?: Motion;
  /** Geometry per material slot, in weapon space until finalized. */
  geometry: Map<MaterialSlot, Geometry>;
}

export interface Socket {
  /** e.g. "SOCKET_Muzzle". */
  name: string;
  /** Component it belongs to. */
  parent: string;
  /** Position in weapon space. */
  position: Vec3;
  /** Direction the socket faces (unit vector, weapon space). */
  forward: Vec3;
  description: string;
}

export interface Weapon {
  recipe: Recipe;
  /** Params after seed-driven defaults are filled in. */
  params: Params;
  /** Variants chosen for each part. */
  parts: Record<string, string>;
  paletteName: string;
  palette: Palette;
  components: Component[];
  sockets: Socket[];
  /** True once geometry is in node-local space. */
  finalized: boolean;
}

export class WeaponBuilder {
  /** Name of the root component; other components default to it as parent. */
  constructor(public rootName = 'Receiver') {}
  private components = new Map<string, Component>();
  private order: string[] = [];
  sockets: Socket[] = [];

  /** Create (or fetch) a component. Parent defaults to the root "Receiver". */
  component(
    name: string,
    opts: { kind: string; variant: string; parent?: string | null; pivot?: Vec3; motion?: Motion },
  ): Component {
    let c = this.components.get(name);
    if (!c) {
      c = {
        name,
        kind: opts.kind,
        variant: opts.variant,
        parent: opts.parent === undefined ? this.rootName : opts.parent,
        pivot: opts.pivot ?? [0, 0, 0],
        motion: opts.motion,
        geometry: new Map(),
      };
      if (c.parent === name) c.parent = null;
      this.components.set(name, c);
      this.order.push(name);
    }
    return c;
  }

  /** Add geometry (weapon space) to a component under a material slot. */
  add(component: Component, slot: MaterialSlot, geo: Geometry): void {
    const existing = component.geometry.get(slot);
    if (existing) existing.merge(geo);
    else component.geometry.set(slot, geo);
  }

  socket(s: Socket): void {
    this.sockets.push(s);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  list(): Component[] {
    return this.order.map((n) => this.components.get(n)!).filter((c) => c.geometry.size > 0 || this.isParentOfAny(c.name));
  }

  private isParentOfAny(name: string): boolean {
    for (const c of this.components.values()) if (c.parent === name) return true;
    return false;
  }
}

/**
 * Move the whole weapon so `origin` becomes (0,0,0), then convert each
 * component's geometry into its own local space (relative to its pivot).
 */
export function finalizeWeapon(weapon: Weapon, origin: Vec3): Weapon {
  if (weapon.finalized) return weapon;
  const shift: Vec3 = [-origin[0], -origin[1], -origin[2]];
  for (const c of weapon.components) {
    c.pivot = [c.pivot[0] + shift[0], c.pivot[1] + shift[1], c.pivot[2] + shift[2]];
    for (const geo of c.geometry.values()) {
      geo.transform({ t: [shift[0] - c.pivot[0], shift[1] - c.pivot[1], shift[2] - c.pivot[2]] });
    }
  }
  for (const s of weapon.sockets) {
    s.position = [s.position[0] + shift[0], s.position[1] + shift[1], s.position[2] + shift[2]];
  }
  weapon.finalized = true;
  return weapon;
}
