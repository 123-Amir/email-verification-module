'use strict';

const dns = require('dns').promises;
const net = require('net');

// ─────────────────────────────────────────────
//  PART 2 – Typo Detection (Levenshtein ≤ 2)
// ─────────────────────────────────────────────

const KNOWN_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'live.com', 'msn.com',
  'protonmail.com', 'yandex.com', 'zoho.com', 'mail.com',
];

/**
 * Compute Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Given an email address, return a suggested correction if the domain looks
 * like a typo of a well-known domain (edit distance ≤ 2).
 *
 * @param {string} email
 * @returns {string|null}  corrected email, or null if no suggestion
 */
function getDidYouMean(email) {
  if (typeof email !== 'string') return null;
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) return null;

  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1).toLowerCase();

  let bestMatch = null;
  let bestDist  = Infinity;

  for (const known of KNOWN_DOMAINS) {
    if (domain === known) return null;           // already correct
    const dist = levenshtein(domain, known);
    if (dist <= 2 && dist < bestDist) {
      bestDist  = dist;
      bestMatch = known;
    }
  }

  return bestMatch ? `${local}@${bestMatch}` : null;
}

// ─────────────────────────────────────────────
//  PART 1 – Core Email Verification
// ─────────────────────────────────────────────

/** Strict but practical RFC-5321/5322 syntax check */
const EMAIL_REGEX = /^(?!.*\.\.)[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Validate email syntax.
 * Returns an error string if invalid, or null if OK.
 * @param {string} email
 * @returns {string|null}
 */
function validateSyntax(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    return 'Email must be a non-empty string';
  }

  const atCount = (email.match(/@/g) || []).length;
  if (atCount === 0) return 'Missing @ symbol';
  if (atCount > 1)   return 'Multiple @ symbols found';
  if (/\.\./.test(email)) return 'Consecutive dots are not allowed';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email syntax';

  return null;
}

/**
 * Look up MX records for a domain.
 * @param {string} domain
 * @returns {Promise<Array<{exchange: string, priority: number}>>}
 */
async function getMxRecords(domain) {
  const records = await dns.resolveMx(domain);
  return records.sort((a, b) => a.priority - b.priority);
}

/**
 * Connect to an SMTP server and probe the recipient address.
 *
 * @param {string} email       – full address to probe
 * @param {string} mxHost      – MX host to connect to
 * @param {object} [opts]
 * @param {number} [opts.port=25]
 * @param {number} [opts.timeout=10000]  ms
 * @returns {Promise<{smtpResult: 'valid'|'invalid'|'unknown', smtpCode: number|null, smtpMessage: string}>}
 */
function smtpProbe(email, mxHost, { port = 25, timeout = 10_000 } = {}) {
  return new Promise((resolve) => {
    let settled  = false;
    let buffer   = '';
    let step     = 'CONNECT';

    const done = (smtpResult, smtpCode, smtpMessage) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ smtpResult, smtpCode, smtpMessage });
    };

    const timer = setTimeout(() => {
      done('unknown', null, 'Connection timed out');
    }, timeout);

    const socket = net.createConnection({ host: mxHost, port });

    socket.setEncoding('utf8');

    socket.on('error', (err) => {
      done('unknown', null, `Socket error: ${err.message}`);
    });

    socket.on('data', (chunk) => {
      buffer += chunk;

      // SMTP responses end with \r\n; wait for a complete line
      if (!buffer.endsWith('\r\n') && !buffer.endsWith('\n')) return;

      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last  = lines[lines.length - 1];
      buffer = '';

      // Extract numeric code from last complete response line
      const codeMatch = last.match(/^(\d{3})[\s-]/);
      if (!codeMatch) return;
      const code = parseInt(codeMatch[1], 10);

      switch (step) {
        case 'CONNECT':
          if (code === 220) {
            step = 'EHLO';
            socket.write(`EHLO verify.local\r\n`);
          } else {
            done('unknown', code, `Unexpected greeting: ${last}`);
          }
          break;

        case 'EHLO':
          // Multi-line EHLO reply; wait until the final line (no dash after code)
          if (/^\d{3} /.test(last)) {
            step = 'MAIL';
            socket.write(`MAIL FROM:<verify@verify.local>\r\n`);
          }
          break;

        case 'MAIL':
          if (code === 250) {
            step = 'RCPT';
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            done('unknown', code, `MAIL FROM rejected: ${last}`);
          }
          break;

        case 'RCPT':
          if (code === 250 || code === 251) {
            done('valid',   code, last);
          } else if (code >= 550 && code <= 559) {
            done('invalid', code, last);
          } else if (code === 450 || code === 451 || code === 452) {
            done('unknown', code, last);
          } else if (code >= 500) {
            done('invalid', code, last);
          } else {
            done('unknown', code, last);
          }
          break;

        default:
          done('unknown', code, `Unexpected step: ${step}`);
      }
    });
  });
}

