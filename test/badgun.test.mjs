import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBytes } from 'gltf-validator';
import { inflateSync } from 'node:zlib';
import { generate, toGLB, buildManifest, STYLES, ARCHETYPES, generateFaction, factionToGLB, buildAtlas, bakeTexture, encodePNG, ID_COLORS } from '../dist/index.js';

const base = { archetype: 'rifle', style: 'steampunk', seed: 42 };
const component = (w, name) => w.components.find((c) => c.name === name);
const positions = (c) => [...c.geometry.values()].map((g) => g.positions.join(',')).join('|');

test('same recipe -> byte-identical .glb', () => {
  for (const style of Object.keys(STYLES)) {
    const r = { ...base, style };
    assert.deepEqual(toGLB(generate(r)), toGLB(generate(r)));
  }
});

test('different seeds -> different weapons', () => {
  const a = toGLB(generate({ ...base, seed: 1 }));
  const b = toGLB(generate({ ...base, seed: 2 }));
  assert.notDeepEqual(a, b);
});

test('string seeds work', () => {
  const w = generate({ ...base, seed: 'tom-was-here' });
  assert.ok(w.components.length > 5);
});

test('recoloring changes materials, never geometry', () => {
  const a = generate(base);
  const b = generate({ ...base, palette: { Body: '#ff00ff', Stock: { color: '#00ff00', roughness: 0.9 } } });
  assert.equal(b.palette.Body.color, '#ff00ff');
  assert.equal(b.palette.Stock.roughness, 0.9);
  for (const c of a.components) assert.equal(positions(component(b, c.name)), positions(c), c.name);
});

test('changing one param leaves unrelated parts alone', () => {
  // Ornament decorates the receiver/stock; the magazine's proportions don't depend on it.
  const a = generate({ ...base, parts: { magazine: 'drum' }, params: { ornament: 0.1, bulk: 0.5 } });
  const b = generate({ ...base, parts: { magazine: 'drum' }, params: { ornament: 0.9, bulk: 0.5 } });
  assert.deepEqual(a.parts, b.parts);
  assert.equal(component(a, 'Trigger').geometry.get('Detail').positions.join(), component(b, 'Trigger').geometry.get('Detail').positions.join());
  assert.notEqual(positions(component(a, 'Stock')), positions(component(b, 'Stock')));
});

test('material names are stable and semantic', () => {
  for (const style of Object.keys(STYLES)) {
    const m = buildManifest(generate({ ...base, style }));
    for (const mat of m.materials) assert.match(mat.name, /^MAT_(Body|Barrel|Grip|Stock|Magazine|Sight|Trim|Accent|Detail|Glass|Emissive)$/);
    const names = m.materials.map((x) => x.name);
    for (const required of ['MAT_Body', 'MAT_Barrel']) assert.ok(names.includes(required), `${style} lacks ${required}`);
    assert.ok(names.length >= 3, `${style}: only ${names.length} materials`);
  }
});

const SOCKETS = {
  common: ['SOCKET_Muzzle', 'SOCKET_Optic', 'SOCKET_ADS', 'SOCKET_Hand_Grip', 'SOCKET_Hand_Support'],
  longgun: ['SOCKET_Magazine', 'SOCKET_Eject', 'SOCKET_Shoulder'],
  pistol: ['SOCKET_Magazine', 'SOCKET_Eject'],
  crossbow: ['SOCKET_Nock', 'SOCKET_Shoulder'],
  bow: ['SOCKET_Hand_Draw', 'SOCKET_Nock'],
};
const family = (a) => (['pistol', 'crossbow', 'bow'].includes(a) ? a : 'longgun');
const required = (a) => (a === 'bow' ? ['SOCKET_Muzzle', 'SOCKET_Hand_Grip', 'SOCKET_ADS', ...SOCKETS.bow] : [...SOCKETS.common, ...SOCKETS[family(a)]]);
/** Overall length range (meters) per archetype. */
const LENGTH = { rifle: [0.6, 1.5], smg: [0.4, 1.1], shotgun: [0.45, 1.6], sniper: [0.8, 1.8], lmg: [0.8, 1.7], pistol: [0.15, 0.6], crossbow: [0.6, 1.3], bow: [0.7, 2.0] };
/** Bows stand upright, so their size is their height; everything else is measured along the barrel. */
const size = (a, m) => (a === 'bow' ? m.bounds.size[1] : m.bounds.size[2]);

