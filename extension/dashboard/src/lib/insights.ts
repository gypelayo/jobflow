/**
 * Insights engine — computes actionable patterns from the user's job search data.
 *
 * All computation is local SQL + TypeScript. No server, no AI calls.
 *
 * A "response" = max_status advanced past 'applied' (any interview stage or offer).
 * An "applied" job = max_status != 'saved' (the user actually applied).
 */

import { getDB } from './db';
import { getProfile } from './queries';
import type { Insight, InsightDataPoint, InsightConfidence, InsightsResult } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_APPLIED_JOBS = 10;   // minimum applied jobs before showing any insights
const MIN_SEGMENT_SIZE = 3;           // minimum applications per segment to include it
const MIN_RATIO = 1.5;                // best segment must be this much better than worst
const RESPONSE_STATUSES = `('interview-hr','interview-tech-intro','interview-tech-system','interview-tech-code','offer')`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidence(sampleSize: number): InsightConfidence {
  if (sampleSize >= 20) return 'high';
  if (sampleSize >= 8) return 'medium';
  return 'low';
}

function pct(responses: number, applied: number): number {
  if (applied === 0) return 0;
  return Math.round((responses / applied) * 100);
}

function ratio(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Individual insight computers
// ---------------------------------------------------------------------------

/**
 * Generic dimension insight: response rate grouped by a text column.
 * Returns an Insight if a meaningful pattern is found, null otherwise.
 */
async function computeDimensionInsight(
  id: string,
  column: string,
  labelMap: Record<string, string> | null,
): Promise<Insight | null> {
  const db = await getDB();

  const rows = db.exec(`
    SELECT
      ${column} as dim,
      COUNT(*) as total,
      SUM(CASE WHEN max_status IN ${RESPONSE_STATUSES} THEN 1 ELSE 0 END) as responses
    FROM jobs
    WHERE max_status != 'saved'
      AND ${column} IS NOT NULL
      AND ${column} != ''
    GROUP BY ${column}
    HAVING COUNT(*) >= ${MIN_SEGMENT_SIZE}
    ORDER BY ${column}
  `);

  if (!rows.length || rows[0].values.length < 2) return null;

  const points: InsightDataPoint[] = rows[0].values.map((r: unknown[]) => {
    const label = (r[0] as string) ?? '';
    const applied = (r[1] as number) ?? 0;
    const responses = (r[2] as number) ?? 0;
    return {
      label: labelMap?.[label] ?? label,
      applied,
      responses,
      rate: pct(responses, applied),
    };
  });

  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => b.rate - a.rate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Only surface if there's a meaningful gap
  if (best.rate === 0) return null;
  if (worst.rate === 0 && best.rate < 20) return null; // not enough signal
  if (worst.rate > 0 && ratio(best.rate, worst.rate) < MIN_RATIO) return null;

  const totalSample = points.reduce((s, p) => s + p.applied, 0);
  const r = worst.rate > 0
    ? `${ratio(best.rate, worst.rate)}×`
    : `${best.rate}% vs 0%`;

  const dimensionLabels: Record<string, string> = {
    company_size: 'company size',
    seniority_level: 'seniority level',
    workplace_type: 'workplace type',
    industry: 'industry',
  };
  const dimLabel = dimensionLabels[column] ?? column;

  return {
    id,
    level: 'positive',
    confidence: confidence(totalSample),
    headline: `${best.label} responds ${r} more often`,
    description: `Of your ${totalSample} applications, ${best.label} roles have the highest response rate at ${best.rate}%${worst.rate > 0 ? `, compared to ${worst.rate}% for ${worst.label}` : ''}.`,
    action: `Focus your next applications on ${best.label} ${dimLabel} roles.`,
    sampleSize: totalSample,
    data: sorted,
  };
}

/**
 * Seniority vs years-of-experience mismatch.
 */
async function computeSeniorityMismatch(yearsExperience: number): Promise<Insight | null> {
  if (!yearsExperience) return null;

  const db = await getDB();

  const rows = db.exec(`
    SELECT seniority_level, COUNT(*) as cnt
    FROM jobs
    WHERE max_status != 'saved'
      AND seniority_level IS NOT NULL
      AND seniority_level != ''
    GROUP BY seniority_level
  `);

  if (!rows.length || !rows[0].values.length) return null;

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows[0].values) {
    const level = (r[0] as string).toLowerCase();
    const cnt = (r[1] as number) ?? 0;
    counts[level] = cnt;
    total += cnt;
  }

  if (total < MIN_SEGMENT_SIZE) return null;

  const seniorCount = (counts['senior'] ?? 0) + (counts['staff'] ?? 0) +
    (counts['principal'] ?? 0) + (counts['lead'] ?? 0);
  const juniorMidCount = (counts['junior'] ?? 0) + (counts['mid'] ?? 0);
  const seniorPct = pct(seniorCount, total);
  const juniorMidPct = pct(juniorMidCount, total);

  // Overreaching: <3 YOE but majority of applications are senior+
  if (yearsExperience < 3 && seniorPct >= 50) {
    return {
      id: 'seniority-mismatch',
      level: 'warning',
      confidence: confidence(total),
      headline: `${seniorPct}% of your applications target Senior+ roles with ${yearsExperience} YoE`,
      description: `You have ${yearsExperience} year${yearsExperience === 1 ? '' : 's'} of experience, but ${seniorPct}% of your applications are for Senior, Staff, or Lead roles. These typically expect 5+ years.`,
      action: 'Try applying to more Mid-level roles — you are likely to get a much higher response rate.',
      sampleSize: total,
      data: Object.entries(counts)
        .map(([label, applied]) => ({ label, applied, responses: 0, rate: pct(applied, total) }))
        .sort((a, b) => b.applied - a.applied),
    };
  }

  // Underaiming: 7+ YOE but majority of applications are junior/mid
  if (yearsExperience >= 7 && juniorMidPct >= 50) {
    return {
      id: 'seniority-mismatch',
      level: 'warning',
      confidence: confidence(total),
      headline: `${juniorMidPct}% of your applications target Junior/Mid roles with ${yearsExperience} YoE`,
      description: `You have ${yearsExperience} years of experience but ${juniorMidPct}% of your applications are for Junior or Mid-level roles. You may be undervaluing yourself.`,
      action: 'Try targeting Senior or Staff roles — your experience level justifies it.',
      sampleSize: total,
      data: Object.entries(counts)
        .map(([label, applied]) => ({ label, applied, responses: 0, rate: pct(applied, total) }))
        .sort((a, b) => b.applied - a.applied),
    };
  }

  return null;
}

