// src/views/GalleryView.tsx
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ComponentCard } from '../components/ComponentCard';
import { ProjectSetupWizard } from '../components/ProjectSetupWizard';
import { EditorView } from './EditorView';
import { loadProject } from '../lib/tauri';
import type { ProjectStructure, Component } from '../types/component';
import styles from '../styles/GalleryView.module.css';

export function GalleryView() {
  const [project, setProject] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [projectRoot, setProjectRoot] = useState<string>('');
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

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
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>Error</h2>
          <p className={styles.errorText}>{error}</p>
          <button onClick={handleLoadProject} className={styles.button}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  // If a component is selected, show the editor view
  if (selectedComponent) {
    return (
      <EditorView
        component={selectedComponent}
        onBack={() => setSelectedComponent(null)}
      />
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
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1>Component Gallery</h1>
              <p className={styles.subtitle}>
                {project?.components.length || 0} component{project?.components.length !== 1 ? 's' : ''}
              </p>
            </div>
            {project && (
              <button onClick={() => { setShowWizard(true); }} className={styles.settingsButton}>
                Configure Project
              </button>
            )}
          </div>
        </header>

        <div className={styles.grid}>
          {project?.components.map((component, idx) => {
            console.log('Rendering component card:', component.name, component);
            return (
              <ComponentCard
                key={idx}
                component={component}
                onClick={() => {
                  console.log('Component clicked:', component.name);
                  setSelectedComponent(component);
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
