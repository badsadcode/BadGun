# BadGun

**Procedural, game-ready weapon asset generator**  
**Project brief for Sage**  
**Status:** Concept / proposed library

> **Core idea:** Generate believable, visually coherent weapons across different genres and art styles, already organized for easy texturing, animation, and use in multiple game engines.

## 1. What we're building

**BadGun** is an independent procedural weapon-generation library and tool. It should generate complete weapon **3D assets**, not just random silhouettes or static concept images.

The generated models should be usable in games, including first-person and third-person games, with as little manual cleanup as practical. The library must be **game-engine-agnostic**: it is not a NoorEngine module, an Unreal plugin, or a Godot-only solution. Games and editors can integrate it through exports or adapters.

BadGun belongs to the same family of independent procedural tools as BadBuildings, BadStructures, and BadVegetation, but **must not require those projects**.

### The guiding principle

**Weapon archetype + visual style + deterministic seed + configurable parameters = a reproducible, coherent weapon asset.**

A generated gun should look as though somebody designed it for a particular game's universe, rather than as a jumble of unrelated parts.

## 2. Weapon families and visual styles

**Weapon archetypes (expandable):**

- Pistols and revolvers
- Submachine guns / compact weapons
- Rifles and carbines
- Shotguns
- Marksman and sniper rifles
- Light/heavy machine guns
- Larger or unusual weapons, including fictional energy weapons
- Fantasy firearms and other stylized ranged weapons when the selected style calls for them

**Visual style profiles (expandable):**

| Profile | Design language |
| --- | --- |
| Modern | Contemporary military and civilian-inspired styling |
| Historical | Flintlock, musket, early-industrial, vintage and period-inspired weapons |
| Old fantasy | Ornate, rune-carved, enchanted, crystal-powered and magical constructions |
| Steampunk | Brass, copper, wood, gauges, elaborate visible mechanisms |
| Dieselpunk | Industrial steel, heavy housings, retro machinery |
| Cyberpunk | Sleek or aggressive futuristic hardware, corporate and street-built variants |
| Sci-fi | Energy weapons, advanced materials, speculative forms |
| Alien / biomechanical | Organic, asymmetrical and otherworldly design language |
| Post-apocalyptic | Worn, salvaged, patched-together appearance |
| Retro / low-poly | Chunky, simple silhouettes suited to PS1-era or other stylized games |

**Important:** *Archetype* and *style* should be independent. For instance, a pistol might be modern, steampunk, fantasy, or cyberpunk without needing a separate generator for every combination. Some combinations may need special rules, and it is fine to add those progressively.

A **faction / collection profile** would be a great later feature: generate a matching family of weapons using one shared palette, silhouette vocabulary, material choices, and design details.

## 3. Extremely important: materials and texturing workflow

This is a major requirement, **not just a nice-to-have**.

The user wants to be able to texture and customize the generated models easily. Please choose whatever practical technical approach achieves that. It does **not** have to mean literally one unique material for every object if another solution is better.

### A. Separate, meaningful material assignments

A weapon should not export as one giant mesh with a single indistinguishable material if that makes editing painful.

Provide **semantic material slots / material groups**, or another clean, editable equivalent, for recognizable parts and surface types, such as:

- Main body / receiver or central housing
- Barrel / front assembly
- Grip
- Stock
- Magazine or power cell
- Sights / optics
- Trim / accents
- Glass, emissive elements, crystals, leather, wood, etc. when applicable

These groups should be understandable in Blender and in game-engine importers. The exact mesh/material organization is Sage's design decision: separate objects, grouped meshes with material slots, shared materials, material IDs, or a hybrid are all acceptable.

**Balance editability with runtime cost.** Avoid creating hundreds of unnecessary draw calls just to assign a different shade to every tiny part. Shared materials across similarly treated pieces are welcome.

### B. Immediately useful default colors

**Every generated weapon should already have a sensible, style-appropriate visual palette.** The default materials should approximate what the *finished* weapon is intended to look like.

Examples:

- Modern rifle: dark metal, matte polymer, appropriately colored grips and accents.
- Historical firearm: wood stock, dark/blued metal, brass where appropriate.
- Steampunk gun: brass/copper body, dark wood, aged steel, leather accents.
- Cyberpunk pistol: coated metal/polymer, contrasting trim, selective glowing accents.
- Fantasy weapon: wood or metal body, engraved trim, colored crystal or magical glow.
- Alien weapon: coherent organic materials with distinctive contrasting surfaces.

The goal is an **instant concept preview in 3D**, even before an artist paints any textures. Avoid default-gray-everything output.

Prefer standard PBR properties where appropriate: **base color, metallic, roughness, emissive** (and texture slots where available). Expose palette overrides so a user can recolor the weapon without regenerating its geometry.

### C. UVs: highly desirable, but not a blocker

**Automatic UV unwrapping would be awesome, but it is not mandatory for the first working version.**

If feasible, generate sensible UV islands for individual parts, with predictable texel density and little overlap unless intentional. An atlas workflow could also be useful later.

If robust UV generation turns out to be too costly or unreliable initially:

- Keep distinct, editable material groups.
- Export usable geometry with material colors.
- Prefer procedural/parametric materials that look decent without custom texture maps.
- Leave a clean path for UV generation or external unwrapping later.

Don't let imperfect UVs hold the entire project hostage. **Good material separation and useful base colors come first.**

### D. Stable material identities

Where practical, give materials and parts consistent semantic names/IDs so recoloring and texture assignments can survive regeneration of the same recipe or changes to unrelated parameters.

Example: `MAT_Body`, `MAT_Grip`, `MAT_Barrel`, `MAT_Trim`, `MAT_Emissive`.

