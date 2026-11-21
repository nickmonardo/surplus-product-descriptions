import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Failure modes recorded before implementation:
// - A tampered, expired or wrong-kind token signs someone in, or an address removed from
//   the allowlist keeps a working session.
// - Edited copy keeps a <script>, an onclick or a link through the server sanitizer.
// - FAQ answers state a weight or warranty the product data doesn't have.
// - The feed keeps the store/UTM query string on product URLs, or drafts a SKU twice
//   (local and online rows), or a product without a title.
// - The weekly run re-drafts products already drafted, or puts thin products ahead of new ones.
// - Tepperman's parsing breaks on its page layout, or calls a comforter set a comparable loft bed.
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
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const keywords = load('src/lib/copy/keywords.ts');
const rules = load('src/lib/copy/rules.ts');
const tokens = load('src/lib/tokens.ts');
const urls = load('src/lib/urls.ts');
const windsor = load('src/lib/feed/windsor.ts', { '../urls': urls });
const select = load('src/lib/select.ts', { './copy/rules': rules });
const tepp = load('src/lib/competitors/teppermans.ts');

test('sign-in tokens: valid, tampered, expired, wrong kind, removed from allowlist', () => {
  process.env.AUTH_SECRET = 'x'.repeat(40);
  process.env.REVIEWER_EMAILS = 'buyer@surplusfurniture.com';
  delete process.env.ALLOWED_DOMAINS;
  const now = Date.UTC(2026, 10, 18);
  const link = tokens.signToken('link', 'Buyer@SurplusFurniture.com', 900, now);
  assert.equal(tokens.verifyToken(link, 'link', now + 1000), 'buyer@surplusfurniture.com');
  assert.equal(tokens.verifyToken(link, 'session', now + 1000), null);
  assert.equal(tokens.verifyToken(link, 'link', now + 901_000), null);
  const [body, sig] = link.split('.');
  const forged = Buffer.from(JSON.stringify({ kind: 'link', email: 'x@theinfluenceagency.com', exp: 9e9 })).toString('base64url');
  assert.equal(tokens.verifyToken(`${forged}.${sig}`, 'link', now), null);
  assert.equal(tokens.verifyToken(`${body}.AAAA`, 'link', now), null);
  process.env.REVIEWER_EMAILS = '';
  assert.equal(tokens.verifyToken(link, 'link', now + 1000), null);
  assert.equal(tokens.isAllowedEmail('nick@theinfluenceagency.com'), true);
  assert.equal(tokens.isAllowedEmail('someone@gmail.com'), false);
  assert.equal(tokens.isStaff('nick@theinfluenceagency.com'), true);
  assert.equal(tokens.isStaff('buyer@surplusfurniture.com'), false);
  process.env.AUTH_SECRET = 'short';
  assert.throws(() => tokens.signToken('link', 'a@theinfluenceagency.com', 60));
});

test('edited copy is sanitized on the server', () => {
  const dirty = '<p class="x" onclick="evil()">Hi <b>there</b><script>alert(1)</script></p><div>Two</div><a href="http://x">link</a><img src=x onerror=alert(1)><ul><li style="c">A</li></ul>';
  assert.equal(rules.sanitizeCopyHtml(dirty), '<p>Hi <strong>there</strong></p><p>Two</p>link<ul><li>A</li></ul>');
  assert.equal(rules.sanitizeCopyHtml('<p>5 < 6</p>'), '<p>5 &lt; 6</p>');
});

test('FAQ answers follow the same fact rules as descriptions', () => {
  const product = { sku: 'B', name: 'Mazin Twin/Twin Espresso Bunkbed', attributes: { material: 'Wood Laminate' }, currentDescription: 'Full length guardrails and a ladder.' };
  const plan = keywords.pickKeywords(product);
  const ok = rules.faqToHtml([{ q: 'What size mattresses?', a: 'Two twin mattresses.' }]);
  assert.equal(ok, '<p><strong>What size mattresses?</strong></p><p>Two twin mattresses.</p>');
  assert.deepEqual(rules.validateFaq(ok, product, plan), []);
  const bad = rules.faqToHtml([{ q: 'Weight limit?', a: 'Each bunk holds 250 lbs and has a 5-year warranty.' }]);
  assert.deepEqual(rules.validateFaq(bad, product, plan).map((i) => i.code).sort(), ['unsupported_claim', 'unsupported_claim', 'unsupported_number']);
  assert.ok(rules.DRAFT_SCHEMA.required.includes('faq'));
});

