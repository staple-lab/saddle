import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Sidebar, type AppView, type TokenGroup } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { ProjectSetupWizard } from '../components/ProjectSetupWizard';
import { TerminalFeed, type LogEntry } from '../components/TerminalFeed';
import { EditorView } from './EditorView';
import { ExportView } from './ExportView';
import { HierarchyView } from './HierarchyView';
import { DashboardView } from './DashboardView';
import { TokensView } from './TokensView';
import { loadProject, loadGlobalConfig, watchProject, detectViteSetup, writeSaddleRuntime, spawnDevServer, killDevServer } from '../lib/tauri';
import type { DevServerStatus } from './DashboardView';
import { loadTokensFromConfig } from '../tokens/tokens';
import { listen } from '@tauri-apps/api/event';
import type { ProjectStructure, Component } from '../types/component';

function VerticalDivider({ isOpen, onToggle, logCount }: { isOpen: boolean; onToggle: () => void; logCount: number }) {
  return (
    <div style={{
      height: 28,
      padding: '0 12px',
      background: '#1d1d1f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      borderTop: '1px solid #3a3a3c',
    }}>
      <button
        onClick={onToggle}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#98989d',
          fontSize: 11,
          cursor: 'pointer',
          fontWeight: 500,
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{
          fontSize: 8,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 100ms',
          display: 'inline-block',
        }}>▲</span>
        Terminal
      </button>
      <span style={{ fontSize: 10, color: '#636366' }}>
        {logCount > 0 ? `${logCount} entries` : ''}
      </span>
    </div>
  );
}

