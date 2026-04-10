import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeInsights, MIN_APPLIED_JOBS } from '@/lib/insights';

vi.mock('@/lib/db', () => ({
  getDB: vi.fn(),
}));

vi.mock('@/lib/queries', () => ({
  getProfile: vi.fn().mockResolvedValue({
    id: 1, fullName: '', email: '', phone: '', location: '',
    currentRole: 'Software Engineer', yearsExperience: 3,
    skills: [], links: [], storyMarkdown: '',
  }),
}));

function makeDb(execResponses: Record<string, unknown[][]>) {
  return {
    exec: vi.fn((sql: string) => {
      // Match most specific keys first (longer strings match before shorter ones)
      const keys = Object.keys(execResponses).sort((a, b) => b.length - a.length);
      for (const key of keys) {
        if (sql.includes(key)) {
          const values = execResponses[key];
          if (!values.length) return [];
          return [{ values }];
        }
      }
      return [];
    }),
  };
}

describe('computeInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hasEnoughData=false when fewer than MIN_APPLIED_JOBS', async () => {
    const { getDB } = await import('@/lib/db');
    (getDB as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDb({ 'COUNT(*) FROM jobs': [[5]] })
    );

    const result = await computeInsights();
    expect(result.hasEnoughData).toBe(false);
    expect(result.appliedCount).toBe(5);
    expect(result.insights).toHaveLength(0);
  });

  it('returns hasEnoughData=true with enough applied jobs', async () => {
    const { getDB } = await import('@/lib/db');
    (getDB as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDb({
        'COUNT(*) FROM jobs': [[MIN_APPLIED_JOBS]],
        'GROUP BY company_size': [],
        'GROUP BY seniority_level': [],
        'GROUP BY workplace_type': [],
        'GROUP BY industry': [],
        'GROUP BY s.skill_name': [],
      })
    );

    const result = await computeInsights();
    expect(result.hasEnoughData).toBe(true);
    expect(result.appliedCount).toBe(MIN_APPLIED_JOBS);
  });

  it('surfaces a company size insight when there is a 1.5x+ rate gap', async () => {
    const { getDB } = await import('@/lib/db');
    (getDB as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDb({
        'COUNT(*) FROM jobs': [[20]],
        'GROUP BY company_size': [
          ['50-200', 10, 5],  // 50% response rate
          ['1000+',  10, 2],  // 20% response rate — ratio 2.5x
        ],
        'GROUP BY seniority_level': [],
        'GROUP BY workplace_type': [],
        'GROUP BY industry': [],
        'GROUP BY s.skill_name': [],
      })
    );

    const result = await computeInsights();
    const insight = result.insights.find(i => i.id === 'company-size');
    expect(insight).toBeDefined();
    expect(insight?.level).toBe('positive');
    expect(insight?.data[0].rate).toBe(50);
  });

  it('suppresses a company size insight when ratio is below 1.5x', async () => {
    const { getDB } = await import('@/lib/db');
    (getDB as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDb({
        'COUNT(*) FROM jobs': [[20]],
        'GROUP BY company_size': [
          ['50-200', 10, 4],  // 40%
          ['1000+',  10, 3],  // 30% — ratio 1.33x, below threshold
        ],
        'GROUP BY seniority_level': [],
        'GROUP BY workplace_type': [],
        'GROUP BY industry': [],
        'GROUP BY s.skill_name': [],
      })
    );

    const result = await computeInsights();
    const insight = result.insights.find(i => i.id === 'company-size');
    expect(insight).toBeUndefined();
  });

  it('surfaces a seniority mismatch warning for junior applicant targeting senior roles', async () => {
    const { getDB } = await import('@/lib/db');
    const { getProfile } = await import('@/lib/queries');
    (getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      yearsExperience: 2, skills: [], links: [],
    });
    (getDB as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDb({
        'COUNT(*) FROM jobs': [[15]],
        'GROUP BY company_size': [],
        'GROUP BY seniority_level': [
          ['Senior', 8, 0],
          ['Mid', 4, 0],
          ['Junior', 3, 0],
        ],
        'GROUP BY workplace_type': [],
        'GROUP BY industry': [],
        'GROUP BY s.skill_name': [],
      })
    );

    const result = await computeInsights();
    const insight = result.insights.find(i => i.id === 'seniority-mismatch');
    expect(insight).toBeDefined();
    expect(insight?.level).toBe('warning');
  });

  it('returns empty insights when no patterns meet the threshold', async () => {
    const { getDB } = await import('@/lib/db');
    (getDB as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDb({
        'COUNT(*) FROM jobs': [[20]],
        'GROUP BY company_size': [],
        'GROUP BY seniority_level': [],
        'GROUP BY workplace_type': [],
        'GROUP BY industry': [],
        'GROUP BY s.skill_name': [],
      })
    );

    const result = await computeInsights();
    expect(result.hasEnoughData).toBe(true);
    expect(result.insights).toHaveLength(0);
  });
});
