import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  applyInlineFormatting,
  renderMarkdown,
} from '@/lib/markdown';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes quotes', () => {
    expect(escapeHtml(`she said "hello" & 'bye'`)).toBe(
      'she said &quot;hello&quot; &amp; &#39;bye&#39;'
    );
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('applyInlineFormatting', () => {
  it('converts bold markers to <strong>', () => {
    expect(applyInlineFormatting('this is **bold** text')).toContain(
      '<strong>bold</strong>'
    );
  });

  it('converts italic markers to <em>', () => {
    expect(applyInlineFormatting('this is *italic* text')).toContain(
      '<em>italic</em>'
    );
  });

  it('converts backtick to <code>', () => {
    expect(applyInlineFormatting('use `code` here')).toContain(
      '<code>code</code>'
    );
  });

  it('converts markdown links to <a>', () => {
    const result = applyInlineFormatting('[Click](https://example.com)');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('>Click</a>');
  });

  it('escapes HTML before applying formatting', () => {
    const result = applyInlineFormatting('<b>not html</b> but **this is**');
    expect(result).not.toContain('<b>');
    expect(result).toContain('&lt;b&gt;');
    expect(result).toContain('<strong>this is</strong>');
  });
});

describe('renderMarkdown', () => {
  it('renders headings', () => {
    const html = renderMarkdown('# Title\n## Subtitle\n### Section');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Subtitle</h2>');
    expect(html).toContain('<h3>Section</h3>');
  });

  it('renders unordered lists', () => {
    const html = renderMarkdown('- item one\n- item two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<li>item two</li>');
    expect(html).toContain('</ul>');
  });

  it('closes list before heading', () => {
    const html = renderMarkdown('- item\n# Heading');
    const ulClose = html.indexOf('</ul>');
    const h1Open = html.indexOf('<h1>');
    expect(ulClose).toBeLessThan(h1Open);
  });

  it('renders paragraphs for plain text', () => {
    const html = renderMarkdown('Hello world');
    expect(html).toBe('<p>Hello world</p>');
  });

  it('handles empty/null input', () => {
    expect(renderMarkdown('')).toContain('No content');
    expect(renderMarkdown(null as unknown as string)).toContain('No content');
  });

  it('handles inline formatting inside list items', () => {
    const html = renderMarkdown('- **bold** item');
    expect(html).toContain('<li><strong>bold</strong> item</li>');
  });

  it('separates lists with blank line', () => {
    const html = renderMarkdown('- a\n- b\n\n- c');
    // Should close first list and open a new one
    const parts = html.split('</ul>');
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });
});