test('Merchant Center rows become one clean product per SKU', () => {
  const rows = [
    { product_id: 'A1', product_title: 'Grey Sofa', product_link: 'https://www.surplusfurniture.com/grey-sofa?store=063&utm_source=google', product_channel: 'LOCAL', product_color: 'Grey', product_type_l1: 'living room', product_type_l2: 'sofas', product_creation_date: '2026-11-13T09:00:00Z' },
    { product_id: 'A1', product_title: 'Grey Sofa', product_link: 'https://www.surplusfurniture.com/grey-sofa?store=001', product_channel: 'ONLINE', product_color: 'Grey' },
    { product_id: 'B2', product_title: '' },
  ];
  const products = windsor.productsFromMerchantRows(rows);
  assert.equal(products.length, 1);
  assert.equal(products[0].url, 'https://www.surplusfurniture.com/grey-sofa');
  assert.deepEqual(products[0].attributes, { colour: 'Grey' });
});

test('weekly selection: new first, then thin, nothing drafted twice', () => {
  const long = `<p>${'word '.repeat(60)}</p>`;
  const products = [
    { sku: 'old-thin', name: 'Old', currentDescription: 'Short.', createdAt: '2023-05-13' },
    { sku: 'new-good', name: 'New', currentDescription: long, createdAt: '2026-11-20' },
    { sku: 'newer-good', name: 'Newer', currentDescription: long, createdAt: '2026-11-21' },
    { sku: 'old-good', name: 'Fine', currentDescription: long, createdAt: '2024-01-01' },
    { sku: 'done', name: 'Done', currentDescription: '', createdAt: '2026-11-22' },
  ];
  const picked = select.selectCandidates(products, new Set(['done']), '2026-11-17', 10);
  assert.deepEqual(picked.map((c) => c.product.sku), ['newer-good', 'new-good', 'old-thin']);
  assert.deepEqual(select.selectCandidates(products, new Set(), '2026-11-17', 1).map((c) => c.product.sku), ['done']);
});

test("Tepperman's search and product pages parse, and off-type results are skipped", () => {
  const search = `<a href="/product-loft-bed-comforter-1">x</a><span itemprop="name">LOFT BED 2 PIECE TWIN COMFORTER SET</span>
    <a href="/product-holmes-twin-over-twin-bunk-bed-white-t2710w-k">x</a><span itemprop="name">Holmes Twin Over Twin Bunk Bed &amp; Drawers</span>`;
  const results = tepp.parseSearchResults(search);
  assert.deepEqual(results.map((r) => r.name), ['LOFT BED 2 PIECE TWIN COMFORTER SET', 'Holmes Twin Over Twin Bunk Bed & Drawers']);
  assert.equal(tepp.pickResult(results, 'loft bed with desk', 'loft-bed'), null);
  assert.equal(tepp.pickResult(results, 'twin over twin bunk bed', 'bunk-bed').path, '/product-holmes-twin-over-twin-bunk-bed-white-t2710w-k');
  assert.equal(tepp.pickResult([{ name: 'Alora Dresser - Light Oak', path: '/p' }], 'oak dresser').path, '/p');
  const page = `<h1>Annie Swivel Glider Recliner - Grey</h1><div class="product-details-information-content-tabs">
    <div class="product-details-information-tab-content-panel active"><div>Back The Annie swivel glider recliner brings smooth motion and supportive comfort to everyday lounging. Upholstered in soft fabric.</div></div>
    <div class="product-details-information-tab-content-panel"><div>Back Dimensions W: 36" | D: 38" Furniture Material Fabric Weight Capacity 360 lbs / 163.29 kg</div></div>
    </div><div class="product-details-related-correlated"></div>`;
  const parsed = tepp.parseProductPage(page);
  assert.equal(parsed.name, 'Annie Swivel Glider Recliner - Grey');
  assert.ok(parsed.description.startsWith('The Annie swivel glider recliner'));
  assert.equal(tepp.pickExcerpt(parsed.description), 'The Annie swivel glider recliner brings smooth motion and supportive comfort to everyday lounging.');
  assert.equal(tepp.specsNote(parsed.specs, parsed.description), 'States a 360 lbs weight capacity, materials (fabric).');
  assert.equal(tepp.hasKeyword(parsed.description, 'swivel recliner'), false);
  assert.equal(tepp.hasKeyword('A swivel recliner for you', 'swivel recliner'), true);
});

test('review order puts the weakest current descriptions first, keeping ties in order', () => {
  const p = (sku, words) => ({ sku, currentText: Array(words).fill('w').join(' ') });
  const order = select.reviewOrder([p('strong', 150), p('a39', 39), p('missing', 0), p('b39', 39), p('loft', 6)]).map((x) => x.sku);
  assert.deepEqual(order, ['missing', 'loft', 'a39', 'b39', 'strong']);
  const seed = JSON.parse(fs.readFileSync('data/seed-batch.json', 'utf8'));
  assert.deepEqual(select.reviewOrder(seed.products).slice(0, 3).map((x) => x.sku), ['0760LG40', 'W900TQ00', '0051ES40']);
});