export function GalleryView() {
  const [project, setProject] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [view, setView] = useState<AppView>('components');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devServerUrl, setDevServerUrl] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tokenGroup, setTokenGroup] = useState<TokenGroup>('all');
  const [devServerStatus, setDevServerStatus] = useState<DevServerStatus>({ kind: 'idle' });

  const addLog = (type: LogEntry['type'], message: string, source?: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), type, message, source }]);
  };

  useEffect(() => {
    const unlisten = listen('dev-server-exited', () => {
      setDevServerStatus({ kind: 'failed', error: 'Vite child process exited unexpectedly' });
      setLogs(prev => [...prev, { timestamp: new Date(), type: 'error', message: 'Vite child process exited', source: 'devserver' }]);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const startSaddleManagedVite = async (root: string) => {
    setDevServerStatus({ kind: 'spawning' });
    try {
      const setup = await detectViteSetup(root);
      if (!setup.has_vite || !setup.stories_path) {
        // Fall back to manual mode — leave dev server URL empty, let the user paste their own.
        setDevServerStatus({ kind: 'manual' });
        addLog('warning', 'Vite or stories file not detected; switch to manual dev server', 'devserver');
        return;
      }
      await writeSaddleRuntime(root, setup.vite_config_path);
      const url = await spawnDevServer(root);
      setDevServerUrl(url);
      setDevServerStatus({ kind: 'live', url });
      addLog('success', `Saddle-managed Vite live on ${url}`, 'devserver');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDevServerStatus({ kind: 'failed', error: msg });
      addLog('error', `Vite spawn failed: ${msg}`, 'devserver');
    }
  };

  const handleLoadProject = async () => {
    // Tear down any previous dev server before loading a new project.
    try { await killDevServer(); } catch {}
    setDevServerStatus({ kind: 'idle' });
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Root Directory',
      });

      if (!selectedPath) return;

      setProjectRoot(selectedPath as string);
      setShowWizard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file picker');
    }
  };

  const handleWizardComplete = async () => {
    try {
      setLoading(true);
      setError(null);
      setShowWizard(false);

      addLog('info', `Loading project from ${projectRoot}`, 'saddle');

      const loadedProject = await loadProject(projectRoot);

      try {
        const config = await loadGlobalConfig(projectRoot);
        loadTokensFromConfig(config.tokens);
        addLog('success', 'Global tokens loaded from saddle.config.json', 'tokens');
      } catch {
        addLog('warning', 'No saddle.config.json found, using defaults', 'tokens');
      }

      setProject(loadedProject);
      addLog('success', `Loaded ${loadedProject.components.length} components`, 'saddle');

      try {
        await watchProject(projectRoot);
        addLog('info', 'File watcher started', 'watcher');

        listen<{ paths: string[]; kind: string }>('file-changed', (event) => {
          const { paths, kind } = event.payload;
          const fileNames = paths.map(p => p.split('/').pop()).join(', ');
          addLog('info', `${kind}: ${fileNames}`, 'watcher');
        });
      } catch (err) {
        addLog('warning', `File watcher failed: ${err}`, 'watcher');
      }

      await startSaddleManagedVite(projectRoot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
      addLog('error', `Failed: ${err}`, 'saddle');
      setShowWizard(false);
    } finally {
      setLoading(false);
    }
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setProjectRoot('');
  };

  const renderMainContent = () => {
    if (loading) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <p style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>Loading project...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, color: 'var(--color-danger)' }}>Error</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-fg-muted)' }}>{error}</p>
            <button
              onClick={handleLoadProject}
              style={{ height: 34, padding: '0 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    if (!project) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: 'var(--color-fg)' }}>Welcome to Saddle</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--color-fg-muted)' }}>Load a component library to get started</p>

            <div style={{
              textAlign: 'left',
              padding: 16,
              marginBottom: 24,
              background: 'var(--color-surface, #1d1d1f)',
              border: '1px solid var(--color-border, #3a3a3c)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-fg-muted)',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--color-fg)', marginBottom: 8, fontSize: 13 }}>
                For Saddle to auto-spawn its dev server, your project needs:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li><code style={{ fontFamily: 'ui-monospace, monospace' }}>vite</code> in <code style={{ fontFamily: 'ui-monospace, monospace' }}>package.json</code> (devDependencies or dependencies)</li>
                <li>A stories file at one of: <code style={{ fontFamily: 'ui-monospace, monospace' }}>demo/stories.tsx</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>**/*.stories.tsx</code>, or <code style={{ fontFamily: 'ui-monospace, monospace' }}>demo/App.tsx</code> (with hash routing)</li>
                <li>Node on your PATH</li>
              </ul>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-fg-muted)' }}>
                Without these, Saddle falls back to manual mode — paste your own dev server URL.
              </div>
            </div>

            <button
              onClick={handleLoadProject}
              style={{
                height: 34,
                padding: '0 20px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              Load Project
            </button>
          </div>
        </div>
      );
    }
    if (view === 'export') {
      return <ExportView project={project} projectRoot={projectRoot} onBack={() => setView('components')} />;
    }
    if (view === 'hierarchy') {
      return <HierarchyView project={project} projectRoot={projectRoot} onSelectComponent={(c) => { setSelectedComponent(c); setView('components'); }} />;
    }
    if (view === 'settings') {
      return (
        <DashboardView
          project={project}
          projectRoot={projectRoot}
          onLoadProject={handleLoadProject}
          devServerStatus={devServerStatus}
          onRetryDevServer={() => startSaddleManagedVite(projectRoot)}
          onDevServerConnect={(url) => {
            setDevServerUrl(url);
            addLog('success', `Connected to dev server: ${url}`, 'devserver');
          }}
        />
      );
    }
    if (view === 'tokens') {
      return <TokensView groupFilter={tokenGroup} />;
    }
    if (selectedComponent) {
      return <EditorView component={selectedComponent} onBack={() => setSelectedComponent(null)} devServerUrl={devServerUrl || undefined} />;
    }
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, color: 'var(--color-fg)' }}>Select a Component</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-fg-muted)' }}>Choose from the sidebar to view and edit</p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {showWizard && (
        <ProjectSetupWizard
          projectRoot={projectRoot}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
      <TopBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {project && (
          <Sidebar
            project={project}
            onSelectComponent={(comp) => {
              setSelectedComponent(comp);
              setView('components');
            }}
            selectedComponent={selectedComponent}
            onLoadProject={handleLoadProject}
            onConfigure={() => setShowWizard(true)}
            onExport={() => { setView('export'); setSelectedComponent(null); }}
            view={view}
            onViewChange={(v) => { setView(v); if (v !== 'components') setSelectedComponent(null); }}
            tokenGroup={tokenGroup}
            onTokenGroupChange={setTokenGroup}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {renderMainContent()}
          </div>
          {project && (
            <>
              <VerticalDivider
                isOpen={terminalOpen}
                onToggle={() => setTerminalOpen(!terminalOpen)}
                logCount={logs.length}
              />
              {terminalOpen && (
                <div style={{ height: 200, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <TerminalFeed
                    logs={logs}
                    onCommand={(cmd) => addLog('ai', `> ${cmd}`, 'user')}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
