import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { JobSummary, JobStatus } from '@/types';
import * as api from '@/lib/api';
import type { ExtractionStatus } from '@/lib/api';

export function useJobs() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle');
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listJobs();
      setJobs(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load jobs'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Drain any pending jobs queued by background.js, then load
    api.drainPendingJobs()
      .then((count) => {
        if (count > 0) console.log(`Imported ${count} pending jobs`);
      })
      .catch((err) => console.error('Failed to drain pending jobs:', err))
      .finally(() => load());

    // Listen for extraction lifecycle events from background.js
    const cleanup = api.onExtractionStatus((event) => {
      // Clear any pending dismiss timer
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }

      setExtractionStatus(event.status);
      setExtractionError(event.error ?? null);

      if (event.status === 'done') {
        // Reload jobs list to pick up the new job
        load();
        // Auto-dismiss success after 4 seconds
        dismissTimer.current = setTimeout(() => {
          setExtractionStatus('idle');
          setExtractionError(null);
        }, 4000);
      } else if (event.status === 'error') {
        // Auto-dismiss error after 8 seconds
        dismissTimer.current = setTimeout(() => {
          setExtractionStatus('idle');
          setExtractionError(null);
        }, 8000);
      }
    });

    return () => {
      cleanup();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [load]);

  const dismissExtraction = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setExtractionStatus('idle');
    setExtractionError(null);
  }, []);

  const updateStatus = useCallback(
    async (id: number, status: JobStatus) => {
      await api.updateJobStatus(id, status);
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status } : j))
      );
    },
    []
  );

  const remove = useCallback(
    async (id: number) => {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    },
    []
  );

  return {
    jobs,
    loading,
    error,
    reload: load,
    updateStatus,
    remove,
    extractionStatus,
    extractionError,
    dismissExtraction,
  };
}
