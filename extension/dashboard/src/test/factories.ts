import type {
  JobSummary,
  JobFull,
  JobStatus,
  JobExtracted,
  Profile,
  AppSettings,
  AnalyticsData,
} from '@/types';
import type { ExtractionStatus } from '@/lib/api';

export function makeJobSummary(overrides: Partial<JobSummary> = {}): JobSummary {
  const id = overrides.id ?? 1;
  return {
    id,
    title: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
    jobType: 'Full-time',
    workplaceType: 'Remote',
    level: 'Senior',
    department: 'Engineering',
    salaryRange: '$120k - $180k',
    status: 'saved' as JobStatus,
    maxStatus: 'saved' as JobStatus,
    extractedAt: '2025-01-15T10:30:00Z',
    sourceUrl: 'https://example.com/job/123',
    skills: ['TypeScript', 'React', 'Node.js'],
    ...overrides,
  };
}

export function makeJobExtracted(overrides: Partial<JobExtracted> = {}): JobExtracted {
  return {
    metadata: {
      job_title: 'Senior Software Engineer',
      department: 'Engineering',
      seniority_level: 'Senior',
      job_function: 'Software Development',
      ...overrides.metadata,
    },
    company_info: {
      company_name: 'TechCorp Inc.',
      industry: 'Technology',
      company_size: '1000-5000',
      location_full: 'San Francisco, CA, USA',
      location_city: 'San Francisco',
      location_country: 'USA',
      ...overrides.company_info,
    },
    role_details: {
      summary: 'We are looking for a talented software engineer...',
      key_responsibilities: [
        'Design and implement scalable features',
        'Collaborate with cross-functional teams',
        'Mentor junior developers',
      ],
      team_structure: 'Engineering team of 10, working in squads',
      ...overrides.role_details,
    },
    requirements: {
      years_experience_min: 5,
      years_experience_max: 10,
      education_level: 'Bachelor\'s',
      requires_specific_degree: false,
      technical_skills: {
        programming_languages: ['TypeScript', 'Python', 'Go'],
        frameworks: ['React', 'Node.js', 'Express'],
        databases: ['PostgreSQL', 'Redis'],
        cloud_platforms: ['AWS', 'GCP'],
        devops_tools: ['Docker', 'Kubernetes', 'CI/CD'],
        other: ['GraphQL', 'REST APIs'],
      },
      soft_skills: ['Communication', 'Problem-solving', 'Teamwork'],
      nice_to_have: ['Startup experience', 'Open source contributions'],
      ...overrides.requirements,
    },
    compensation: {
      salary_min: 150000,
      salary_max: 200000,
      salary_currency: 'USD',
      has_equity: true,
      has_remote_stipend: true,
      benefits: ['Health insurance', '401k matching', 'Unlimited PTO'],
      offers_visa_sponsorship: false,
      offers_health_insurance: true,
      offers_pto: true,
      offers_professional_development: true,
      offers_401k: true,
      ...overrides.compensation,
    },
    work_arrangement: {
      workplace_type: 'Remote',
      job_type: 'Full-time',
      is_remote_friendly: true,
      timezone_requirements: 'US timezones preferred',
      ...overrides.work_arrangement,
    },
    market_signals: {
      urgency_level: 'Medium',
      interview_rounds: 4,
      has_take_home: true,
      has_pair_programming: true,
      ...overrides.market_signals,
    },
    extracted_at: '2025-01-15T10:30:00Z',
    source_url: 'https://example.com/job/123',
    ...overrides,
  };
}

export function makeJobFull(overrides: Partial<JobFull> = {}): JobFull {
  const id = overrides.id ?? 1;
  return {
    id,
    title: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
    status: 'saved' as JobStatus,
    url: 'https://example.com/job/123',
    skills: ['TypeScript', 'React', 'Node.js'],
    notes: '',
    cvMarkdown: '',
    extracted: makeJobExtracted(),
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    location: 'San Francisco, CA',
    currentRole: 'Full Stack Developer',
    yearsExperience: 5,
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python'],
    links: ['https://github.com/johndoe', 'https://linkedin.com/in/johndoe'],
    storyMarkdown: 'Experienced developer with a passion for building great products...',
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    provider: 'ollama',
    ollamaModel: 'qwen2.5:7b',
    perplexityKey: '',
    perplexityModel: 'sonar-pro',
    perplexityApiKey: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-3-5-sonnet',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    ghostedDays: 14,
    licenseKey: '',
    licenseExpiry: '',
    ...overrides,
  };
}

export function makeAnalytics(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    statusStats: {
      saved: 5,
      applied: 3,
      'interview-hr': 1,
      'interview-tech-intro': 1,
      'interview-tech-system': 1,
      'interview-tech-code': 0,
      offer: 0,
      rejected: 2,
    },
    skillsByCategory: {
      languages: [
        { skill: 'TypeScript', count: 8 },
        { skill: 'Python', count: 5 },
        { skill: 'Go', count: 3 },
      ],
      frameworks: [
        { skill: 'React', count: 6 },
        { skill: 'Node.js', count: 4 },
      ],
    },
    skillsByStatus: {
      applied: [
        { skill: 'TypeScript', count: 3 },
        { skill: 'React', count: 2 },
      ],
      saved: [
        { skill: 'Python', count: 4 },
      ],
    },
    topJobTitles: [
      { title: 'Software Engineer', count: 10 },
      { title: 'Frontend Developer', count: 6 },
      { title: 'Full Stack Developer', count: 4 },
    ],
    ...overrides,
  };
}

export function makeExtractionEvent(status: ExtractionStatus, error?: string) {
  return { status, error };
}

export const jobStatuses: JobStatus[] = [
  'saved',
  'applied',
  'interview-hr',
  'interview-tech-intro',
  'interview-tech-system',
  'interview-tech-code',
  'offer',
  'rejected',
];

export function makeJobsWithStatuses(): JobSummary[] {
  return jobStatuses.map((status, index) =>
    makeJobSummary({
      id: index + 1,
      status,
      title: `${status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')} Job`,
    })
  );
}

export function makeManyJobs(count: number, baseOverrides: Partial<JobSummary> = {}): JobSummary[] {
  return Array.from({ length: count }, (_, i) =>
    makeJobSummary({
      id: i + 1,
      ...baseOverrides,
      title: `Job ${i + 1}`,
      company: `Company ${i + 1}`,
    })
  );
}
