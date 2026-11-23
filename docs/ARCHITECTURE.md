# BadGun architecture

> Studio motto #001: *"Code shall remain understandable to whichever AI inherits this mess."*
> This page is for you, future inheritor.

## The pipeline

```
Recipe ──► resolveParams / resolveParts ──► layout ──► part builders ──► Weapon ──► finalize ──► toGLB / buildManifest
 (JSON)     (seeded, per-style ranges)      (sizes)    (geometry per       (components,  (move origin,   (glTF 2.0 binary,
                                                        material slot)      sockets)      local pivots)   sidecar JSON)
                                                                                              │
                                                                                              └──► buildAtlas ──► bakeTexture ──► encodePNG
                                                                                                   (2nd UV set)   (base color,    (PNG files or
                                                                                                                   ID map, UV      embedded in
                                                                                                                   template)       the .glb)
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
| `src/archetypes/archetype.ts` | `ArchetypeDef`: part tables, weight rules, layout, build, origin |
| `src/archetypes/longgun.ts` | Rifle, SMG, shotgun, sniper, LMG: one assembly line + per-archetype proportion presets and part rules |
| `src/archetypes/pistol.ts`, `crossbow.ts`, `bow.ts` | Handguns, crossbows and bows (bows stand upright in the YZ plane) |
| `src/archetypes/index.ts` | Archetype registry and root component names (`Receiver`, `Frame`, `Tiller`) |
| `src/parts/*.ts` | Part builders, keyed by variant name: `receiver.ts`, `front.ts` (barrel/handguard/muzzle), `lower.ts` (grip/magazine), `stock.ts`, `sight.ts`, `extra.ts` and `variety.ts` (later long-gun variants: doubles, bullpup butt, pan magazine…), `scrap.ts` (survivor/makeshift parts), `accessory.ts` (bipod, bolt handle…), `pistol.ts`, `crossbow.ts`, `bow.ts` |
| `src/materials/palette.ts` | Color utils, wear, overrides |
| `src/export/glb.ts` | Dependency-free GLB writer |
| `src/export/manifest.ts` | Manifest (recipe, parts, sockets, bounds, stats, conventions, UV info) |
| `src/anim/clips.ts` | Animation clips (Fire, Reload, Cycle…) built from component motion metadata; sampled into glTF animations by `glb.ts` |
| `src/texture/atlas.ts` | Atlas UVs: charts from shared vertices, skyline packing into one square, uniform texel density |
| `src/texture/bake.ts` | Rasterizer: base color, ID map and UV template images in atlas space |
| `src/texture/png.ts` | Dependency-free PNG encoder (own DEFLATE), works in Node and browsers |
| `src/parts/punk.ts` | Dieselpunk and cyberpunk parts |
| `src/cli.ts` | Command-line tool |
| `tools/preview/index.html` | three.js preview that runs the generator live in the browser |
| `tools/render.mjs` | Batch PNG renders through the preview page (Playwright) |
| `tools/build-site.mjs`, `tools/devlog.mjs` | GitHub Pages site: playground + devlog pages rendered from `devlog/*.md` and `devlog/entries.json` |

## Key design decisions

**Choosing parts.** For each part kind, the variant comes from (first match wins): the recipe's `parts` override, the style's `byArchetype[archetype][kind]`, the archetype's `weights(style, kind)` rule, the style's generic `parts[kind]`, and finally all variants equally. Pistols and crossbows decide from style *traits* (rails, plumbing, glow), so a brand-new style gets sensible handguns without editing them.

**Linked choices.** Variants are picked independently, then `ArchetypeDef.fixup` makes them consistent without touching anything the recipe pinned: double barrels mean a break action (no magazine, splinter forend, bare muzzle), a bullpup gets the `butt` stock, a top pan magazine removes the optic. Builders can also read `ctx.chosen` to adapt to their neighbors.

**Shape genes.** `longGunLayout` draws seeded multipliers (receiver length/height, magazine position, grip rake, handguard and bare-barrel length, stock length/drop, barrel thickness) from the `layout` stream, so silhouettes differ even when the same variants are picked. The pseudo-kind `config` (standard/bullpup) moves the grip, magazine and optic around.

**Archetype ⟂ style.** An archetype owns *proportions and assembly order* (`LongGunLayout`). A style owns *which variants, which colors, which traits*. Part builders read both through a `BuildContext`. Adding a style means writing a new `StyleProfile` and maybe a few part variants. Archetypes don't change.

**Authoring in weapon space.** Builders write geometry in one shared coordinate space (bore axis at `y = 0`, muzzle toward `+Z`). `finalizeWeapon` moves the origin to the grip hand, then converts each component's geometry relative to its pivot. That keeps builders simple and pivots correct.

**Side profiles are the workhorse.** Most gun parts read as silhouettes. `extrudeSide(profile[z,y], { width, bevel })` extrudes a 2D side profile across the width with chamfered edges, so it catches light. Round parts use `lathe(profile[r,z])`.

**Rotating parts.** `Geometry.transform` rotates around the *origin*, so build rotated pieces centered at `[0,0,0]` and pass the position as `t` (see `put(ctx, comp, slot, geo, t, r)`). That mistake bit us once already.

**Named random streams.** Never share one RNG across unrelated decisions. Each part kind, param and layout gets its own stream, which keeps "change one thing, keep the rest" true.

**Materials = semantic slots.** Eleven slots, shared materials, so draw calls per weapon stay ≈ (components × slots actually used), typically about 20-30. Slot names never change between styles; only their `MaterialDef` does.

**UVs are physical.** Builders emit UVs in meters (perimeter × depth for extrusions, arc × length for lathes; flat lathe caps project as a disc); the exporter scales by `UV_UNITS_PER_METER = 4`. These "tiling" UVs can overlap.

**The atlas is derived, not authored.** `buildAtlas` runs after finalize and never touches builders. It treats every group of triangles connected through shared vertices as one chart (builders already cut seams by duplicating vertices, and every chart's physical UVs are flat and fold-free), measures charts in meters, and skyline-packs them into one square with padding in pixels. Because the source UVs are physical, texel density is uniform everywhere. The export writes both sets: tiling in `TEXCOORD_0` and atlas in `TEXCOORD_1` by default, or swapped with `{ uv: 'atlas' }`. The atlas is cached per weapon (`weaponAtlas`) so the GLB, manifest and bakes all agree. If a new builder ever makes a chart that overlaps itself in UV, the atlas test will catch it.

**Animations come from motion metadata.** Builders only declare how a part *can* move (`motion: { type, axis, range, purpose }`); `weaponClips` decides *when*, by looking for well-known component names (`Trigger`, `Hammer`, `Magazine`, `ChargingHandle`, `BoltHandle`, `Lever`, `Slide`, pump `Handguard`, break-open `Barrel`, `String`, …). Tracks hold the motion parameter over time (eased keys); the exporter samples them at 60 fps into translation/rotation channels on the existing nodes. A new moving part becomes animated by giving it a motion and, if it's a new kind of part, a line in `clips.ts`.

## Adding things

- **A part variant:** write a `PartBuilder` in the matching `src/parts/*.ts` file, add it to that file's export table, then reference it in a style's `parts` weights. `test/` automatically validates every variant in every style.
- **A style:** copy `src/styles/modern.ts`, register it in `src/styles/index.ts`, and add its id to `StyleId` in `src/types.ts`.
- **A long-gun cousin:** add a preset to `PRESETS` in `longgun.ts` and a `longGun(...)` entry with its part rules.
- **A new archetype:** implement `ArchetypeDef` in `src/archetypes/<name>.ts` (its layout fills `LongGunLayout`, using `extra` for anything special), register it in `archetypes/index.ts`, and add its id to `ArchetypeId`. Reuse part builders where the shapes fit: crossbows reuse stocks, grips and sights, and pistols reuse muzzles.
- **A devlog entry:** write `devlog/NNN-slug.md`, add it to `devlog/entries.json`, and put images in `devlog/assets/NNN/`.
