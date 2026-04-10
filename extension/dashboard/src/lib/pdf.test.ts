import { describe, it, expect } from 'vitest';
import { parseInline } from '@/lib/pdf';

describe('parseInline', () => {
  it('returns single plain segment for no markers', () => {
    const result = parseInline('hello world');
    expect(result).toEqual([
      { text: 'hello world', bold: false, italic: false },
    ]);
  });

  it('parses bold markers', () => {
    const result = parseInline('before **bold** after');
    expect(result).toEqual([
      { text: 'before ', bold: false, italic: false },
      { text: 'bold', bold: true, italic: false },
      { text: ' after', bold: false, italic: false },
    ]);
  });

  it('parses italic markers', () => {
    const result = parseInline('before *italic* after');
    expect(result).toEqual([
      { text: 'before ', bold: false, italic: false },
      { text: 'italic', bold: false, italic: true },
      { text: ' after', bold: false, italic: false },
    ]);
  });

  it('parses mixed bold and italic', () => {
    const result = parseInline('**bold** and *italic*');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ text: 'bold', bold: true, italic: false });
    expect(result[1]).toEqual({ text: ' and ', bold: false, italic: false });
    expect(result[2]).toEqual({ text: 'italic', bold: false, italic: true });
  });

  it('handles empty string', () => {
    const result = parseInline('');
    expect(result).toEqual([{ text: '', bold: false, italic: false }]);
  });

  it('handles multiple bold segments', () => {
    const result = parseInline('**a** text **b**');
    const boldSegments = result.filter((s) => s.bold);
    expect(boldSegments).toHaveLength(2);
    expect(boldSegments[0].text).toBe('a');
    expect(boldSegments[1].text).toBe('b');
  });
});
