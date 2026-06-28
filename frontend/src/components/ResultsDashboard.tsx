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
}

type Tab = 'overview' | 'review' | 'conflicts' | 'prompt';

export default function ResultsDashboard({ review, conflicts, agentPrompt }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'overview', label: 'Overview', available: !!review },
    { key: 'review', label: 'Code Review', available: !!review },
    { key: 'conflicts', label: 'Conflicts', available: !!conflicts },
    { key: 'prompt', label: 'AI Prompt', available: !!agentPrompt },
  ];

  return (
    <section className="results" id="results">
      <div className="section-container">
        <div className="section-label">Results</div>
        <h2 className="section-title">Review Dashboard</h2>

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
