import { useState } from 'react';
import type { ReviewOutput, ConflictReport } from '../types';
import OverviewTab from './tabs/OverviewTab';
import CodeReviewTab from './tabs/CodeReviewTab';
import ConflictTab from './tabs/ConflictTab';
import PromptTab from './tabs/PromptTab';

interface ResultsDashboardProps {
  review?: ReviewOutput;
  conflicts?: ConflictReport;
  agentPrompt?: string;
  prUrl?: string;
}

type Tab = 'overview' | 'review' | 'conflicts' | 'prompt';

export default function ResultsDashboard({ review, conflicts, agentPrompt, prUrl }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'overview', label: 'Overview', available: !!review },
    { key: 'review', label: 'Code Review', available: !!review },
    { key: 'conflicts', label: 'Conflicts', available: !!conflicts },
    { key: 'prompt', label: 'AI Prompt', available: !!agentPrompt },
  ];

  async function handleExportPdf() {
    if (!review) return;
    const { exportReviewPdf } = await import('../utils/exportPdf');
    exportReviewPdf(review, conflicts, agentPrompt, prUrl);
  }

  return (
    <section className="results" id="results">
      <div className="section-container">
        <div className="results-header">
          <div>
            <div className="section-label">Results</div>
            <h2 className="section-title">Review Dashboard</h2>
          </div>
          {review && (
            <button className="export-pdf-btn" onClick={handleExportPdf} title="Download results as PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export PDF
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''} ${!tab.available ? 'disabled' : ''}`}
              onClick={() => tab.available && setActiveTab(tab.key)}
              disabled={!tab.available}
            >
              {tab.label}
              {!tab.available && <span className="tab-na">N/A</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {activeTab === 'overview' && review && <OverviewTab review={review} conflicts={conflicts} />}
          {activeTab === 'review' && review && <CodeReviewTab review={review} />}
          {activeTab === 'conflicts' && conflicts && <ConflictTab conflicts={conflicts} />}
          {activeTab === 'prompt' && agentPrompt && <PromptTab prompt={agentPrompt} />}
        </div>
      </div>
    </section>
  );
}
