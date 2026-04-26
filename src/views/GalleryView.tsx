import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Sidebar, type AppView } from '../components/Sidebar';
import { ProjectSetupWizard } from '../components/ProjectSetupWizard';
import { TerminalFeed, type LogEntry } from '../components/TerminalFeed';
import { EditorView } from './EditorView';
import { ExportView } from './ExportView';
import { HierarchyView } from './HierarchyView';
import { DashboardView } from './DashboardView';
import { loadProject, loadGlobalConfig, watchProject } from '../lib/tauri';
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

  const addLog = (type: LogEntry['type'], message: string, source?: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), type, message, source }]);
  };

  const handleLoadProject = async () => {
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

  const handleWizardComplete = async (componentPath: string, extensions: string[]) => {
    try {
      setLoading(true);
      setError(null);
      setShowWizard(false);

      addLog('info', `Loading project from ${projectRoot}`, 'saddle');

      const loadedProject = await loadProject(projectRoot, componentPath, extensions);

      try {
        const config = await loadGlobalConfig(projectRoot);
        loadTokensFromConfig(config.tokens);
        addLog('success', 'Global tokens loaded from saddle.config.json', 'tokens');
      } catch {
        addLog('warning', 'No saddle.config.json found, using defaults', 'tokens');
      }

      setProject(loadedProject);
      addLog('success', `Loaded ${loadedProject.components.length} components`, 'saddle');

      // Start file watching
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

  // No project, no wizard - show landing
  if (!project && !loading && !showWizard) {
    return (
      <>
        <Sidebar
          project={null}
          onSelectComponent={() => {}}
          selectedComponent={null}
          onLoadProject={handleLoadProject}
          onConfigure={() => {}}
          onExport={() => {}}
          view="components"
          onViewChange={() => {}}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600, color: 'var(--color-fg)' }}>Welcome to Saddle</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-fg-muted)' }}>Load a component library to get started</p>
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
      </>
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

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>Loading project...</p>
      </div>
    );
  }

  const renderMainContent = () => {
    if (view === 'export' && project) {
      return <ExportView project={project} projectRoot={projectRoot} onBack={() => setView('components')} />;
    }
    if (view === 'hierarchy' && project) {
      return <HierarchyView project={project} projectRoot={projectRoot} onSelectComponent={(c) => { setSelectedComponent(c); setView('components'); }} />;
    }
    if (view === 'dashboard' && project) {
      return <DashboardView project={project} projectRoot={projectRoot} />;
    }
    if (selectedComponent) {
      return <EditorView component={selectedComponent} onBack={() => setSelectedComponent(null)} />;
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
    <>
      {showWizard && (
        <ProjectSetupWizard
          projectRoot={projectRoot}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
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
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {renderMainContent()}
        </div>

        {/* Terminal Feed (bottom panel) */}
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
      </div>
    </>
  );
}
