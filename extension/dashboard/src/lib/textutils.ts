/**
 * Text utility functions — port of Go extractor/utils.go + pkg/utils/text.go.
 */

/** Remove markdown code fences from LLM JSON responses */
export function cleanJSONResponse(response: string): string {
  let s = response.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

/** Extract a URL from text that contains "URL: <url>" */
export function extractURL(text: string): string {
  const idx = text.indexOf('URL:');
  if (idx === -1) return '';
  let urlLine = text.slice(idx);
  const endIdx = urlLine.indexOf('\n');
  if (endIdx !== -1) urlLine = urlLine.slice(0, endIdx);
  return urlLine.replace('URL:', '').trim();
}

/**
 * Sanitize generated markdown — port of Go SanitizeMarkdown.
 * Removes citation references, superscript digits, orphaned pipes, etc.
 */
export function sanitizeMarkdown(md: string): string {
  if (!md) return md;

  // Protect markdown links with placeholders
  const linkRe = /\[[^\]]+\]\([^)]*\)/gs;
  const links = md.match(linkRe) ?? [];
  let tmp = md;
  for (let i = 0; i < links.length; i++) {
    tmp = tmp.replace(links[i], `<<LINKPLACEHOLDER${String(i).padStart(3, '0')}>>`);
  }

  // Remove bracketed citation tokens like [1], [2], [1][2]
  tmp = tmp.replace(/\s*\[[\d,;\s-]+\](?:\s*\[[\d,;\s-]+\])*/g, '');

  // Clean space before punctuation
  tmp = tmp.replace(/ +([,.:;!?])/g, '$1');

  // Remove orphaned trailing pipes
  tmp = tmp.replace(/(\S)\s*(?:\|\s*)+$/gm, '$1');
  // Remove lines that are only pipes and whitespace
  tmp = tmp.replace(/^\s*(?:\|\s*)+\s*$/gm, '');

  // Remove full-width brackets
  tmp = tmp.replace(/\uff3b/g, ' ').replace(/\uff3d/g, ' ');

  // Remove superscript digits
  tmp = tmp.replace(/[\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\u207a\u207b]+/g, '');

  // Collapse multiple spaces per line
  const lines = tmp.split('\n').map((line) => {
    const trimmed = line.trim();
    return trimmed === '' ? '' : trimmed.replace(/ {2,}/g, ' ');
  });
  tmp = lines.join('\n');

  // Restore links
  for (let i = 0; i < links.length; i++) {
    tmp = tmp.replace(`<<LINKPLACEHOLDER${String(i).padStart(3, '0')}>>`, links[i]);
  }

  // Trim trailing spaces/newlines
  tmp = tmp.replace(/ \n/g, '\n').replace(/[ \n]+$/, '');

  // Ensure headings start on their own line
  tmp = tmp.replace(/([^ \t\n])[ \t]+(#{1,6}\s+)/gm, '$1\n\n$2');

  // Ensure list markers start on their own line
  tmp = tmp.replace(/([^ \t\n*])[ \t]+([-*]\s+)/gm, '$1\n\n$2');

  return tmp;
}

/**
 * Truncate markdown to at most maxWords words, cutting at line boundaries.
 * Port of Go TruncateMarkdownToWords.
 */
export function truncateMarkdownToWords(md: string, maxWords: number): string {
  if (!md || maxWords <= 0) return '';

  const allWords = md.split(/\s+/).filter(Boolean);
  if (allWords.length <= maxWords) return md;

  const outLines: string[] = [];
  let count = 0;

  for (const line of md.split('\n')) {
    const lineWords = line.split(/\s+/).filter(Boolean);
    if (count + lineWords.length <= maxWords) {
      outLines.push(line);
      count += lineWords.length;
      continue;
    }
    const remaining = maxWords - count;
    if (remaining > 0) {
      const parts = line.split(/\s+/).filter(Boolean);
      outLines.push(parts.slice(0, remaining).join(' ') + ' ...');
    }
    break;
  }

  return outLines.join('\n');
}
