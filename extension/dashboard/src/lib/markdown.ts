/** Escape HTML entities to prevent XSS */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert inline markdown (bold, italic, code, links) to HTML */
export function applyInlineFormatting(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
    );
}

/** Convert a markdown string to HTML (headings, lists, paragraphs, inline) */
export function renderMarkdown(markdown: string): string {
  const trimmed = (markdown ?? '').trim();
  if (!trimmed) {
    return '<p><em>No content.</em></p>';
  }

  const lines = trimmed.split(/\r?\n/);
  const chunks: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      chunks.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const text = line.trim();

    if (!text) {
      closeList();
      continue;
    }

    const headingMatch = text.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = Math.min(3, headingMatch[1].length);
      chunks.push(
        `<h${level}>${applyInlineFormatting(headingMatch[2])}</h${level}>`
      );
      continue;
    }

    if (/^-\s+/.test(text)) {
      if (!inList) {
        inList = true;
        chunks.push('<ul>');
      }
      const itemText = text.replace(/^-+\s+/, '');
      chunks.push(`<li>${applyInlineFormatting(itemText)}</li>`);
      continue;
    }

    closeList();
    chunks.push(`<p>${applyInlineFormatting(text)}</p>`);
  }

  closeList();
  return chunks.join('');
}
