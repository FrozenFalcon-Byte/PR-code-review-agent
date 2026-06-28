import type { ReviewOutput, ConflictReport } from '../types';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sevColor(s: string) {
  return ({ critical: '#D44332', high: '#E07A3A', medium: '#C49A2A', low: '#4A90D9' } as Record<string,string>)[s] ?? '#627064';
}
function sevBg(s: string) {
  return ({ critical: '#fdf2f1', high: '#fdf5f0', medium: '#fdf9ee', low: '#eff6fd' } as Record<string,string>)[s] ?? '#f5f8f5';
}

interface PrMeta { title: string; repo: string; prNumber: string; author: string; baseBranch: string; }

function parsePrUrl(url?: string): PrMeta | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!m) return null;
  return { title: '', repo: m[1], prNumber: m[2], author: '', baseBranch: '' };
}

function issueCard(item: { title: string; description: string; severity: string; file?: string; line?: string }) {
  const col = sevColor(item.severity);
  const bg  = sevBg(item.severity);
  const loc = item.file ? `${esc(item.file)}${item.line ? ` · line ${item.line}` : ''}` : '';
  return `
  <div class="card" style="border-color:${col};background:${bg}">
    <div class="card-bar" style="background:${col}"></div>
    <div class="card-inner">
      <div class="card-top">
        <span class="card-title">${esc(item.title)}</span>
        <span class="pill" style="background:${col}">${item.severity.toUpperCase()}</span>
      </div>
      <p class="card-desc">${esc(item.description)}</p>
      ${loc ? `<span class="file-ref">${loc}</span>` : ''}
    </div>
  </div>`;
}

function suggestionCard(item: { title: string; description: string; file?: string }, idx: number) {
  return `
  <div class="card s-card">
    <div class="s-num">${idx + 1}</div>
    <div class="card-inner">
      <p class="card-title" style="margin-bottom:6px">${esc(item.title)}</p>
      <p class="card-desc">${esc(item.description)}</p>
      ${item.file ? `<span class="file-ref">${esc(item.file)}</span>` : ''}
    </div>
  </div>`;
}

function conflictBlock(c: { file: string; conflict_summary: string; our_side: string; their_side: string; recommendation: string }) {
  const fields = [
    { label: 'Summary',        value: c.conflict_summary, col: '#627064' },
    { label: 'Our Side',       value: c.our_side,         col: '#3A7D5C' },
    { label: 'Their Side',     value: c.their_side,       col: '#C49A2A' },
    { label: 'Recommendation', value: c.recommendation,   col: '#D44332' },
  ];
  return `
  <div class="conflict">
    <div class="conflict-file">${esc(c.file)}</div>
    ${fields.map(f => `
    <div class="field" style="border-left-color:${f.col}">
      <div class="field-label" style="color:${f.col}">${f.label}</div>
      <div class="field-val">${esc(f.value)}</div>
    </div>`).join('')}
  </div>`;
}

function section(title: string, count: number | null, body: string) {
  const badge = count !== null ? `<span class="badge">${count}</span>` : '';
  return `
  <div class="section">
    <div class="sec-head">
      <h2>${title}</h2>${badge}
    </div>
    <div class="sec-rule"></div>
    ${body}
  </div>`;
}

function buildHtml(review: ReviewOutput, conflicts?: ConflictReport, agentPrompt?: string, prUrl?: string) {
  const date = new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const pr = parsePrUrl(prUrl);

  const stats = [
    { label: 'Bugs',        count: review.bugs.length,                col: '#D44332' },
    { label: 'Security',    count: review.security_issues.length,     col: '#E07A3A' },
    { label: 'Suggestions', count: review.suggestions.length,         col: '#3A7D5C' },
    { label: 'Conflicts',   count: conflicts?.conflicts?.length ?? 0, col: '#C49A2A' },
  ];

  const promptHtml = agentPrompt
    ? agentPrompt
        .split('\n')
        .map(l => `<div class="prompt-line">${esc(l) || '&nbsp;'}</div>`)
        .join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PR Review Report</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  font-size: 13.5px;
  line-height: 1.65;
  color: #18261C;
  background: #fff;
}

