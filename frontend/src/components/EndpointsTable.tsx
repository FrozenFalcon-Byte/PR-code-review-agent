import type { EndpointType } from '../types';

interface EndpointsTableProps {
  onSelectEndpoint: (endpoint: EndpointType) => void;
}

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/review/full',
    description: 'Full analysis — code review + conflict analysis + AI prompt',
    endpoint: 'full' as EndpointType,
  },
  {
    method: 'POST',
    path: '/review',
    description: 'Code review only — bugs, security issues, suggestions',
    endpoint: 'review' as EndpointType,
  },
  {
    method: 'POST',
    path: '/review/conflicts',
    description: 'Conflict analysis only — merge conflict detection & resolution',
    endpoint: 'conflicts' as EndpointType,
  },
  {
    method: 'POST',
    path: '/review/with-prompt',
    description: 'Code review + copy-pasteable AI agent prompt',
    endpoint: 'with-prompt' as EndpointType,
  },
];

export default function EndpointsTable({ onSelectEndpoint }: EndpointsTableProps) {
  return (
    <section className="endpoints" id="endpoints">
      <div className="section-container">
        <div className="section-label">API Reference</div>
        <h2 className="section-title">Available Endpoints</h2>

        <div className="endpoints-table">
          <div className="table-header">
            <span>Endpoint</span>
            <span>Description</span>
            <span>Action</span>
          </div>
          {ENDPOINTS.map(ep => (
            <div
              key={ep.path}
              className="table-row"
              onClick={() => {
                onSelectEndpoint(ep.endpoint);
                document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <div className="endpoint-path">
                <span className="method-badge">{ep.method}</span>
                <code>{ep.path}</code>
              </div>
              <div className="endpoint-desc">{ep.description}</div>
              <button className="try-btn">
                Try it <span>→</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
