/**
 * LLM extraction service — port of Go extractor package.
 *
 * Calls Ollama (local) or Perplexity (cloud) to extract structured job data
 * from raw text, or to generate tailored CVs.
 */

import type { JobExtracted, AppSettings, Profile } from '@/types';
import { cleanJSONResponse, extractURL } from './textutils';

const HOSTED_API_URL = 'https://api.jobflow.app';

// ---------------------------------------------------------------------------
// Prompts (port of Go prompt.go)
// ---------------------------------------------------------------------------

function buildExtractionPrompt(jobText: string, sourceURL: string): string {
  const now = new Date().toISOString();

  return `Extract job posting information into structured JSON for analytics. Extract ONLY what is explicitly stated.

Job Posting:
${jobText}

Return this JSON structure:
{
  "metadata": {
    "job_title": "exact title from posting",
    "department": "Engineering, Product, Sales, etc.",
    "seniority_level": "Junior|Mid|Senior|Staff|Principal|Lead",
    "job_function": "Backend|Frontend|FullStack|DevOps|Data|Mobile|Security|Embedded"
  },
  "company_info": {
    "company_name": "exact company name",
    "industry": "single primary industry: SaaS, E-commerce, Finance, Healthcare, etc.",
    "company_size": "10-50, 50-200, 200-1000, 1000+, or empty",
    "location_full": "full location as stated",
    "location_city": "extract city name",
    "location_country": "extract country name or region (e.g., USA, UK, EMEA, Remote)"
  },
  "role_details": {
    "summary": "1-2 sentence role summary",
    "key_responsibilities": ["extract exact bullet points"],
    "team_structure": "team info if mentioned"
  },
  "requirements": {
    "years_experience_min": 0,
    "years_experience_max": 0,
    "education_level": "None|Bachelor's|Master's|PhD",
    "requires_specific_degree": false,
    "technical_skills": {
      "programming_languages": ["Go", "Python"],
      "frameworks": ["React", "Django"],
      "databases": ["PostgreSQL", "Redis"],
      "cloud_platforms": ["AWS", "GCP", "Azure"],
      "devops_tools": ["Docker", "Kubernetes", "Terraform"],
      "other": ["Git", "Linux"]
    },
    "soft_skills": ["Communication", "Problem-solving"],
    "nice_to_have": ["skill or experience that's nice to have"]
  },
  "compensation": {
    "salary_min": 0,
    "salary_max": 0,
    "salary_currency": "USD|EUR|GBP|empty",
    "has_equity": false,
    "has_remote_stipend": false,
    "benefits": ["401k", "health insurance"],
    "offers_visa_sponsorship": false,
    "offers_health_insurance": false,
    "offers_pto": false,
    "offers_professional_development": false,
    "offers_401k": false
  },
  "work_arrangement": {
    "workplace_type": "Remote|Hybrid|On-site",
    "job_type": "Full-time|Part-time|Contract|Internship",
    "is_remote_friendly": true,
    "timezone_requirements": "EMEA|US|APAC|Flexible|empty"
  },
  "market_signals": {
    "urgency_level": "Standard|Urgent|Immediate",
    "interview_rounds": 0,
    "has_take_home": false,
    "has_pair_programming": false
  },
  "extracted_at": "${now}",
  "source_url": "${sourceURL}"
}

CRITICAL EXTRACTION RULES:
1. years_experience_min/max: Extract numbers from "3-5 years" → min:3, max:5. If "5+ years" → min:5, max:0
2. seniority_level: Infer from title (Junior/Mid/Senior/Staff/Principal/Lead)
3. job_function: Categorize the role type (Backend/Frontend/etc)
4. salary_min/max: Extract numbers only. "€80k-100k" → min:80000, max:100000
5. technical_skills: Use simple names only ["Go", "Python"], not full sentences
6. Boolean fields: Set to true ONLY if explicitly mentioned
7. urgency_level: "Urgent" if mentions "immediate", "ASAP", "urgent". Otherwise "Standard"

Return ONLY valid JSON.`;
}