/* ── Print bar (screen only) ─────────────────────────── */
.print-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 999;
  background: #2D6349;
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 28px;
  box-shadow: 0 2px 10px rgba(0,0,0,.18);
}
.print-bar-title { font-size: 13px; font-weight: 600; color: #fff; }
.print-btn {
  background: #fff; color: #2D6349; border: none;
  padding: 7px 22px; border-radius: 7px;
  font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: .01em;
}
.print-btn:hover { background: #ECF5F0; }
@media screen { body { padding-top: 48px; } }

/* ── Cover ───────────────────────────────────────────── */
.cover {
  background: #3A7D5C;
  color: #fff;
  padding: 56px 52px 50px;
  position: relative; overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.cover::after {
  content: '';
  position: absolute; top: 0; right: 0;
  border-style: solid;
  border-width: 0 140px 210px 0;
  border-color: transparent #2D6349 transparent transparent;
}
.cover-eyebrow {
  font-size: 11px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; opacity: .65; margin-bottom: 14px;
}
.cover-title {
  font-size: 68px;
  font-weight: 900;
  line-height: .97;
  letter-spacing: -2.5px;
  margin-bottom: 24px;
  position: relative; z-index: 1;
}
.cover-meta {
  display: flex; flex-direction: column; gap: 6px;
  position: relative; z-index: 1; margin-bottom: 20px;
}
.cover-meta-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; opacity: .9;
}
.cover-meta-label {
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; opacity: .6; width: 72px; flex-shrink: 0;
}
.cover-meta-val { font-weight: 500; }
.cover-meta-val a { color: #fff; text-decoration: underline; text-underline-offset: 2px; }
.cover-date {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; opacity: .65;
  background: rgba(0,0,0,.18);
  padding: 5px 14px; border-radius: 999px;
  position: relative; z-index: 1;
}

/* ── Content ─────────────────────────────────────────── */
.content { padding: 40px 52px; }

/* ── Stat grid ───────────────────────────────────────── */
.stats {
  display: grid; grid-template-columns: repeat(4,1fr); gap: 14px;
  margin-bottom: 44px;
}
.stat {
  border: 1px solid #CFDECF; border-radius: 12px;
  padding: 22px 16px 18px; text-align: center;
  border-top: 5px solid var(--c);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.stat-n { font-size: 40px; font-weight: 900; color: var(--c); line-height: 1; margin-bottom: 7px; }
.stat-l { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #627064; }

/* ── Section ─────────────────────────────────────────── */
.section { margin-bottom: 36px; }
.sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.sec-head h2 {
  font-size: 26px; font-weight: 800; color: #3A7D5C; letter-spacing: -.4px;
}
.badge {
  background: #ECF5F0; color: #3A7D5C;
  border: 1px solid #C8E4D5; border-radius: 999px;
  font-size: 11.5px; font-weight: 700; padding: 2px 11px;
}
.sec-rule {
  height: 2px;
  background: linear-gradient(to right, #3A7D5C55, transparent);
  margin-bottom: 18px; border-radius: 2px;
}

/* ── Issue / generic card ────────────────────────────── */
.card {
  display: flex; border: 1px solid #CFDECF; border-radius: 10px;
  margin-bottom: 12px; overflow: hidden;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.card-bar { width: 5px; flex-shrink: 0; }
.card-inner { padding: 14px 16px; flex: 1; min-width: 0; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 7px; }
.card-title { font-size: 14px; font-weight: 700; color: #18261C; line-height: 1.4; }
.pill {
  font-size: 10px; font-weight: 700; letter-spacing: .07em; color: #fff;
  padding: 3px 10px; border-radius: 999px; white-space: nowrap; flex-shrink: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.card-desc { font-size: 13px; color: #2C3D2E; line-height: 1.65; margin-bottom: 5px; }
.file-ref { font-size: 12px; font-style: italic; color: #3A7D5C; display: block; margin-top: 5px; }

/* ── Summary ─────────────────────────────────────────── */
.summary-box {
  background: #EEF4EE; border: 1px solid #CFDECF;
  border-left: 5px solid #3A7D5C; border-radius: 10px;
  padding: 20px 22px; font-size: 14px; line-height: 1.75; color: #18261C;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* ── Suggestion card ─────────────────────────────────── */
.s-card { background: #fff; border-color: #CFDECF; align-items: flex-start; }
.s-num {
  font-size: 13px; font-weight: 800; color: #3A7D5C;
  background: #ECF5F0; border: 1px solid #C8E4D5;
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  margin: 14px 0 14px 14px; flex-shrink: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* ── Conflict block ──────────────────────────────────── */
.conflict { margin-bottom: 28px; page-break-inside: avoid; }
.conflict-file {
  background: #ECF5F0; border: 1px solid #C8E4D5; border-radius: 8px;
  padding: 9px 16px; font-size: 13.5px; font-weight: 700; color: #3A7D5C;
  margin-bottom: 10px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.field {
  background: #f8faf8; border: 1px solid #CFDECF;
  border-left: 4px solid; border-radius: 8px;
  padding: 13px 16px; margin-bottom: 8px;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.field-label {
  font-size: 10px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase; margin-bottom: 6px;
}
.field-val { font-size: 13px; color: #2C3D2E; line-height: 1.7; word-break: break-word; }

/* ── Strategy banner ─────────────────────────────────── */
.strategy {
  background: #EEF4EE; border: 1px solid #CFDECF;
  border-left: 4px solid #3A7D5C; border-radius: 8px;
  padding: 14px 18px; margin-bottom: 22px; font-size: 13.5px;
  color: #2C3D2E; line-height: 1.7; word-break: break-word;
  page-break-inside: avoid;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.strategy-label {
  font-size: 10px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase; color: #3A7D5C; margin-bottom: 6px;
}

/* ── Prompt ──────────────────────────────────────────── */
.prompt-box {
  background: #f8faf8; border: 1px solid #CFDECF; border-radius: 10px;
  padding: 20px 22px; word-break: break-word;
}
.prompt-line { font-size: 12.5px; color: #2C3D2E; line-height: 1.75; min-height: 1em; }

/* ── Print ───────────────────────────────────────────── */
@media print {
  @page { size: A4; margin: 13mm 15mm 16mm; }
  .print-bar { display: none !important; }
  body { padding-top: 0; }
  .cover { padding: 44px 40px 40px; }
  .cover-title { font-size: 60px; }
  .content { padding: 32px 40px; }
}
</style>
</head>
<body>

<!-- Print bar -->
<div class="print-bar">
  <span class="print-bar-title">PR Review Report</span>
  <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
</div>

<!-- Cover -->
<div class="cover">
  <div class="cover-eyebrow">Code Review Report</div>
  <div class="cover-title">PR Review<br>Report</div>

  ${pr ? `
  <div class="cover-meta">
    <div class="cover-meta-row">
      <span class="cover-meta-label">Repository</span>
      <span class="cover-meta-val">${esc(pr.repo)}</span>
    </div>
    <div class="cover-meta-row">
      <span class="cover-meta-label">PR</span>
      <span class="cover-meta-val">
        <a href="${esc(prUrl!)}" target="_blank">#${esc(pr.prNumber)} — ${esc(prUrl!)}</a>
      </span>
    </div>
  </div>` : ''}

  <div class="cover-date">Generated ${esc(date)}</div>
</div>

<!-- Content -->
<div class="content">

  <!-- Stats -->
  <div class="stats">
    ${stats.map(s => `
    <div class="stat" style="--c:${s.col}">
      <div class="stat-n">${s.count}</div>
      <div class="stat-l">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Summary -->
  ${section('Summary', null, `<div class="summary-box">${esc(review.summary)}</div>`)}

  <!-- Bugs -->
  ${review.bugs.length > 0 ? section('Bugs', review.bugs.length, review.bugs.map(b => issueCard(b)).join('')) : ''}

  <!-- Security -->
  ${review.security_issues.length > 0 ? section('Security Issues', review.security_issues.length, review.security_issues.map(s => issueCard(s)).join('')) : ''}

  <!-- Suggestions -->
  ${review.suggestions.length > 0 ? section('Suggestions', review.suggestions.length, review.suggestions.map((s,i) => suggestionCard(s,i)).join('')) : ''}

  <!-- Conflicts -->
  ${conflicts && conflicts.conflicts.length > 0 ? section('Merge Conflicts', conflicts.conflicts.length, `
    <div class="strategy">
      <div class="strategy-label">Overall Strategy</div>
      ${esc(conflicts.overall_strategy)}
    </div>
    ${conflicts.conflicts.map(c => conflictBlock(c)).join('')}
  `) : ''}

  <!-- AI Prompt -->
  ${agentPrompt ? section('AI Agent Prompt', null, `
    <div class="prompt-box">${promptHtml}</div>
  `) : ''}

</div>
</body>
</html>`;
}

export function exportReviewPdf(
  review:       ReviewOutput,
  conflicts?:   ConflictReport,
  agentPrompt?: string,
  prUrl?:       string,
) {
  const html = buildHtml(review, conflicts, agentPrompt, prUrl);
  const win  = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to export the report.'); return; }
  win.document.write(html);
  win.document.close();
}