/**
 * Top skills correlated with getting a response.
 */
async function computeSkillInsight(): Promise<Insight | null> {
  const db = await getDB();

  const rows = db.exec(`
    SELECT
      s.skill_name,
      COUNT(DISTINCT j.id) as total,
      SUM(CASE WHEN j.max_status IN ${RESPONSE_STATUSES} THEN 1 ELSE 0 END) as responses
    FROM job_skills s
    JOIN jobs j ON j.id = s.job_id
    WHERE j.max_status != 'saved'
    GROUP BY s.skill_name
    HAVING COUNT(DISTINCT j.id) >= ${MIN_SEGMENT_SIZE}
    ORDER BY (CAST(SUM(CASE WHEN j.max_status IN ${RESPONSE_STATUSES} THEN 1 ELSE 0 END) AS FLOAT) / COUNT(DISTINCT j.id)) DESC
    LIMIT 20
  `);

  if (!rows.length || rows[0].values.length < 4) return null;

  const points: InsightDataPoint[] = rows[0].values.map((r: unknown[]) => ({
    label: (r[0] as string) ?? '',
    applied: (r[1] as number) ?? 0,
    responses: (r[2] as number) ?? 0,
    rate: pct((r[2] as number) ?? 0, (r[1] as number) ?? 0),
  }));

  const best = points[0];
  const worst = points[points.length - 1];

  if (best.rate === 0) return null;
  if (worst.rate > 0 && ratio(best.rate, worst.rate) < MIN_RATIO) return null;

  const totalSample = points.reduce((s, p) => s + p.applied, 0);
  const top3 = points.slice(0, 3).map(p => p.label).join(', ');

  return {
    id: 'top-skills',
    level: 'positive',
    confidence: confidence(totalSample),
    headline: `${best.label} jobs respond to you ${worst.rate > 0 ? `${ratio(best.rate, worst.rate)}×` : `${best.rate}% vs ${worst.rate}%`} more often`,
    description: `Your best-performing skills by response rate are ${top3}. Roles requiring these skills are more likely to advance you past the application stage.`,
    action: `Prioritise roles that prominently feature ${best.label} in their requirements.`,
    sampleSize: totalSample,
    data: points.slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function computeInsights(): Promise<InsightsResult> {
  const db = await getDB();

  // Count applied jobs (max_status != 'saved')
  const countRows = db.exec(`SELECT COUNT(*) FROM jobs WHERE max_status != 'saved'`);
  const appliedCount = (countRows[0]?.values[0]?.[0] as number) ?? 0;

  if (appliedCount < MIN_APPLIED_JOBS) {
    return { insights: [], appliedCount, hasEnoughData: false };
  }

  // Fetch profile for seniority mismatch check
  const profile = await getProfile();

  const companySizeMap: Record<string, string> = {
    '10-50': 'Startup (10-50)',
    '51-200': 'Series B (51-200)',
    '50-200': 'Series B (50-200)',
    '201-1000': 'Mid-size (201-1000)',
    '200-1000': 'Mid-size (200-1000)',
    '1001+': 'Enterprise (1000+)',
    '1000+': 'Enterprise (1000+)',
  };

  const results = await Promise.all([
    computeDimensionInsight('company-size', 'company_size', companySizeMap),
    computeDimensionInsight('seniority', 'seniority_level', null),
    computeDimensionInsight('workplace', 'workplace_type', null),
    computeDimensionInsight('industry', 'industry', null),
    computeSeniorityMismatch(profile?.yearsExperience ?? 0),
    computeSkillInsight(),
  ]);

  const insights = results.filter((i): i is Insight => i !== null);

  return { insights, appliedCount, hasEnoughData: true };
}
