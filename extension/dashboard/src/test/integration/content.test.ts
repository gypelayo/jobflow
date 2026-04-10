import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

function createDOM(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

describe('Wellfound Extractor', () => {
  function extractWellfound(doc: Document): { title: string; salary: string; location: string; description: string } {
    let jobData = { title: '', salary: '', location: '', description: '' };
    
    const titleSelectors = ['h1', '[class*="JobTitle"]', '[class*="job-title"]'];
    for (const selector of titleSelectors) {
      const el = doc.querySelector(selector);
      if (el && el.textContent?.trim().length > 0 && el.textContent!.trim().length < 150) {
        jobData.title = el.textContent!.trim();
        break;
      }
    }
    
    const salarySelectors = ['[class*="salary"]', '[class*="compensation"]', '[class*="Salary"]'];
    for (const selector of salarySelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (text.includes('$') || text.includes('€') || text.includes('%')) {
          jobData.salary = text;
          break;
        }
      }
    }
    
    const locationSelectors = ['[class*="location"]', '[class*="Location"]'];
    for (const selector of locationSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && text.length < 200) {
          jobData.location = text;
          break;
        }
      }
    }
    
    const descriptionSelectors = ['[class*="JobDescription"]', '[class*="job-description"]', '[class*="description"]', 'main'];
    for (const selector of descriptionSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        const clone = el.cloneNode(true) as Element;
        const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', '[class*="similar"]', '[class*="cookie"]', '[class*="consent"]'];
        removeSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(elem => elem.remove()));
        const text = clone.textContent?.trim() || '';
        if (text.length > 500) {
          jobData.description = text;
          break;
        }
      }
    }
    
    if (!jobData.description || jobData.description.length < 500) {
      const main = doc.querySelector('main');
      if (main) {
        const clone = main.cloneNode(true) as Element;
        clone.querySelectorAll('script, style, nav, header, footer, [class*="similar"], [class*="cookie"], [class*="consent"], [id*="consent"]').forEach(el => el.remove());
        jobData.description = clone.textContent?.trim() || '';
      }
    }
    
    return jobData;
  }

  it('extracts job title from h1', () => {
    const html = '<html><body><h1>Senior Software Engineer</h1></body></html>';
    const doc = createDOM(html);
    const result = extractWellfound(doc);
    expect(result.title).toBe('Senior Software Engineer');
  });

  it('extracts salary information', () => {
    const html = '<html><body><div class="salary">$120k - $180k + equity</div></body></html>';
    const doc = createDOM(html);
    const result = extractWellfound(doc);
    expect(result.salary).toContain('$120k - $180k');
  });

  it('extracts location', () => {
    const html = '<html><body><span class="location">San Francisco, CA</span></body></html>';
    const doc = createDOM(html);
    const result = extractWellfound(doc);
    expect(result.location).toBe('San Francisco, CA');
  });

  it('extracts job description from main element', () => {
    const html = `<html><body>
      <main>
        <p>We are looking for a talented software engineer to join our team. We need someone with strong technical skills and excellent communication abilities. The ideal candidate will have experience with modern web technologies, cloud platforms, and agile methodologies.</p>
        <p>The ideal candidate will have experience with modern web technologies. We offer competitive salary, health benefits, and flexible work arrangements. Join our dynamic team and help build innovative products that make a difference.</p>
        <p>Requirements include 5+ years of experience in software development. We value clean code, testing, and continuous improvement. Previous experience with startups or fast-paced environments is a plus.</p>
        <p>Benefits include health insurance, 401k, and unlimited PTO. We provide ongoing training opportunities, conference attendance budget, and a collaborative work environment where your ideas matter.</p>
      </main>
    </body></html>`;
    const doc = createDOM(html);
    const result = extractWellfound(doc);
    expect(result.description.length).toBeGreaterThan(500);
  });

  it('removes script and style elements', () => {
    const html = `<html><body>
      <main>
        <p>Valid content here that should be extracted.</p>
        <script>console.log('this should not appear');</script>
        <style>.hidden { display: none; }</style>
        <p>More valid content after the scripts and styles.</p>
      </main>
    </body></html>`;
    const doc = createDOM(html);
    const result = extractWellfound(doc);
    expect(result.description).not.toContain('console.log');
    expect(result.description).not.toContain('.hidden { display: none; }');
  });
});