/** Map result string → result code */
const RESULT_CODES = { valid: 1, unknown: 3, invalid: 6 };

/**
 * Verify an email address.
 *
 * @param {string} email
 * @param {object} [opts]
 * @param {number} [opts.smtpTimeout=10000]
 * @param {number} [opts.smtpPort=25]
 * @returns {Promise<VerifyResult>}
 *
 * @typedef {object} VerifyResult
 * @property {string}  email
 * @property {'valid'|'invalid'|'unknown'} result
 * @property {1|3|6}   resultcode
 * @property {string}  subresult       – human-readable detail
 * @property {string}  domain
 * @property {Array}   mxRecords
 * @property {number}  executiontime   – ms
 * @property {string|null} error
 * @property {string}  timestamp       – ISO-8601
 * @property {string|null} didyoumean
 */
async function verifyEmail(email, { smtpTimeout = 10_000, smtpPort = 25 } = {}) {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  const base = {
    email,
    result:        'unknown',
    resultcode:    3,
    subresult:     '',
    domain:        '',
    mxRecords:     [],
    executiontime: 0,
    error:         null,
    timestamp,
    didyoumean:    getDidYouMean(email),
  };

  const finish = (overrides) => ({
    ...base,
    ...overrides,
    executiontime: Date.now() - start,
  });

  // ── 1. Syntax validation ──────────────────────────────────────────────────
  const syntaxError = validateSyntax(email);
  if (syntaxError) {
    return finish({
      result:     'invalid',
      resultcode: 6,
      subresult:  `Syntax error: ${syntaxError}`,
      error:      syntaxError,
    });
  }

  const domain = email.split('@')[1].toLowerCase();
  base.domain = domain;

  // ── 2. DNS MX lookup ──────────────────────────────────────────────────────
  let mxRecords;
  try {
    mxRecords = await getMxRecords(domain);
    base.mxRecords = mxRecords;
  } catch (err) {
    return finish({
      result:     'invalid',
      resultcode: 6,
      subresult:  'DNS lookup failed – domain has no MX records',
      error:      err.message,
    });
  }

  if (!mxRecords.length) {
    return finish({
      result:     'invalid',
      resultcode: 6,
      subresult:  'No MX records found for domain',
    });
  }

  // ── 3. SMTP probe (try MX hosts in priority order) ────────────────────────
  let lastSmtp = null;
  for (const mx of mxRecords) {
    try {
      const smtp = await smtpProbe(email, mx.exchange, {
        port:    smtpPort,
        timeout: smtpTimeout,
      });
      lastSmtp = smtp;

      if (smtp.smtpResult === 'valid' || smtp.smtpResult === 'invalid') {
        // Definitive answer – stop trying
        return finish({
          result:     smtp.smtpResult,
          resultcode: RESULT_CODES[smtp.smtpResult],
          subresult:  smtp.smtpMessage,
          error:      smtp.smtpResult === 'invalid' ? smtp.smtpMessage : null,
        });
      }
      // 'unknown' → try next MX
    } catch (err) {
      lastSmtp = { smtpResult: 'unknown', smtpCode: null, smtpMessage: err.message };
    }
  }

  // All MX hosts returned unknown
  return finish({
    result:     'unknown',
    resultcode: 3,
    subresult:  lastSmtp ? lastSmtp.smtpMessage : 'SMTP verification inconclusive',
    error:      lastSmtp ? lastSmtp.smtpMessage : null,
  });
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = { verifyEmail, getDidYouMean, levenshtein, validateSyntax };