test('every weapon type has its sockets and moving parts', () => {
  for (const archetype of Object.keys(ARCHETYPES)) {
    for (const style of Object.keys(STYLES)) {
      const w = generate({ archetype, style, seed: 7 });
      const sockets = w.sockets.map((s) => s.name);
      for (const s of required(archetype)) assert.ok(sockets.includes(s), `${archetype}/${style} lacks ${s}`);
      if (archetype !== 'bow') assert.equal(component(w, 'Trigger').motion.purpose, 'fire', `${archetype}/${style} trigger`);
      const movers = w.components.filter((c) => c.motion).map((c) => c.motion.purpose);
      if (family(archetype) === 'longgun') assert.ok(movers.some((m) => /reload|pump|cycle/.test(m)), `${archetype}/${style}: ${movers}`);
      if (archetype === 'bow') assert.ok(component(w, 'String').motion.purpose.startsWith('draw') && component(w, 'Arrow'), 'bow string + arrow');
      if (archetype === 'crossbow') assert.ok(component(w, 'String') && component(w, 'Bolt'), 'crossbow string + bolt');
    }
  }
});

test('origin sits at the grip hand, muzzle points +Z, sizes are plausible', () => {
  for (const archetype of Object.keys(ARCHETYPES)) {
    for (const style of Object.keys(STYLES)) {
      for (const seed of [1, 2, 3]) {
        const m = buildManifest(generate({ archetype, style, seed }));
        const grip = m.sockets.find((s) => s.name === 'SOCKET_Hand_Grip');
        assert.deepEqual(grip.position, [0, 0, 0]);
        const muzzle = m.sockets.find((s) => s.name === 'SOCKET_Muzzle');
        assert.ok(muzzle.position[2] > 0.08, `${archetype}/${style}/${seed}: muzzle in front of the hand`);
        const [lo, hi] = LENGTH[archetype];
        assert.ok(size(archetype, m) > lo && size(archetype, m) < hi, `${archetype}/${style}/${seed}: size ${size(archetype, m)}`);
      }
    }
  }
});

test('archetypes pick variants that fit them', () => {
  for (const style of Object.keys(STYLES)) {
    for (let seed = 1; seed <= 10; seed++) {
      const sh = generate({ archetype: 'shotgun', style, seed });
      if (['double', 'overunder'].includes(sh.parts.barrel)) {
        assert.deepEqual([sh.parts.magazine, sh.parts.handguard], ['none', 'splinter'], 'break action');
      } else if (sh.parts.config === 'lever') {
        assert.equal(sh.parts.magazine, 'tube', 'lever action feeds from a tube');
      } else if (sh.parts.config === 'boxfed') {
        assert.ok(!['tube', 'none'].includes(sh.parts.magazine) && sh.parts.handguard !== 'pump', 'box-fed');
      } else {
        assert.deepEqual([sh.parts.magazine, sh.parts.handguard], ['tube', 'pump'], 'pump action');
      }
      const sn = generate({ archetype: 'sniper', style, seed });
      assert.ok(['scope', 'brass', 'rune'].includes(sn.parts.sight), `sniper sight ${sn.parts.sight}`);
      assert.ok(component(sn, 'BoltHandle'), 'sniper bolt handle');
      assert.ok(component(generate({ archetype: 'lmg', style, seed }), 'Bipod'), 'lmg bipod');
      for (const a of ['rifle', 'smg']) {
        const w = generate({ archetype: a, style, seed });
        assert.ok(!['ammobox'].includes(w.parts.magazine) && (w.parts.magazine !== 'tube' || w.parts.config === 'lever'), `${a}: ${w.parts.magazine}`);
        assert.equal(w.parts.stock === 'butt', w.parts.config === 'bullpup', 'bullpups (and only bullpups) get a butt stock');
        assert.equal(['sporter', 'military'].includes(w.parts.stock), w.parts.grip === 'integral', 'one-piece stocks carry their own grip');
        if (w.parts.config === 'machinepistol') assert.ok(['straight', 'stick'].includes(w.parts.magazine), 'machine pistols feed through the grip');
      }
    }
  }
});

