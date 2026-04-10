import { useState, useEffect, useMemo, useContext } from 'preact/hooks';
import { JobOpenContext } from '@/contexts/JobOpenContext';
import type { JobSummary, JobStatus } from '@/types';
import { JOB_STATUS_LABELS } from '@/types';
import * as api from '@/lib/api';

interface RejectedTabProps {
  updateStatus: (id: number, status: JobStatus) => Promise<void>;
  remove: (id: number) => Promise<void>;
  ghostedDays: number;
}

export function RejectedTab({ updateStatus, remove, ghostedDays }: RejectedTabProps) {
  const [rejected, setRejected] = useState<JobSummary[]>([]);
  const [ghosted, setGhosted] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const ctx = useContext(JobOpenContext);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rejectedResult, ghostedResult] = await Promise.all([
          api.listRejectedJobs(),
          api.listGhostedJobs(ghostedDays),
        ]);
        if (!cancelled) {
          setRejected(rejectedResult);
          setGhosted(ghostedResult);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load jobs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ghostedDays]);

  const filteredRejected = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return rejected;
    return rejected.filter((j) =>
      j.title.toLowerCase().includes(s) || j.company.toLowerCase().includes(s)
    );
  }, [rejected, search]);

  const filteredGhosted = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return ghosted;
    return ghosted.filter((j) =>
      j.title.toLowerCase().includes(s) || j.company.toLowerCase().includes(s)
    );
  }, [ghosted, search]);

  if (loading) return <div class="tab-message">Loading...</div>;
  if (error) return <div class="tab-message">Could not load: {error}</div>;

  const isEmpty = !rejected.length && !ghosted.length;

  if (isEmpty) {
    return (
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h3 class="empty-state-title">No rejections or ghosts yet</h3>
        <p class="empty-state-text">
          Jobs you mark as rejected will appear here. Applied jobs with no response
          after {ghostedDays} days will be flagged as ghosted.
        </p>
      </div>
    );
  }

  return (
    <div class="tab-rejected">
      <div class="rejected-header">
        <h2>Cold Leads</h2>
        <span class="rejected-count">
          {ghosted.length + rejected.length}{' '}
          {ghosted.length + rejected.length === 1 ? 'job' : 'jobs'}
        </span>
      </div>

      <div class="filters">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          class="search-input"
        />
      </div>

      {/* ---- Ghosted section ---- */}
      {ghosted.length > 0 && (
        <div class="ghosted-section">
          <div class="ghosted-section-header">
            <span class="ghosted-section-title">👻 Ghosted</span>
            <span class="rejected-count">{ghosted.length} — no response for {ghostedDays}+ days</span>
          </div>
          <div class="rejected-list">
            {filteredGhosted.length === 0 ? (
              <div class="tab-message">No ghosted jobs match your search.</div>
            ) : (
              filteredGhosted.map((job) => (
                <GhostedCard
                  key={job.id}
                  job={job}
                  onOpen={() => { if (typeof ctx.open === 'function') ctx.open(job.id); }}
                  onReject={async () => {
                    await updateStatus(job.id, 'rejected');
                    setGhosted((prev) => prev.filter((j) => j.id !== job.id));
                    const updated = await api.listRejectedJobs();
                    setRejected(updated);
                  }}
                  onDelete={async () => {
                    if (confirm('Permanently remove this job?')) {
                      await remove(job.id);
                      setGhosted((prev) => prev.filter((j) => j.id !== job.id));
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ---- Rejected section ---- */}
      {rejected.length > 0 && (
        <div class={ghosted.length > 0 ? 'rejected-section-below-ghosted' : ''}>
          {ghosted.length > 0 && (
            <div class="ghosted-section-header" style={{ marginTop: '24px' }}>
              <span class="ghosted-section-title">✕ Rejected</span>
              <span class="rejected-count">{rejected.length}</span>
            </div>
          )}
          {ghosted.length === 0 && (
            <div class="rejected-header" style={{ marginBottom: '12px' }}>
              <h2>Rejected</h2>
              <span class="rejected-count">{rejected.length} {rejected.length === 1 ? 'job' : 'jobs'}</span>
            </div>
          )}
          <div class="rejected-list">
            {filteredRejected.length === 0 ? (
              <div class="tab-message">No rejected jobs match your search.</div>
            ) : (
              filteredRejected.map((job) => (
                <RejectedCard
                  key={job.id}
                  job={job}
                  onOpen={() => { if (typeof ctx.open === 'function') ctx.open(job.id); }}
                  onRestore={async () => {
                    const restoreStatus: JobStatus = job.maxStatus === 'rejected' ? 'saved' : job.maxStatus;
                    await updateStatus(job.id, restoreStatus);
                    setRejected((prev) => prev.filter((j) => j.id !== job.id));
                  }}
                  onDelete={async () => {
                    if (confirm('Permanently remove this job?')) {
                      await remove(job.id);
                      setRejected((prev) => prev.filter((j) => j.id !== job.id));
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Ghosted card ----

function GhostedCard({
  job,
  onOpen,
  onReject,
  onDelete,
}: {
  job: JobSummary;
  onOpen: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const days = job.daysGhosted ?? 0;

  return (
    <div class="rejected-card ghosted-card">
      <div class="rejected-card-main" onClick={onOpen}>
        <div class="rejected-card-header">
          <div class="job-title">{job.title}</div>
          <span class="ghosted-days-badge">{days}d ago</span>
        </div>
        <div class="job-meta">
          <span class="job-status-dot" data-status="applied" />
          <span>{job.company}</span>
          <span class="job-meta-separator">&middot;</span>
          <span>{job.location || 'No location'}</span>
        </div>
      </div>
      <div class="rejected-card-actions">
        <button class="rejected-restore-btn" onClick={onReject} title="Mark as rejected">
          Mark Rejected
        </button>
        <button class="job-delete-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ---- Rejected card ----

function RejectedCard({
  job,
  onOpen,
  onRestore,
  onDelete,
}: {
  job: JobSummary;
  onOpen: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const peakLabel = JOB_STATUS_LABELS[job.maxStatus] ?? job.maxStatus;

  return (
    <div class="rejected-card">
      <div class="rejected-card-main" onClick={onOpen}>
        <div class="rejected-card-header">
          <div class="job-title">{job.title}</div>
          <span class="rejected-peak-badge" data-peak={job.maxStatus}>
            {peakLabel}
          </span>
        </div>
        <div class="job-meta">
          <span class="job-status-dot" data-status="rejected" />
          <span>{job.company}</span>
          <span class="job-meta-separator">&middot;</span>
          <span>{job.location || 'No location'}</span>
        </div>
      </div>
      <div class="rejected-card-actions">
        <button class="rejected-restore-btn" onClick={onRestore} title="Move back to peak stage">
          Restore
        </button>
        <button class="job-delete-btn" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
