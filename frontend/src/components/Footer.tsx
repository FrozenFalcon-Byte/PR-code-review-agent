interface FooterProps {
  isBackendOnline: boolean;
}

export default function Footer({ isBackendOnline }: FooterProps) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-left">
          <div className="footer-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className="footer-brand">PR Review Agent</span>
          </div>
          <span className="footer-copy">© 2025</span>
        </div>

        <div className="footer-center">
          <a href="#" className="footer-link">Docs</a>
          <a href="#" className="footer-link">API</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
        </div>

        <div className="footer-right">
          <div className={`status-indicator ${isBackendOnline ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            <span className="status-text">
              {isBackendOnline ? 'Backend running' : 'Backend offline'}
            </span>
            {/* <code className="status-url"></code> */}
          </div>
        </div>
      </div>
    </footer>
  );
}
