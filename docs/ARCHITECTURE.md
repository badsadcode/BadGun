# BadGun architecture

> Studio motto #001: *"Code shall remain understandable to whichever AI inherits this mess."*
> This page is for you, future inheritor.

## The pipeline

```
Recipe ──► resolveParams / resolveParts ──► layout ──► part builders ──► Weapon ──► finalize ──► toGLB / buildManifest
 (JSON)     (seeded, per-style ranges)      (sizes)    (geometry per       (components,  (move origin,   (glTF 2.0 binary,
                                                        material slot)      sockets)      local pivots)   sidecar JSON)
```

## Source map

| Path | Responsibility |
|---|---|
| `src/types.ts` | Public types: `Recipe`, `Params`, `MaterialSlot`, `MaterialDef` |
| `src/generate.ts` | `generate(recipe)`: resolves params, parts and palette, then builds and finalizes |
| `src/core/rng.ts` | Seeded PRNG with **named streams** (`Rng.stream(seed, "part:stock")`) |
| `src/core/geometry.ts` | Geometry kernel: `extrudeSide` (side profiles, chamfered), `lathe`, `box`, `cylinder`, `tube`, `ring`, `dome`, ear-clipping, profile helpers |
| `src/core/weapon.ts` | `WeaponBuilder` (components, sockets), `finalizeWeapon` (origin + local pivots) |
| `src/styles/*.ts` | Style profiles: palettes, param ranges, weighted part variants, optic weights, traits |
| `src/archetypes/rifle.ts` | Rifle layout (proportions from params) and assembly order, plus sockets |
| `src/parts/*.ts` | Part builders, keyed by variant name: `receiver.ts`, `front.ts` (barrel/handguard/muzzle), `lower.ts` (grip/magazine), `stock.ts`, `sight.ts` |
| `src/materials/palette.ts` | Color utils, wear, overrides |
| `src/export/glb.ts` | Dependency-free GLB writer |
| `src/export/manifest.ts` | Manifest (recipe, parts, sockets, bounds, stats, conventions) |
| `src/cli.ts` | Command-line tool |
| `tools/preview/index.html` | three.js preview that runs the generator live in the browser |
| `tools/render.mjs` | Batch PNG renders through the preview page (Playwright) |

## Key design decisions

**Archetype ⟂ style.** An archetype owns *proportions and assembly order* (`LongGunLayout`). A style owns *which variants, which colors, which traits*. Part builders read both through a `BuildContext`. Adding a style means writing a new `StyleProfile` and maybe a few part variants. Archetypes don't change.

**Authoring in weapon space.** Builders write geometry in one shared coordinate space (bore axis at `y = 0`, muzzle toward `+Z`). `finalizeWeapon` moves the origin to the grip hand, then converts each component's geometry relative to its pivot. That keeps builders simple and pivots correct.

**Side profiles are the workhorse.** Most gun parts read as silhouettes. `extrudeSide(profile[z,y], { width, bevel })` extrudes a 2D side profile across the width with chamfered edges, so it catches light. Round parts use `lathe(profile[r,z])`.

**Rotating parts.** `Geometry.transform` rotates around the *origin*, so build rotated pieces centered at `[0,0,0]` and pass the position as `t` (see `put(ctx, comp, slot, geo, t, r)`). That mistake bit us once already.

**Named random streams.** Never share one RNG across unrelated decisions. Each part kind, param and layout gets its own stream, which keeps "change one thing, keep the rest" true.

**Materials = semantic slots.** Eleven slots, shared materials, so draw calls per weapon stay ≈ (components × slots actually used), typically about 20-30. Slot names never change between styles; only their `MaterialDef` does.

**UVs are physical.** Builders emit UVs in meters (perimeter × depth for extrusions, arc × length for lathes); the exporter scales by `UV_UNITS_PER_METER = 4`. Islands can overlap. A future atlas/packing pass can be added without touching builders.

## Adding things

- **A part variant:** write a `PartBuilder` in the matching `src/parts/*.ts` file, add it to that file's export table, then reference it in a style's `parts` weights. `test/` automatically validates every variant in every style.
- **A style:** copy `src/styles/modern.ts`, register it in `src/styles/index.ts`, and add its id to `StyleId` in `src/types.ts`.
- **An archetype:** add `src/archetypes/<name>.ts` with a layout and an assembly function, then dispatch to it in `generate.ts`. Reuse part builders where the shapes fit (a pistol can reuse grips, magazines, muzzles and sights).
