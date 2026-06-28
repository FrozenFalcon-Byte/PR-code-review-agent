import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ReviewOutput, ReviewItem, Suggestion, Severity } from '../../types';

const markdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter
        style={vscDarkPlus as any}
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
};

interface CodeReviewTabProps {
  review: ReviewOutput;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'var(--critical)',
  high: 'var(--high)',
  medium: 'var(--medium)',
  low: 'var(--low)',
};

const SEVERITY_BG: Record<Severity, string> = {
  critical: 'var(--critical-bg)',
  high: 'var(--high-bg)',
  medium: 'var(--medium-bg)',
  low: 'var(--low-bg)',
};

export default function CodeReviewTab({ review }: CodeReviewTabProps) {
  return (
    <div className="code-review-tab">
      <AccordionSection
        title="Bugs"
        items={review.bugs}
        renderItem={(item) => <ReviewItemCard item={item} />}
        emptyMessage="No bugs found in this category ✓"
      />
      <AccordionSection
        title="Security Issues"
        items={review.security_issues}
        renderItem={(item) => <ReviewItemCard item={item} />}
        emptyMessage="No security issues found ✓"
      />
      <AccordionSection
        title="Suggestions"
        items={review.suggestions}
        renderItem={(item) => <SuggestionCard item={item} />}
        emptyMessage="No suggestions — code looks clean ✓"
      />
    </div>
  );
}

function AccordionSection<T>({
  title,
  items,
  renderItem,
  emptyMessage,
}: {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="accordion">
      <button className="accordion-header" onClick={() => setOpen(!open)}>
        <div className="accordion-left">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`accordion-chevron ${open ? 'open' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="accordion-title">{title}</span>
        </div>
        <span className="accordion-count">{items.length}</span>
      </button>
      {open && (
        <div className="accordion-body">
          {items.length === 0 ? (
            <div className="empty-state">{emptyMessage}</div>
          ) : (
            items.map((item, i) => (
              <div key={i} className="accordion-item">
                {renderItem(item, i)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReviewItemCard({ item }: { item: ReviewItem }) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        <span
          className="severity-chip"
          style={{
            color: SEVERITY_COLORS[item.severity],
            backgroundColor: SEVERITY_BG[item.severity],
          }}
        >
          {item.severity}
        </span>
        <span className="review-title">{item.title}</span>
        {item.file && (
          <span className="file-badge">
            {item.file}
            {item.line ? `:${item.line}` : ''}
          </span>
        )}
      </div>
      <div className="review-description">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{item.description}</ReactMarkdown>
      </div>
    </div>
  );
}

function SuggestionCard({ item }: { item: Suggestion }) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        <span
          className="severity-chip"
          style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-dim)' }}
        >
          suggestion
        </span>
        <span className="review-title">{item.title}</span>
        {item.file && <span className="file-badge">{item.file}</span>}
      </div>
      <div className="review-description">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{item.description}</ReactMarkdown>
      </div>
    </div>
  );
}
