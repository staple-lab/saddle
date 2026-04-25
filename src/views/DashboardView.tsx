import { useState, useEffect } from 'react';
import type { ProjectStructure } from '../types/component';

interface DashboardViewProps {
  project: ProjectStructure;
  projectRoot: string;
}

export function DashboardView({ project, projectRoot }: DashboardViewProps) {
  const [devServerUrl, setDevServerUrl] = useState('');
  const [devServerStatus, setDevServerStatus] = useState<'disconnected' | 'checking' | 'connected'>('disconnected');
  const [mcpStatus, setMcpStatus] = useState<'disconnected' | 'connected'>('disconnected');

  const checkDevServer = async (url: string) => {
    if (!url) return;
    setDevServerStatus('checking');
    try {
      const resp = await fetch(url, { mode: 'no-cors' });
      setDevServerStatus('connected');
    } catch {
      setDevServerStatus('disconnected');
    }
  };

  const commonPorts = [3000, 5173, 8080, 4200, 3001];

  const autoDetect = async () => {
    setDevServerStatus('checking');
    for (const port of commonPorts) {
      try {
        await fetch(`http://localhost:${port}`, { mode: 'no-cors' });
        setDevServerUrl(`http://localhost:${port}`);
        setDevServerStatus('connected');
        return;
      } catch {}
    }
    setDevServerStatus('disconnected');
  };

  const statusDot = (status: string) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: status === 'connected' ? 'var(--color-success)' : status === 'checking' ? 'var(--color-warning)' : 'var(--color-fg-subtle)',
    flexShrink: 0,
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)' }}>
      <header style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border)',
        background: '#ffffff',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-fg)' }}>Dashboard</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-fg-muted)' }}>
          {projectRoot.split('/').pop()} - Project settings and integrations
        </p>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Project Info */}
          <Card title="Project">
            <Row label="Root" value={projectRoot} mono />
            <Row label="Components" value={`${project.components.length}`} />
            <Row label="Total Variants" value={`${project.components.reduce((acc, c) => acc + c.variants.length, 0)}`} />
          </Card>

          {/* Dev Server */}
          <Card title="Dev Server">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={statusDot(devServerStatus)} />
              <span style={{ fontSize: 13, color: 'var(--color-fg)' }}>
                {devServerStatus === 'connected' ? 'Connected' : devServerStatus === 'checking' ? 'Checking...' : 'Disconnected'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={devServerUrl}
                onChange={(e) => setDevServerUrl(e.target.value)}
                placeholder="http://localhost:5173"
                style={{
                  flex: 1,
                  height: 28,
                  padding: '0 8px',
                  fontSize: 12,
                  fontFamily: 'var(--font-code)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  background: '#ffffff',
                  color: 'var(--color-fg)',
                }}
              />
              <button
                onClick={() => checkDevServer(devServerUrl)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  background: '#ffffff',
                  color: 'var(--color-fg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: 'var(--elevation-1)',
                }}
              >
                Connect
              </button>
              <button
                onClick={autoDetect}
                style={{
                  height: 28,
                  padding: '0 12px',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: 'var(--elevation-1)',
                }}
              >
                Auto-detect
              </button>
            </div>
          </Card>

          {/* MCP Integration */}
          <Card title="Claude Code (MCP)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={statusDot(mcpStatus)} />
              <span style={{ fontSize: 13, color: 'var(--color-fg)' }}>
                {mcpStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-fg-muted)', lineHeight: 1.5, margin: 0 }}>
              Saddle exposes an MCP server for Claude Code integration. Connect via Claude Code settings to enable bidirectional component editing.
            </p>
          </Card>

          {/* Token Stats */}
          <Card title="Design Tokens">
            <p style={{ fontSize: 12, color: 'var(--color-fg-muted)', lineHeight: 1.5, margin: '0 0 8px' }}>
              Global tokens from saddle.config.json
            </p>
            <button
              style={{
                height: 28,
                padding: '0 12px',
                background: '#ffffff',
                color: 'var(--color-fg)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              Edit saddle.config.json
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-fg)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>{label}</span>
      <span style={{
        fontSize: 12,
        color: 'var(--color-fg)',
        fontFamily: mono ? 'var(--font-code)' : undefined,
        maxWidth: 300,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  );
}
