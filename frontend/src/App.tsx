import { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './ToastContext';
import HeroSection from './components/HeroSection';
import AnalyzeSection from './components/AnalyzeSection';
import ResultsDashboard from './components/ResultsDashboard';
import HowItWorks from './components/HowItWorks';
import EndpointsTable from './components/EndpointsTable';
import Footer from './components/Footer';
import {
  healthCheck,
  reviewOnly,
  reviewConflicts,
  reviewWithPrompt,
  reviewStream,
} from './api';
import type {
  EndpointType,
  ReviewOutput,
  ConflictReport,
} from './types';
import { saveRecentReview } from './components/RecentReviews';
import './App.css';

function AppContent() {
  const { addToast } = useToast();
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Results state
  const [review, setReview] = useState<ReviewOutput | undefined>();
  const [conflicts, setConflicts] = useState<ConflictReport | undefined>();
  const [agentPrompt, setAgentPrompt] = useState<string | undefined>();
  const [prUrl, setPrUrl] = useState<string | undefined>();
  const [hasResults, setHasResults] = useState(false);

  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>('full');
  const [recentRefresh, setRecentRefresh] = useState(0);

  // Health check polling
  useEffect(() => {
    const check = async () => {
      const online = await healthCheck();
      setIsBackendOnline(online);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Maps raw backend log strings to user-facing step labels
  const LOG_TO_STEP: [RegExp, string][] = [
    [/Fetching PR #/i,               'Fetching PR diff...'],
    [/Iteration \d+.*Calling model/i, 'Analyzing code...'],
    [/get_file_content|get_function_definition|search_repo/i, 'Reading changed files...'],
    [/conflict info/i,               'Checking conflicts...'],
    [/Analyzing conflicts/i,         'Checking conflicts...'],
    [/Producing structured review/i, 'Producing review...'],
    [/Generating AI agent prompt/i,  'Generating AI prompt...'],
  ];

  const logToStep = (msg: string): string => {
    for (const [pattern, label] of LOG_TO_STEP) {
      if (pattern.test(msg)) return label;
    }
    return '';
  };

  const handleAnalyze = useCallback(async (url: string, endpoint: EndpointType, maxIterations: number) => {
    setIsLoading(true);
    setReview(undefined);
    setConflicts(undefined);
    setAgentPrompt(undefined);
    setPrUrl(url);
    setHasResults(false);
    setStreamLogs([]);
    setLoadingStep('Fetching PR diff...');
    setElapsedSeconds(0);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const onLog = (msg: string) => {
      setStreamLogs(prev => [...prev, msg]);
      const step = logToStep(msg);
      if (step) setLoadingStep(step);
    };

    let localReview: ReviewOutput | undefined;
    let localConflicts: ConflictReport | undefined;

    try {
      if (endpoint === 'full') {
        const res = await reviewStream(url, maxIterations, onLog);
        localReview = res.review;
        localConflicts = res.conflicts;
        setReview(res.review);
        setConflicts(res.conflicts);
        setAgentPrompt(res.agent_prompt);
      } else {
        switch (endpoint) {
          case 'review': {
            const res = await reviewOnly(url, maxIterations);
            localReview = res;
            setReview(res);
            break;
          }
          case 'conflicts': {
            const res = await reviewConflicts(url);
            localConflicts = res;
            setConflicts(res);
            break;
          }
          case 'with-prompt': {
            const res = await reviewWithPrompt(url, maxIterations);
            localReview = res.review;
            setReview(res.review);
            setAgentPrompt(res.agent_prompt);
            break;
          }
        }
      }
      setHasResults(true);

      // Persist to recent reviews history using local result vars (state hasn't flushed yet)
      const prMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
      if (prMatch) {
        const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const issue of [...(localReview?.bugs ?? []), ...(localReview?.security_issues ?? [])]) {
          const s = issue.severity?.toLowerCase() as keyof typeof sevCounts;
          if (s in sevCounts) sevCounts[s]++;
        }
        saveRecentReview({
          url,
          repo: prMatch[1],
          prNumber: parseInt(prMatch[2], 10),
          severity: sevCounts,
          conflicts: (localConflicts?.conflicts?.length ?? 0) > 0,
          reviewedAt: Date.now(),
        });
        setRecentRefresh(n => n + 1);
      }

      addToast('Review completed successfully!', 'success');
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      addToast(message, 'error');
    } finally {
      clearInterval(timer);
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [addToast]);

  const handleHeroAnalyze = (url: string) => {
    setSelectedEndpoint('full');
    // Scroll to analyze section then auto-submit
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      handleAnalyze(url, 'full', 10);
    }, 400);
  };

  const handleEndpointSelect = (endpoint: EndpointType) => {
    setSelectedEndpoint(endpoint);
  };

  return (
    <div className="app">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-inner">
          <div className="nav-brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 18l6-6-6-6" />
              <path d="M8 6l-6 6 6 6" />
            </svg>
            <span>PR Review Agent</span>
          </div>
          <div className="nav-links">
            <a href="#analyze" className="nav-link">Analyze</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#endpoints" className="nav-link">API</a>
          </div>
        </div>
      </nav>

      <main>
        <HeroSection onAnalyze={handleHeroAnalyze} recentRefresh={recentRefresh} />
        <div>
          <AnalyzeSection
            onSubmit={handleAnalyze}
            isLoading={isLoading}
            loadingStep={loadingStep}
            streamLogs={streamLogs}
            elapsedSeconds={elapsedSeconds}
            selectedEndpoint={selectedEndpoint}
          />
        </div>
        {hasResults && (
          <ResultsDashboard
            review={review}
            conflicts={conflicts}
            agentPrompt={agentPrompt}
            prUrl={prUrl}
          />
        )}
        <HowItWorks />
        <EndpointsTable onSelectEndpoint={handleEndpointSelect} />
      </main>

      <Footer isBackendOnline={isBackendOnline} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
