import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBytes } from 'gltf-validator';
import { generate, toGLB, buildManifest, STYLES, RIFLE_PARTS, OPTIC_NAMES } from '../dist/index.js';

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

test('every rifle has the core sockets and moving parts', () => {
  for (const style of Object.keys(STYLES)) {
    const w = generate({ ...base, style });
    const sockets = w.sockets.map((s) => s.name);
    for (const s of ['SOCKET_Muzzle', 'SOCKET_Optic', 'SOCKET_ADS', 'SOCKET_Hand_Grip', 'SOCKET_Hand_Support', 'SOCKET_Magazine', 'SOCKET_Eject', 'SOCKET_Shoulder']) {
      assert.ok(sockets.includes(s), `${style} lacks ${s}`);
    }
    assert.equal(component(w, 'Magazine').motion.purpose, 'reload');
    assert.equal(component(w, 'Trigger').motion.purpose, 'fire');
  }
});

test('origin sits at the grip hand, muzzle points +Z, size is rifle-like', () => {
  for (const style of Object.keys(STYLES)) {
    const m = buildManifest(generate({ ...base, style }));
    const grip = m.sockets.find((s) => s.name === 'SOCKET_Hand_Grip');
    assert.deepEqual(grip.position, [0, 0, 0]);
    const muzzle = m.sockets.find((s) => s.name === 'SOCKET_Muzzle');
    assert.ok(muzzle.position[2] > 0.3, 'muzzle in front of the hand');
    assert.ok(m.bounds.size[2] > 0.7 && m.bounds.size[2] < 1.5, `length ${m.bounds.size[2]}`);
  }
});

test('unknown part variants fail loudly with the available options', () => {
  assert.throws(() => generate({ ...base, parts: { stock: 'banana' } }), /Available: /);
  assert.throws(() => generate({ ...base, style: 'vaporwave' }), /Unknown style/);
});

test('every style x part x optic combination exports a valid glTF', async () => {
  const recipes = [];
  for (const style of Object.keys(STYLES)) {
    for (let seed = 1; seed <= 3; seed++) recipes.push({ ...base, style, seed });
    for (const [kind, table] of Object.entries(RIFLE_PARTS)) {
      for (const variant of Object.keys(table)) recipes.push({ ...base, style, parts: { [kind]: variant } });
    }
    for (const optic of ['none', ...OPTIC_NAMES]) recipes.push({ ...base, style, optic });
    recipes.push({ ...base, style, params: { smoothness: 0, bulk: 1, length: 1, ornament: 1, detail: 1, wear: 1 } });
    recipes.push({ ...base, style, params: { smoothness: 1, bulk: 0, length: 0, ornament: 0, detail: 0, wear: 0 } });
  }
  for (const r of recipes) {
    const report = await validateBytes(toGLB(generate(r)));
    const errors = report.issues.messages.filter((m) => m.severity <= 1);
    assert.equal(errors.length, 0, `${JSON.stringify(r)}: ${errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  }
});
