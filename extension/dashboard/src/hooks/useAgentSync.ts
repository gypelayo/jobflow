import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { importMcpJobs } from '@/lib/queries';

/**
 * Persists a FileSystemDirectoryHandle to IndexedDB so it survives extension
 * reloads (handles are structured-cloneable but not JSON-serialisable).
 */
const IDB_NAME = 'jobflow-agent-sync';
const IDB_STORE = 'handles';
const IDB_DIR_KEY = 'agentDir';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(handle, IDB_DIR_KEY);
  });
}

async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openIDB();
  return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_DIR_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function clearDirHandle(): Promise<void> {
  const db = await openIDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).delete(IDB_DIR_KEY);
  });
}

// Extended types for permission API not yet in all TS lib.dom versions
interface FSDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(opts?: { mode?: string }): Promise<PermissionState>;
  requestPermission(opts?: { mode?: string }): Promise<PermissionState>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FSDirectoryHandle>;
  }
}

const STORAGE_KEY = 'agentSyncConfig';

interface SyncConfig {
  lastImport: string; // ISO timestamp of last successful import
  lastModified: string; // ISO timestamp of db.json at last import
}

export interface UseAgentSyncResult {
  isConnected: boolean;
  isLoading: boolean;
  lastSync: string | null;
  syncCount: number;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  syncNow: () => Promise<number>;
  checkAndSync: () => Promise<void>;
}

export function useAgentSync(): UseAgentSyncResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dirHandleRef = useRef<FSDirectoryHandle | null>(null);
  const configRef = useRef<SyncConfig | null>(null);

  // Load persisted config + restore directory handle on mount
  useEffect(() => {
    restore();
  }, []);

  const getStorage = () =>
    typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.sync : null;

  const loadConfig = async (): Promise<SyncConfig | null> => {
    const storage = getStorage();
    if (!storage) return null;
    const result = await new Promise<Record<string, unknown>>(resolve =>
      storage.get(STORAGE_KEY, resolve)
    );
    return (result[STORAGE_KEY] as SyncConfig) ?? null;
  };

  const saveConfig = async (config: SyncConfig): Promise<void> => {
    const storage = getStorage();
    if (!storage) return;
    await new Promise<void>(resolve => storage.set({ [STORAGE_KEY]: config }, resolve));
    configRef.current = config;
    setLastSync(config.lastImport);
  };

  const restore = async () => {
    try {
      const config = await loadConfig();
      if (!config) return;

      configRef.current = config;
      setLastSync(config.lastImport);

      const saved = await loadDirHandle();
      if (!saved) return;

      const handle = saved as unknown as FSDirectoryHandle;
      let perm = await handle.queryPermission({ mode: 'read' });
      if (perm === 'prompt') perm = await handle.requestPermission({ mode: 'read' });

      if (perm === 'granted') {
        dirHandleRef.current = handle;
        setIsConnected(true);
      }
    } catch {
      // Handle not restorable — user needs to reconnect
    }
  };

  const performImport = async (): Promise<number> => {
    const handle = dirHandleRef.current;
    if (!handle) return 0;

    setIsLoading(true);
    setError(null);

    try {
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') throw new Error('Permission denied');

      const fileHandle = await handle.getFileHandle('db.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.jobs || !Array.isArray(data.jobs)) {
        throw new Error('Invalid db.json format');
      }

      const count = await importMcpJobs(data.jobs);

      await saveConfig({
        lastImport: new Date().toISOString(),
        lastModified: new Date(file.lastModified).toISOString(),
      });

      return count;
    } catch (err) {
      setError(`Sync failed: ${(err as Error).message}`);
      return 0;
    } finally {
      setIsLoading(false);
    }
  };

  const connect = async () => {
    setError(null);

    if (!window.showDirectoryPicker) {
      setError('Auto-sync requires Chrome or Edge (File System Access API).');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      dirHandleRef.current = handle;

      // Verify db.json exists in the selected folder
      try {
        await handle.getFileHandle('db.json');
      } catch {
        setError('No db.json found in that folder. Export first, then connect.');
        dirHandleRef.current = null;
        return;
      }

      await saveDirHandle(handle);
      setIsConnected(true);

      // Import immediately on connect
      const count = await performImport();
      if (count > 0) setSyncCount(c => c + 1);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to select folder. Please try again.');
      }
    }
  };

  const disconnect = async () => {
    await clearDirHandle();
    const storage = getStorage();
    if (storage) {
      await new Promise<void>(resolve => storage.set({ [STORAGE_KEY]: null }, resolve));
    }
    dirHandleRef.current = null;
    configRef.current = null;
    setIsConnected(false);
    setLastSync(null);
  };

  const syncNow = useCallback(async (): Promise<number> => {
    if (!dirHandleRef.current) {
      setError('Not connected. Select your ~/.jobflow folder first.');
      return 0;
    }
    const count = await performImport();
    if (count > 0) setSyncCount(c => c + 1);
    return count;
  }, []);

  /**
   * Called on extension open. Only imports if db.json is newer than the last
   * import — avoids redundant work on every open.
   */
  const checkAndSync = async () => {
    const handle = dirHandleRef.current;
    const config = configRef.current;
    if (!handle || !config) return;

    try {
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm !== 'granted') return;

      const fileHandle = await handle.getFileHandle('db.json');
      const file = await fileHandle.getFile();
      const currentModified = new Date(file.lastModified).toISOString();

      if (currentModified > config.lastModified) {
        const count = await performImport();
        if (count > 0) setSyncCount(c => c + 1);
      }
    } catch {
      // File handle may have been revoked — user needs to reconnect
    }
  };

  return {
    isConnected,
    isLoading,
    lastSync,
    syncCount,
    error,
    connect,
    disconnect,
    syncNow,
    checkAndSync,
  };
}
