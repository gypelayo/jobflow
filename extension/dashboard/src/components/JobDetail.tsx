import { useState, useEffect } from 'preact/hooks';
import type { JobFull } from '@/types';
import * as api from '@/lib/api';
import { CvSection } from '@/components/CvSection';

interface JobDetailProps {
  jobId: number;
  onClose: () => void;
}

type DetailTab = 'overview' | 'company' | 'role' | 'requirements' | 'compensation' | 'cv';

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'company', label: 'Company' },
  { id: 'role', label: 'Role' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'compensation', label: 'Comp' },
  { id: 'cv', label: 'CV' },
];

export function JobDetail({ jobId, onClose }: JobDetailProps) {
  const [job, setJob] = useState<JobFull | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getJob(jobId);
        if (!cancelled) {
          setJob(data);
          setNotes(data.notes ?? '');
        }
      } catch (err) {
        console.error('Failed to load job detail', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (!job) return <div class="job-detail-collapsible">Loading...</div>;

  const ext = job.extracted ?? {};
  const meta = ext.metadata ?? {};
  const company = ext.company_info ?? {};
  const role = ext.role_details ?? {};
  const reqs = ext.requirements ?? {};
  const comp = ext.compensation ?? {};
  const work = ext.work_arrangement ?? {};
  const market = ext.market_signals ?? {};

  return (
    <div class="job-detail-collapsible" >
      {/* Header */}
      <div class="detail-header">
        <div>
          <h2>{meta.job_title || job.title || 'Untitled role'}</h2>
          <div class="subtitle">
            {company.company_name || job.company || 'Unknown company'} &middot;{' '}
            {company.location_full || job.location || 'Location not set'}
          </div>
        </div>
        <button class="job-detail-close-btn" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Inner tabs */}
      <div class="job-inner-nav">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            class={`job-inner-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div class="job-detail-panels">
        {activeTab === 'overview' && (
          <OverviewPanel
            job={job}
            meta={meta}
            work={work}
            market={market}
            notes={notes}
            onNotesChange={setNotes}
            onSaveNotes={async () => {
              await api.updateJobNotes(jobId, notes);
            }}
          />
        )}
        {activeTab === 'company' && <CompanyPanel company={company} />}
        {activeTab === 'role' && <RolePanel role={role} />}
        {activeTab === 'requirements' && <RequirementsPanel reqs={reqs} />}
        {activeTab === 'compensation' && <CompensationPanel comp={comp} />}
        {activeTab === 'cv' && (
          <CvSection jobId={jobId} initialMarkdown={job.cvMarkdown ?? ''} />
        )}
      </div>
    </div>
  );
}

// ---- Sub-panels ----

function OverviewPanel({
  job,
  meta,
  work,
  market,
  notes,
  onNotesChange,
  onSaveNotes,
}: {
  job: JobFull;
  meta: JobFull['extracted']['metadata'];
  work: JobFull['extracted']['work_arrangement'];
  market: JobFull['extracted']['market_signals'];
  notes: string;
  onNotesChange: (val: string) => void;
  onSaveNotes: () => void;
}) {
  const url = job.url || job.extracted?.source_url || '';

  return (
    <div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Open original posting
        </a>
      )}
      <div>
        <strong>Skills:</strong>{' '}
        {job.skills?.length ? job.skills.join(', ') : 'None extracted'}
      </div>
      <hr />
      <h3>Role</h3>
      <p><strong>Title:</strong> {meta.job_title}</p>
      <p><strong>Department:</strong> {meta.department}</p>
      <p><strong>Seniority:</strong> {meta.seniority_level}</p>
      <p><strong>Function:</strong> {meta.job_function}</p>

      <h3>Work arrangement</h3>
      <p><strong>Workplace type:</strong> {work.workplace_type || 'Not specified'}</p>
      <p><strong>Job type:</strong> {work.job_type || 'Not specified'}</p>
      <p>
        <strong>Remote friendly:</strong>{' '}
        {typeof work.is_remote_friendly === 'boolean'
          ? work.is_remote_friendly
            ? 'Yes'
            : 'No'
          : 'Not specified'}
      </p>
      <p><strong>Timezone:</strong> {work.timezone_requirements || '\u2014'}</p>

      <h3>Market signals</h3>
      <p><strong>Urgency:</strong> {market.urgency_level || 'Standard'}</p>
      <p>
        <strong>Interview rounds:</strong>{' '}
        {market.interview_rounds != null ? market.interview_rounds : 'Not specified'}
      </p>
      <p><strong>Take home:</strong> {market.has_take_home ? 'Yes' : 'No'}</p>
      <p><strong>Pair programming:</strong> {market.has_pair_programming ? 'Yes' : 'No'}</p>
      <p><strong>Extracted at:</strong> {job.extracted?.extracted_at}</p>

      <hr />
      <div>
        <label>Notes</label>
        <textarea
          rows={4}
          style={{ width: '100%', marginTop: '4px' }}
          value={notes}
          onInput={(e) =>
            onNotesChange((e.target as HTMLTextAreaElement).value)
          }
        />
        <button class="notes-save-btn" onClick={onSaveNotes}>
          Save notes
        </button>
      </div>
    </div>
  );
}

function CompanyPanel({
  company,
}: {
  company: JobFull['extracted']['company_info'];
}) {
  return (
    <div>
      <h3>Company</h3>
      <p><strong>Name:</strong> {company.company_name}</p>
      <p><strong>Industry:</strong> {company.industry}</p>
      <p><strong>Size:</strong> {company.company_size}</p>
      <p><strong>Location:</strong> {company.location_full}</p>
    </div>
  );
}

function RolePanel({
  role,
}: {
  role: JobFull['extracted']['role_details'];
}) {
  return (
    <div>
      <h3>Role details</h3>
      <p>
        <strong>Summary:</strong>
        <br />
        {role.summary}
      </p>
      <p>
        <strong>Key responsibilities:</strong>
        <br />
        {role.key_responsibilities?.length
          ? role.key_responsibilities.map((r, i) => (
              <span key={i}>
                &bull; {r}
                <br />
              </span>
            ))
          : '\u2014'}
      </p>
      <p><strong>Team structure:</strong> {role.team_structure || '\u2014'}</p>
    </div>
  );
}

function RequirementsPanel({
  reqs,
}: {
  reqs: JobFull['extracted']['requirements'];
}) {
  const ts = reqs.technical_skills ?? {};
  const categories: [string, string[] | undefined][] = [
    ['Programming languages', ts.programming_languages],
    ['Frameworks', ts.frameworks],
    ['Databases', ts.databases],
    ['Cloud platforms', ts.cloud_platforms],
    ['DevOps tools', ts.devops_tools],
    ['Other', ts.other],
  ];

  return (
    <div>
      <h3>Requirements</h3>
      <p>
        <strong>Experience:</strong>{' '}
        {reqs.years_experience_min ?? 0}&ndash;{reqs.years_experience_max ?? 0} years
      </p>
      <p>
        <strong>Education:</strong> {reqs.education_level || 'Not specified'}
      </p>
      <p>
        <strong>Specific degree required:</strong>{' '}
        {reqs.requires_specific_degree ? 'Yes' : 'No'}
      </p>
      {categories.map(
        ([label, arr]) =>
          arr &&
          arr.length > 0 && (
            <p key={label}>
              <strong>{label}:</strong> {arr.join(', ')}
            </p>
          )
      )}
      <p>
        <strong>Soft skills:</strong>{' '}
        {reqs.soft_skills?.join(', ') || '\u2014'}
      </p>
      <p>
        <strong>Nice to have:</strong>{' '}
        {reqs.nice_to_have?.join(', ') || '\u2014'}
      </p>
    </div>
  );
}

function CompensationPanel({
  comp,
}: {
  comp: JobFull['extracted']['compensation'];
}) {
  const hasSalary = comp.salary_min || comp.salary_max;

  return (
    <div>
      <h3>Compensation &amp; benefits</h3>
      <p>
        <strong>Salary:</strong>{' '}
        {hasSalary
          ? `${comp.salary_min}\u2013${comp.salary_max} ${comp.salary_currency ?? ''}`.trim()
          : 'Not specified'}
      </p>
      <p><strong>Equity:</strong> {comp.has_equity ? 'Yes' : 'No'}</p>
      <p><strong>Remote stipend:</strong> {comp.has_remote_stipend ? 'Yes' : 'No'}</p>
      <p><strong>Visa sponsorship:</strong> {comp.offers_visa_sponsorship ? 'Yes' : 'No'}</p>
      <p><strong>Health insurance:</strong> {comp.offers_health_insurance ? 'Yes' : 'No'}</p>
      <p><strong>PTO:</strong> {comp.offers_pto ? 'Yes' : 'No'}</p>
      <p>
        <strong>Professional development:</strong>{' '}
        {comp.offers_professional_development ? 'Yes' : 'No'}
      </p>
      <p><strong>401k:</strong> {comp.offers_401k ? 'Yes' : 'No'}</p>
      <p>
        <strong>Benefits:</strong>{' '}
        {comp.benefits?.join(', ') || '\u2014'}
      </p>
    </div>
  );
}