function buildCVPrompt(profileJSON: string, jobJSON: string): string {
  return `Generate a tailored CV/resume in Markdown format for a job application.

USER PROFILE:
${profileJSON}

JOB POSTING:
${jobJSON}

Generate a professional CV in Markdown that:
1. Highlights relevant skills and experience matching the job requirements
2. Emphasizes achievements and responsibilities aligned with the role
3. Uses clear, action-oriented language
4. Is concise but comprehensive (aim for 400-600 words)
5. Include sections: Summary, Skills, Experience, Education

IMPORTANT: Do NOT include any citation references, footnotes, or bracketed numbers like [1], [2], etc. Do NOT add any source references. Return clean Markdown only.

Return ONLY the Markdown CV content, no JSON wrapper or explanations.`;
}

// ---------------------------------------------------------------------------
// Ollama (port of Go ollama.go)
// ---------------------------------------------------------------------------

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
  format?: string;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

async function callOllama(
  prompt: string,
  model: string,
  format?: string,
  timeoutMs = 180_000,
): Promise<string> {
  const body: OllamaRequest = { model, prompt, stream: false };
  if (format) body.format = format;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Ollama returned status ${resp.status}: ${text}`);
    }

    const data: OllamaResponse = await resp.json();
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

interface OpenAIRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
  temperature?: number;
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
}

async function callOpenAI(
  prompt: string,
  apiKey: string,
  model: string,
  timeoutMs = 120_000,
): Promise<string> {
  const body: OpenAIRequest = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
    temperature: 0.1,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI returned status ${resp.status}: ${text}`);
    }

    const data: OpenAIResponse = await resp.json();
    if (!data.choices?.length) throw new Error('No response from OpenAI');
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: { role: string; content: string }[];
  temperature?: number;
}

interface AnthropicResponse {
  content: { text: string }[];
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
  timeoutMs = 120_000,
): Promise<string> {
  const body: AnthropicRequest = {
    model,
    max_tokens: 4000,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic returned status ${resp.status}: ${text}`);
    }

    const data: AnthropicResponse = await resp.json();
    if (!data.content?.length) throw new Error('No response from Anthropic');
    return data.content[0].text;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

interface GeminiRequest {
  contents: { parts: { text: string }[] }[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
}

interface GeminiResponse {
  candidates: { content: { parts: { text: string }[] } }[];
}

async function callGemini(
  prompt: string,
  apiKey: string,
  model: string,
  timeoutMs = 120_000,
): Promise<string> {
  const body: GeminiRequest = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4000,
      temperature: 0.1,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini returned status ${resp.status}: ${text}`);
    }

    const data: GeminiResponse = await resp.json();
    if (!data.candidates?.length || !data.candidates[0].content?.parts?.length) {
      throw new Error('No response from Gemini');
    }
    return data.candidates[0].content.parts[0].text;
  } finally {
    clearTimeout(timer);
  }
}

interface PerplexityRequest {
  model: string;
  messages: { role: string; content: string }[];
}

interface PerplexityResponse {
  choices: { message: { content: string } }[];
}

