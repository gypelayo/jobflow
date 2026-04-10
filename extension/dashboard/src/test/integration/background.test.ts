import { describe, it, expect } from 'vitest';

function extractURL(text: string): string {
  const idx = text.indexOf('URL:');
  if (idx === -1) return '';
  let urlLine = text.slice(idx);
  const endIdx = urlLine.indexOf('\n');
  if (endIdx !== -1) urlLine = urlLine.slice(0, endIdx);
  return urlLine.replace('URL:', '').trim();
}

describe('Greenhouse URL Detection', () => {
  it('extracts direct greenhouse job URLs', () => {
    const testCases = [
      {
        url: 'https://boards.greenhouse.io/acme/jobs/123456',
        expected: { boardToken: 'acme', jobId: '123456', type: 'direct' },
      },
      {
        url: 'https://boards.greenhouse.io/example-company/jobs/789012',
        expected: { boardToken: 'example-company', jobId: '789012', type: 'direct' },
      },
      {
        url: 'https://greenhouse.io/some-company/jobs/456789',
        expected: { boardToken: 'some-company', jobId: '456789', type: 'direct' },
      },
    ];

    for (const { url, expected } of testCases) {
      const directMatch = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
      
      expect(directMatch).toBeTruthy();
      if (directMatch) {
        expect(directMatch[1]).toBe(expected.boardToken);
        expect(directMatch[2]).toBe(expected.jobId);
      }
    }
  });

  it('extracts embedded greenhouse job IDs', () => {
    const mockUrl = new URL('https://example.com/page?gh_jid=12345');
    const jobId = mockUrl.searchParams.get('gh_jid');
    expect(jobId).toBe('12345');
  });

  it('returns null for non-greenhouse URLs', () => {
    const nonGreenhouseUrls = [
      'https://linkedin.com/jobs/view/123',
      'https://wellfound.com/jobs/456',
      'https://example.com/jobs/789',
    ];

    for (const url of nonGreenhouseUrls) {
      const directMatch = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
      const mockUrl = new URL(url);
      const hasGhJid = mockUrl.searchParams.get('gh_jid');
      
      expect(directMatch).toBeFalsy();
      expect(hasGhJid).toBeNull();
    }
  });
});

describe('Wellfound URL Detection', () => {
  it('identifies wellfound.com job URLs', () => {
    const wellfoundUrls = [
      'https://wellfound.com/jobs/123456',
      'https://www.wellfound.com/jobs/789',
      'https://angel.co/jobs/def-456',
    ];

    const isWellfound = (url: string) => 
      url.includes('wellfound.com/jobs/') || url.includes('angel.co/jobs/');

    for (const url of wellfoundUrls) {
      expect(isWellfound(url)).toBe(true);
    }
  });

  it('rejects non-wellfound URLs', () => {
    const nonWellfoundUrls = [
      'https://linkedin.com/jobs/view/123',
      'https://greenhouse.io/company/jobs/456',
      'https://example.com/jobs',
    ];

    const isWellfound = (url: string) => 
      url.includes('wellfound.com/jobs/') || url.includes('angel.co/jobs/');

    for (const url of nonWellfoundUrls) {
      expect(isWellfound(url)).toBe(false);
    }
  });
});

describe('LinkedIn URL Detection', () => {
  it('identifies LinkedIn job URLs', () => {
    const linkedInUrls = [
      'https://www.linkedin.com/jobs/view/123456789',
      'https://linkedin.com/jobs/view/abc-123',
    ];

    const isLinkedIn = (url: string) => url.includes('linkedin.com/jobs/view/');

    for (const url of linkedInUrls) {
      expect(isLinkedIn(url)).toBe(true);
    }
  });

  it('rejects non-LinkedIn URLs', () => {
    const nonLinkedInUrls = [
      'https://wellfound.com/jobs/123',
      'https://greenhouse.io/company/jobs/456',
      'https://example.com/jobs/view/789',
    ];

    const isLinkedIn = (url: string) => url.includes('linkedin.com/jobs/view/');

    for (const url of nonLinkedInUrls) {
      expect(isLinkedIn(url)).toBe(false);
    }
  });
});

