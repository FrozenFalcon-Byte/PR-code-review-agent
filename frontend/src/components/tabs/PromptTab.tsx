import { useState, useRef, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { generateCodeStream } from '../../api';

function DiffLines({ code }: { code: string }) {
  // Strip markdown fences, then render each line with diff coloring + line numbers
  const lines = code
    .split('\n')
    .filter(l => !l.match(/^```/));

  let lineNum = 0;

  return (
    <table className="diff-table">
      <tbody>
        {lines.map((line, i) => {
          const isAdd    = line.startsWith('+') && !line.startsWith('+++');
          const isDel    = line.startsWith('-') && !line.startsWith('---');
          const isHunk   = line.startsWith('@@');
          const isFile   = line.startsWith('---') || line.startsWith('+++');
          const isComment = line.startsWith('#');

          if (!isDel && !isHunk && !isFile) lineNum++;

          const cls = isAdd ? 'dl-add' : isDel ? 'dl-del' : isHunk ? 'dl-hunk' : isFile ? 'dl-file' : isComment ? 'dl-comment' : 'dl-ctx';

          return (
            <tr key={i} className={`diff-row ${cls}`}>
              <td className="diff-ln">
                {!isDel && !isHunk && !isFile ? lineNum : ''}
              </td>
              <td className="diff-sign">
                {isAdd ? '+' : isDel ? '−' : isHunk ? '⋯' : ''}
              </td>
              <td className="diff-code">{line.replace(/^[+\-]/, '')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface PromptTabProps {
  prompt: string;
}

export default function PromptTab({ prompt }: PromptTabProps) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [genError, setGenError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  const charCount = prompt.length;
  const estimatedTokens = Math.round(charCount / 4);

  // Auto-scroll code output as it streams in
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [generatedCode]);

  const copyAndOpen = (url: string) => {
    navigator.clipboard.writeText(prompt);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setGeneratedCode('');
    setGenError('');
    try {
      await generateCodeStream(prompt, (chunk) => {
        setGeneratedCode(prev => prev + chunk);
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="prompt-tab">
      {/* Explanation */}
      <div className="prompt-explainer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        This prompt includes the full PR diff and every finding. Generate code fixes directly below, or paste it into any AI assistant.
      </div>

      {/* Prompt block */}
      <div className="prompt-block">
        <div className="prompt-header">
          <span className="prompt-meta">
            {charCount.toLocaleString()} chars · ~{estimatedTokens.toLocaleString()} tokens
          </span>
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <SyntaxHighlighter
          language="markdown"
          style={vscDarkPlus}
          customStyle={{ margin: 0, borderRadius: '0 0 12px 12px', maxHeight: '320px' }}
        >
          {prompt}
        </SyntaxHighlighter>
      </div>

      {/* Primary action: Generate Code */}
      <div className="gen-code-section">
        <button
          className="btn-primary btn-generate-code"
          onClick={handleGenerateCode}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner" />
              Generating fixes...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Generate Code Fixes
            </>
          )}
        </button>
        <span className="gen-code-hint">Runs the LLM and streams code diffs right here</span>
      </div>

      {/* Streaming code output — Mac window chrome */}
      {(generatedCode || isGenerating) && (
        <div className="mac-window">
          {/* Title bar */}
          <div className="mac-titlebar">
            <div className="mac-dots">
              <span className="mac-dot mac-close" />
              <span className="mac-dot mac-min" />
              <span className="mac-dot mac-max" />
            </div>
            <span className="mac-title">
              {isGenerating ? (
                <><span className="streaming-dot" /> generating fixes...</>
              ) : (
                'code-fixes.diff'
              )}
            </span>
            {generatedCode && !isGenerating && (
              <button className="mac-copy-btn" onClick={handleCopyCode}>
                {codeCopied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>

          {/* Code body */}
          <div className="mac-body" ref={codeRef}>
            {generatedCode ? (
              <DiffLines code={generatedCode} />
            ) : (
              <div className="mac-placeholder">
                <span className="mac-cursor" />
              </div>
            )}
          </div>
        </div>
      )}

      {genError && (
        <div className="gen-code-error">{genError}</div>
      )}

      {/* Secondary: open in external AI tool */}
      <div className="prompt-actions">
        <p className="prompt-actions-label">Or paste the prompt into an external AI tool:</p>
        <div className="prompt-actions-row">
          <button className="action-btn claude-btn" onClick={() => copyAndOpen('https://claude.ai')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            Claude
          </button>
          <button className="action-btn chatgpt-btn" onClick={() => copyAndOpen('https://chatgpt.com')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
            </svg>
            ChatGPT
          </button>
          <button className="action-btn gemini-btn" onClick={() => copyAndOpen('https://gemini.google.com')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 2c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8 3.58-8 8-8zm-1 4v4H7l5 5 5-5h-4V8h-2z"/>
            </svg>
            Gemini
          </button>
        </div>
      </div>
    </div>
  );
}
