// ---- Job data types (matching Go models + native host responses) ----

export interface JobMetadata {
  job_title: string;
  department: string;
  seniority_level: string;
  job_function: string;
}

export interface CompanyInfo {
  company_name: string;
  industry: string;
  company_size: string;
  location_full: string;
  location_city: string;
  location_country: string;
}

export interface RoleDetails {
  summary: string;
  key_responsibilities: string[];
  team_structure: string;
}

export interface TechnicalSkills {
  programming_languages: string[];
  frameworks: string[];
  databases: string[];
  cloud_platforms: string[];
  devops_tools: string[];
  other: string[];
}

export interface Requirements {
  years_experience_min: number;
  years_experience_max: number;
  education_level: string;
  requires_specific_degree: boolean;
  technical_skills: TechnicalSkills;
  soft_skills: string[];
  nice_to_have: string[];
}

export interface Compensation {
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  has_equity: boolean;
  has_remote_stipend: boolean;
  benefits: string[];
  offers_visa_sponsorship: boolean;
  offers_health_insurance: boolean;
  offers_pto: boolean;
  offers_professional_development: boolean;
  offers_401k: boolean;
}

export interface WorkArrangement {
  workplace_type: string;
  job_type: string;
  is_remote_friendly: boolean;
  timezone_requirements: string;
}

export interface MarketSignals {
  urgency_level: string;
  interview_rounds: number;
  has_take_home: boolean;
  has_pair_programming: boolean;
}

export interface JobExtracted {
  metadata: JobMetadata;
  company_info: CompanyInfo;
  role_details: RoleDetails;
  requirements: Requirements;
  compensation: Compensation;
  work_arrangement: WorkArrangement;
  market_signals: MarketSignals;
  extracted_at: string;
  source_url: string;
}

/** Summary returned by listJobs */
export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location: string;
  jobType: string;
  workplaceType: string;
  level: string;
  department: string;
  salaryRange: string;
  status: JobStatus;
  maxStatus: JobStatus;
  extractedAt: string;
  sourceUrl: string;
  skills: string[];
  daysGhosted?: number;
}

/** Full job returned by getJob */
export interface JobFull {
  id: number;
  title: string;
  company: string;
  location: string;
  status: JobStatus;
  url: string;
  skills: string[];
  notes: string;
  cvMarkdown: string;
  extracted: JobExtracted;
}

export type JobStatus = 'saved' | 'applied' | 'interview-hr' | 'interview-tech-intro' | 'interview-tech-system' | 'interview-tech-code' | 'offer' | 'rejected';

export const JOB_STATUSES: JobStatus[] = ['saved', 'applied', 'interview-hr', 'interview-tech-intro', 'interview-tech-system', 'interview-tech-code', 'offer', 'rejected'];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  'interview-hr': 'Interview: HR',
  'interview-tech-intro': 'Interview: Tech Intro',
  'interview-tech-system': 'Interview: Tech System',
  'interview-tech-code': 'Interview: Tech Code',
  offer: 'Offer',
  rejected: 'Rejected',
};

// ---- Profile ----

export interface Profile {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  currentRole: string;
  yearsExperience: number;
  skills: string[];
  links: string[];
  storyMarkdown: string;
}

// ---- Analytics ----

export interface SkillCount {
  skill: string;
  count: number;
}

export interface TitleCount {
  title: string;
  count: number;
}

export interface AnalyticsData {
  statusStats: Record<string, number>;
  skillsByCategory: Record<string, SkillCount[]>;
  skillsByStatus: Record<string, SkillCount[]>;
  topJobTitles: TitleCount[];
}

// ---- Settings ----

export interface AppSettings {
  provider: string;
  ollamaModel: string;
  perplexityKey: string;
  perplexityModel: string;
  perplexityApiKey: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  geminiApiKey: string;
  geminiModel: string;
  ghostedDays: number;
  licenseKey: string;
  licenseExpiry: string;
  onboardingCompleted?: boolean;
}

// ---- Tabs ----

export type TabId = 'jobs' | 'pipeline' | 'rejected' | 'analytics' | 'profile' | 'settings';

// ---- Insights ----

export type InsightLevel = 'positive' | 'warning' | 'neutral';
export type InsightConfidence = 'low' | 'medium' | 'high';

export interface InsightDataPoint {
  label: string;
  applied: number;
  responses: number;
  rate: number; // 0-100
}

export interface Insight {
  id: string;
  level: InsightLevel;
  confidence: InsightConfidence;
  headline: string;
  description: string;
  action: string;
  sampleSize: number;
  data: InsightDataPoint[];
}

export interface InsightsResult {
  insights: Insight[];
  appliedCount: number;
  hasEnoughData: boolean; // true if appliedCount >= MIN_APPLIED_JOBS
}
