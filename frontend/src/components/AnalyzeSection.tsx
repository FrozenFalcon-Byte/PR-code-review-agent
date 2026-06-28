import { useState, useEffect } from 'react';
import type { EndpointType } from '../types';

interface AnalyzeSectionProps {
  onSubmit: (url: string, endpoint: EndpointType, maxIterations: number) => void;
  isLoading: boolean;
  loadingStep: string;
  streamLogs?: string[];
  elapsedSeconds?: number;
  selectedEndpoint?: EndpointType;
}

const ENDPOINTS: { key: EndpointType; label: string }[] = [
  { key: 'full', label: 'Full Review' },
  { key: 'review', label: 'Review Only' },
  { key: 'conflicts', label: 'Conflict Analysis' },
  { key: 'with-prompt', label: 'With AI Prompt' },
];

const LOADING_STEPS = [
  'Fetching PR diff...',
  'Reading changed files...',
  'Analyzing code...',
  'Producing review...',
  'Checking conflicts...',
  'Generating AI prompt...',
];

export default function AnalyzeSection({ onSubmit, isLoading, loadingStep, streamLogs = [], elapsedSeconds = 0, selectedEndpoint }: AnalyzeSectionProps) {
  const [url, setUrl] = useState('');
  const [endpoint, setEndpoint] = useState<EndpointType>('full');
  const [maxIterations, setMaxIterations] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (selectedEndpoint) setEndpoint(selectedEndpoint);
  }, [selectedEndpoint]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isLoading) {
      onSubmit(url.trim(), endpoint, maxIterations);
    }
  };

  const currentStepIndex = LOADING_STEPS.findIndex(s => s === loadingStep);

  return (
    <section className="analyze" id="analyze">
      <div className="section-container">
        <div className="section-label">Analyze</div>
        <h2 className="section-title">Run a PR Review</h2>
        <p className="section-subtitle">
          Paste a GitHub pull request URL and let the AI agent do the rest.
        </p>

        <form className="analyze-form" onSubmit={handleSubmit}>
          <div className="analyze-input-group">
            <input
              type="url"
              placeholder="https://github.com/owner/repo/pull/123"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="analyze-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="btn-primary btn-lg analyze-btn"
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Analyzing...
                </>
              ) : (
                'Run Full Review'
              )}
            </button>
          </div>

          {/* Endpoint toggles */}
          <div className="endpoint-toggles">
            {ENDPOINTS.map(ep => (
              <button
                key={ep.key}
                type="button"
                className={`toggle-btn ${endpoint === ep.key ? 'active' : ''}`}
                onClick={() => setEndpoint(ep.key)}
                disabled={isLoading}
              >
                {ep.label}
              </button>
            ))}
          </div>

          {/* Advanced settings */}
          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform var(--transition)' }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="advanced-panel">
              <label className="slider-label">
                <span>Max Iterations: <strong>{maxIterations}</strong></span>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={maxIterations}
                  onChange={e => setMaxIterations(Number(e.target.value))}
                  className="slider"
                />
              </label>
            </div>
          )}
        </form>

        {/* Loading state */}
        {isLoading && (
          <div className="loading-steps">
            <div className="loading-header">
              <span className="loading-status">{loadingStep || 'Starting...'}</span>
              <span className="loading-timer">
                {Math.floor(elapsedSeconds / 60) > 0
                  ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
                  : `${elapsedSeconds}s`}
                {' · '}
                <span className="loading-eta">
                  {elapsedSeconds < 30 ? 'est. 2–4 min' : elapsedSeconds < 90 ? 'almost there...' : 'wrapping up...'}
                </span>
              </span>
            </div>

            {LOADING_STEPS.map((step, i) => (
              <div
                key={step}
                className={`loading-step ${
                  i < currentStepIndex
                    ? 'done'
                    : i === currentStepIndex
                    ? 'active'
                    : ''
                }`}
              >
                <div className="step-dot">
                  {i < currentStepIndex ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : i === currentStepIndex ? (
                    <span className="pulse-dot" />
                  ) : (
                    <span className="empty-dot" />
                  )}
                </div>
                <span className="step-text">{step}</span>
              </div>
            ))}

            {streamLogs.length > 0 && (
              <div className="stream-log">
                <div className="stream-log-inner">
                  {streamLogs.slice(-6).map((log, i) => (
                    <div key={i} className="stream-log-line">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