test('unknown part variants fail loudly with the available options', () => {
  assert.throws(() => generate({ ...base, parts: { stock: 'banana' } }), /Available: /);
  assert.throws(() => generate({ ...base, style: 'vaporwave' }), /Unknown style/);
  assert.throws(() => generate({ ...base, archetype: 'bee-launcher' }), /Unknown archetype/);
});

test('every archetype x style x part variant exports a valid glTF', async () => {
  const recipes = [];
  for (const [archetype, def] of Object.entries(ARCHETYPES)) {
    for (const style of Object.keys(STYLES)) {
      for (let seed = 1; seed <= 2; seed++) recipes.push({ archetype, style, seed });
      recipes.push({ archetype, style, seed: 9, params: { smoothness: 0, bulk: 1, length: 1, ornament: 1, detail: 1, wear: 1 } });
      recipes.push({ archetype, style, seed: 9, params: { smoothness: 1, bulk: 0, length: 0, ornament: 0, detail: 0, wear: 0 } });
      for (const optic of def.optics) recipes.push({ archetype, style, seed: 3, optic });
      // Every variant once per style (long guns share tables, so test them on two archetypes).
      if (['smg', 'sniper', 'lmg'].includes(archetype)) continue;
      for (const [kind, table] of Object.entries(def.parts)) {
        for (const variant of Object.keys(table)) recipes.push({ archetype, style, seed: 5, parts: { [kind]: variant } });
      }
    }
  }
  for (const r of recipes) {
    const report = await validateBytes(toGLB(generate(r)));
    const errors = report.issues.messages.filter((m) => m.severity <= 1);
    assert.equal(errors.length, 0, `${JSON.stringify(r)}: ${errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  }
  console.log(`# validated ${recipes.length} weapons`);
});

test('factions: deterministic, one palette, shared doctrine, valid arsenal file', async () => {
  for (const style of Object.keys(STYLES)) {
    const a = generateFaction({ style, seed: 11 });
    const b = generateFaction({ style, seed: 11 });
    assert.equal(a.name, b.name);
    assert.deepEqual(factionToGLB(a), factionToGLB(b), `${style}: same faction seed -> same arsenal`);
    // Every member wears the same paint.
    const accent = a.members.map((m) => m.weapon.palette.Accent.color);
    assert.equal(new Set(accent).size, 1, `${style}: one accent color`);
    assert.equal(accent[0], a.color);
    // Doctrine: long guns mostly share the faction's preferred receiver.
    const want = a.doctrine.longgun.receiver;
    // (Bolt-action receivers are only preferred by rifles and snipers.)
    const longs = a.members.filter((m) => !['pistol', 'crossbow', 'bow'].includes(m.archetype) && (want !== 'boltaction' || ['rifle', 'sniper'].includes(m.archetype)));
    const hits = longs.filter((m) => m.weapon.parts.receiver === want).length;
    assert.ok(hits >= longs.length - 1, `${style}: ${hits}/${longs.length} use the doctrine receiver ${want}`);
    // Everyone carries the insignia, and the arsenal is valid glTF.
    const report = await validateBytes(factionToGLB(a));
    assert.equal(report.issues.messages.filter((m) => m.severity <= 1).length, 0, `${style}: arsenal glTF errors`);
  }
});

test('preferences are soft: archetype rules still win', () => {
  const sh = generate({ archetype: 'shotgun', style: 'modern', seed: 3, prefer: { magazine: 'curved', handguard: 'quad' } });
  assert.notEqual(sh.parts.magazine, 'curved');
  const r = generate({ archetype: 'rifle', style: 'modern', seed: 3, parts: { config: 'standard' }, prefer: { stock: 'thumbhole' } });
  assert.equal(r.parts.stock, 'thumbhole');
});

/** Paint each atlas chart with its own id; count pixels claimed by two charts. */
function atlasOverlap(weapon, atlas, size) {
  const owner = new Int32Array(size * size).fill(-1);
  let over = 0, filled = 0, next = 0;
  for (const c of weapon.components) for (const geo of c.geometry.values()) {
    const uv = atlas.uvs.get(geo);
    const parent = Int32Array.from({ length: geo.vertexCount }, (_, i) => i);
    const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    const I = geo.indices;
    for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); parent[find(I[t + 1])] = r; parent[find(I[t + 2])] = r; }
    const ids = new Map();
    for (let t = 0; t < I.length; t += 3) {
      const root = find(I[t]);
      if (!ids.has(root)) ids.set(root, next++);
      const id = ids.get(root);
      const [ax, ay, bx, by, cx, cy] = [0, 1, 2].flatMap((k) => [uv[I[t + k] * 2] * size, uv[I[t + k] * 2 + 1] * size]);
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-12) continue;
      const sg = Math.sign(area);
      for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy))); y <= Math.min(size - 1, Math.ceil(Math.max(ay, by, cy))); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(ax, bx, cx))); x <= Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx))); x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * sg;
          const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * sg;
          const w2 = ((ax - px) * (by - py) - (ay - py) * (bx - px)) * sg;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const i = y * size + x;
          if (owner[i] === -1) { owner[i] = id; filled++; } else if (owner[i] !== id) over++;
        }
      }
    }
  }
  return { over, filled };
}

