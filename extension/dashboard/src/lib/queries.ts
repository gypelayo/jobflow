/**
 * Database queries — direct TypeScript port of Go db/queries.go + db/db.go.
 *
 * Every function gets its own `db` handle via getDB() so callers don't need
 * to worry about initialisation order.
 *
 * IMPORTANT: sql.js parameter binding (db.run(sql, params)) is broken in
 * Firefox extension contexts — the WASM binding layer silently produces
 * NOT NULL constraint errors even when valid strings are passed.
 * All queries use string interpolation via sqlVal() instead.
 */

import { getDB, persist, resetDatabase } from './db';
import type {
  JobSummary,
  JobFull,
  JobExtracted,
  AnalyticsData,
  SkillCount,
  TitleCount,
  Profile,
} from '@/types';
import { JOB_STATUSES } from '@/types';

// ---------------------------------------------------------------------------
// SQL value escaping — replaces broken parameter binding
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe inline SQL interpolation.
 * - null / undefined → 'NULL'
 * - numbers → numeric literal
 * - booleans → 1 or 0
 * - strings → single-quoted with internal quotes doubled
 */
function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  // String: escape single quotes by doubling them
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

// ---------------------------------------------------------------------------
// SaveJob (port of Go db.SaveJob + db.saveSkills)
// ---------------------------------------------------------------------------