async function callPerplexity(
  prompt: string,
  apiKey: string,
  model: string,
  timeoutMs = 120_000,
): Promise<string> {
  const body: PerplexityRequest = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Perplexity returned status ${resp.status}: ${text}`);
    }

    const data: PerplexityResponse = await resp.json();
    if (!data.choices?.length) throw new Error('No response from Perplexity');
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Hosted API
// ---------------------------------------------------------------------------

async function callHostedExtract(jobText: string, licenseKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const resp = await fetch(`${HOSTED_API_URL}/v1/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${licenseKey}`,
      },
      body: JSON.stringify({ text: jobText }),
      signal: controller.signal,
    });
    if (resp.status === 401) throw new Error('Invalid or expired license key');
    if (resp.status === 429) throw new Error('Usage limit reached — please try again later');
    if (!resp.ok) throw new Error(`Hosted API returned ${resp.status}`);
    const data = await resp.json();
    return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  } finally {
    clearTimeout(timer);
  }
}

async function callHostedCv(prompt: string, licenseKey: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const resp = await fetch(`${HOSTED_API_URL}/v1/cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${licenseKey}`,
      },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    if (resp.status === 401) throw new Error('Invalid or expired license key');
    if (resp.status === 429) throw new Error('Usage limit reached — please try again later');
    if (!resp.ok) throw new Error(`Hosted API returned ${resp.status}`);
    const data = await resp.json();
    return data.markdown ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function extractJob(
  jobText: string,
  settings: AppSettings,
): Promise<JobExtracted> {
  const sourceURL = extractURL(jobText);
  const prompt = buildExtractionPrompt(jobText, sourceURL);

  let rawResponse: string;

  if (settings.provider === 'hosted' && settings.licenseKey) {
    rawResponse = await callHostedExtract(jobText, settings.licenseKey);
  } else if (settings.provider === 'openai' && settings.openaiApiKey) {
    const model = settings.openaiModel || 'gpt-4o-mini';
    rawResponse = await callOpenAI(prompt, settings.openaiApiKey, model, 60_000);
  } else if (settings.provider === 'anthropic' && settings.anthropicApiKey) {
    const model = settings.anthropicModel || 'claude-3-5-haiku-20241022';
    rawResponse = await callAnthropic(prompt, settings.anthropicApiKey, model, 60_000);
  } else if (settings.provider === 'gemini' && settings.geminiApiKey) {
    const model = settings.geminiModel || 'gemini-1.5-flash';
    rawResponse = await callGemini(prompt, settings.geminiApiKey, model, 60_000);
  } else if (settings.provider === 'perplexity' && (settings.perplexityKey || settings.perplexityApiKey)) {
    const key = settings.perplexityKey || settings.perplexityApiKey;
    const model = settings.perplexityModel || 'sonar-pro';
    rawResponse = await callPerplexity(prompt, key, model, 60_000);
  } else {
    const model = settings.ollamaModel || 'qwen2.5:7b';
    rawResponse = await callOllama(prompt, model, 'json');
  }

  const jsonStr = cleanJSONResponse(rawResponse);
  const job: JobExtracted = JSON.parse(jsonStr);

  // Ensure source_url is set
  if (sourceURL && !job.source_url) {
    job.source_url = sourceURL;
  }

  return job;
}

export async function generateCvText(
  profile: Profile,
  job: JobExtracted,
  settings: AppSettings,
): Promise<string> {
  const profileJSON = JSON.stringify(profile);
  const jobJSON = JSON.stringify(job);
  const prompt = buildCVPrompt(profileJSON, jobJSON);

  if (settings.provider === 'hosted' && settings.licenseKey) {
    return callHostedCv(prompt, settings.licenseKey);
  } else if (settings.provider === 'openai' && settings.openaiApiKey) {
    const model = settings.openaiModel || 'gpt-4o-mini';
    return callOpenAI(prompt, settings.openaiApiKey, model, 120_000);
  } else if (settings.provider === 'anthropic' && settings.anthropicApiKey) {
    const model = settings.anthropicModel || 'claude-3-5-haiku-20241022';
    return callAnthropic(prompt, settings.anthropicApiKey, model, 120_000);
  } else if (settings.provider === 'gemini' && settings.geminiApiKey) {
    const model = settings.geminiModel || 'gemini-1.5-flash';
    return callGemini(prompt, settings.geminiApiKey, model, 120_000);
  } else if (settings.provider === 'perplexity' && (settings.perplexityKey || settings.perplexityApiKey)) {
    const key = settings.perplexityKey || settings.perplexityApiKey;
    const model = settings.perplexityModel || 'sonar-pro';
    return callPerplexity(prompt, key, model, 120_000);
  }

  const model = settings.ollamaModel || 'qwen2.5:7b';
  return callOllama(prompt, model, undefined, 180_000);
}
