import { useState } from 'react';
import type { ProjectStructure } from '../types/component';
import { writeComponentFile } from '../lib/tauri';

interface DashboardViewProps {
  project: ProjectStructure;
  projectRoot: string;
  onDevServerConnect?: (url: string) => void;
  onLoadProject?: () => void;
}

export function DashboardView({ project, projectRoot, onDevServerConnect, onLoadProject }: DashboardViewProps) {
  const [devServerUrl, setDevServerUrl] = useState('');
  const [devServerStatus, setDevServerStatus] = useState<'disconnected' | 'checking' | 'connected'>('disconnected');
  const [mcpStatus] = useState<'disconnected' | 'connected'>('disconnected');

  const checkDevServer = async (url: string) => {
    if (!url) return;
    setDevServerStatus('checking');
    try {
      await fetch(url, { mode: 'no-cors' });
      setDevServerStatus('connected');
      onDevServerConnect?.(url);
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
        const url = `http://localhost:${port}`;
        setDevServerUrl(url);
        setDevServerStatus('connected');
        onDevServerConnect?.(url);
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
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-stage)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 32px 64px' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, color: 'var(--color-fg)' }}>Settings</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-fg-muted)' }}>
            {projectRoot.split('/').pop()} — Project, dev server, and integrations
          </p>
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Project Info */}
          <Card title="Project">
            <Row label="Root" value={projectRoot} mono />
            <Row label="Components" value={`${project.components.length}`} />
            <Row label="Total Variants" value={`${project.components.reduce((acc, c) => acc + c.variants.length, 0)}`} />
            {onLoadProject && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={onLoadProject}
                  style={{
                    height: 30,
                    padding: '0 14px',
                    background: 'var(--color-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    boxShadow: 'var(--elevation-1)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-press)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary)'; }}
                >
                  Load Different Project
                </button>
              </div>
            )}
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
          <MCPSetupCard
            projectRoot={projectRoot}
            mcpStatus={mcpStatus}
            statusDot={statusDot}
          />

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

function MCPSetupCard({ projectRoot, mcpStatus, statusDot }: {
  projectRoot: string;
  mcpStatus: string;
  statusDot: (s: string) => React.CSSProperties;
}) {
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  const mcpBridgeSrc = `${projectRoot}/mcp-bridge.mjs`;

  const claudeCodeConfig = JSON.stringify({
    mcpServers: {
      saddle: {
        command: 'node',
        args: [mcpBridgeSrc],
      },
    },
  }, null, 2);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleInstallToClaudeCode = async () => {
    // Write .mcp.json to project root for Claude Code auto-discovery
    const mcpJson = JSON.stringify({
      mcpServers: {
        saddle: {
          command: 'node',
          args: ['mcp-bridge.mjs'],
          cwd: projectRoot,
        },
      },
    }, null, 2);

    try {
      await writeComponentFile(`${projectRoot}/.mcp.json`, mcpJson);
      setInstalled(true);
    } catch (err) {
      alert(`Failed to write .mcp.json: ${err}`);
    }
  };


  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 11,
    fontFamily: 'var(--font-code)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    background: '#f5f5f7',
    color: 'var(--color-fg)',
    lineHeight: 1.5,
    resize: 'none' as const,
  };

  const btnStyle: React.CSSProperties = {
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
  };

  return (
    <Card title="Claude Code (MCP)">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={statusDot(mcpStatus)} />
        <span style={{ fontSize: 13, color: 'var(--color-fg)' }}>
          {mcpStatus === 'connected' ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {/* Auto-install */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)', marginBottom: 8 }}>Quick Setup</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleInstallToClaudeCode}
            style={{
              ...btnStyle,
              background: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            {installed ? 'Installed' : 'Install for Claude Code CLI'}
          </button>
        </div>
        {installed && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-success)' }}>
            Wrote .mcp.json to project root. Claude Code will auto-discover Saddle's MCP server.
          </div>
        )}
      </div>

      {/* Manual config */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)', marginBottom: 8 }}>Manual Setup</div>
        <p style={{ fontSize: 12, color: 'var(--color-fg-muted)', lineHeight: 1.5, margin: '0 0 8px' }}>
          Add to your Claude Code or Claude Desktop config:
        </p>
        <div style={{ position: 'relative' }}>
          <textarea
            readOnly
            value={claudeCodeConfig}
            rows={8}
            style={inputStyle}
          />
          <button
            onClick={() => handleCopy(claudeCodeConfig)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              ...btnStyle,
              height: 24,
              fontSize: 11,
              padding: '0 8px',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Available tools */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)', marginBottom: 8 }}>Available MCP Tools</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { name: 'saddle_list_components', desc: 'List all components with variants' },
            { name: 'saddle_get_component', desc: 'Get full schema for a component' },
            { name: 'saddle_update_tokens', desc: 'Update design tokens (saves to file)' },
            { name: 'saddle_read_component', desc: 'Read component source code' },
            { name: 'saddle_create_variant', desc: 'Create new variant with frontmatter' },
            { name: 'saddle_get_global_tokens', desc: 'Read saddle.config.json tokens' },
          ].map(tool => (
            <div key={tool.name} style={{
              display: 'flex', gap: 8, alignItems: 'baseline',
              padding: '4px 0', fontSize: 12,
            }}>
              <span style={{ fontFamily: 'var(--font-code)', color: 'var(--color-primary)', fontWeight: 500, flexShrink: 0 }}>
                {tool.name}
              </span>
              <span style={{ color: 'var(--color-fg-muted)' }}>{tool.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
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