export async function saveJob(job: JobExtracted): Promise<number> {
  const db = await getDB();

  const rawJSON = JSON.stringify(job);

  // Coerce NOT NULL fields to guaranteed strings
  const sourceUrl = String(job.source_url || 'unknown');
  const extractedAt = String(job.extracted_at || new Date().toISOString());

  const summary = job.role_details?.summary ?? '';
  const keyResp = (job.role_details?.key_responsibilities ?? []).join('\n\u2022 ');
  const teamStructure = job.role_details?.team_structure ?? '';
  const benefits = (job.compensation?.benefits ?? []).join(', ');
  const softSkills = (job.requirements?.soft_skills ?? []).join(', ');
  const niceToHave = (job.requirements?.nice_to_have ?? []).join('; ');

  db.run(`INSERT INTO jobs (
    source_url, extracted_at,
    job_title, company_name, company_size, industry,
    location_full, location_city, location_country,
    seniority_level, department, job_function,
    workplace_type, job_type, is_remote_friendly, timezone_requirements,
    years_experience_min, years_experience_max, education_level, requires_specific_degree,
    salary_min, salary_max, salary_currency, has_equity, has_remote_stipend,
    offers_visa_sponsorship, offers_health_insurance, offers_pto,
    offers_professional_development, offers_401k,
    urgency_level, interview_rounds, has_take_home, has_pair_programming,
    summary, key_responsibilities, team_structure, benefits, soft_skills, nice_to_have,
    status, raw_json
  ) VALUES (
    ${sqlVal(sourceUrl)}, ${sqlVal(extractedAt)},
    ${sqlVal(job.metadata?.job_title)}, ${sqlVal(job.company_info?.company_name)}, ${sqlVal(job.company_info?.company_size)}, ${sqlVal(job.company_info?.industry)},
    ${sqlVal(job.company_info?.location_full)}, ${sqlVal(job.company_info?.location_city)}, ${sqlVal(job.company_info?.location_country)},
    ${sqlVal(job.metadata?.seniority_level)}, ${sqlVal(job.metadata?.department)}, ${sqlVal(job.metadata?.job_function)},
    ${sqlVal(job.work_arrangement?.workplace_type)}, ${sqlVal(job.work_arrangement?.job_type)}, ${sqlVal(job.work_arrangement?.is_remote_friendly)}, ${sqlVal(job.work_arrangement?.timezone_requirements)},
    ${sqlVal(job.requirements?.years_experience_min)}, ${sqlVal(job.requirements?.years_experience_max)}, ${sqlVal(job.requirements?.education_level)}, ${sqlVal(job.requirements?.requires_specific_degree)},
    ${sqlVal(job.compensation?.salary_min)}, ${sqlVal(job.compensation?.salary_max)}, ${sqlVal(job.compensation?.salary_currency)}, ${sqlVal(job.compensation?.has_equity)}, ${sqlVal(job.compensation?.has_remote_stipend)},
    ${sqlVal(job.compensation?.offers_visa_sponsorship)}, ${sqlVal(job.compensation?.offers_health_insurance)}, ${sqlVal(job.compensation?.offers_pto)},
    ${sqlVal(job.compensation?.offers_professional_development)}, ${sqlVal(job.compensation?.offers_401k)},
    ${sqlVal(job.market_signals?.urgency_level)}, ${sqlVal(job.market_signals?.interview_rounds)}, ${sqlVal(job.market_signals?.has_take_home)}, ${sqlVal(job.market_signals?.has_pair_programming)},
    ${sqlVal(summary)}, ${sqlVal(keyResp)}, ${sqlVal(teamStructure)}, ${sqlVal(benefits)}, ${sqlVal(softSkills)}, ${sqlVal(niceToHave)},
    'saved', ${sqlVal(rawJSON)}
  )
  ON CONFLICT(source_url) DO UPDATE SET
    updated_at = CURRENT_TIMESTAMP,
    job_title = excluded.job_title,
    company_name = excluded.company_name,
    seniority_level = excluded.seniority_level,
    job_function = excluded.job_function,
    salary_min = excluded.salary_min,
    salary_max = excluded.salary_max,
    is_remote_friendly = excluded.is_remote_friendly,
    raw_json = excluded.raw_json`);

  // Get the inserted/updated row ID
  const rows = db.exec('SELECT last_insert_rowid()');
  const jobId = (rows[0]?.values[0]?.[0] as number) ?? 0;

  // Save skills
  if (jobId > 0) {
    const ts = job.requirements?.technical_skills;
    if (ts) {
      db.run(`DELETE FROM job_skills WHERE job_id = ${sqlVal(jobId)}`);

      const insertSkill = (category: string, names: string[] | undefined) => {
        for (const name of names ?? []) {
          if (!name) continue;
          db.run(
            `INSERT INTO job_skills (job_id, skill_name, skill_category, is_required) VALUES (${sqlVal(jobId)}, ${sqlVal(name)}, ${sqlVal(category)}, 1)`,
          );
        }
      };

      insertSkill('programming_language', ts.programming_languages);
      insertSkill('framework', ts.frameworks);
      insertSkill('database', ts.databases);
      insertSkill('cloud', ts.cloud_platforms);
      insertSkill('devops', ts.devops_tools);
      insertSkill('other', ts.other);
    }
  }

  await persist();
  return jobId;
}

// ---------------------------------------------------------------------------
// ListJobs
// ---------------------------------------------------------------------------