describe('HTML Stripping', () => {
  function stripHTMLTags(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  it('converts <br> tags to newlines', () => {
    const html = 'Line 1<br>Line 2<br/>Line 3';
    expect(stripHTMLTags(html)).toBe('Line 1\nLine 2\nLine 3');
  });

  it('converts </p> tags to double newlines', () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>';
    const result = stripHTMLTags(html);
    expect(result).toContain('First paragraph');
    expect(result).toContain('Second paragraph');
    expect(result).toContain('\n\n');
  });

  it('converts </li> tags to newlines', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(stripHTMLTags(html)).toContain('Item 1');
    expect(stripHTMLTags(html)).toContain('Item 2');
  });

  it('removes all HTML tags', () => {
    const html = '<div class="test"><strong>Bold</strong> and <em>italic</em></div>';
    expect(stripHTMLTags(html)).not.toContain('<');
    expect(stripHTMLTags(html)).not.toContain('>');
  });

  it('decodes HTML entities', () => {
    const html = '&amp; &lt;script&gt; &quot;test&quot; &#39;value&#39; &nbsp;';
    const result = stripHTMLTags(html);
    expect(result).toContain('& <script> "test" \'value\'');
  });

  it('handles empty input', () => {
    expect(stripHTMLTags('')).toBe('');
    expect(stripHTMLTags(null as unknown as string)).toBe('');
    expect(stripHTMLTags(undefined as unknown as string)).toBe('');
  });

  it('collapses multiple newlines', () => {
    const html = 'Line 1\n\n\n\n\nLine 2';
    expect(stripHTMLTags(html)).toBe('Line 1\n\nLine 2');
  });
});

describe('JSON Response Cleaning', () => {
  function cleanJSONResponse(response: string): string {
    let s = response.trim();
    if (s.startsWith('```json')) s = s.slice(7);
    else if (s.startsWith('```')) s = s.slice(3);
    if (s.endsWith('```')) s = s.slice(0, -3);
    return s.trim();
  }

  it('strips ```json fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(cleanJSONResponse(input)).toBe('{"key": "value"}');
  });

  it('strips ``` fences', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(cleanJSONResponse(input)).toBe('{"key": "value"}');
  });

  it('handles no fences', () => {
    const input = '{"key": "value"}';
    expect(cleanJSONResponse(input)).toBe('{"key": "value"}');
  });

  it('trims whitespace', () => {
    const input = '   \n  {"key": "value"}  \n  ';
    expect(cleanJSONResponse(input)).toBe('{"key": "value"}');
  });
});

describe('URL Extraction', () => {
  it('extracts URL from text', () => {
    const text = `Some content
URL: https://example.com/job/123
More content`;
    expect(extractURL(text)).toBe('https://example.com/job/123');
  });

  it('returns empty string when no URL found', () => {
    const text = 'Some content without URL';
    expect(extractURL(text)).toBe('');
  });

  it('handles URL at end of text', () => {
    const text = 'Some content\nURL: https://example.com/job';
    expect(extractURL(text)).toBe('https://example.com/job');
  });
});

describe('Extraction Prompt Building', () => {
  function buildExtractionPrompt(jobText: string): string {
    const now = new Date().toISOString();
    const sourceURL = extractURL(jobText);

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

  it('includes job text in prompt', () => {
    const jobText = 'JOB TITLE: Software Engineer\nDESCRIPTION: We are looking for...';
    const prompt = buildExtractionPrompt(jobText);
    
    expect(prompt).toContain(jobText);
  });

  it('includes JSON schema in prompt', () => {
    const prompt = buildExtractionPrompt('Some job text');
    
    expect(prompt).toContain('"metadata"');
    expect(prompt).toContain('"company_info"');
    expect(prompt).toContain('"requirements"');
    expect(prompt).toContain('"compensation"');
    expect(prompt).toContain('"work_arrangement"');
    expect(prompt).toContain('"market_signals"');
  });

  it('includes extraction rules', () => {
    const prompt = buildExtractionPrompt('Some job text');
    
    expect(prompt).toContain('CRITICAL EXTRACTION RULES');
    expect(prompt).toContain('years_experience_min/max');
    expect(prompt).toContain('seniority_level');
    expect(prompt).toContain('Return ONLY valid JSON');
  });
});