test('texture atlas: every surface gets its own spot in the 0..1 square', () => {
  for (const archetype of Object.keys(ARCHETYPES)) {
    for (const style of Object.keys(STYLES)) {
      const w = generate({ archetype, style, seed: 7 });
      const atlas = buildAtlas(w);
      for (const uv of atlas.uvs.values()) for (const v of uv) assert.ok(v >= 0 && v <= 1, `${archetype}/${style}: atlas UV ${v} outside 0..1`);
      const { over, filled } = atlasOverlap(w, atlas, 512);
      assert.equal(over, 0, `${archetype}/${style}: ${over} overlapping atlas pixels`);
      assert.ok(atlas.coverage > 0.4, `${archetype}/${style}: atlas only ${Math.round(atlas.coverage * 100)}% used`);
      assert.ok(filled > 0);
    }
  }
  // Deterministic: same weapon, same layout.
  const a = buildAtlas(generate(base)), b = buildAtlas(generate(base));
  assert.deepEqual([...a.uvs.values()].map((u) => Array.from(u)), [...b.uvs.values()].map((u) => Array.from(u)));
});

test('texture bakes encode as valid PNGs and the textured .glb is valid glTF', async () => {
  const w = generate(base);
  for (const mode of ['basecolor', 'id', 'layout']) {
    const img = bakeTexture(w, mode, { size: 256 });
    const png = encodePNG(img.data, img.width, img.height);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    // Decode IDAT with zlib and undo the Sub filter: must give back the exact pixels.
    const len = new DataView(png.buffer, png.byteOffset + 33).getUint32(0);
    const raw = inflateSync(png.subarray(41, 41 + len));
    const stride = 256 * 4, out = new Uint8Array(256 * stride);
    for (let y = 0; y < 256; y++) {
      assert.equal(raw[y * (stride + 1)], 1, 'Sub filter');
      for (let x = 0; x < stride; x++) out[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + (x >= 4 ? out[y * stride + x - 4] : 0)) & 255;
    }
    assert.deepEqual(out, img.data, `${mode}: PNG round trip`);
  }
  // The ID map only uses the documented slot colors (plus black background).
  const id = bakeTexture(w, 'id', { size: 128 }).data;
  const allowed = new Set(['000000', ...Object.values(ID_COLORS).map((c) => c.slice(1))]);
  for (let i = 0; i < id.length; i += 4) assert.ok(allowed.has([id[i], id[i + 1], id[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')));

  for (const opts of [{}, { uv: 'atlas' }, { texture: 256 }, { texture: 256, uv: 'atlas' }]) {
    const bytes = toGLB(w, opts);
    const report = await validateBytes(bytes);
    const errors = report.issues.messages.filter((m) => m.severity <= 1);
    assert.equal(errors.length, 0, `${JSON.stringify(opts)}: ${errors.map((e) => e.code).join(', ')}`);
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true))));
    const prim = json.meshes[0].primitives[0];
    assert.ok(prim.attributes.TEXCOORD_0 !== undefined && prim.attributes.TEXCOORD_1 !== undefined, 'both UV sets');
    assert.equal(json.scenes[0].nodes.length, 1);
    if (opts.texture) assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord, opts.uv === 'atlas' ? 0 : 1);
  }
  assert.equal(buildManifest(w).uv.atlas, 'TEXCOORD_1');
  assert.equal(buildManifest(w, 'atlas').uv.atlas, 'TEXCOORD_0');
});
