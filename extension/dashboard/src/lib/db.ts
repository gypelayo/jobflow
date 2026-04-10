/**
 * SQLite database layer using sql.js (WASM).
 *
 * The database lives in IndexedDB so it persists across sessions.
 * Both the dashboard and background script can access it (same origin).
 */

// @ts-expect-error sql.js has no bundled types
import initSqlJs from 'sql.js';
type Database = ReturnType<Awaited<ReturnType<typeof initSqlJs>>['prototype']> & {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
  export(): Uint8Array;
  close(): void;
};

const DB_NAME = 'jobflow';
const DB_STORE = 'sqlitedb';
const DB_KEY = 'main';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

// ---------------------------------------------------------------------------
// Schema (matches the Go schema exactly)
// ---------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT UNIQUE NOT NULL,
    extracted_at TIMESTAMP NOT NULL,

    -- Basic Info
    job_title TEXT,
    company_name TEXT,
    company_size TEXT,
    industry TEXT,
    location_full TEXT,
    location_city TEXT,
    location_country TEXT,

    -- Role Classification
    seniority_level TEXT,
    department TEXT,
    job_function TEXT,

    -- Work Arrangement
    workplace_type TEXT,
    job_type TEXT,
    is_remote_friendly BOOLEAN,
    timezone_requirements TEXT,

    -- Experience & Skills
    years_experience_min INTEGER,
    years_experience_max INTEGER,
    education_level TEXT,
    requires_specific_degree BOOLEAN,

    -- Compensation
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency TEXT,
    has_equity BOOLEAN,
    has_remote_stipend BOOLEAN,
    offers_visa_sponsorship BOOLEAN,
    offers_health_insurance BOOLEAN,
    offers_pto BOOLEAN,
    offers_professional_development BOOLEAN,
    offers_401k BOOLEAN,

    -- Market Signals
    urgency_level TEXT,
    interview_rounds INTEGER,
    has_take_home BOOLEAN,
    has_pair_programming BOOLEAN,

    -- Aggregated data
    summary TEXT,
    key_responsibilities TEXT,
    team_structure TEXT,
    benefits TEXT,
    soft_skills TEXT,
    nice_to_have TEXT,

    -- Tracking
    status TEXT DEFAULT 'saved',
    max_status TEXT DEFAULT 'saved',
    applied_date TIMESTAMP,
    notes TEXT,
    rating INTEGER,
    cv_markdown TEXT,

    -- Raw
    raw_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    skill_name TEXT NOT NULL,
    skill_category TEXT,
    is_required BOOLEAN DEFAULT 1,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company ON jobs(company_name);
CREATE INDEX IF NOT EXISTS idx_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_workplace_type ON jobs(workplace_type);
CREATE INDEX IF NOT EXISTS idx_seniority ON jobs(seniority_level);
CREATE INDEX IF NOT EXISTS idx_is_remote ON jobs(is_remote_friendly);
CREATE INDEX IF NOT EXISTS idx_extracted_at ON jobs(extracted_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_skills_name ON job_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_job_skills_category ON job_skills(skill_category);

CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    full_name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    current_role TEXT,
    years_experience INTEGER,
    skills TEXT,
    links TEXT,
    story_markdown TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO profile (id) VALUES (1);
`;

// Migrations — run after SCHEMA, each wrapped in try/catch so they're idempotent
const MIGRATIONS = [
  "ALTER TABLE jobs ADD COLUMN max_status TEXT DEFAULT 'saved'",
];

function runMigrations(database: Database): void {
  for (const sql of MIGRATIONS) {
    try {
      database.run(sql);
    } catch {
      // Column already exists or other benign error — skip
    }
  }
}

// ---------------------------------------------------------------------------
// IndexedDB persistence helpers
// ---------------------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.get(DB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => idb.close();
  });
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put(data, DB_KEY);
    tx.oncomplete = () => {
      idb.close();
      resolve();
    };
    tx.onerror = () => {
      idb.close();
      reject(tx.error);
    };
  });
}

async function clearIDB(): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.delete(DB_KEY);
    tx.oncomplete = () => {
      idb.close();
      resolve();
    };
    tx.onerror = () => {
      idb.close();
      reject(tx.error);
    };
  });
}

// ---------------------------------------------------------------------------
// Init / persist
// ---------------------------------------------------------------------------

/**
 * Fetch the sql-wasm.wasm binary ourselves so we can pass it directly
 * to sql.js as `wasmBinary`. This avoids the internal fetch/streaming
 * path that fails in some extension contexts.
 */
async function loadWasmBinary(): Promise<ArrayBuffer> {
  const url = chrome.runtime.getURL('assets/sql-wasm.wasm');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch WASM: ${resp.status}`);
  return resp.arrayBuffer();
}

/**
 * Get the database instance. Initialises on first call, then returns cached.
 * Safe to call from multiple places — only one init runs at a time.
 *
 * If init fails (e.g. corrupted IndexedDB data), the cached promise is cleared
 * so the next call retries. On the second attempt it wipes IndexedDB and starts
 * from a fresh database.
 */
export function getDB(): Promise<Database> {
  if (db) return Promise.resolve(db);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const wasmBinary = await loadWasmBinary();

    const SQL = await initSqlJs({
      wasmBinary,
    });

    const saved = await loadFromIDB();

    if (saved) {
      try {
        db = new SQL.Database(saved);
        // Validate: run schema and a simple query to check integrity
        db.run(SCHEMA);
        runMigrations(db);
        db.exec('SELECT COUNT(*) FROM jobs');
      } catch (err) {
        console.warn('Saved database failed validation, starting fresh:', err);
        if (db) { try { db.close(); } catch { /* ignore */ } }
        db = null;
        await clearIDB();
        db = new SQL.Database();
        db.run(SCHEMA);
        runMigrations(db);
      }
    } else {
      db = new SQL.Database();
      db.run(SCHEMA);
      runMigrations(db);
    }

    // Persist after schema init
    await persist();

    return db;
  })();

  // If init fails, clear the cached promise so the next call retries
  initPromise.catch(() => {
    initPromise = null;
    db = null;
  });

  return initPromise;
}

/** Flush current database to IndexedDB. Call after any write operation. */
export async function persist(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await saveToIDB(data);
}

/**
 * Destroy the current database and IndexedDB data, then reinitialise from
 * scratch. Use as a last-resort recovery when the stored DB is corrupted.
 */
export async function resetDatabase(): Promise<void> {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
  initPromise = null;
  await clearIDB();
  // Re-init creates a fresh DB
  await getDB();
}

/** Export the raw database bytes (for user download). */
export async function exportDatabase(): Promise<Uint8Array> {
  const d = await getDB();
  return d.export();
}

/** Returns the number of jobs in the database. */
export async function countJobs(): Promise<number> {
  const d = await getDB();
  const rows = d.exec('SELECT COUNT(*) FROM jobs');
  return rows[0]?.values[0]?.[0] as number ?? 0;
}

/** Import a database from raw bytes (user upload). Replaces current DB. */
export async function importDatabase(data: Uint8Array): Promise<void> {
  const wasmBinary = await loadWasmBinary();

  const SQL = await initSqlJs({
    wasmBinary,
  });

  // Close existing
  if (db) {
    db.close();
    db = null;
    initPromise = null;
  }

  db = new SQL.Database(data);
  await persist();
}
