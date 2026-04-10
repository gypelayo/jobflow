/// <reference types="vite/client" />

/** Firefox WebExtension global — may or may not exist at runtime. */
declare const browser: typeof chrome | undefined;

declare namespace chrome {
  namespace runtime {
    function sendMessage(
      message: unknown,
      responseCallback?: (response: unknown) => void
    ): void;
    function getManifest(): { version: string };
    function getURL(path: string): string;
    let lastError: { message: string } | undefined;

    interface MessageEvent {
      addListener(
        callback: (
          request: Record<string, unknown>,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => void | boolean
      ): void;
      removeListener(
        callback: (
          request: Record<string, unknown>,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => void | boolean
      ): void;
    }

    const onMessage: MessageEvent;
  }
  namespace storage {
    const sync: {
      get(
        keys: string | string[] | Record<string, unknown>,
        callback: (result: Record<string, unknown>) => void
      ): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
    };
    const local: {
      get(
        keys: string | string[] | Record<string, unknown>,
        callback: (result: Record<string, unknown>) => void
      ): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
      remove(keys: string | string[], callback?: () => void): void;
    };
  }
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }
    function create(options: { url: string }): void;
    function query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: Tab[]) => void
    ): void;
  }
  namespace downloads {
    interface DownloadOptions {
      url: string;
      filename?: string;
      saveAs?: boolean;
    }
    function download(options: DownloadOptions, callback?: (downloadId: number) => void): void;
  }
}