describe('LinkedIn Extractor', () => {
  function extractLinkedIn(doc: Document): { title: string; company: string; location: string; description: string } {
    let jobData = { title: '', company: '', location: '', description: '' };
    
    const titleSelectors = ['.top-card-layout__title', 'h1.topcard__title', 'h1'];
    for (const selector of titleSelectors) {
      const el = doc.querySelector(selector);
      if (el && el.textContent?.trim().length > 0 && el.textContent!.trim().length < 150) {
        jobData.title = el.textContent!.trim();
        break;
      }
    }
    
    const companySelectors = ['.topcard__org-name-link', '.topcard__flavor', 'a.topcard__org-name-link'];
    for (const selector of companySelectors) {
      const el = doc.querySelector(selector);
      if (el && el.textContent?.trim().length > 0) {
        jobData.company = el.textContent!.trim();
        break;
      }
    }
    
    const locationSelectors = ['.topcard__flavor--bullet', '.top-card-layout__second-subline'];
    for (const selector of locationSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (text.length > 0 && text.length < 200 && !text.includes('applicants')) {
          jobData.location = text;
          break;
        }
      }
    }
    
    const descriptionSelectors = ['.show-more-less-html__markup', '.jobs-description__content', '.description__text', '[class*="job-description"]'];
    for (const selector of descriptionSelectors) {
      const el = doc.querySelector(selector);
      if (el) {
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll('button, [class*="show-more"]').forEach(elem => elem.remove());
        const text = clone.textContent?.trim() || '';
        if (text.length > 200) {
          jobData.description = text;
          break;
        }
      }
    }
    
    if (!jobData.description || jobData.description.length < 200) {
      const mainContent = doc.querySelector('[class*="jobs-description"]') || doc.querySelector('article') || doc.querySelector('main');
      if (mainContent) {
        const clone = mainContent.cloneNode(true) as Element;
        const removeSelectors = ['nav', 'header', 'aside', '[class*="messaging"]', '[class*="global-nav"]', '[class*="artdeco-modal"]', 'button', 'form'];
        removeSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(elem => elem.remove()));
        jobData.description = clone.textContent?.trim() || '';
      }
    }
    
    return jobData;
  }

  it('extracts job title from LinkedIn selectors', () => {
    const html = '<html><body><h1 class="top-card-layout__title">Frontend Developer</h1></body></html>';
    const doc = createDOM(html);
    const result = extractLinkedIn(doc);
    expect(result.title).toBe('Frontend Developer');
  });

  it('extracts company name from topcard', () => {
    const html = '<html><body><a class="topcard__org-name-link">TechCorp Inc.</a></body></html>';
    const doc = createDOM(html);
    const result = extractLinkedIn(doc);
    expect(result.company).toBe('TechCorp Inc.');
  });

  it('extracts location from topcard flavor', () => {
    const html = '<html><body><span class="topcard__flavor--bullet">San Francisco, CA · 2 days ago</span></body></html>';
    const doc = createDOM(html);
    const result = extractLinkedIn(doc);
    expect(result.location).toBe('San Francisco, CA · 2 days ago');
  });

  it('extracts job description', () => {
    const html = `<html><body>
      <div class="show-more-less-html__markup">
        <p>We are seeking a talented developer with strong technical skills and excellent communication abilities to join our growing team.</p>
        <p>This is a great opportunity for growth in a fast-paced environment. We offer competitive salary and comprehensive benefits package.</p>
        <p>The role offers competitive compensation and the chance to work on cutting-edge projects that make a real difference in people's lives.</p>
      </div>
    </body></html>`;
    const doc = createDOM(html);
    const result = extractLinkedIn(doc);
    expect(result.description.length).toBeGreaterThan(200);
  });

  it('removes buttons from description', () => {
    const html = `<html><body>
      <div class="jobs-description">
        <p>Job description text here.</p>
        <button>Show more</button>
        <button>Other button</button>
      </div>
    </body></html>`;
    const doc = createDOM(html);
    const result = extractLinkedIn(doc);
    expect(result.description).not.toContain('Show more');
    expect(result.description).not.toContain('Other button');
  });
});

