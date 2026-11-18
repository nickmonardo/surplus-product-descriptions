import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Failure modes recorded before implementation:
// - A twin/full bunk bed, an extra firm queen mattress or a sofa & ottoman gets
//   only the head term ("bunk beds", "mattress", "sofa") instead of the
//   product-specific keyword Google.ca searches for.
// - A sectional is filed under sofas, or a mattress protector under mattresses.
// - A draft invents a dimension, a warranty or a price and still passes.
// - A Magento export's store-view rows or hidden child SKUs are drafted twice,
//   or a comma inside an attribute value splits it.
function load(file) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', source)((id) => {
    throw new Error(`Unexpected dependency: ${id}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const keywords = load('src/lib/copy/keywords.ts');
const rules = load('src/lib/copy/rules.ts');
const magento = load('src/lib/copy/magento-export.ts');

// Product names are real Surplus Furniture pages found in Semrush (Google.ca,
// 2026-10-28); attributes are test fixtures, not their catalogue data.
const BUNK = {
  sku: 'TEST-BUNK',
  name: 'Grey Twin/Full Bunk Bed',
  attributes: { color: 'Grey', material: 'Pine and MDF', features: 'Built-in ladder, full-length guard rails', dimensions: '78 x 57 x 65 in' },
};

test('picks the product-specific keyword ahead of the head term', () => {
  const bunk = keywords.pickKeywords(BUNK);
  assert.equal(bunk.category.id, 'bunk-bed');
  assert.equal(bunk.primary.keyword, 'twin over full bunk bed');
  assert.deepEqual(bunk.secondary.map((e) => e.keyword), ['grey bunk bed', 'bunk beds', 'bunk beds for kids']);

  const mattress = keywords.pickKeywords({ name: 'Rock Extra Firm Queen Mattress' });
  assert.equal(mattress.primary.keyword, 'queen mattress');
  assert.deepEqual(mattress.secondary.map((e) => e.keyword), ['firm mattress', 'extra firm mattress', 'firm queen mattress']);

  const sofa = keywords.pickKeywords({ name: 'Grey 2pc Sofa & Ottoman' });
  assert.equal(sofa.primary.keyword, 'sofa and ottoman');
  assert.ok(sofa.secondary.some((e) => e.keyword === 'grey couch'));

  const plain = keywords.pickKeywords({ name: 'Morty Retreat Granite Sofa', attributes: { material: 'Polyester fabric' } });
  assert.equal(plain.primary.keyword, 'fabric sofa');
  assert.deepEqual(plain.secondary.map((e) => e.keyword), ['sofa', 'couch', 'sofa canada']);
});

test('files products under the right category, or none', () => {
  assert.equal(keywords.findCategory('Harlow Reversible Sectional with Ottoman').id, 'sectional');
  assert.equal(keywords.findCategory('Brennan 5pc Counter Height Dining Set').id, 'dining-set');
  assert.equal(keywords.findCategory('Queen Mattress Protector'), null);
  assert.equal(keywords.findCategory('Accent Mirror'), null);
  // Product names from Surplus Furniture's Merchant Center feed, 2026-11-17.
  assert.equal(keywords.pickKeywords({ name: 'UFSER 760 Loft Bed w/Book Case and Desk' }).primary.keyword, 'loft bed with desk');
  assert.equal(keywords.pickKeywords({ name: 'Mazin Furniture Twin/Twin Espresso Bunkbed Brown Wood Laminate' }).primary.keyword, 'twin over twin bunk bed');
  assert.equal(keywords.pickKeywords({ name: 'Beaudoin Bed Frames Twin-Full-Queen Bed Frame' }).primary.keyword, 'queen bed frame');
  assert.equal(keywords.pickKeywords({ name: 'Dynamic Furniture Alabaster Oak Dresser Dark Oak' }).primary.keyword, 'oak dresser');
  assert.equal(keywords.findCategory('Titus Furniture TWIN 39" Metal Storable Base').id, 'bed-frame');
  assert.equal(keywords.pickKeywords({ name: 'Minhas Furniture Heppner Grey Sofa and Loveseat Set' }).primary.keyword, 'sofa and loveseat set');
  assert.equal(keywords.pickKeywords({ name: 'Minhas Furniture Charcoal Loveseat' }).primary.keyword, 'loveseat');
  assert.equal(keywords.pickKeywords({ name: 'Minhas Furniture Mega Fog Swivel Glider Recliner' }).primary.keyword, 'swivel recliner');
  assert.equal(keywords.pickKeywords({ name: 'Minhas Furniture Gavin Grey 6-Piece Dinette Set', attributes: { includes: 'Table, four chairs and a bench' } }).primary.keyword, 'dining table with bench');
  assert.equal(keywords.findCategory('Accent Piece', ['Living Room', 'Sofas']).id, 'sofa');
  const dining = keywords.pickKeywords({ name: 'Brennan 5pc Counter Height Dining Set' });
  assert.equal(dining.primary.keyword, '5 piece dining set');
  assert.equal(keywords.pickKeywords({ name: 'Accent Mirror' }).primary, null);
});

const GOOD = {
  description_html:
    "<p>This grey twin over full bunk bed puts two beds in the footprint of one, giving siblings or guests their own place to sleep in a kids' room or spare room. Its clean lines and grey finish suit most bedroom colours.</p>" +
    '<ul><li>Twin bed on top, full bed below</li><li>Grey finish in pine and MDF</li><li>Built-in ladder and full-length guard rails on the top bunk</li><li>Overall size 78 x 57 x 65 in</li></ul>' +
    '<p>Pair it with a dresser or nightstand in a matching tone to complete the room.</p>',
  meta_title: 'Grey Twin over Full Bunk Bed | Surplus Furniture',
  meta_description:
    "Shop a grey twin over full bunk bed with a built-in ladder and guard rails. Two beds in one footprint for kids' rooms and guest rooms.",
  keywords_used: ['twin over full bunk bed', 'grey bunk bed'],
  research_sources: [],
  reviewer_notes: '',
};

test('a draft that keeps to the product data passes', () => {
  assert.deepEqual(rules.validateDraft(GOOD, BUNK, keywords.pickKeywords(BUNK)), []);
});

test('invented numbers, claims, prices and missing keywords are flagged', () => {
  const plan = keywords.pickKeywords(BUNK);
  const codes = (draft) => rules.validateDraft({ ...GOOD, ...draft }, BUNK, plan).map((i) => i.code);
  const swap = (from, to) => ({ description_html: GOOD.description_html.replace(from, to) });

  assert.deepEqual(codes(swap('78 x 57 x 65 in', '80 x 57 x 65 in')), ['unsupported_number']);
  assert.deepEqual(codes(swap('to complete the room.', 'to complete the room, backed by a warranty.')), ['unsupported_claim']);
  assert.ok(codes(swap('to complete the room.', 'to complete the room, now on sale.')).includes('banned'));
  assert.ok(codes(swap('to complete the room.', 'for under $499.')).includes('banned'));
  assert.deepEqual(codes(swap('Grey finish in pine and MDF', 'Solid pine construction')), ['unsupported_claim']);
  assert.deepEqual(codes(swap('This grey twin over full bunk bed', 'This grey bed')), ['keyword']);
  assert.deepEqual(codes({ meta_title: 'Grey Twin over Full Bunk Bed for Kids Rooms and Guest Rooms | Surplus Furniture' }), ['meta_title']);
  assert.deepEqual(codes({ meta_description: 'Grey twin over full bunk bed.' }), ['meta_description']);
  assert.deepEqual(codes(swap('<ul>', '<ul class="x">')), ['html']);
  assert.ok(codes({ description_html: '<p>A grey twin over full bunk bed.</p>' }).includes('length'));
});

test('copy reasons: missing, thin, new', () => {
  assert.deepEqual(rules.copyReasons({ sku: 'a', name: 'a' }), ['missing']);
  assert.deepEqual(rules.copyReasons({ sku: 'a', name: 'a', currentDescription: '<p>Comfy grey sofa.</p>' }), ['thin']);
  const long = `<p>${'word '.repeat(60)}</p>`;
  assert.deepEqual(rules.copyReasons({ sku: 'a', name: 'a', currentDescription: long, createdAt: '2026-10-20 09:00:00' }, '2026-10-19'), ['new']);
  assert.deepEqual(rules.copyReasons({ sku: 'a', name: 'a', currentDescription: long, createdAt: '2026-10-01 09:00:00' }, '2026-10-19'), []);
});

test('reads a Magento product export', () => {
  const csv = [
    'sku,store_view_code,name,description,categories,product_online,visibility,url_key,created_at,additional_attributes',
    'SF-1,,Grey Twin/Full Bunk Bed,,"Default Category/Bedroom Furniture/Beds,Default Category/Kids",1,"Catalog, Search",grey-twin-full-bunk-bed,2026-10-20 09:00:00,"color=Grey,material=Pine, MDF,features=Ladder|Guard rails,tax_class=Taxable"',
    'SF-1,fr,Lit superposé gris,,,1,"Catalog, Search",,,',
    'SF-1-CHILD,,Child SKU,,,1,Not Visible Individually,,,',
    'SF-2,,Disabled Sofa,,,2,"Catalog, Search",,,',
    'SF-3,,"Rock Extra Firm Queen Mattress","<p>Firm.</p>\n<p>Quote ""here"".</p>",Default Category/Mattresses,1,"Catalog, Search",rock-extra-firm-queen-mattress,,',
  ].join('\n');
  const products = magento.productsFromExport(csv);
  assert.deepEqual(products.map((p) => p.sku), ['SF-1', 'SF-3']);
  const [bunk, mattress] = products;
  assert.equal(bunk.url, 'https://www.surplusfurniture.com/grey-twin-full-bunk-bed');
  assert.deepEqual(bunk.categories, ['Beds', 'Kids']);
  assert.deepEqual(bunk.attributes, { color: 'Grey', material: 'Pine, MDF', features: 'Ladder, Guard rails' });
  assert.equal(mattress.currentDescription, '<p>Firm.</p>\n<p>Quote "here".</p>');
  assert.deepEqual(rules.copyReasons(bunk, '2026-10-19'), ['missing', 'new']);
});
