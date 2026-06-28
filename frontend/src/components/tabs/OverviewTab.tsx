import type { ReviewOutput, ConflictReport, Severity } from '../../types';

interface OverviewTabProps {
  review: ReviewOutput;
  conflicts?: ConflictReport;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export default function OverviewTab({ review, conflicts }: OverviewTabProps) {
  const severityCounts = SEVERITY_ORDER.map(sev => ({
    severity: sev,
    count: [
      ...review.bugs.filter(b => b.severity === sev),
      ...review.security_issues.filter(s => s.severity === sev),
    ].length,
  }));

  const bugCount = review.bugs.length;
  const securityCount = review.security_issues.length;
  const suggestionCount = review.suggestions.length;
  const conflictCount = conflicts?.conflicts?.length ?? 0;

  return (
    <div className="overview-tab">
      {/* Summary */}
      <div className="overview-summary">
        <p>{review.summary}</p>
      </div>

      {/* Stats row */}
      <div className="overview-stats">
        <StatCard label="Bugs" count={bugCount} color="var(--critical)" />
        <StatCard label="Security Issues" count={securityCount} color="var(--high)" />
        <StatCard label="Suggestions" count={suggestionCount} color="var(--primary)" />
        <StatCard label="Conflicts" count={conflictCount} color="var(--medium)" />
      </div>

      {/* Severity Breakdown Grid */}
      <div className="severity-chart">
        <h3 className="chart-title">Severity Breakdown</h3>
        <div 
          className="severity-grid" 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
            gap: '1rem', 
            marginTop: '1rem' 
          }}
        >
          {severityCounts.map(({ severity, count }) => {
            const isZero = count === 0;
            return (
              <div 
                key={severity} 
                className="severity-card"
                style={{
                  backgroundColor: `var(--${severity}-bg)`,
                  padding: '1.25rem',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  opacity: isZero ? 0.5 : 1,
                  border: `1px solid var(--${severity})`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: `var(--${severity})` }} />
                  <span style={{ color: `var(--${severity})`, fontWeight: 600, textTransform: 'capitalize', fontSize: '0.9rem' }}>
                    {severity}
                  </span>
                </div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-dot" style={{ backgroundColor: color }} />
      <div className="stat-card-count">{count}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
