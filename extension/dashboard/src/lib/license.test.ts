import { describe, it, expect } from 'vitest';
import { verifyLicenseKey, computeLicenseStatus, generateLicenseKey } from '@/lib/license';

describe('generateLicenseKey + verifyLicenseKey', () => {
  it('generates a key that verifies correctly', async () => {
    const key = await generateLicenseKey('2026-01-01', 90);
    expect(key).toMatch(/^JOBFLOW-/);
    const payload = await verifyLicenseKey(key);
    expect(payload).not.toBeNull();
    expect(payload?.purchaseDate).toBe('2026-01-01');
    expect(payload?.expiry).toBe('2026-04-01');
  });

  it('returns null for a tampered payload', async () => {
    const key = await generateLicenseKey('2026-01-01', 90);
    const tampered = key.slice(0, -4) + 'AAAA';
    const payload = await verifyLicenseKey(tampered);
    expect(payload).toBeNull();
  });

  it('returns null for a completely invalid string', async () => {
    expect(await verifyLicenseKey('not-a-key')).toBeNull();
    expect(await verifyLicenseKey('')).toBeNull();
    expect(await verifyLicenseKey('JOBFLOW-abc')).toBeNull();
  });

  it('returns null for a key with a forged expiry', async () => {
    const key = await generateLicenseKey('2026-01-01', 90);
    // Swap in a different payload with a longer expiry, keeping original signature
    const [, rest] = key.split('JOBFLOW-');
    const [, sig] = rest.split('.');
    const fakePayload = btoa(JSON.stringify({ p: '2026-01-01', e: '2030-01-01' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const forged = `JOBFLOW-${fakePayload}.${sig}`;
    expect(await verifyLicenseKey(forged)).toBeNull();
  });

  it('is case-insensitive on the JOBFLOW- prefix', async () => {
    const key = await generateLicenseKey('2026-01-01', 90);
    const lower = key.replace('JOBFLOW-', 'jobflow-');
    const payload = await verifyLicenseKey(lower);
    expect(payload).not.toBeNull();
  });
});

describe('computeLicenseStatus', () => {
  it('returns inactive for empty expiry', () => {
    const status = computeLicenseStatus('');
    expect(status.isActive).toBe(false);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBe(0);
  });

  it('returns active with correct days for a future expiry', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const status = computeLicenseStatus(future.toISOString().slice(0, 10));
    expect(status.isActive).toBe(true);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBeGreaterThanOrEqual(29);
    expect(status.daysRemaining).toBeLessThanOrEqual(31);
  });

  it('returns expired for a past expiry', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const status = computeLicenseStatus(past.toISOString().slice(0, 10));
    expect(status.isActive).toBe(false);
    expect(status.isExpired).toBe(true);
    expect(status.daysRemaining).toBe(0);
  });
});
