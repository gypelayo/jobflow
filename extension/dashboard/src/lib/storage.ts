import type { AppSettings } from '@/types';

const SETTINGS_KEYS: (keyof AppSettings)[] = [
  'provider',
  'ollamaModel',
  'perplexityKey',
  'perplexityModel',
  'perplexityApiKey',
  'openaiApiKey',
  'openaiModel',
  'anthropicApiKey',
  'anthropicModel',
  'geminiApiKey',
  'geminiModel',
  'ghostedDays',
  'licenseKey',
  'licenseExpiry',
];

const DEFAULTS: AppSettings = {
  provider: 'ollama',
  ollamaModel: 'qwen2.5:7b',
  perplexityKey: '',
  perplexityModel: 'sonar-pro',
  perplexityApiKey: '',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-haiku-20241022',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  ghostedDays: 14,
  licenseKey: '',
  licenseExpiry: '',
};

const storage =
  typeof browser !== 'undefined' && browser
    ? browser.storage
    : chrome.storage;

export function loadSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    storage.sync.get(DEFAULTS as unknown as Record<string, unknown>, (result) => {
      resolve(result as unknown as AppSettings);
    });
  });
}

export function saveSettings(
  values: Partial<AppSettings>
): Promise<void> {
  return new Promise((resolve) => {
    storage.sync.set(values as unknown as Record<string, unknown>, () => {
      resolve();
    });
  });
}

/**
 * Returns the effective Perplexity API key.
 * The old options page saved to 'perplexityKey', the dashboard saved to 'perplexityApiKey'.
 * We unify them here.
 */
export function getPerplexityKey(settings: AppSettings): string {
  return settings.perplexityKey || settings.perplexityApiKey || '';
}

export { SETTINGS_KEYS, DEFAULTS };
