/**
 * License key verification for the JobFlow Job Search Bundle.
 *
 * Key format:  JOBFLOW-<base64url(payload)>.<base64url(signature)>
 * Payload:     JSON { p: "YYYY-MM-DD", e: "YYYY-MM-DD" }  (purchase, expiry)
 * Signature:   HMAC-SHA256(secret, base64url(payload))
 *
 * Verification is client-side only using the Web Crypto API.
 * The secret is embedded — this is intentional (see security note in #41).
 */

const SECRET = '8a430dd8d834b4a46def7e7d492d2464c287a96d6179458dfe6caa9f197247d9';

export interface LicensePayload {
  purchaseDate: string; // YYYY-MM-DD
  expiry: string;       // YYYY-MM-DD
}

export interface LicenseStatus {
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  expiry: string | null;
  purchaseDate: string | null;
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function base64urlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(pad);
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------------------
// Core verify — async, uses Web Crypto
// ---------------------------------------------------------------------------

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Verify a license key and return its payload if valid, null otherwise.
 */
export async function verifyLicenseKey(key: string): Promise<LicensePayload | null> {
  try {
    const stripped = key.trim().replace(/^JOBFLOW-/i, '');
    const dotIndex = stripped.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payloadB64 = stripped.slice(0, dotIndex);
    const sigB64 = stripped.slice(dotIndex + 1);
    if (!payloadB64 || !sigB64) return null;

    const sigBytes = base64urlDecode(sigB64);

    const cryptoKey = await importHmacKey(SECRET);
    const valid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      sigBytes as unknown as ArrayBuffer,
      new TextEncoder().encode(payloadB64),
    );

    if (!valid) return null;

    // Decode payload using the same base64url decoder
    const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    if (!payload.p || !payload.e) return null;

    return { purchaseDate: payload.p, expiry: payload.e };
  } catch {
    return null;
  }
}

/**
 * Compute license status from stored expiry string.
 * Does not re-verify the HMAC — verification happens once on activation.
 */
export function computeLicenseStatus(licenseExpiry: string): LicenseStatus {
  if (!licenseExpiry) {
    return { isActive: false, isExpired: false, daysRemaining: 0, expiry: null, purchaseDate: null };
  }

  const now = new Date();
  const expiry = new Date(licenseExpiry);
  const msRemaining = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    isActive: daysRemaining > 0,
    isExpired: daysRemaining <= 0,
    daysRemaining: Math.max(0, daysRemaining),
    expiry: licenseExpiry,
    purchaseDate: null,
  };
}

// ---------------------------------------------------------------------------
// Key generation — used by scripts/generate-license.js (Node.js, not bundled)
// ---------------------------------------------------------------------------

/**
 * Generate a signed license key.
 * Only called from the generation script — not imported by the extension bundle.
 */
export async function generateLicenseKey(
  purchaseDate: string,
  durationDays = 90,
): Promise<string> {
  const expiry = new Date(purchaseDate + 'T00:00:00Z');
  expiry.setUTCDate(expiry.getUTCDate() + durationDays);
  const expiryStr = expiry.toISOString().slice(0, 10);

  const payload = { p: purchaseDate, e: expiryStr };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));

  const cryptoKey = await importHmacKey(SECRET);
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(payloadB64),
  );
  const sigB64 = base64urlEncode(new Uint8Array(sigBuf));

  return `JOBFLOW-${payloadB64}.${sigB64}`;
}
