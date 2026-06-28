import { jsPDF } from 'jspdf';
import type { ReviewOutput, ConflictReport } from '../types';

// ── Palette ───────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  primary:     [58,  125, 92]  as RGB,
  primaryDark: [45,  99,  73]  as RGB,
  primaryBg:   [236, 245, 240] as RGB,
  primaryMid:  [180, 218, 196] as RGB,

  text:        [24,  38,  28]  as RGB,
  textSec:     [55,  72,  57]  as RGB,
  textMuted:   [98,  112, 100] as RGB,
  textDim:     [147, 168, 148] as RGB,

  surface:     [255, 255, 255] as RGB,
  bg:          [245, 248, 245] as RGB,
  bgWarm:      [238, 244, 238] as RGB,
  border:      [207, 222, 207] as RGB,
  borderLight: [220, 232, 220] as RGB,

  critical:    [212, 67,  50]  as RGB,
  criticalBg:  [251, 241, 240] as RGB,
  high:        [224, 122, 58]  as RGB,
  highBg:      [252, 245, 239] as RGB,
  medium:      [196, 154, 42]  as RGB,
  mediumBg:    [253, 249, 238] as RGB,
  low:         [74,  144, 217] as RGB,
  lowBg:       [239, 246, 253] as RGB,

  white:       [255, 255, 255] as RGB,
};

function sevFg(s: string): RGB {
  return ({ critical: C.critical, high: C.high, medium: C.medium, low: C.low } as Record<string, RGB>)[s] ?? C.textMuted;
}
function sevBg(s: string): RGB {
  return ({ critical: C.criticalBg, high: C.highBg, medium: C.mediumBg, low: C.lowBg } as Record<string, RGB>)[s] ?? C.bg;
}

// ── Page geometry — generous margins to prevent any overflow ─────────────────
const PW   = 210;
const PH   = 297;
const ML   = 22;           // left margin
const MR   = 22;           // right margin
const CW   = PW - ML - MR; // 166 mm — content band
// Text inside a card: card spans CW, left-bar=4mm, inner-pad=8mm, right-pad=10mm
// → TEXT_W = CW - 4 - 8 - 10 = 144mm  (very conservative to prevent overflow)
const TEXT_W = 144;
const FOOT   = 12;

