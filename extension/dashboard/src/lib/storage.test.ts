import { describe, it, expect } from 'vitest';
import { getPerplexityKey, SETTINGS_KEYS } from '@/lib/storage';
import { makeSettings } from '@/test/factories';

describe('getPerplexityKey', () => {
  it('prefers perplexityKey over perplexityApiKey', () => {
    const settings = makeSettings({
      provider: 'perplexity',
      perplexityKey: 'key-a',
      perplexityApiKey: 'key-b',
    });
    expect(getPerplexityKey(settings)).toBe('key-a');
  });

  it('falls back to perplexityApiKey', () => {
    const settings = makeSettings({
      provider: 'perplexity',
      perplexityKey: '',
      perplexityApiKey: 'key-b',
    });
    expect(getPerplexityKey(settings)).toBe('key-b');
  });

  it('returns empty string when neither is set', () => {
    const settings = makeSettings({
      provider: 'ollama',
      perplexityKey: '',
      perplexityApiKey: '',
    });
    expect(getPerplexityKey(settings)).toBe('');
  });
});

describe('SETTINGS_KEYS', () => {
  it('contains all required settings keys', () => {
    expect(SETTINGS_KEYS).toContain('provider');
    expect(SETTINGS_KEYS).toContain('ollamaModel');
    expect(SETTINGS_KEYS).toContain('perplexityKey');
    expect(SETTINGS_KEYS).toContain('openaiApiKey');
    expect(SETTINGS_KEYS).toContain('anthropicApiKey');
    expect(SETTINGS_KEYS).toContain('geminiApiKey');
    expect(SETTINGS_KEYS).toContain('ghostedDays');
    expect(SETTINGS_KEYS).toContain('licenseKey');
    expect(SETTINGS_KEYS).toContain('licenseExpiry');
  });
});
