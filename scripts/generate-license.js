#!/usr/bin/env node
/**
 * Generate a JobFlow license key.
 *
 * Usage:
 *   node scripts/generate-license.js             # 90-day key from today
 *   node scripts/generate-license.js 180         # 180-day key
 *   node scripts/generate-license.js 90 2026-06-01  # 90-day key from specific date
 *
 * Keep this script and the SECRET private.
 */

const SECRET = '8a430dd8d834b4a46def7e7d492d2464c287a96d6179458dfe6caa9f197247d9';

function base64urlEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateLicenseKey(purchaseDate, durationDays = 90) {
  const expiry = new Date(purchaseDate + 'T00:00:00Z');
  expiry.setUTCDate(expiry.getUTCDate() + durationDays);
  const expiryStr = expiry.toISOString().slice(0, 10);

  const payload = { p: purchaseDate, e: expiryStr };
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload)));

  const { createHmac } = await import('crypto');
  const sig = createHmac('sha256', SECRET).update(payloadB64).digest();
  const sigB64 = base64urlEncode(sig);

  return `JOBFLOW-${payloadB64}.${sigB64}`;
}

const args = process.argv.slice(2);
const durationDays = args[0] ? parseInt(args[0], 10) : 90;
const purchaseDate = args[1] ?? new Date().toISOString().slice(0, 10);

if (isNaN(durationDays) || durationDays < 1) {
  console.error('Usage: node generate-license.js [days] [purchase-date]');
  process.exit(1);
}

generateLicenseKey(purchaseDate, durationDays).then((key) => {
  const expiry = new Date(purchaseDate);
  expiry.setDate(expiry.getDate() + durationDays);

  console.log('\nJobFlow License Key');
  console.log('───────────────────────────────────────────');
  console.log(`Key:      ${key}`);
  console.log(`Issued:   ${purchaseDate}`);
  console.log(`Expires:  ${expiry.toISOString().slice(0, 10)} (${durationDays} days)`);
  console.log('───────────────────────────────────────────\n');
});