export async function listJobs(
  limit = 100,
  offset = 0,
  status = '',
): Promise<JobSummary[]> {
  const safeLimit = Math.max(0, Math.floor(Number(limit)));
  const safeOffset = Math.max(0, Math.floor(Number(offset)));

  let sql: string;

  if (status) {
    sql = `SELECT
      id,
      job_title,
      company_name,
      location_full,
      job_type,
      workplace_type,
      seniority_level,
      department,
      salary_min || '-' || salary_max || ' ' || IFNULL(salary_currency, '') as salary_range,
      status,
      IFNULL(max_status, status) as max_status,
      extracted_at,
      source_url
    FROM jobs
    WHERE status = ${sqlVal(status)}
    ORDER BY extracted_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}`;
  } else {
    sql = `SELECT
      id,
      job_title,
      company_name,
      location_full,
      job_type,
      workplace_type,
      seniority_level,
      department,
      salary_min || '-' || salary_max || ' ' || IFNULL(salary_currency, '') as salary_range,
      status,
      IFNULL(max_status, status) as max_status,
      extracted_at,
      source_url
    FROM jobs
    ORDER BY extracted_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}`;
  }

  try {
    const db = await getDB();
    const rows = db.exec(sql);

    if (!rows.length) return [];

    return rows[0].values.map((r: unknown[]) => ({
      id: r[0] as number,
      title: (r[1] as string) ?? '',
      company: (r[2] as string) ?? '',
      location: (r[3] as string) ?? '',
      jobType: (r[4] as string) ?? '',
      workplaceType: (r[5] as string) ?? '',
      level: (r[6] as string) ?? '',
      department: (r[7] as string) ?? '',
      salaryRange: (r[8] as string) ?? '',
      status: ((r[9] as string) ?? 'saved') as JobSummary['status'],
      maxStatus: ((r[10] as string) ?? r[9] ?? 'saved') as JobSummary['maxStatus'],
      extractedAt: (r[11] as string) ?? '',
      sourceUrl: (r[12] as string) ?? '',
      skills: [],
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('datatype mismatch') || msg.includes('malformed') || msg.includes('not a database')) {
      console.warn('Database appears corrupted, resetting:', msg);
      await resetDatabase();
      return [];
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GetJob
// ---------------------------------------------------------------------------

export async function getJob(id: number): Promise<JobFull> {
  const db = await getDB();

  const rows = db.exec(
    `SELECT raw_json, status, notes, rating, cv_markdown FROM jobs WHERE id = ${sqlVal(id)}`,
  );

  if (!rows.length || !rows[0].values.length) {
    throw new Error('Job not found');
  }

  const [rawJSON, status, notes, _rating, cvMarkdown] = rows[0].values[0];
  const extracted: JobExtracted = JSON.parse(rawJSON as string);

  // Flatten technical skills
  const ts = extracted.requirements?.technical_skills;
  const skills: string[] = [];
  if (ts) {
    skills.push(
      ...(ts.programming_languages ?? []),
      ...(ts.frameworks ?? []),
      ...(ts.databases ?? []),
      ...(ts.cloud_platforms ?? []),
      ...(ts.devops_tools ?? []),
      ...(ts.other ?? []),
    );
  }

  return {
    id,
    title: extracted.metadata?.job_title ?? '',
    company: extracted.company_info?.company_name ?? '',
    location: extracted.company_info?.location_full ?? '',
    url: extracted.source_url ?? '',
    status: ((status as string) ?? 'saved') as JobFull['status'],
    notes: (notes as string) ?? '',
    cvMarkdown: (cvMarkdown as string) ?? '',
    skills,
    extracted,
  };
}

export async function listGhostedJobs(thresholdDays: number): Promise<JobSummary[]> {
  const safeThreshold = Math.max(1, Math.floor(Number(thresholdDays)));
  const db = await getDB();

  const sql = `SELECT
    id,
    job_title,
    company_name,
    location_full,
    job_type,
    workplace_type,
    seniority_level,
    department,
    salary_min || '-' || salary_max || ' ' || IFNULL(salary_currency, '') as salary_range,
    status,
    IFNULL(max_status, status) as max_status,
    extracted_at,
    source_url,
    CAST((julianday('now') - julianday(updated_at)) AS INTEGER) as days_ghosted
  FROM jobs
  WHERE status = 'applied'
    AND updated_at < datetime('now', '-${safeThreshold} days')
  ORDER BY updated_at ASC`;

  const rows = db.exec(sql);
  if (!rows.length) return [];

  return rows[0].values.map((r: unknown[]) => ({
    id: r[0] as number,
    title: (r[1] as string) ?? '',
    company: (r[2] as string) ?? '',
    location: (r[3] as string) ?? '',
    jobType: (r[4] as string) ?? '',
    workplaceType: (r[5] as string) ?? '',
    level: (r[6] as string) ?? '',
    department: (r[7] as string) ?? '',
    salaryRange: (r[8] as string) ?? '',
    status: ((r[9] as string) ?? 'applied') as JobSummary['status'],
    maxStatus: ((r[10] as string) ?? 'applied') as JobSummary['maxStatus'],
    extractedAt: (r[11] as string) ?? '',
    sourceUrl: (r[12] as string) ?? '',
    skills: [],
    daysGhosted: (r[13] as number) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Update helpers
// ---------------------------------------------------------------------------

export async function updateJobStatus(id: number, status: string): Promise<void> {
  const db = await getDB();

  // Pipeline rank: higher index = further along (excluding rejected)
  const activeStatuses: string[] = JOB_STATUSES.filter((s) => s !== 'rejected');
  const rankOf = (s: string) => activeStatuses.indexOf(s);

  // Read current max_status
  const rows = db.exec(`SELECT IFNULL(max_status, status) FROM jobs WHERE id = ${sqlVal(id)}`);
  const currentMax = (rows[0]?.values[0]?.[0] as string) ?? 'saved';

  // Only advance max_status if the new status has a higher rank (and isn't rejected)
  let newMax = currentMax;
  if (status !== 'rejected' && rankOf(status) > rankOf(currentMax)) {
    newMax = status;
  }

  db.run(`UPDATE jobs SET
    status = ${sqlVal(status)},
    max_status = ${sqlVal(newMax)},
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ${sqlVal(id)}`);
  await persist();
}

export async function listRejectedJobs(
  limit = 100,
  offset = 0,
): Promise<JobSummary[]> {
  const safeLimit = Math.max(0, Math.floor(Number(limit)));
  const safeOffset = Math.max(0, Math.floor(Number(offset)));

  const sql = `SELECT
    id,
    job_title,
    company_name,
    location_full,
    job_type,
    workplace_type,
    seniority_level,
    department,
    salary_min || '-' || salary_max || ' ' || IFNULL(salary_currency, '') as salary_range,
    status,
    IFNULL(max_status, status) as max_status,
    extracted_at,
    source_url
  FROM jobs
  WHERE status = 'rejected'
  ORDER BY updated_at DESC
  LIMIT ${safeLimit} OFFSET ${safeOffset}`;

  const db = await getDB();
  const rows = db.exec(sql);

  if (!rows.length) return [];

  return rows[0].values.map((r: unknown[]) => ({
    id: r[0] as number,
    title: (r[1] as string) ?? '',
    company: (r[2] as string) ?? '',
    location: (r[3] as string) ?? '',
    jobType: (r[4] as string) ?? '',
    workplaceType: (r[5] as string) ?? '',
    level: (r[6] as string) ?? '',
    department: (r[7] as string) ?? '',
    salaryRange: (r[8] as string) ?? '',
    status: ((r[9] as string) ?? 'rejected') as JobSummary['status'],
    maxStatus: ((r[10] as string) ?? r[9] ?? 'rejected') as JobSummary['maxStatus'],
    extractedAt: (r[11] as string) ?? '',
    sourceUrl: (r[12] as string) ?? '',
    skills: [],
  }));
}

export async function updateJobNotes(id: number, notes: string): Promise<void> {
  const db = await getDB();
  db.run(`UPDATE jobs SET notes = ${sqlVal(notes)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${sqlVal(id)}`);
  await persist();
}

export async function updateJobCv(id: number, cvMarkdown: string): Promise<void> {
  const db = await getDB();
  db.run(`UPDATE jobs SET cv_markdown = ${sqlVal(cvMarkdown)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${sqlVal(id)}`);
  await persist();
}

export async function deleteJob(id: number): Promise<void> {
  const db = await getDB();
  db.run(`DELETE FROM job_skills WHERE job_id = ${sqlVal(id)}`);
  db.run(`DELETE FROM jobs WHERE id = ${sqlVal(id)}`);
  await persist();
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function getJobStats(): Promise<Record<string, number>> {
  const db = await getDB();

  const rows = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) as saved,
      SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN status = 'interview-hr' THEN 1 ELSE 0 END) as "interview-hr",
      SUM(CASE WHEN status = 'interview-tech-intro' THEN 1 ELSE 0 END) as "interview-tech-intro",
      SUM(CASE WHEN status = 'interview-tech-system' THEN 1 ELSE 0 END) as "interview-tech-system",
      SUM(CASE WHEN status = 'interview-tech-code' THEN 1 ELSE 0 END) as "interview-tech-code",
      SUM(CASE WHEN status = 'offer' THEN 1 ELSE 0 END) as offer,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM jobs
  `);

  if (!rows.length) {
    return { total: 0, saved: 0, applied: 0, 'interview-hr': 0, 'interview-tech-intro': 0, 'interview-tech-system': 0, 'interview-tech-code': 0, offer: 0, rejected: 0 };
  }

  const [total, saved, applied, interviewHr, interviewTechIntro, interviewTechSystem, interviewTechCode, offer, rejected] = rows[0].values[0];
  return {
    total: (total as number) ?? 0,
    saved: (saved as number) ?? 0,
    applied: (applied as number) ?? 0,
    'interview-hr': (interviewHr as number) ?? 0,
    'interview-tech-intro': (interviewTechIntro as number) ?? 0,
    'interview-tech-system': (interviewTechSystem as number) ?? 0,
    'interview-tech-code': (interviewTechCode as number) ?? 0,
    offer: (offer as number) ?? 0,
    rejected: (rejected as number) ?? 0,
  };
}

export async function getTopSkillsByCategory(
  category: string,
  limit: number,
): Promise<SkillCount[]> {
  const db = await getDB();
  const safeLimit = Math.max(0, Math.floor(Number(limit)));

  const rows = db.exec(
    `SELECT skill_name, COUNT(*) AS cnt
     FROM job_skills
     WHERE skill_category = ${sqlVal(category)}
     GROUP BY skill_name
     ORDER BY cnt DESC, skill_name ASC
     LIMIT ${safeLimit}`,
  );

  if (!rows.length) return [];
  return rows[0].values.map((r: unknown[]) => ({
    skill: (r[0] as string) ?? '',
    count: (r[1] as number) ?? 0,
  }));
}

export async function getSkillsByStatus(
  limitPerStatus: number,
): Promise<Record<string, SkillCount[]>> {
  const db = await getDB();

  const rows = db.exec(`
    SELECT j.status, s.skill_name, COUNT(*) AS cnt
    FROM job_skills s
    JOIN jobs j ON j.id = s.job_id
    GROUP BY j.status, s.skill_name
    ORDER BY j.status, cnt DESC
  `);

  const result: Record<string, SkillCount[]> = {};

  if (!rows.length) return result;

  for (const r of rows[0].values) {
    const status = (r[0] as string) ?? '';
    const list = result[status] ?? [];
    if (list.length < limitPerStatus) {
      list.push({ skill: (r[1] as string) ?? '', count: (r[2] as number) ?? 0 });
      result[status] = list;
    }
  }

  return result;
}

export async function getTopJobTitles(limit: number): Promise<TitleCount[]> {
  const db = await getDB();
  const safeLimit = Math.max(0, Math.floor(Number(limit)));

  const rows = db.exec(
    `SELECT job_title, COUNT(*) AS cnt
     FROM jobs
     WHERE job_title IS NOT NULL AND job_title != ''
     GROUP BY job_title
     ORDER BY cnt DESC, job_title ASC
     LIMIT ${safeLimit}`,
  );

  if (!rows.length) return [];
  return rows[0].values.map((r: unknown[]) => ({
    title: (r[0] as string) ?? '',
    count: (r[1] as number) ?? 0,
  }));
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const statusStats = await getJobStats();

  const categories = ['programming_language', 'database', 'cloud', 'devops', 'other'];
  const skillsByCategory: Record<string, SkillCount[]> = {};
  for (const cat of categories) {
    skillsByCategory[cat] = await getTopSkillsByCategory(cat, 15);
  }

  const skillsByStatus = await getSkillsByStatus(10);
  const topJobTitles = await getTopJobTitles(15);

  return { statusStats, skillsByCategory, skillsByStatus, topJobTitles };
}

// ---------------------------------------------------------------------------
// ListJobsFull — for agent export (includes raw_json for all jobs)
// ---------------------------------------------------------------------------

export interface JobFullExport {
  id: number;
  sourceUrl: string;
  status: string;
  notes: string;
  rating?: number;
  extracted: JobExtracted | null;
}

export async function listJobsFull(): Promise<JobFullExport[]> {
  const db = await getDB();
  const rows = db.exec(
    `SELECT id, source_url, status, notes, rating, raw_json FROM jobs ORDER BY extracted_at DESC`
  );
  if (!rows.length) return [];
  return rows[0].values.map((r: unknown[]) => {
    let extracted: JobExtracted | null = null;
    try {
      const raw = r[5] as string;
      if (raw) extracted = JSON.parse(raw);
    } catch { /* malformed raw_json — skip */ }
    return {
      id: r[0] as number,
      sourceUrl: (r[1] as string) ?? '',
      status: (r[2] as string) ?? 'saved',
      notes: (r[3] as string) ?? '',
      rating: r[4] != null ? (r[4] as number) : undefined,
      extracted,
    };
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<Profile> {
  const db = await getDB();

  const rows = db.exec(
    'SELECT id, full_name, email, phone, location, current_role, years_experience, skills, links, story_markdown FROM profile WHERE id = 1',
  );

  if (!rows.length || !rows[0].values.length) {
    return { id: 1, fullName: '', email: '', phone: '', location: '', currentRole: '', yearsExperience: 0, skills: [], links: [], storyMarkdown: '' };
  }

  const [id, fullName, email, phone, location, currentRole, yearsExperience, skillsJSON, linksJSON, storyMarkdown] = rows[0].values[0];

  let skills: string[] = [];
  let links: string[] = [];
  try { skills = JSON.parse((skillsJSON as string) ?? '[]'); } catch { /* empty */ }
  try { links = JSON.parse((linksJSON as string) ?? '[]'); } catch { /* empty */ }

  return {
    id: (id as number) ?? 1,
    fullName: (fullName as string) ?? '',
    email: (email as string) ?? '',
    phone: (phone as string) ?? '',
    location: (location as string) ?? '',
    currentRole: (currentRole as string) ?? '',
    yearsExperience: (yearsExperience as number) ?? 0,
    skills,
    links,
    storyMarkdown: (storyMarkdown as string) ?? '',
  };
}

export async function saveProfile(profile: Omit<Profile, 'id'>): Promise<void> {
  const db = await getDB();

  db.run(
    `UPDATE profile SET
      full_name = ${sqlVal(profile.fullName)},
      email = ${sqlVal(profile.email)},
      phone = ${sqlVal(profile.phone)},
      location = ${sqlVal(profile.location)},
      current_role = ${sqlVal(profile.currentRole)},
      years_experience = ${sqlVal(profile.yearsExperience)},
      skills = ${sqlVal(JSON.stringify(profile.skills ?? []))},
      links = ${sqlVal(JSON.stringify(profile.links ?? []))},
      story_markdown = ${sqlVal(profile.storyMarkdown)},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1`,
  );

  await persist();
}

// ---------------------------------------------------------------------------
// Agent Import (import jobs from exported db.json)
// ---------------------------------------------------------------------------

export interface ImportedJob {
  id?: number;
  sourceUrl: string;
  title?: string;
  company?: string;
  location?: string;
  status: string;
  skills?: string[];
  notes?: string;
  rating?: number;
  extractedAt?: string;
  /** Full extracted data — when present, all fields are populated via saveJob() */
  extracted?: JobExtracted;
}

export async function importMcpJobs(jobs: ImportedJob[]): Promise<number> {
  let imported = 0;

  for (const mcpJob of jobs) {
    if (mcpJob.extracted) {
      // Full extracted data available — use the proper saveJob path so all
      // DB columns (salary, seniority, summary, responsibilities, etc.) are written
      const extracted: JobExtracted = {
        ...mcpJob.extracted,
        source_url: mcpJob.sourceUrl || mcpJob.extracted.source_url,
        extracted_at: mcpJob.extractedAt || mcpJob.extracted.extracted_at || new Date().toISOString(),
      };

      const jobId = await saveJob(extracted);

      // After saveJob, apply status/notes/rating overrides from the agent
      if (jobId > 0) {
        const db = await getDB();
        db.run(
          `UPDATE jobs SET
            status = ${sqlVal(mcpJob.status)},
            notes = ${sqlVal(mcpJob.notes || '')},
            rating = ${mcpJob.rating != null ? sqlVal(mcpJob.rating) : 'NULL'},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${sqlVal(jobId)}`
        );
        await persist();
      }
    } else {
      // Minimal fallback — no extracted blob (agent-created job with basic fields only)
      const db = await getDB();
      const existing = db.exec(`SELECT id FROM jobs WHERE source_url = ${sqlVal(mcpJob.sourceUrl)}`);

      if (existing.length && existing[0].values.length) {
        const existingId = existing[0].values[0][0] as number;
        db.run(
          `UPDATE jobs SET
            job_title = ${sqlVal(mcpJob.title || '')},
            company_name = ${sqlVal(mcpJob.company || '')},
            location_full = ${sqlVal(mcpJob.location || '')},
            status = ${sqlVal(mcpJob.status)},
            notes = ${sqlVal(mcpJob.notes || '')},
            rating = ${mcpJob.rating != null ? sqlVal(mcpJob.rating) : 'NULL'},
            updated_at = CURRENT_TIMESTAMP
          WHERE source_url = ${sqlVal(mcpJob.sourceUrl)}`
        );

        if (mcpJob.skills?.length) {
          db.run(`DELETE FROM job_skills WHERE job_id = ${sqlVal(existingId)}`);
          for (const skill of mcpJob.skills) {
            db.run(
              `INSERT INTO job_skills (job_id, skill_name, skill_category, is_required)
               VALUES (${sqlVal(existingId)}, ${sqlVal(skill)}, 'other', 1)`
            );
          }
        }
      } else {
        db.run(
          `INSERT INTO jobs (
            source_url, extracted_at, job_title, company_name, location_full,
            status, notes, rating, raw_json
          ) VALUES (
            ${sqlVal(mcpJob.sourceUrl)},
            ${sqlVal(mcpJob.extractedAt || new Date().toISOString())},
            ${sqlVal(mcpJob.title || '')},
            ${sqlVal(mcpJob.company || '')},
            ${sqlVal(mcpJob.location || '')},
            ${sqlVal(mcpJob.status)},
            ${sqlVal(mcpJob.notes || '')},
            ${mcpJob.rating != null ? sqlVal(mcpJob.rating) : 'NULL'},
            ${sqlVal(JSON.stringify({ agentImport: true }))}
          )`
        );

        const jobId = db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] as number;

        if (mcpJob.skills?.length) {
          for (const skill of mcpJob.skills) {
            db.run(
              `INSERT INTO job_skills (job_id, skill_name, skill_category, is_required)
               VALUES (${sqlVal(jobId)}, ${sqlVal(skill)}, 'other', 1)`
            );
          }
        }
      }

      await persist();
    }

    imported++;
  }

  return imported;
}
