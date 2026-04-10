import type { JobSummary, JobStatus } from '@/types';
import { useContext } from 'preact/hooks';
import { JobOpenContext } from '@/contexts/JobOpenContext';
import { JOB_STATUSES, JOB_STATUS_LABELS } from '@/types';

type ActiveJobStatus = Exclude<JobStatus, 'rejected'>;

const PIPELINE_STAGES: { key: ActiveJobStatus; label: string }[] = JOB_STATUSES
  .filter((key): key is ActiveJobStatus => key !== 'rejected')
  .map((key) => ({ key, label: JOB_STATUS_LABELS[key] }));

interface PipelineTabProps {
  jobs: JobSummary[];
  updateStatus: (id: number, status: JobStatus) => Promise<void>;
  onOpenJob?: (id: number) => void;
}

export function PipelineTab({ jobs, updateStatus, onOpenJob }: PipelineTabProps) {
  const ctx = useContext(JobOpenContext);
  const grouped: Record<ActiveJobStatus, JobSummary[]> = {
    saved: [],
    applied: [],
    'interview-hr': [],
    'interview-tech-intro': [],
    'interview-tech-system': [],
    'interview-tech-code': [],
    offer: [],
  };

  for (const job of jobs) {
    if (job.status === 'rejected') continue;
    const key = (JOB_STATUSES as readonly string[]).includes(job.status)
      ? (job.status as ActiveJobStatus)
      : 'saved';
    grouped[key].push(job);
  }

  const handleDragStart = (e: DragEvent, jobId: number) => {
    e.dataTransfer?.setData('text/plain', String(jobId));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).classList.add('dragging');
  };

  const handleDragEnd = (e: DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
    document
      .querySelectorAll('.pipeline-column-body.drag-over')
      .forEach((el) => el.classList.remove('drag-over'));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  };

  const handleDragLeave = (e: DragEvent) => {
    const body = e.currentTarget as HTMLElement;
    if (!body.contains(e.relatedTarget as Node)) {
      body.classList.remove('drag-over');
    }
  };

  const handleDrop = async (e: DragEvent, newStatus: ActiveJobStatus) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    const jobId = parseInt(e.dataTransfer?.getData('text/plain') ?? '', 10);
    if (!jobId || isNaN(jobId)) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;
    await updateStatus(jobId, newStatus);
  };

  return (
    <div class="pipeline-board" id="pipelineBoard">
      {PIPELINE_STAGES.map((stage) => (
        <div key={stage.key} class="pipeline-column" data-status={stage.key}>
          <div class="pipeline-column-header">
            <span>{stage.label}</span>
            <span class="count">{grouped[stage.key].length}</span>
          </div>
          <div
            class="pipeline-column-body"
            data-status={stage.key}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={async (e) => await handleDrop(e as DragEvent, stage.key)}
          >
              {grouped[stage.key].map((job) => (
                <div
                  key={job.id}
                  class="pipeline-card"
                  onClick={() => {
                    if (onOpenJob) onOpenJob(job.id);
                    else ctx.open(job.id);
                  }}
                  draggable
                  onDragStart={(e) =>
                    handleDragStart(e as DragEvent, job.id)
                  }
                  onDragEnd={handleDragEnd}
                >
                <div class="pipeline-card-title" title={job.title}>
                  {job.title || 'Untitled'}
                </div>
                <div class="pipeline-card-company" title={job.company}>
                  {job.company}
                </div>
                {(job.location || job.workplaceType) && (
                  <div class="pipeline-card-meta">
                    {[job.location, job.workplaceType]
                      .filter(Boolean)
                      .join(' \u00B7 ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
