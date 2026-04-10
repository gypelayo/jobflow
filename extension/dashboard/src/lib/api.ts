/**
 * API layer — replaces native messaging with direct in-extension calls.
 *
 * All functions previously routed through sendNativeMessage to the Go host.
 * They now call the local SQLite database and LLM services directly.
 *
 * The background script queues extracted jobs into chrome.storage.local.
 * This module drains that queue on init and listens for real-time messages.
 */

import * as queries from './queries';
import { extractJob, generateCvText } from './llm';
import { sanitizeMarkdown, truncateMarkdownToWords } from './textutils';
import { loadSettings, getPerplexityKey } from './storage';
import type {
  JobSummary,
  JobFull,
  JobStatus,
  JobExtracted,
  AnalyticsData,
  Profile,
} from '@/types';

// ---- Pending job queue (background → dashboard bridge) ----

/**
 * Drain any jobs the background script queued while the dashboard was closed.
 * Call this once during app init.
 */
export async function drainPendingJobs(): Promise<number> {
  return new Promise((resolve) => {
    const storage = typeof browser !== 'undefined' && browser
      ? browser.storage
      : chrome.storage;

    storage.local.get({ pendingJobs: [] }, async (result: Record<string, unknown>) => {
      const pending = (result.pendingJobs ?? []) as JobExtracted[];
      if (!pending.length) {
        resolve(0);
        return;
      }

      let saved = 0;
      for (const job of pending) {
        try {
          await queries.saveJob(job);
          saved++;
        } catch (err) {
          console.error('Failed to save queued job:', err);
        }
      }

      // Clear the queue
      storage.local.set({ pendingJobs: [] });
      if (saved > 0) console.log(`Drained ${saved} pending jobs from queue`);
      resolve(saved);
    });
  });
}

/**
 * Listen for real-time extraction messages from background.js.
 * Returns a cleanup function to remove the listener.
 * @deprecated Use onExtractionStatus instead — it handles all extraction lifecycle events.
 */
export function onJobExtracted(callback: (job: JobExtracted) => void): () => void {
  const handler = (request: Record<string, unknown>) => {
    if (request.action === 'jobExtracted' && request.job) {
      const job = request.job as JobExtracted;
      queries.saveJob(job).then(() => {
        callback(job);
      }).catch((err) => {
        console.error('Failed to save extracted job:', err);
      });
    }
  };

  const runtime = typeof browser !== 'undefined' && browser
    ? browser.runtime
    : chrome.runtime;

  runtime.onMessage.addListener(handler);
  return () => runtime.onMessage.removeListener(handler);
}

// ---- Extraction status (background → dashboard notifications) ----

export type ExtractionStatus = 'idle' | 'extracting' | 'processing' | 'saving' | 'done' | 'error';

export interface ExtractionEvent {
  status: ExtractionStatus;
  error?: string;
  provider?: string;
}

/**
 * Listen for extraction lifecycle messages from background.js:
 *   - extractionStarted    -> { status: 'extracting' }
 *   - extractionProcessing -> { status: 'processing', provider: '...' }
 *   - extractionSaving     -> { status: 'saving' }
 *   - jobExtracted         -> { status: 'done' } (also saves the job)
 *   - extractionFailed     -> { status: 'error', error: '...' }
 *
 * Returns a cleanup function to remove the listener.
 */
export function onExtractionStatus(callback: (event: ExtractionEvent) => void): () => void {
  const handler = (request: Record<string, unknown>) => {
    if (request.action === 'extractionStarted') {
      callback({ status: 'extracting' });
    } else if (request.action === 'extractionProcessing') {
      callback({ status: 'processing', provider: (request.provider as string) || '' });
    } else if (request.action === 'extractionSaving') {
      callback({ status: 'saving' });
    } else if (request.action === 'jobExtracted' && request.job) {
      const job = request.job as JobExtracted;
      queries.saveJob(job).then(() => {
        callback({ status: 'done' });
      }).catch((err) => {
        console.error('Failed to save extracted job:', err);
        callback({ status: 'error', error: 'Failed to save job to database' });
      });
    } else if (request.action === 'extractionFailed') {
      callback({ status: 'error', error: (request.error as string) || 'Extraction failed' });
    }
  };

  const runtime = typeof browser !== 'undefined' && browser
    ? browser.runtime
    : chrome.runtime;

  runtime.onMessage.addListener(handler);
  return () => runtime.onMessage.removeListener(handler);
}

// ---- Jobs ----

export async function listJobs(): Promise<JobSummary[]> {
  return queries.listJobs();
}

export async function listRejectedJobs(): Promise<JobSummary[]> {
  return queries.listRejectedJobs();
}

export async function listGhostedJobs(thresholdDays: number): Promise<JobSummary[]> {
  return queries.listGhostedJobs(thresholdDays);
}

export async function getJob(id: number): Promise<JobFull> {
  return queries.getJob(id);
}

export async function updateJobStatus(id: number, status: JobStatus): Promise<void> {
  await queries.updateJobStatus(id, status);
}

export async function updateJobNotes(id: number, notes: string): Promise<void> {
  await queries.updateJobNotes(id, notes);
}

export async function updateJobCv(id: number, cvMarkdown: string): Promise<void> {
  await queries.updateJobCv(id, cvMarkdown);
}

export async function deleteJob(id: number): Promise<void> {
  await queries.deleteJob(id);
}

// ---- Extraction (called from background.js via message) ----

export async function extractAndSaveJob(jobText: string): Promise<number> {
  const settings = await loadSettings();
  const job = await extractJob(jobText, settings);
  const jobId = await queries.saveJob(job);
  return jobId;
}

// Save an already-extracted job (when background sends structured data)
export async function saveExtractedJob(job: JobExtracted): Promise<number> {
  return queries.saveJob(job);
}

// ---- CV Generation ----

export async function generateCv(jobId: number): Promise<string> {
  const settings = await loadSettings();

  const jobFull = await queries.getJob(jobId);
  const profile = await queries.getProfile();

  if (!profile.storyMarkdown) {
    throw new Error('Please fill out your profile first');
  }

  // Build settings with effective key
  const effectiveSettings = {
    ...settings,
    perplexityKey: getPerplexityKey(settings),
    provider: getPerplexityKey(settings) ? 'perplexity' : settings.provider || 'ollama',
  };

  const rawCv = await generateCvText(profile, jobFull.extracted, effectiveSettings);

  // Sanitize and truncate
  const sanitized = sanitizeMarkdown(rawCv);
  const truncated = truncateMarkdownToWords(sanitized, 350);

  // Auto-save to database
  await queries.updateJobCv(jobId, truncated);

  return truncated;
}

// ---- Analytics ----

export async function getAnalytics(): Promise<AnalyticsData> {
  return queries.getAnalytics();
}

export async function getInsights() {
  const { computeInsights } = await import('./insights');
  return computeInsights();
}

// ---- Profile ----

export async function getProfile(): Promise<Profile> {
  return queries.getProfile();
}

export async function saveProfile(profile: Omit<Profile, 'id'>): Promise<void> {
  await queries.saveProfile(profile);
}

// ---- Ping (no longer needed for native host, but keep for version info) ----

export async function pingHost(): Promise<string> {
  // No native host anymore — return extension version
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return 'unknown';
  }
}