describe('Text Cleaning', () => {
  function cleanText(text: string): string {
    text = text.replace(/@font-face[\s\S]*?\}/g, '');
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');
    text = text.replace(/\{[\s\S]*?\}/g, '');
    text = text.replace(/https?:\/\/[^\s]+/g, '');
    text = text.replace(/[a-z-]+\.(woff2?|ttf|eot)/gi, '');
    text = text.replace(/\n{4,}/g, '\n\n');
    text = text.replace(/\s{3,}/g, ' ');
    text = text.replace(/DiscoverFind JobsFor Recruiters.*?Sign Up/gi, '');
    text = text.replace(/Copyright.*$/gi, '');
    text = text.replace(/©.*\d{4}.*$/gi, '');
    text = text.replace(/Cookie Preferences.*/gi, '');
    text = text.replace(/Browse by:.*/gi, '');
    text = text.replace(/Similar Jobs.*/gi, '');
    text = text.replace(/Find Your Dream Remote Job.*/gi, '');
    text = text.replace(/Loved by \d+.*remote workers/gi, '');
    text = text.replace(/Wall of Love.*/gi, '');
    text = text.replace(/Frequently asked questions.*/gi, '');
    return text.trim();
  }

  it('removes font-face declarations', () => {
    const text = '@font-face { font-family: test; src: url(test.woff2); } Some content';
    expect(cleanText(text)).not.toContain('@font-face');
  });

  it('removes CSS comments', () => {
    const text = '/* This is a comment */ Content here /* another comment */';
    expect(cleanText(text)).not.toContain('/*');
    expect(cleanText(text)).not.toContain('*/');
  });

  it('removes URLs', () => {
    const text = 'Check https://example.com/path for more info';
    expect(cleanText(text)).not.toContain('https://example.com/path');
  });

  it('removes font files', () => {
    const text = 'font-family: test; src: url(font.woff2) format(woff2);';
    expect(cleanText(text)).not.toContain('.woff2');
  });

  it('removes footer navigation text', () => {
    const text = 'Content DiscoverFind JobsFor Recruiters Sign Up More footer text';
    expect(cleanText(text)).not.toContain('DiscoverFind');
  });

  it('removes copyright text', () => {
    const text = 'Content Copyright 2024 Company Name Rights Reserved';
    expect(cleanText(text)).not.toContain('Copyright');
  });

  it('collapses excessive whitespace', () => {
    const text = 'Line 1\n\n\n\n\nLine 2';
    expect(cleanText(text)).toBe('Line 1\n\nLine 2');
  });
});

describe('Job Data Formatting', () => {
  function formatJobData(title: string, salary: string, location: string, description: string, source: string, url: string): string {
    let formatted = '';
    if (title) formatted += `JOB TITLE: ${title}\n\n`;
    if (salary) formatted += `COMPENSATION: ${salary}\n\n`;
    if (location) formatted += `LOCATION: ${location}\n\n`;
    formatted += `DESCRIPTION:\n${description}`;
    return `\nURL: ${url}\nSOURCE: ${source} (Scraped)\n\n${formatted}`;
  }

  it('formats job title', () => {
    const result = formatJobData('Software Engineer', '', '', 'Job description', 'Test', 'https://example.com');
    expect(result).toContain('JOB TITLE: Software Engineer');
  });

  it('formats compensation', () => {
    const result = formatJobData('', '$100k-$150k', '', 'Job description', 'Test', 'https://example.com');
    expect(result).toContain('COMPENSATION: $100k-$150k');
  });

  it('formats location', () => {
    const result = formatJobData('', '', 'Remote', 'Job description', 'Test', 'https://example.com');
    expect(result).toContain('LOCATION: Remote');
  });

  it('includes source and URL', () => {
    const result = formatJobData('Test', '', '', 'Description', 'LinkedIn', 'https://linkedin.com/jobs/123');
    expect(result).toContain('SOURCE: LinkedIn (Scraped)');
    expect(result).toContain('URL: https://linkedin.com/jobs/123');
  });
});
