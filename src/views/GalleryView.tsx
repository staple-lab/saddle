// src/views/GalleryView.tsx
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Sidebar } from '../components/Sidebar';
import { ProjectSetupWizard } from '../components/ProjectSetupWizard';
import { EditorView } from './EditorView';
import { ExportView } from './ExportView';
import { loadProject, loadGlobalConfig } from '../lib/tauri';
import { loadTokensFromConfig } from '../tokens/tokens';
import type { ProjectStructure, Component } from '../types/component';
import styles from '../styles/GalleryView.module.css';

export function GalleryView() {
  const [project, setProject] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [view, setView] = useState<'components' | 'export'>('components');

  const handleLoadProject = async () => {
    try {
      console.log('Opening file picker...');
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Root Directory',
      });

      console.log('Selected path:', selectedPath);

      if (!selectedPath) {
        console.log('No path selected');
        return;
      }

      setProjectRoot(selectedPath as string);
      setShowWizard(true);
      console.log('Wizard should be visible now');
    } catch (err) {
      console.error('Error opening file picker:', err);
      setError(err instanceof Error ? err.message : 'Failed to open file picker');
    }
  };

  const handleWizardComplete = async (componentPath: string, extensions: string[]) => {
    try {
      console.log('=== handleWizardComplete ===');
      console.log('Component path:', componentPath);
      console.log('Extensions:', extensions);

      setLoading(true);
      setError(null);
      setShowWizard(false);

      console.log('Loading project...');
      const loadedProject = await loadProject(projectRoot, componentPath, extensions);
      console.log('Project loaded:', loadedProject);

      // Load global tokens
      try {
        const config = await loadGlobalConfig(projectRoot);
        loadTokensFromConfig(config.tokens);
        console.log('✓ Global tokens loaded from saddle.config.json');
      } catch (err) {
        console.warn('No saddle.config.json found, using default tokens');
      }

      setProject(loadedProject);
      console.log('State updated');
    } catch (err) {
      console.error('Error loading project:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project');
      setShowWizard(false);
    } finally {
      setLoading(false);
    }
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setProjectRoot('');
  };

  if (!project && !loading && !showWizard) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>No Project Loaded</h2>
          <p>Select a component library to get started</p>
          <button onClick={handleLoadProject} className={styles.button}>
            Load Project
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '100%', width: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: 'var(--color-danger)' }}>Error</h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-fg-muted)' }}>{error}</p>
            <button
              onClick={handleLoadProject}
              style={{
                padding: '8px 16px',
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
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '100%', width: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <p style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>Loading project...</p>
        </div>
      </div>
    );
  }

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
        onExport={() => {
          setView('export');
          setSelectedComponent(null);
        }}
        view={view}
      />
      {view === 'export' && project ? (
        <ExportView
          project={project}
          onBack={() => setView('components')}
        />
      ) : selectedComponent ? (
        <EditorView
          component={selectedComponent}
          onBack={() => setSelectedComponent(null)}
        />
      ) : (
        <div className={styles.emptyStage}>
          <div className={styles.emptyContent}>
            {!project ? (
              <>
                <h2>No Project Loaded</h2>
                <p>Select a component library to get started</p>
                <button onClick={handleLoadProject} className={styles.button}>
                  Load Project
                </button>
              </>
            ) : (
              <>
                <h2>Select a Component</h2>
                <p>Choose a component from the sidebar to view and edit</p>
                {project && (
                  <button onClick={() => { setShowWizard(true); }} className={styles.settingsButton}>
                    Configure Project
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