Names are illustrative, not mandatory API specifications.

## 4. Procedural construction

Generate recognizable weapon assemblies from reusable procedural components and rules, rather than attaching arbitrary parts at random.

Examples of logical components include bodies/housings, barrels, stocks, grips, magazines/power cells, sights, and style-specific details. Components should be proportionate and arranged into a coherent silhouette.

Required design goals:

- **Deterministic generation:** same recipe and seed should reproduce the same model.
- **Controllable variation:** size, proportions, silhouette, complexity, palette, amount of ornamentation, wear, etc.
- **Modular construction:** components can be independently identified, edited, replaced, or styled where useful.
- **Plausible design language:** modern looks modern; steampunk looks steampunk; fantasy looks fantasy.
- **Art-direction controls:** allow a user to request cleaner, chunkier, more ornate, more industrial, more low-poly, and similar broad looks.
- **Reproducible recipes:** save, load, edit, share, and batch-generate weapon variants.

The generator does **not** need to model fully functional real-world mechanical internals. This is for **visual game assets**, not real-world fabrication or mechanical weapon engineering.

## 5. Game-ready asset requirements

Aim to export a complete, organized asset with:

- Clean, consistently scaled and oriented geometry.
- Reasonable normals, shading, and topology for the intended art style.
- Sensible object/component names and hierarchy.
- Identifiable moving pieces where appropriate (e.g., magazine, slide, bolt, trigger, energy cell).
- Appropriate pivot/origin locations for those pieces.
- Named attachment points / sockets for optional optics, effects, hands, etc.
- Simple collision representation and LOD support when practical.
- First-person / third-person detail presets eventually, if helpful.
- Optional animation-ready rig or metadata for firing, reloading, and inspection.

**Animations and advanced rigs are desirable later-stage features, not a reason to delay a working procedural mesh generator.** Fictional weapon types may use very different actions; don't force all types into one real-gun animation scheme.

The output should be easy to take into an engine and implement gameplay around. **BadGun should not dictate the game's combat, damage, recoil, ballistics, or input systems.** Optional generic metadata is fine; engine-specific behavior belongs in integration code.

## 6. Engine-independent export

**Preferred initial format:** glTF 2.0 / `.glb`, provided it supports the geometry, material groups, and hierarchy we need reliably.

Possible later formats/adapters: separate `.gltf`, OBJ for basic static meshes, FBX through suitable tooling, and direct integrations with Godot, Unreal, Unity, or NoorEngine.

Export should preserve as much as the format allows:

- Geometry and object hierarchy
- Material assignments and base colors / PBR properties
- Component names and pivots
- UVs, when available
- Attachment point metadata or a clearly documented equivalent
- Recipe and seed, via sidecar JSON/manifest if necessary

Use open, documented formats and avoid mandatory dependence on a particular game engine or paid asset package.

## 7. Suggested user experience

An ideal BadGun tool might offer:

1. Pick a weapon archetype.
2. Pick a visual style, and optionally a faction/collection theme.
3. Choose a seed or press **Generate**.
4. See a **real-time 3D preview with the intended colors already applied**.
5. Adjust proportions, style, palette, details, and individual material groups.
6. Inspect isolated parts and material assignments.
7. Save the recipe or export the game-ready asset.

A standalone app is welcome, or Sage may choose a library-first approach with a lightweight preview tool. Integration as a **NoorMD bench** could come later, but is **not required** and should not create a dependency.

Useful stretch features: batch generation, matching faction arsenals, part swapping, randomize-only-selected-parameters, before/after previews, and export validation.

## 8. Practical milestones (suggested, not prescribed)

**M1 — Solid vertical slice**

Generate one recognizable weapon archetype in one style, with a stable seed, editable material groups, thoughtfully colored PBR defaults, a simple preview, and valid `.glb` export. This is the crucial proof of concept.

**M2 — Variations and recipes**

Add meaningful geometric variation, parameter controls, save/load recipes, and predictable material identities. Validate imports in at least one external DCC app or game engine.

**M3 — More archetypes and style profiles**

Expand into distinct weapon families and visually convincing styles. Prioritize quality and coherence over sheer number of random combinations.

**M4 — Production polish**

Improve UVs where feasible, LODs, sockets, pivots, part organization, optional animation metadata, batch generation, and cross-engine export testing.

**M5 — Ecosystem features**

Faction arsenals, advanced materials, optional rigs and animations, adapters, and potential NoorMD integration.

Sage can change the implementation details and ordering if there is a better technical approach.

## 9. What success looks like

A good early demonstration would be to generate **three variations of a rifle-like asset** with the same general archetype but different themes (for example, modern, steampunk, and sci-fi), each with:

- A convincing, distinct silhouette.
- A palette that already communicates the final design.
- Separately editable body, grip, barrel/front, and accent materials.
- A clean component hierarchy.
- A reliable, reproducible recipe.
- A `.glb` that opens in Blender or a game engine with the right geometry and colors.

If the first working implementation achieves that, **BadGun is useful already**. Everything else can grow from there.

## 10. Freedom to solve the hard parts

This document describes **what we want to achieve**, not a demand for one specific architecture or a finished feature checklist on day one.

Especially for texturing: **Sage should choose the best practical solution** for material separation, material IDs, optional automatic UVs, and engine-friendly export. The intent is to make generated models both visually appealing immediately and easy for a human to customize afterward.

If a feature is expensive or impractical early on, implement a sound foundation and document the limitation. Prefer a smaller polished generator over a giant generator of unusable meshes.

---

**In one sentence:** *BadGun generates reproducible, visually coherent, game-ready weapons in many genres, with well-organized parts, editable materials, smart default colors, and engine-independent exports.*
