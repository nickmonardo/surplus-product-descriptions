import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Failure modes recorded before implementation:
// - The to-do list asks for a detail the product data already states (drawer count on a
//   "6 drawer dresser"), or asks twice (a curated ask and the same FAQ gap).
// - A detail checked off as "doesn't apply", or done without a value, becomes a product fact.
// - A rewrite's request drops the confirmed details or the client's current copy, or the
//   confirmed detail doesn't unlock its keyword ("nightstand with drawers").
const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const req = (id) => {
    if (id in deps) return deps[id];
    if (id.startsWith('node:')) return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function('require', 'module', 'exports', source)(req, loaded, loaded.exports);
  return loaded.exports;
}
const keywords = load('src/lib/copy/keywords.ts');
const rules = load('src/lib/copy/rules.ts');
const asks = load('src/lib/copy/data-asks.ts', { './keywords': keywords });

const nightstand = { sku: 'N1', name: 'Alabaster Oak Nightstand Dark Oak', categories: ['Nightstands'], currentDescription: 'Dimensions 23.82"W x 15.87"D x 22.24"H' };

test('asks only for what the product data lacks', () => {
  const list = asks.dataAsks(nightstand, 'nightstand', []);
  assert.deepEqual(list.map((a) => a.id), ['drawer-count']); // dimensions are in the copy
  assert.equal(list[0].keyword.keyword, 'nightstand with drawers');
  const withDrawers = asks.dataAsks({ ...nightstand, attributes: { features: '2 drawers' } }, 'nightstand', []);
  assert.deepEqual(withDrawers, []);
  const dresser = asks.dataAsks({ sku: 'D1', name: 'Oak 6 Drawer Dresser', currentDescription: '54"W x 16"D x 37"H' }, 'dresser', []);
  assert.deepEqual(dresser, []);
});

test('FAQ gaps become asks unless a curated ask covers them', () => {
  const recliner = { sku: 'R1', name: 'Mega Fog Swivel Glider Recliner', currentDescription: 'Corduroy fabric.' };
  const gaps = [
    { q: "What's the weight capacity?", why: 'Common question.' },
    { q: 'How do I clean it?', why: 'Care.' },
    { q: 'Does it come with a footrest?', why: 'Shoppers ask.' },
  ];
  const list = asks.dataAsks(recliner, 'recliner', gaps);
  const ids = list.map((a) => a.id);
  assert.deepEqual(ids.filter((id) => id.startsWith('faq-')), ['faq-does-it-come-with-a-footrest']);
  assert.ok(ids.includes('weight-capacity') && ids.includes('care') && ids.includes('reclining-type'));
  for (const id of ids) assert.ok(asks.isAskId(id), id);
});

test('only done items with a value become facts', () => {
  const list = [
    { id: 'drawer-count', field: 'Drawer count', needsValue: true },
    { id: 'materials', field: 'Materials', needsValue: true },
    { id: 'category', field: 'Category', needsValue: false },
  ];
  const fix = (askId, status, value) => ({ batchId: 'b', sku: 'N1', askId, status, value, by: 'dev', at: '' });
  assert.deepEqual(
    asks.confirmedFacts(list, [fix('drawer-count', 'done', ' 2 drawers '), fix('materials', 'not_applicable', ''), fix('category', 'done', '')]),
    { 'Drawer count': '2 drawers' },
  );
});

test('a confirmed detail unlocks its keyword and reaches the rewrite request', () => {
  const before = keywords.pickKeywords(nightstand);
  assert.notEqual(before.primary.keyword, 'nightstand with drawers');
  const withFact = { ...nightstand, attributes: { 'Drawer count': '2 drawers' } };
  const plan = keywords.pickKeywords(withFact);
  assert.equal(plan.primary.keyword, 'nightstand with drawers');
  const current = { description_html: '<p>Client edit stays.</p>', meta_title: 'T', meta_description: 'M', faq_html: '' };
  const req = JSON.parse(rules.revisionRequestText(withFact, plan, current, { 'Drawer count': '2 drawers' }));
  assert.deepEqual(req.new_details, { 'Drawer count': '2 drawers' });
  assert.equal(req.product['Drawer count'], '2 drawers');
  assert.equal(req.current_copy.description, 'Client edit stays.');
  assert.equal(req.keywords.primary, 'nightstand with drawers');
});

test('the confirmed number passes the fact check in the rewritten copy', () => {
  const withFact = { ...nightstand, attributes: { 'Drawer count': '3 drawers' } };
  assert.ok(rules.allowedNumbers(withFact).has('3'));
  assert.ok(!rules.allowedNumbers(nightstand).has('3'));
});

test('every seed product has well-formed asks', () => {
  const seed = JSON.parse(fs.readFileSync('data/seed-batch.json', 'utf8'));
  for (const p of seed.products) {
    const ids = new Set();
    for (const a of p.dataAsks ?? []) {
      assert.ok(asks.isAskId(a.id), `${p.sku} ${a.id}`);
      assert.ok(!ids.has(a.id), `duplicate ${p.sku} ${a.id}`);
      ids.add(a.id);
      assert.ok(a.field && a.ask && a.why, `${p.sku} ${a.id}`);
    }
  }
});