// ── Strip ALL markdown / special chars that could confuse rendering ───────────
function plain(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/gs, '$1')   // **bold**
    .replace(/\*(.*?)\*/gs,     '$1')   // *italic*
    .replace(/`([^`]*)`/g,      '$1')   // `code`  ← inline code (no font switch)
    .replace(/#{1,6}\s/g,       '')     // # headings
    .replace(/\r\n/g,           '\n')
    .replace(/\r/g,             '\n');
}

export function exportReviewPdf(
  review:       ReviewOutput,
  conflicts?:   ConflictReport,
  agentPrompt?: string,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

  // ── Base helpers ──────────────────────────────────────────────────────────

  const sf = (r: RGB) => doc.setFillColor(...r);
  const sd = (r: RGB) => doc.setDrawColor(...r);
  const sc = (r: RGB) => doc.setTextColor(...r);

  // ALWAYS set font + size before splitting — prevents mid-line font switches
  function splitH(text: string, maxW: number, bold: boolean, size: number): string[] {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.splitTextToSize(plain(text), maxW);
  }

  function pageBreak(needed: number) {
    if (y + needed > PH - FOOT - 4) {
      doc.addPage();
      y = 20;
    }
  }

  // ── Cover ─────────────────────────────────────────────────────────────────
  sf(C.primary); doc.rect(0, 0, PW, 62, 'F');
  sf(C.primaryDark); doc.triangle(PW - 55, 0, PW, 0, PW, 62, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(40); sc(C.white);
  doc.text('PR Review', ML, 30);
  doc.text('Report',    ML, 52);

  y = 70;

  // ── Stat cards ────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Bugs',        count: review.bugs.length,                col: C.critical },
    { label: 'Security',    count: review.security_issues.length,     col: C.high     },
    { label: 'Suggestions', count: review.suggestions.length,         col: C.primary  },
    { label: 'Conflicts',   count: conflicts?.conflicts?.length ?? 0, col: C.medium   },
  ];
  const cw4 = (CW - 9) / 4;
  stats.forEach((s, i) => {
    const sx = ML + i * (cw4 + 3);
    sf(C.surface); sd(C.border); doc.setLineWidth(0.3);
    doc.roundedRect(sx, y, cw4, 30, 3, 3, 'FD');
    sf(s.col); doc.roundedRect(sx, y, cw4, 3.5, 1.5, 1.5, 'F');
    doc.rect(sx, y + 2, cw4, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); sc(s.col);
    doc.text(String(s.count), sx + cw4 / 2, y + 20, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); sc(C.textMuted);
    doc.text(s.label.toUpperCase(), sx + cw4 / 2, y + 27, { align: 'center' });
  });
  y += 38;

  // ── Section heading ───────────────────────────────────────────────────────
  function sectionHeading(title: string, count?: number) {
    pageBreak(22);
    y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); sc(C.primary);
    doc.text(title, ML, y);
    if (count !== undefined) {
      const tw = doc.getTextWidth(title);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      const pillW = doc.getTextWidth(String(count)) + 10;
      sf(C.primaryBg); sd(C.primaryMid); doc.setLineWidth(0.3);
      doc.roundedRect(ML + tw + 5, y - 6, pillW, 8, 3, 3, 'FD');
      sc(C.primary);
      doc.text(String(count), ML + tw + 5 + pillW / 2, y - 0.5, { align: 'center' });
    }
    y += 4;
    sf(C.primary); doc.setGState(doc.GState({ opacity: 0.15 }));
    doc.rect(ML, y, CW, 0.8, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    y += 8;
  }

  // ── Card wrapper ──────────────────────────────────────────────────────────
  function cardBox(height: number, bg: RGB, borderCol: RGB, accentCol: RGB) {
    sf(bg); sd(borderCol); doc.setLineWidth(0.35);
    doc.roundedRect(ML, y, CW, height, 3, 3, 'FD');
    // left accent bar: 4mm wide
    sf(accentCol);
    doc.roundedRect(ML, y, 4, height, 1.5, 1.5, 'F');
    doc.rect(ML + 2.5, y, 1.5, height, 'F');
  }

  // Text x-start inside a card (past the left bar + padding)
  const TX = ML + 12;   // text x inside cards (past left bar + padding)

  // ── Summary ───────────────────────────────────────────────────────────────
  sectionHeading('Summary');
  {
    const ls = splitH(review.summary, TEXT_W, false, 10);
    const bH = ls.length * 5.8 + 14;
    pageBreak(bH + 6);
    cardBox(bH, C.bgWarm, C.border, C.primary);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); sc(C.text);
    doc.text(ls, TX, y + 10);
    y += bH + 10;
  }

  // ── Issue card ────────────────────────────────────────────────────────────
  function issueCard(title: string, description: string, severity: string, file?: string, line?: string) {
    const fg = sevFg(severity);
    const bg = sevBg(severity);

    // pill
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    const pillLabel = severity.toUpperCase();
    const pillW = doc.getTextWidth(pillLabel) + 8;
    const pillX = PW - MR - pillW - 2;

    // lines — title avoids pill area
    const titleW = pillX - TX - 4;
    const tls = splitH(title,       Math.min(titleW, TEXT_W), true,  10);
    const dls = splitH(description, TEXT_W,                   false, 9);

    const fileH = file ? 7 : 0;
    const bH = 8 + tls.length * 5.5 + 4 + dls.length * 5.2 + fileH + 8;
    pageBreak(bH + 6);

    cardBox(bH, bg, fg, fg);

    // severity pill — top right, inside card
    sf(fg);
    doc.roundedRect(pillX, y + 4, pillW, 6, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); sc(C.white);
    doc.text(pillLabel, pillX + pillW / 2, y + 8.5, { align: 'center' });

    // title
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); sc(C.text);
    doc.text(tls, TX, y + 10);
    const afterTitle = y + 8 + tls.length * 5.5;

    // description
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); sc(C.textSec);
    doc.text(dls, TX, afterTitle + 4);
    let afterDesc = afterTitle + 4 + dls.length * 5.2;

    // file reference — plain helvetica, no courier
    if (file) {
      const loc = line ? `${file}  ·  line ${line}` : file;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); sc(fg);
      doc.text(loc, TX, afterDesc + 5);
    }

    y += bH + 6;
  }

  // ── Bugs ─────────────────────────────────────────────────────────────────
  if (review.bugs.length > 0) {
    sectionHeading('Bugs', review.bugs.length);
    review.bugs.forEach(b => issueCard(b.title, b.description, b.severity, b.file, b.line));
  }

  // ── Security ─────────────────────────────────────────────────────────────
  if (review.security_issues.length > 0) {
    sectionHeading('Security Issues', review.security_issues.length);
    review.security_issues.forEach(s => issueCard(s.title, s.description, s.severity, s.file, s.line));
  }

  // ── Suggestions ───────────────────────────────────────────────────────────
  if (review.suggestions.length > 0) {
    sectionHeading('Suggestions', review.suggestions.length);
    review.suggestions.forEach((s, idx) => {
      const tls = splitH(s.title,       TEXT_W - 14, true,  10);
      const dls = splitH(s.description, TEXT_W - 14, false, 9);
      const fileH = s.file ? 7 : 0;
      const bH = Math.max(tls.length * 5.5 + 4 + dls.length * 5.2 + fileH + 16, 30);
      pageBreak(bH + 6);

      sf(C.surface); sd(C.border); doc.setLineWidth(0.3);
      doc.roundedRect(ML, y, CW, bH, 3, 3, 'FD');

      // number badge — left gutter
      const badgeY = y + 6;
      sf(C.primaryBg); sd(C.primaryMid); doc.setLineWidth(0.3);
      doc.roundedRect(ML + 5, badgeY, 10, 10, 2.5, 2.5, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); sc(C.primary);
      doc.text(String(idx + 1), ML + 10, badgeY + 7.2, { align: 'center' });

      const TXS = ML + 20;  // text x for suggestions (past number badge)
      const TW_S = CW - 20 - 10;  // text width for suggestions

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); sc(C.text);
      const tls2 = splitH(s.title, TW_S, true, 10);
      doc.text(tls2, TXS, y + 10);
      const afterT = y + 10 + tls2.length * 5.5;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); sc(C.textSec);
      const dls2 = splitH(s.description, TW_S, false, 9);
      doc.text(dls2, TXS, afterT + 3);
      const afterD = afterT + 3 + dls2.length * 5.2;

      if (s.file) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); sc(C.primary);
        doc.text(s.file, TXS, afterD + 4);
      }

      y += bH + 6;
    });
  }

  // ── Conflicts ─────────────────────────────────────────────────────────────
  if (conflicts && conflicts.conflicts.length > 0) {
    sectionHeading('Merge Conflicts', conflicts.conflicts.length);

    // strategy block
    {
      const ls = splitH(conflicts.overall_strategy, TEXT_W, false, 9);
      const bH = ls.length * 5.2 + 16;
      pageBreak(bH + 4);
      cardBox(bH, C.bgWarm, C.border, C.primary);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); sc(C.textMuted);
      doc.text('OVERALL STRATEGY', TX, y + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); sc(C.text);
      doc.text(ls, TX, y + 13);
      y += bH + 8;
    }

    conflicts.conflicts.forEach(c => {
      pageBreak(20);

      // file header bar
      sf(C.primaryBg); sd(C.primaryMid); doc.setLineWidth(0.3);
      doc.roundedRect(ML, y, CW, 10, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); sc(C.primary);
      // strip any path weirdness, keep it plain helvetica
      doc.text(plain(c.file), ML + 6, y + 7);
      y += 14;

      const fields: { label: string; value: string; accentCol: RGB }[] = [
        { label: 'SUMMARY',        value: c.conflict_summary, accentCol: C.textMuted },
        { label: 'OUR SIDE',       value: c.our_side,         accentCol: C.primary   },
        { label: 'THEIR SIDE',     value: c.their_side,       accentCol: C.medium    },
        { label: 'RECOMMENDATION', value: c.recommendation,   accentCol: C.critical  },
      ];

      fields.forEach(f => {
        const ls = splitH(f.value, TEXT_W, false, 9);
        const bH = ls.length * 5.2 + 18;
        pageBreak(bH + 4);

        sf(C.bg); sd(C.borderLight); doc.setLineWidth(0.25);
        doc.roundedRect(ML, y, CW, bH, 2, 2, 'FD');
        sf(f.accentCol);
        doc.roundedRect(ML, y, 4, bH, 1.5, 1.5, 'F');
        doc.rect(ML + 2.5, y, 1.5, bH, 'F');

        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); sc(C.textDim);
        doc.text(f.label, TX, y + 7);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); sc(C.text);
        doc.text(ls, TX, y + 13);
        y += bH + 4;
      });

      y += 6;
    });
  }

  // ── AI Agent Prompt ───────────────────────────────────────────────────────
  if (agentPrompt) {
    sectionHeading('AI Agent Prompt');
    const truncated = agentPrompt.length > 1200;
    const src       = truncated ? agentPrompt.slice(0, 1200) : agentPrompt;
    // Use helvetica (not courier) to prevent width mismatches
    const ls = splitH(src, TEXT_W, false, 8.5);
    const bH = ls.length * 5 + 14;
    pageBreak(bH + 4);

    sf(C.bg); sd(C.border); doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, bH, 3, 3, 'FD');
    sf(C.primaryBg);
    doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F');
    doc.rect(ML, y + 6, CW, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); sc(C.primary);
    doc.text('PROMPT', TX, y + 5.5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); sc(C.textSec);
    doc.text(ls, TX, y + 13);
    y += bH + 4;

    if (truncated) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); sc(C.textDim);
      doc.text('Prompt truncated for brevity.', ML, y + 4);
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    sd(C.border); doc.setLineWidth(0.25);
    doc.line(ML, PH - FOOT, PW - MR, PH - FOOT);
    sf(C.primaryBg); doc.rect(0, PH - FOOT + 0.3, PW, FOOT, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); sc(C.textMuted);
    doc.text('PR Review Report', ML, PH - 4.5);
    doc.text(`Page ${p} of ${total}`, PW - MR, PH - 4.5, { align: 'right' });
  }

  doc.save(`pr-review-${Date.now()}.pdf`);
}
