import type { jsPDF as JsPDFType } from 'jspdf';

interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Parse inline **bold** and *italic* markers into segments */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ text: text.slice(last, m.index), bold: false, italic: false });
    }
    if (m[2]) {
      segments.push({ text: m[2], bold: true, italic: false });
    } else if (m[3]) {
      segments.push({ text: m[3], bold: false, italic: true });
    }
    last = re.lastIndex;
  }

  if (last < text.length) {
    segments.push({ text: text.slice(last), bold: false, italic: false });
  }

  return segments.length ? segments : [{ text, bold: false, italic: false }];
}

/** Generate and download a PDF from a markdown string */
export async function downloadCvAsPdf(markdown: string): Promise<void> {
  if (!markdown) {
    alert('Generate a CV first before downloading.');
    return;
  }

  const { jsPDF } = await import('jspdf');
  const doc: JsPDFType = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;
  const marginTop = 18;
  const marginBot = 18;
  const usableW = pageW - marginL - marginR;
  let y = marginTop;

  function checkPage(needed: number) {
    if (y + needed > pageH - marginBot) {
      doc.addPage();
      y = marginTop;
    }
  }

  function writeLine(
    text: string,
    fontSize: number,
    _bold: boolean,
    _italic: boolean,
    indent = 0
  ) {
    doc.setFontSize(fontSize);
    const lineH = fontSize * 0.45;

    if (
      !_bold &&
      !_italic &&
      !text.includes('**') &&
      !text.includes('*')
    ) {
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(text, usableW - indent);
      checkPage(lineH * wrapped.length);
      doc.text(wrapped, marginL + indent, y);
      y += lineH * wrapped.length;
      return;
    }

    const segments = parseInline(text);
    const plain = segments.map((s) => s.text).join('');
    doc.setFont('helvetica', 'normal');
    const wrappedPlain = doc.splitTextToSize(plain, usableW - indent);
    checkPage(lineH * wrappedPlain.length);

    let charIdx = 0;
    for (const wLine of wrappedPlain) {
      let x = marginL + indent;
      const remaining = wLine.length;

      let segI = 0;
      let segOff = 0;
      let acc = 0;
      for (segI = 0; segI < segments.length; segI++) {
        if (acc + segments[segI].text.length > charIdx) {
          segOff = charIdx - acc;
          break;
        }
        acc += segments[segI].text.length;
      }

      let drawn = 0;
      while (drawn < remaining && segI < segments.length) {
        const seg = segments[segI];
        const avail = seg.text.length - segOff;
        const take = Math.min(avail, remaining - drawn);
        const chunk = seg.text.substr(segOff, take);
        const style = seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
        doc.setFont('helvetica', style);
        doc.text(chunk, x, y);
        x += doc.getTextWidth(chunk);
        drawn += take;
        charIdx += take;
        segOff = 0;
        segI++;
      }
      y += lineH;
    }
  }

  const lines = markdown.trim().split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      y += 2;
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const txt = hMatch[2].replace(/\*\*/g, '').replace(/\*/g, '');
      const sizes: Record<number, number> = { 1: 16, 2: 13, 3: 11 };
      const fontSize = sizes[level] ?? 11;
      y += level === 1 ? 4 : 3;
      checkPage(fontSize * 0.5 + 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.text(txt, marginL, y);
      y += fontSize * 0.45;
      if (level === 2) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(marginL, y, pageW - marginR, y);
        y += 2;
      }
      y += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const itemText = line.replace(/^[-*]+\s+/, '');
      checkPage(5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('\u2022', marginL + 2, y);
      writeLine(itemText, 10, false, false, 7);
      y += 0.5;
      continue;
    }

    writeLine(line, 10, false, false, 0);
    y += 1;
  }

  doc.save('cv.pdf');
}
