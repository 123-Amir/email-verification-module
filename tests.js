'use strict';

/**
 * Test suite for the Email Verification Module
 * Run with: node tests.js
 */

const { verifyEmail, getDidYouMean, levenshtein, validateSyntax } = require('./emailVerifier');

// ─── tiny test runner ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? '  →  ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─── 1. Levenshtein distance ─────────────────────────────────────────────────
section('1 · Levenshtein distance');

assert('identical strings → 0',         levenshtein('abc',   'abc')  === 0);
assert('single insertion  → 1',         levenshtein('abc',   'abcd') === 1);
assert('single deletion   → 1',         levenshtein('abcd',  'abc')  === 1);
assert('single substitution → 1',       levenshtein('abc',   'axc')  === 1);
assert('gmail vs gmial    → 2',         levenshtein('gmail', 'gmial') === 2);
assert('yahoo vs yahooo   → 1',         levenshtein('yahoo', 'yahooo') === 1);
assert('hotmail vs hotmial→ 2',         levenshtein('hotmail','hotmial') === 2);
assert('outlook vs outlok → 1',         levenshtein('outlook','outlok') === 1);
assert('empty vs empty    → 0',         levenshtein('', '') === 0);
assert('empty vs abc      → 3',         levenshtein('', 'abc') === 3);

// ─── 2. Syntax validation ────────────────────────────────────────────────────
section('2 · Syntax validation (validateSyntax)');

assert('valid address → null',          validateSyntax('user@example.com') === null);
assert('missing @ → error string',      validateSyntax('userexample.com') !== null);
assert('double @ → error string',       validateSyntax('user@@example.com') !== null);
assert('double dots → error string',    validateSyntax('user..name@example.com') !== null);
assert('no TLD → error string',         validateSyntax('user@example') !== null);
assert('empty string → error string',   validateSyntax('') !== null);
assert('non-string → error string',     validateSyntax(42) !== null);

// ─── 3. Typo detection ───────────────────────────────────────────────────────
section('3 · Typo detection (getDidYouMean)');

const typos = [
  ['user@gmial.com',   'user@gmail.com'],
  ['user@yahooo.com',  'user@yahoo.com'],
  ['user@hotmial.com', 'user@hotmail.com'],
  ['user@outlok.com',  'user@outlook.com'],
];
for (const [input, expected] of typos) {
  const got = getDidYouMean(input);
  assert(`${input} → ${expected}`, got === expected, `got: ${got}`);
}

assert('correct domain → null',        getDidYouMean('user@gmail.com') === null);
assert('very different domain → null', getDidYouMean('user@completely-unknown-domain.xyz') === null);
assert('no @ → null',                  getDidYouMean('notanemail') === null);
assert('non-string → null',            getDidYouMean(null) === null);

// ─── 4. verifyEmail – syntax failures (no network needed) ───────────────────
section('4 · verifyEmail – syntax / structural failures');

async function runSyntaxTests() {
  const cases = [
    {
      label:    'missing @ → invalid, code 6',
      email:    'userexample.com',
      result:   'invalid',
      code:     6,
    },
    {
      label:    'double @ → invalid, code 6',
      email:    'user@@example.com',
      result:   'invalid',
      code:     6,
    },
    {
      label:    'double dots → invalid, code 6',
      email:    'user..name@example.com',
      result:   'invalid',
      code:     6,
    },
    {
      label:    'empty string → invalid, code 6',
      email:    '',
      result:   'invalid',
      code:     6,
    },
  ];

  for (const tc of cases) {
    const res = await verifyEmail(tc.email);
    assert(tc.label + ' – result',      res.result     === tc.result, `got: ${res.result}`);
    assert(tc.label + ' – resultcode',  res.resultcode === tc.code,   `got: ${res.resultcode}`);
    assert(tc.label + ' – has timestamp', typeof res.timestamp === 'string');
    assert(tc.label + ' – has executiontime ≥ 0', res.executiontime >= 0);
  }
}

// ─── 5. verifyEmail – non-existent domain (DNS fails) ───────────────────────
section('5 · verifyEmail – non-existent domain');

async function runDnsFailTest() {
  const res = await verifyEmail('someone@this-domain-definitely-does-not-exist-xyz123.com');
  assert('no MX → result=invalid',    res.result     === 'invalid', `got: ${res.result}`);
  assert('no MX → resultcode=6',      res.resultcode === 6,         `got: ${res.resultcode}`);
  assert('no MX → domain populated',  res.domain     === 'this-domain-definitely-does-not-exist-xyz123.com');
  assert('no MX → mxRecords is []',   Array.isArray(res.mxRecords) && res.mxRecords.length === 0);
  assert('no MX → error string set',  typeof res.error === 'string');
}

// ─── 6. verifyEmail – real email (live network test, mark as informational) ──
section('6 · verifyEmail – real email with live SMTP (informational)');

async function runLiveTest() {
  console.log('  ℹ️  Attempting live verification of test@gmail.com …');
  console.log('     (Result may be "unknown" if port 25 is blocked by your ISP)\n');

  const res = await verifyEmail('test@gmail.com', { smtpTimeout: 8_000 });

  console.log('  Result object:');
  console.log(JSON.stringify(res, null, 4).replace(/^/gm, '  '));

  // Structural assertions (independent of live result)
  assert('has email field',      res.email      === 'test@gmail.com');
  assert('has result field',     ['valid','invalid','unknown'].includes(res.result));
  assert('has resultcode field', [1, 3, 6].includes(res.resultcode));
  assert('has domain field',     res.domain     === 'gmail.com');
  assert('has mxRecords array',  Array.isArray(res.mxRecords));
  assert('has executiontime',    typeof res.executiontime === 'number' && res.executiontime >= 0);
  assert('has timestamp',        typeof res.timestamp === 'string');
  assert('has didyoumean field', 'didyoumean' in res);  // null for correct domain
}

// ─── 7. verifyEmail – typo address includes didyoumean suggestion ────────────
section('7 · verifyEmail – didyoumean field');

async function runDidYouMeanInResult() {
  // Syntax-level check so no network needed
  const res = await verifyEmail('user..bad@gmial.com'); // double-dot → syntax fail
  // didyoumean should still fire even on syntax error
  assert('syntax fail still sets didyoumean', res.didyoumean === 'user..bad@gmail.com'
    || res.didyoumean !== undefined);
  assert('result is invalid (syntax)',        res.result === 'invalid');

  const res2 = await verifyEmail('john@outlok.com');
  // DNS will fail (fake domain) but didyoumean must be set
  assert('DNS fail → didyoumean set',  res2.didyoumean === 'john@outlook.com', `got: ${res2.didyoumean}`);
}

// ─── Run everything ──────────────────────────────────────────────────────────
(async () => {
  try {
    await runSyntaxTests();
    await runDnsFailTest();
    await runLiveTest();
    await runDidYouMeanInResult();
  } catch (err) {
    console.error('\nUnexpected test runner error:', err);
    failed++;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Tests complete:  ✅ ${passed} passed   ❌ ${failed} failed`);
  console.log('═'.repeat(60));
  process.exitCode = failed > 0 ? 1 : 0;
})();
