import { makeSettings, makeProfile } from './factories';

const storageData: Record<string, unknown> = {
  settings: makeSettings(),
  profile: makeProfile(),
  pendingJobs: [] as unknown[],
  onboardingComplete: true,
};

const messageListeners: Array<(request: Record<string, unknown>) => void> = [];

function createStorageArea() {
  return {
    get: (
      keys: string | string[] | Record<string, unknown>,
      callback: (result: Record<string, unknown>) => void
    ) => {
      const result: Record<string, unknown> = {};

      if (typeof keys === 'string') {
        result[keys] = storageData[keys] ?? null;
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          result[key] = storageData[key] ?? null;
        }
      } else {
        for (const [key, defaultVal] of Object.entries(keys)) {
          result[key] = storageData[key] ?? defaultVal;
        }
      }

      callback(result);
    },
    set: (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(storageData, items);
      callback?.();
    },
    remove: (keys: string[], callback?: () => void) => {
      for (const key of keys) {
        delete storageData[key];
      }
      callback?.();
    },
    clear: (callback?: () => void) => {
      Object.keys(storageData).forEach((key) => delete storageData[key]);
      callback?.();
    },
  };
}

const chromeMock = {
  runtime: {
    id: 'test-extension-id',
    version: '0.4.0',
    lastError: null as { message: string } | null,
    getManifest: () => ({ version: '0.4.0' }),
    getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
    sendNativeMessage: vi.fn(),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((callback: (request: Record<string, unknown>) => void) => {
        messageListeners.push(callback);
      }),
      removeListener: vi.fn((callback: (request: Record<string, unknown>) => void) => {
        const index = messageListeners.indexOf(callback);
        if (index > -1) messageListeners.splice(index, 1);
      }),
    },
  },
  storage: {
    sync: createStorageArea(),
    local: createStorageArea(),
  },
  tabs: {
    create: vi.fn(),
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
});

export function triggerChromeMessage(action: string, data: Record<string, unknown> = {}) {
  const message = { action, ...data };
  messageListeners.forEach((listener) => listener(message));
}

export function clearChromeMessageListeners() {
  messageListeners.length = 0;
}

export function setChromeStorage(_area: 'sync' | 'local', key: string, value: unknown) {
  storageData[key] = value;
}

export function getChromeStorage(_area: 'sync' | 'local', key: string) {
  return storageData[key];
}

export function resetChromeStorage() {
  Object.keys(storageData).forEach((key) => delete storageData[key]);
}
