import { useState, useRef, useEffect } from 'react';
import RecentReviews from './RecentReviews';

interface HeroSectionProps {
  onAnalyze: (url: string) => void;
  recentRefresh: number;
}

const TAGS = [
  'Bug Detection', 'Security Scan', 'Conflict Analysis', 'AI Prompts',
  'Structured Output', 'Code Quality', 'PR Insights', 'Merge Safety',
  'Bug Detection', 'Security Scan', 'Conflict Analysis', 'AI Prompts',
  'Structured Output', 'Code Quality', 'PR Insights', 'Merge Safety',
];

export default function HeroSection({ onAnalyze, recentRefresh }: HeroSectionProps) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onAnalyze(url.trim());
  };

  return (
    <section className="hero">
      <div className="hero-grid">
        {/* Main CTA card */}
        <div className="hero-card hero-main">
          <div className="hero-badge">AI Code Review</div>
          <h1 className="hero-headline">
            Review <span className="text-accent">→</span> Smarter
          </h1>
          <p className="hero-subtext">
            Catch bugs, security issues, and merge conflicts before they hit production.
          </p>
          <form className="hero-form" onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://github.com/owner/repo/pull/123"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="hero-input"
              />
            </div>
            <button type="submit" className="btn-primary btn-lg">
              Analyze PR <span className="btn-arrow">→</span>
            </button>
          </form>
        </div>

        {/* Recent reviews card */}
        <RecentReviews refresh={recentRefresh} />
      </div>

      {/* Scrolling tags */}
      <div className="tag-strip">
        <div className="tag-scroll">
          {TAGS.map((tag, i) => (
            <span key={i} className="tag-chip">{tag}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
