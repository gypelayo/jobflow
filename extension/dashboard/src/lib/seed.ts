import { saveJob, updateJobStatus } from './queries';
import type { JobExtracted, JobStatus } from '@/types';

const createJob = (overrides: Partial<JobExtracted> & { source_url: string }): JobExtracted => {
  const base: JobExtracted = {
    metadata: {
      job_title: 'Software Engineer',
      department: 'Engineering',
      seniority_level: 'Mid',
      job_function: 'Engineering',
    },
    company_info: {
      company_name: 'Acme Corp',
      industry: 'Technology',
      company_size: '50-200',
      location_full: 'San Francisco, CA',
      location_city: 'San Francisco',
      location_country: 'USA',
    },
    role_details: {
      summary: 'Join our team to build amazing products.',
      key_responsibilities: ['Build features', 'Write tests', 'Code review'],
      team_structure: 'Small team',
    },
    requirements: {
      years_experience_min: 2,
      years_experience_max: 5,
      education_level: "Bachelor's",
      requires_specific_degree: false,
      technical_skills: {
        programming_languages: ['JavaScript'],
        frameworks: ['React'],
        databases: ['PostgreSQL'],
        cloud_platforms: ['AWS'],
        devops_tools: ['Docker'],
        other: [],
      },
      soft_skills: ['Communication', 'Teamwork'],
      nice_to_have: ['TypeScript', 'GraphQL'],
    },
    compensation: {
      salary_min: 100000,
      salary_max: 150000,
      salary_currency: 'USD',
      has_equity: true,
      has_remote_stipend: false,
      benefits: ['Health', '401k', 'PTO'],
      offers_visa_sponsorship: false,
      offers_health_insurance: true,
      offers_pto: true,
      offers_professional_development: true,
      offers_401k: true,
    },
    work_arrangement: {
      workplace_type: 'Hybrid',
      job_type: 'Full-time',
      is_remote_friendly: true,
      timezone_requirements: 'US Pacific',
    },
    market_signals: {
      urgency_level: 'Medium',
      interview_rounds: 4,
      has_take_home: true,
      has_pair_programming: true,
    },
    extracted_at: new Date().toISOString(),
    source_url: 'https://example.com/job/1',
  };

  return deepMerge(base, overrides);
};

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    if (sourceValue !== undefined) {
      const targetValue = target[key];
      if (isObject(sourceValue) && isObject(targetValue)) {
        (result as T)[key] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T];
      } else {
        (result as T)[key] = sourceValue as T[keyof T];
      }
    }
  }
  return result;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const seedJobs = [
  {
    source_url: 'https://linkedin.com/jobs/view/senior-devops-engineer-123',
    metadata: { job_title: 'Senior DevOps Engineer', seniority_level: 'Senior', department: 'Infrastructure', job_function: 'Infrastructure' },
    company_info: { company_name: 'Stripe', industry: 'Fintech', company_size: '5000+', location_full: 'San Francisco, CA', location_city: 'San Francisco', location_country: 'USA' },
    requirements: { years_experience_min: 5, years_experience_max: 8, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Python', 'Go'], frameworks: [], databases: ['PostgreSQL', 'Redis'], cloud_platforms: ['AWS', 'GCP'], devops_tools: ['Kubernetes', 'Terraform', 'Docker'] as string[], other: ['CI/CD', 'Linux'] }, soft_skills: ['Leadership', 'Communication'], nice_to_have: ['AWS Solutions Architect', 'CKA'] },
    compensation: { salary_min: 180000, salary_max: 250000, salary_currency: 'USD', has_equity: true, has_remote_stipend: true, benefits: ['Health', 'Stock', '401k', 'Unlimited PTO'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Remote', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US timezones' },
    market_signals: { urgency_level: 'High', interview_rounds: 5, has_take_home: false, has_pair_programming: true },
    status: 'saved' as JobStatus,
  },
  {
    source_url: 'https://greenhouse.io/jobs/frontend-engineer-456',
    metadata: { job_title: 'Frontend Engineer', seniority_level: 'Mid', department: 'Product', job_function: 'Engineering' },
    company_info: { company_name: 'Figma', industry: 'Design', company_size: '500-1000', location_full: 'San Francisco, CA', location_city: 'San Francisco', location_country: 'USA' },
    requirements: { years_experience_min: 3, years_experience_max: 6, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['TypeScript', 'JavaScript'], frameworks: ['React', 'Next.js'], databases: ['PostgreSQL'], cloud_platforms: ['AWS'], devops_tools: ['Docker', 'Vercel'] as string[], other: ['CSS', 'WebGL'] }, soft_skills: ['Design collaboration', 'Attention to detail'], nice_to_have: ['Figma plugin development', 'WebGL experience'] },
    compensation: { salary_min: 150000, salary_max: 200000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', '401k', 'Meals'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US Pacific' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 4, has_take_home: true, has_pair_programming: true },
    status: 'applied' as JobStatus,
  },
  {
    source_url: 'https://wellfound.com/jobs/backend-engineer-789',
    metadata: { job_title: 'Backend Engineer', seniority_level: 'Mid', department: 'Platform', job_function: 'Engineering' },
    company_info: { company_name: 'Notion', industry: 'Productivity', company_size: '200-500', location_full: 'New York, NY', location_city: 'New York', location_country: 'USA' },
    requirements: { years_experience_min: 2, years_experience_max: 5, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['TypeScript', 'Python'], frameworks: ['Node.js', 'FastAPI'], databases: ['PostgreSQL', 'Redis', 'Elasticsearch'], cloud_platforms: ['AWS'], devops_tools: ['Docker', 'Kubernetes'] as string[], other: ['GraphQL', 'REST APIs'] }, soft_skills: ['Problem solving', 'Documentation'], nice_to_have: ['Distributed systems experience', 'Rust'] },
    compensation: { salary_min: 140000, salary_max: 190000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', '401k'], offers_visa_sponsorship: false, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US East' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 4, has_take_home: true, has_pair_programming: false },
    status: 'applied' as JobStatus,
  },
  {
    source_url: 'https://careers.google.com/jobs/senior-ml-engineer-101',
    metadata: { job_title: 'Senior ML Engineer', seniority_level: 'Senior', department: 'AI/ML', job_function: 'Engineering' },
    company_info: { company_name: 'Google', industry: 'Technology', company_size: '10000+', location_full: 'Mountain View, CA', location_city: 'Mountain View', location_country: 'USA' },
    requirements: { years_experience_min: 5, years_experience_max: 10, education_level: "Master's", requires_specific_degree: true, technical_skills: { programming_languages: ['Python', 'C++'], frameworks: ['TensorFlow', 'PyTorch'], databases: ['BigQuery', 'PostgreSQL'], cloud_platforms: ['GCP'], devops_tools: ['Docker', 'Kubeflow'] as string[], other: ['MLOps', 'Statistics'] }, soft_skills: ['Research', 'Communication'], nice_to_have: ['PhD', 'Publications', 'Kaggle'] },
    compensation: { salary_min: 250000, salary_max: 400000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', '401k', 'Free meals', 'Gym'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US Pacific' },
    market_signals: { urgency_level: 'Low', interview_rounds: 6, has_take_home: true, has_pair_programming: false },
    status: 'applied' as JobStatus,
  },
  {
    source_url: 'https://jobs.lever.co/startup/ios-engineer-202',
    metadata: { job_title: 'iOS Engineer', seniority_level: 'Mid', department: 'Mobile', job_function: 'Engineering' },
    company_info: { company_name: 'Robinhood', industry: 'Fintech', company_size: '1000-5000', location_full: 'Menlo Park, CA', location_city: 'Menlo Park', location_country: 'USA' },
    requirements: { years_experience_min: 3, years_experience_max: 7, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Swift', 'Kotlin'], frameworks: ['SwiftUI', 'Jetpack Compose'], databases: ['SQLite', 'Realm'], cloud_platforms: ['AWS'], devops_tools: ['Fastlane', 'CI/CD'] as string[], other: ['UIKit', 'Combine'] }, soft_skills: ['User focus', 'Performance optimization'], nice_to_have: ['Fintech experience', 'Crypto knowledge'] },
    compensation: { salary_min: 160000, salary_max: 220000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', '401k'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US Pacific' },
    market_signals: { urgency_level: 'High', interview_rounds: 5, has_take_home: true, has_pair_programming: true },
    status: 'interview-hr' as JobStatus,
  },
  {
    source_url: 'https://apply.workable.com/security-engineer-303',
    metadata: { job_title: 'Security Engineer', seniority_level: 'Senior', department: 'Security', job_function: 'Security' },
    company_info: { company_name: '1Password', industry: 'Cybersecurity', company_size: '200-500', location_full: 'Toronto, ON', location_city: 'Toronto', location_country: 'Canada' },
    requirements: { years_experience_min: 5, years_experience_max: 10, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Python', 'Go', 'Rust'], frameworks: [], databases: ['PostgreSQL'], cloud_platforms: ['AWS', 'Azure'], devops_tools: ['Docker', 'Kubernetes', 'Vault'] as string[], other: ['Penetration testing', 'Security audits'] }, soft_skills: ['Analytical thinking', 'Documentation'], nice_to_have: ['CISSP', 'OSCP', 'Security certifications'] },
    compensation: { salary_min: 140000, salary_max: 200000, salary_currency: 'CAD', has_equity: true, has_remote_stipend: true, benefits: ['Health', 'Stock', 'RRSP', 'Unlimited PTO'], offers_visa_sponsorship: false, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: false },
    work_arrangement: { workplace_type: 'Remote', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'Flexible' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 4, has_take_home: false, has_pair_programming: true },
    status: 'interview-tech-intro' as JobStatus,
  },
  {
    source_url: 'https://careers.dropbox.com/jobs/full-stack-engineer-404',
    metadata: { job_title: 'Full Stack Engineer', seniority_level: 'Mid', department: 'Product', job_function: 'Engineering' },
    company_info: { company_name: 'Dropbox', industry: 'Cloud', company_size: '1000-5000', location_full: 'San Francisco, CA', location_city: 'San Francisco', location_country: 'USA' },
    requirements: { years_experience_min: 3, years_experience_max: 6, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Python', 'TypeScript'], frameworks: ['Django', 'React', 'Next.js'], databases: ['PostgreSQL', 'MySQL'], cloud_platforms: ['AWS'], devops_tools: ['Docker', 'Kubernetes'] as string[], other: ['AWS S3', 'Microservices'] }, soft_skills: ['Collaboration', 'Agile'], nice_to_have: ['File systems experience', 'Large scale systems'] },
    compensation: { salary_min: 155000, salary_max: 210000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', '401k', 'Sabbatical'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US Pacific' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 4, has_take_home: true, has_pair_programming: true },
    status: 'interview-tech-system' as JobStatus,
  },
  {
    source_url: 'https://jobs.figma.com/positions/data-engineer-505',
    metadata: { job_title: 'Data Engineer', seniority_level: 'Mid', department: 'Data', job_function: 'Engineering' },
    company_info: { company_name: 'Databricks', industry: 'Data/AI', company_size: '1000-5000', location_full: 'San Francisco, CA', location_city: 'San Francisco', location_country: 'USA' },
    requirements: { years_experience_min: 3, years_experience_max: 7, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Python', 'Scala', 'SQL'], frameworks: ['Spark', 'Airflow'], databases: ['PostgreSQL', 'Snowflake', 'BigQuery'], cloud_platforms: ['AWS', 'Azure', 'GCP'], devops_tools: ['Docker', 'Terraform'] as string[], other: ['dbt', 'Data modeling'] }, soft_skills: ['Data storytelling', 'Cross-functional'], nice_to_have: ['Databricks certification', 'Streaming experience'] },
    compensation: { salary_min: 165000, salary_max: 230000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', '401k'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US Pacific' },
    market_signals: { urgency_level: 'High', interview_rounds: 4, has_take_home: false, has_pair_programming: true },
    status: 'interview-tech-code' as JobStatus,
  },
  {
    source_url: 'https://careers.vercel.com/technical-writer-606',
    metadata: { job_title: 'Technical Writer', seniority_level: 'Mid', department: 'Developer Experience', job_function: 'Documentation' },
    company_info: { company_name: 'Vercel', industry: 'Developer Tools', company_size: '200-500', location_full: 'Remote (US)', location_city: 'Remote', location_country: 'USA' },
    requirements: { years_experience_min: 2, years_experience_max: 5, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['JavaScript', 'TypeScript'], frameworks: ['Next.js'], databases: [], cloud_platforms: ['Vercel'], devops_tools: ['Git', 'Markdown'] as string[], other: ['API documentation', 'MDX'] }, soft_skills: ['Writing clarity', 'Technical aptitude'], nice_to_have: ['Developer documentation experience', 'Open source contributions'] },
    compensation: { salary_min: 120000, salary_max: 160000, salary_currency: 'USD', has_equity: true, has_remote_stipend: true, benefits: ['Health', 'Stock', '401k'], offers_visa_sponsorship: false, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Remote', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US timezones' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 3, has_take_home: false, has_pair_programming: false },
    status: 'offer' as JobStatus,
  },
  {
    source_url: 'https://apply.stripe.com/engineering-manager-707',
    metadata: { job_title: 'Engineering Manager', seniority_level: 'Senior', department: 'Engineering', job_function: 'Engineering' },
    company_info: { company_name: 'Stripe', industry: 'Fintech', company_size: '5000+', location_full: 'San Francisco, CA', location_city: 'San Francisco', location_country: 'USA' },
    requirements: { years_experience_min: 7, years_experience_max: 15, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Python', 'Go', 'Ruby'], frameworks: ['Rails', 'Node.js'], databases: ['PostgreSQL', 'Redis'], cloud_platforms: ['AWS'], devops_tools: ['Docker', 'Kubernetes'] as string[], other: ['System design', 'Technical leadership'] }, soft_skills: ['Leadership', 'Mentorship', 'Communication'], nice_to_have: ['Management experience', 'Fintech background'] },
    compensation: { salary_min: 280000, salary_max: 400000, salary_currency: 'USD', has_equity: true, has_remote_stipend: true, benefits: ['Health', 'Stock', '401k', 'Executive benefits'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: true },
    work_arrangement: { workplace_type: 'Hybrid', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'US Pacific' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 5, has_take_home: false, has_pair_programming: true },
    status: 'saved' as JobStatus,
  },
  {
    source_url: 'https://jobs.linear.app/react-engineer-808',
    metadata: { job_title: 'React Engineer', seniority_level: 'Mid', department: 'Product', job_function: 'Engineering' },
    company_info: { company_name: 'Linear', industry: 'Developer Tools', company_size: '10-50', location_full: 'Remote (Global)', location_city: 'Remote', location_country: 'Global' },
    requirements: { years_experience_min: 2, years_experience_max: 5, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['TypeScript', 'JavaScript'], frameworks: ['React', 'Next.js'], databases: ['PostgreSQL'], cloud_platforms: ['AWS'], devops_tools: ['Docker'] as string[], other: ['Performance optimization', 'Accessibility'] }, soft_skills: ['Product thinking', 'Attention to detail'], nice_to_have: ['Design systems experience', 'Open source'] },
    compensation: { salary_min: 130000, salary_max: 180000, salary_currency: 'USD', has_equity: true, has_remote_stipend: false, benefits: ['Health', 'Stock', 'Unlimited PTO'], offers_visa_sponsorship: false, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: false },
    work_arrangement: { workplace_type: 'Remote', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'Flexible' },
    market_signals: { urgency_level: 'High', interview_rounds: 3, has_take_home: true, has_pair_programming: false },
    status: 'saved' as JobStatus,
  },
  {
    source_url: 'https://careers.shopify.com/devops-lead-909',
    metadata: { job_title: 'DevOps Lead', seniority_level: 'Senior', department: 'Infrastructure', job_function: 'Infrastructure' },
    company_info: { company_name: 'Shopify', industry: 'E-commerce', company_size: '5000+', location_full: 'Ottawa, ON', location_city: 'Ottawa', location_country: 'Canada' },
    requirements: { years_experience_min: 6, years_experience_max: 12, education_level: "Bachelor's", requires_specific_degree: false, technical_skills: { programming_languages: ['Go', 'Python', 'Ruby'], frameworks: [], databases: ['PostgreSQL', 'MySQL', 'Redis'], cloud_platforms: ['AWS', 'GCP'], devops_tools: ['Kubernetes', 'Terraform', 'Helm', 'Docker'] as string[], other: ['Site reliability', 'Incident response'] }, soft_skills: ['Team leadership', 'Incident management'], nice_to_have: ['AWS certifications', 'E-commerce experience'] },
    compensation: { salary_min: 170000, salary_max: 240000, salary_currency: 'CAD', has_equity: true, has_remote_stipend: true, benefits: ['Health', 'Stock', 'RRSP', 'Parental leave'], offers_visa_sponsorship: true, offers_health_insurance: true, offers_pto: true, offers_professional_development: true, offers_401k: false },
    work_arrangement: { workplace_type: 'Remote', job_type: 'Full-time', is_remote_friendly: true, timezone_requirements: 'Flexible' },
    market_signals: { urgency_level: 'Medium', interview_rounds: 4, has_take_home: false, has_pair_programming: true },
    status: 'rejected' as JobStatus,
  },
];

export async function seedDemoData(): Promise<void> {
  for (const jobData of seedJobs) {
    const { status: _status, ...jobWithoutStatus } = jobData;
    const job = createJob(jobWithoutStatus as Partial<JobExtracted> & { source_url: string });
    const jobId = await saveJob(job);
    await updateJobStatus(jobId, jobData.status);
  }
}
