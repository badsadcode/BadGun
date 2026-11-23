import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBytes } from 'gltf-validator';
import { generate, toGLB, buildManifest, STYLES, ARCHETYPES } from '../dist/index.js';

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
    for (const required of ['MAT_Body', 'MAT_Barrel', 'MAT_Grip', 'MAT_Stock']) assert.ok(names.includes(required), `${style} lacks ${required}`);
  }
});

const SOCKETS = {
  common: ['SOCKET_Muzzle', 'SOCKET_Optic', 'SOCKET_ADS', 'SOCKET_Hand_Grip', 'SOCKET_Hand_Support'],
  longgun: ['SOCKET_Magazine', 'SOCKET_Eject', 'SOCKET_Shoulder'],
  pistol: ['SOCKET_Magazine', 'SOCKET_Eject'],
  crossbow: ['SOCKET_Nock', 'SOCKET_Shoulder'],
};
const family = (a) => (a === 'pistol' || a === 'crossbow' ? a : 'longgun');
/** Overall length range (meters) per archetype. */
const LENGTH = { rifle: [0.7, 1.4], smg: [0.45, 1.0], shotgun: [0.8, 1.5], sniper: [0.9, 1.7], lmg: [0.9, 1.6], pistol: [0.15, 0.5], crossbow: [0.6, 1.3] };

test('every weapon type has its sockets and moving parts', () => {
  for (const archetype of Object.keys(ARCHETYPES)) {
    for (const style of Object.keys(STYLES)) {
      const w = generate({ archetype, style, seed: 7 });
      const sockets = w.sockets.map((s) => s.name);
      for (const s of [...SOCKETS.common, ...SOCKETS[family(archetype)]]) assert.ok(sockets.includes(s), `${archetype}/${style} lacks ${s}`);
      assert.equal(component(w, 'Trigger').motion.purpose, 'fire', `${archetype}/${style} trigger`);
      const movers = w.components.filter((c) => c.motion).map((c) => c.motion.purpose);
      if (family(archetype) === 'longgun') assert.ok(movers.includes(archetype === 'shotgun' ? 'pump' : 'reload'), `${archetype}/${style}: ${movers}`);
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
        assert.ok(m.bounds.size[2] > lo && m.bounds.size[2] < hi, `${archetype}/${style}/${seed}: length ${m.bounds.size[2]}`);
      }
    }
  }
});

test('archetypes pick variants that fit them', () => {
  for (const style of Object.keys(STYLES)) {
    for (let seed = 1; seed <= 10; seed++) {
      const sh = generate({ archetype: 'shotgun', style, seed });
      assert.equal(sh.parts.magazine, 'tube');
      assert.equal(sh.parts.handguard, 'pump');
      const sn = generate({ archetype: 'sniper', style, seed });
      assert.ok(['scope', 'brass'].includes(sn.parts.sight), `sniper sight ${sn.parts.sight}`);
      assert.ok(component(sn, 'BoltHandle'), 'sniper bolt handle');
      assert.ok(component(generate({ archetype: 'lmg', style, seed }), 'Bipod'), 'lmg bipod');
      for (const a of ['rifle', 'smg']) assert.ok(!['tube', 'ammobox'].includes(generate({ archetype: a, style, seed }).parts.magazine));
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
