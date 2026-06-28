import { useEffect, useState } from 'react';

export interface RecentReview {
  url: string;
  repo: string;
  prNumber: number;
  title?: string;
  severity: { critical: number; high: number; medium: number; low: number };
  conflicts: boolean;
  reviewedAt: number;
}

const STORAGE_KEY = 'pr_review_history';
const MAX_HISTORY = 5;

export function saveRecentReview(entry: RecentReview) {
  try {
    const existing = loadRecentReviews();
    const deduped = existing.filter(r => r.url !== entry.url);
    const updated = [entry, ...deduped].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function loadRecentReviews(): RecentReview[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function severityDot(critical: number, high: number, medium: number) {
  if (critical > 0) return <span className="sev-dot critical" title={`${critical} critical`} />;
  if (high > 0) return <span className="sev-dot high" title={`${high} high`} />;
  if (medium > 0) return <span className="sev-dot medium" title={`${medium} medium`} />;
  return <span className="sev-dot ok" title="No major issues" />;
}

interface Props {
  refresh: number;
}

export default function RecentReviews({ refresh }: Props) {
  const [reviews, setReviews] = useState<RecentReview[]>([]);

  useEffect(() => {
    setReviews(loadRecentReviews());
  }, [refresh]);

  return (
    <div className="hero-card hero-stats">
      <div className="stats-header">Recent Reviews</div>
      {reviews.length === 0 ? (
        <div className="recent-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p>No reviews yet — paste a PR URL above to get started.</p>
        </div>
      ) : (
        <ul className="recent-list">
          {reviews.map(r => (
            <li key={r.url} className="recent-item">
              <div className="recent-top">
                {severityDot(r.severity.critical, r.severity.high, r.severity.medium)}
                <a href={r.url} target="_blank" rel="noreferrer" className="recent-repo">
                  {r.repo} <span className="recent-pr">#{r.prNumber}</span>
                </a>
                <span className="recent-time">{timeAgo(r.reviewedAt)}</span>
              </div>
              <div className="recent-chips">
                {r.severity.critical > 0 && <span className="recent-chip critical">{r.severity.critical} critical</span>}
                {r.severity.high > 0 && <span className="recent-chip high">{r.severity.high} high</span>}
                {r.severity.medium > 0 && <span className="recent-chip medium">{r.severity.medium} med</span>}
                {r.severity.low > 0 && <span className="recent-chip low">{r.severity.low} low</span>}
                {r.conflicts && <span className="recent-chip conflict">conflicts</span>}
                {r.severity.critical === 0 && r.severity.high === 0 && r.severity.medium === 0 && !r.conflicts && (
                  <span className="recent-chip ok">clean</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
