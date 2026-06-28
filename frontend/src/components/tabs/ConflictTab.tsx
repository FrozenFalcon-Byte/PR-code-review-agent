import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ConflictReport } from '../../types';

interface ConflictTabProps {
  conflicts: ConflictReport;
}

export default function ConflictTab({ conflicts }: ConflictTabProps) {
  return (
    <div className="conflict-tab">
      {/* Mergeability banner */}
      <div className={`merge-banner ${conflicts.mergeable ? 'clean' : 'conflict'}`}>
        <span className="merge-dot" />
        <span className="merge-text">
          {conflicts.mergeable_state || (conflicts.mergeable ? 'clean' : 'blocked')}
        </span>
      </div>

      {/* Conflict cards */}
      {conflicts.conflicts.length === 0 ? (
        <div className="empty-state">No conflicts detected ✓</div>
      ) : (
        conflicts.conflicts.map((conflict, i) => (
          <div key={i} className="conflict-card">
            <div className="conflict-file">
              <code>{conflict.file}</code>
            </div>

            <p className="conflict-summary">{stripCodeFences(conflict.conflict_summary)}</p>

            {/* Two-column diff */}
            <div className="diff-columns">
              <div className="diff-column diff-ours">
                <div className="diff-label">Our Side (PR Branch)</div>
                <div className="diff-text">{conflict.our_side}</div>
              </div>
              <div className="diff-column diff-theirs">
                <div className="diff-label">Their Side (Base Branch)</div>
                <div className="diff-text">{conflict.their_side}</div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="conflict-recommendation">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{conflict.recommendation}</ReactMarkdown>
            </div>

          </div>
        ))
      )}

      {/* Overall strategy */}
      {conflicts.overall_strategy && (
        <div className="strategy-card">
          <h3 className="strategy-title">Overall Strategy</h3>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{conflicts.overall_strategy}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function stripCodeFences(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter(line => !line.trim().startsWith('```'))
    .join('\n')
    .trim();
}

