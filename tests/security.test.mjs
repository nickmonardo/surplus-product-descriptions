import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import ts from 'typescript';

// Failure modes recorded before implementation (security review, Nov 2026):
// - The post-sign-in redirect leaves the site ("/\evil.com" reads as "//evil.com").
// - A sign-in link without a single-use id, a tampered or oversized token, or a session
//   token presented as a link is accepted.
// - A javascript: or data: URL from the feed reaches an href or img src.
// - Saved copy keeps script, event handlers, links, styles or iframes through the sanitizer.
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
const tokens = load('src/lib/tokens.ts');
const urls = load('src/lib/urls.ts');
const rules = load('src/lib/copy/rules.ts');
process.env.AUTH_SECRET = 'y'.repeat(40);
process.env.ALLOWED_DOMAINS = '';
process.env.REVIEWER_EMAILS = 'buyer@surplusfurniture.com';

test('post-sign-in redirect stays on this site', () => {
  for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', '\\\\evil.com', 'https://evil.com', 'javascript:alert(1)',
    '/\tevil.com', '/\nevil.com', '', null, undefined, 42, '/' + 'a'.repeat(600)]) {
    assert.equal(tokens.safeNext(bad), '/', JSON.stringify(bad));
  }
  assert.equal(tokens.safeNext('/batches/2026-11-17-prototype?sku=0356AO05'), '/batches/2026-11-17-prototype?sku=0356AO05');
  assert.equal(tokens.safeNext('/magento'), '/magento');
});

test('sign-in links carry a single-use id; sessions and tampering are refused', () => {
  const link = tokens.signToken('link', 'Buyer@SurplusFurniture.com', 900);
  const read = tokens.readToken(link, 'link');
  assert.equal(read.email, 'buyer@surplusfurniture.com');
  assert.ok(read.nonce && read.nonce.length >= 16);
  assert.notEqual(tokens.readToken(tokens.signToken('link', 'buyer@surplusfurniture.com', 900), 'link').nonce, read.nonce);
  assert.equal(tokens.readToken(link, 'session'), null);
  assert.equal(tokens.readToken(tokens.signToken('session', 'buyer@surplusfurniture.com', 900), 'link'), null);
  // A correctly signed link without an id (the old format) is refused.
  const b64 = (b) => Buffer.from(b).toString('base64url');
  const body = b64(JSON.stringify({ kind: 'link', email: 'buyer@surplusfurniture.com', exp: Math.floor(Date.now() / 1000) + 900 }));
  const old = `${body}.${b64(createHmac('sha256', process.env.AUTH_SECRET).update(`link.${body}`).digest())}`;
  assert.equal(tokens.readToken(old, 'link'), null);
  assert.equal(tokens.readToken(`${link}.extra`, 'link'), null);
  assert.equal(tokens.readToken('x'.repeat(5000), 'link'), null);
  assert.equal(tokens.readToken(tokens.signToken('link', 'buyer@surplusfurniture.com', -1), 'link'), null);
  assert.equal(tokens.storageHash('a@b.c').length, 40);
  assert.ok(!tokens.storageHash('buyer@surplusfurniture.com').includes('buyer'));
});

test('only http(s) URLs reach links and images', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '/relative', '', null, 'ftp://x']) {
    assert.equal(urls.httpUrl(bad), undefined, String(bad));
  }
  assert.equal(urls.httpUrl('https://www.surplusfurniture.com/a'), 'https://www.surplusfurniture.com/a');
});

test('the copy sanitizer survives common XSS payloads', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<scr<script>ipt>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<img src=x onerror=alert(1)',
    '<svg/onload=alert(1)>',
    '<p onclick="alert(1)">x</p>',
    '<p/onmouseover=alert(1)>x</p>',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.com"></iframe>',
    '<style>body{display:none}</style>',
    '<p style="background:url(javascript:alert(1))">x</p>',
    '<p title=">" onclick="alert(1)">x</p>',
    '<!--<script>alert(1)</script>-->',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<STRONG ONCLICK=alert(1)>x</STRONG>',
    '<object data="x"></object><embed src="x">',
    '<form action="https://evil.com"><input name=x></form>',
    '<base href="https://evil.com/">',
    '<meta http-equiv="refresh" content="0;url=https://evil.com">',
  ];
  for (const p of payloads) {
    const out = rules.sanitizeCopyHtml(`<p>ok</p>${p}`);
    const tags = [...out.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)];
    for (const [, tag, attrs] of tags) {
      assert.ok(['p', 'ul', 'li', 'strong'].includes(tag), `${p} -> ${out}`);
      assert.equal(attrs, '', `${p} -> ${out}`);
    }
    assert.ok(!/<(?!\/?(p|ul|li|strong)>)/.test(out), `${p} -> ${out}`);
  }
});
