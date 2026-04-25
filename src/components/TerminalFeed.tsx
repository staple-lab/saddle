import { useState, useRef, useEffect } from 'react';

export interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'ai';
  message: string;
  source?: string;
}

interface TerminalFeedProps {
  logs: LogEntry[];
  onCommand?: (command: string) => void;
}

const typeColors: Record<string, string> = {
  info: 'var(--color-fg-muted)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-danger)',
  ai: 'var(--color-primary)',
};

export function TerminalFeed({ logs, onCommand }: TerminalFeedProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && onCommand) {
      onCommand(input.trim());
      setInput('');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1d1d1f',
      borderRadius: '10px 10px 0 0',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 16px',
        background: '#2c2c2e',
        borderBottom: '1px solid #3a3a3c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#98989d' }}>Terminal</span>
        <span style={{ fontSize: 11, color: '#636366' }}>{logs.length} entries</span>
      </div>

      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px',
        fontFamily: 'var(--font-code)',
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#636366', fontStyle: 'italic', padding: '8px 0' }}>
            No activity yet
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ color: '#636366', flexShrink: 0 }}>{formatTime(log.timestamp)}</span>
              {log.source && (
                <span style={{ color: '#8e8e93', flexShrink: 0 }}>[{log.source}]</span>
              )}
              <span style={{ color: typeColors[log.type] || '#ffffff' }}>{log.message}</span>
            </div>
          ))
        )}
      </div>

      {onCommand && (
        <form onSubmit={handleSubmit} style={{
          padding: '8px 16px',
          borderTop: '1px solid #3a3a3c',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: 'var(--color-primary)', fontSize: 12, fontFamily: 'var(--font-code)' }}>{'>'}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Claude Code..."
            style={{
              flex: 1,
              height: 28,
              padding: '0 8px',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontFamily: 'var(--font-code)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </form>
      )}
    </div>
  );
}
