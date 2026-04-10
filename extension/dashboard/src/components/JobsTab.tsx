import { useState, useMemo, useEffect, useContext, useRef } from 'preact/hooks';
import { JobOpenContext } from '@/contexts/JobOpenContext';
import type { JobSummary, JobStatus } from '@/types';
import type { ExtractionStatus } from '@/lib/api';
import { JOB_STATUSES, JOB_STATUS_LABELS } from '@/types';
import { JobDetail } from '@/components/JobDetail';

interface JobsTabProps {
  jobs: JobSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateStatus: (id: number, status: JobStatus) => Promise<void>;
  remove: (id: number) => Promise<void>;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  dismissExtraction: () => void;
}

export function JobsTab({
  jobs,
  loading,
  error,
  updateStatus,
  remove,
  extractionStatus,
  extractionError,
  dismissExtraction,
}: JobsTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [highlighting, setHighlighting] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const jobRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Listen for pipeline -> jobs open requests
  const ctx = useContext(JobOpenContext);
  useEffect(() => {
    const unregisters: (() => void)[] = [];

    if (ctx && typeof ctx.register === 'function') {
      const off = ctx.register((id: number) => {
        setSearch('');
        setStatusFilter('');
        setExpandedJobId(id);
        // scroll and highlight after DOM updates
          setTimeout(() => {
          setHighlighting(id);
          const el = jobRefs.current.get(id);
          if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
            try {
              (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
              // ignore in environments that don't support smooth scroll
              (el as HTMLElement).scrollIntoView();
            }
          }
          setTimeout(() => setHighlighting(null), 1600);
        }, 0);
      });
      unregisters.push(off);
    } else {
      const handler = (e: Event) => {
        const ev = e as CustomEvent<{ id: number }>;
        const id = ev?.detail?.id;
        if (typeof id !== 'number') return;
        setSearch('');
        setStatusFilter('');
        setExpandedJobId(id);
      };
      window.addEventListener('open-job', handler as EventListener);
      unregisters.push(() => window.removeEventListener('open-job', handler as EventListener));
    }

    return () => {
      for (const u of unregisters) u();
    };
  }, [ctx]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !s ||
        job.title.toLowerCase().includes(s) ||
        job.company.toLowerCase().includes(s);
      const matchesStatus = !statusFilter || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  if (loading) return <div class="tab-message">Loading jobs...</div>;
  if (error)
    return (
      <div class="tab-message">
        Could not load jobs: {error}
      </div>
    );

  const hasJobs = jobs.length > 0;
  const hasResults = filtered.length > 0;

  return (
    <div class="tab-jobs">
      {/* Extraction status banner */}
      {extractionStatus !== 'idle' && (
        <ExtractionBanner
          status={extractionStatus}
          error={extractionError}
          onDismiss={dismissExtraction}
        />
      )}

      {hasJobs && (
        <div class="filters">
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            class="search-input"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter((e.target as HTMLSelectElement).value)
            }
            class="status-filter"
          >
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div class="jobs-list" ref={(el) => { listRef.current = el as HTMLDivElement; }}>
        {!hasJobs ? (
          <EmptyState />
        ) : !hasResults ? (
          <div class="tab-message">No jobs match your search.</div>
        ) : (
          filtered.map((job) => (
            <div key={job.id} ref={(el) => { if (el) jobRefs.current.set(job.id, el as HTMLElement); }} class={highlighting === job.id ? 'job-jump-highlight' : ''}>
              <JobCard
                job={job}
                isExpanded={expandedJobId === job.id}
                onToggle={() =>
                  setExpandedJobId(
                    expandedJobId === job.id ? null : job.id
                  )
                }
                onStatusChange={(status) =>
                  updateStatus(job.id, status)
                }
                onDelete={() => {
                  if (confirm('Remove this job from your list?')) {
                    remove(job.id);
                    if (expandedJobId === job.id)
                      setExpandedJobId(null);
                  }
                }}
              />
              {expandedJobId === job.id && (
                <JobDetail
                  jobId={job.id}
                  onClose={() => setExpandedJobId(null)}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Empty State ----

function EmptyState() {
  return (
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      </div>
      <h3 class="empty-state-title">No jobs yet</h3>
      <p class="empty-state-text">
        Navigate to a job posting and click the extension icon to extract it.
        Your saved jobs will appear here.
      </p>
    </div>
  );
}

// ---- Extraction Banner ----

interface ExtractionBannerProps {
  status: ExtractionStatus;
  error: string | null;
  onDismiss: () => void;
}

function ExtractionBanner({ status, error, onDismiss }: ExtractionBannerProps) {
  const variants: Record<string, { className: string; text: string }> = {
    extracting: {
      className: 'extraction-banner extracting',
      text: 'Scraping page...',
    },
    processing: {
      className: 'extraction-banner extracting',
      text: 'Analyzing with LLM...',
    },
    saving: {
      className: 'extraction-banner extracting',
      text: 'Saving job...',
    },
    done: {
      className: 'extraction-banner done',
      text: 'Job extracted successfully',
    },
    error: {
      className: 'extraction-banner error',
      text: error || 'Extraction failed',
    },
  };

  const v = variants[status];
  if (!v) return null;

  const isInProgress = status === 'extracting' || status === 'processing' || status === 'saving';

  return (
    <div class={v.className}>
      <div class="extraction-banner-content">
        {isInProgress && <span class="spinner" />}
        {status === 'done' && <span class="check-mark">&#10003;</span>}
        {status === 'error' && <span class="error-mark">&#10007;</span>}
        <span>{v.text}</span>
      </div>
      {!isInProgress && (
        <button class="extraction-banner-dismiss" onClick={onDismiss}>
          &#215;
        </button>
      )}
    </div>
  );
}

// ---- Job Card ----

interface JobCardProps {
  job: JobSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: JobStatus) => void;
  onDelete: () => void;
}

function JobCard({
  job,
  isExpanded,
  onToggle,
  onStatusChange,
  onDelete,
}: JobCardProps) {
  return (
    <div
      class={`job-card ${isExpanded ? 'selected' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.job-actions')) return;
        onToggle();
      }}
    >
      <div class="job-main">
        <div class="job-title">{job.title}</div>
        <div class="job-meta">
          <span class="job-status-dot" data-status={job.status} />
          <span>{job.company}</span>
          <span class="job-meta-separator">&middot;</span>
          <span>{job.location || 'No location'}</span>
        </div>
      </div>
      <div class="job-actions">
        <select
          value={job.status}
          onChange={(e) =>
            onStatusChange(
              (e.target as HTMLSelectElement).value as JobStatus
            )
          }
          onClick={(e) => e.stopPropagation()}
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button onClick={onToggle}>View</button>
        <button
          class="job-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
