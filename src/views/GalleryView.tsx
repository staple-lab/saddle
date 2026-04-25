// src/views/GalleryView.tsx
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ComponentCard } from '../components/ComponentCard';
import { ProjectSetupWizard } from '../components/ProjectSetupWizard';
import { loadProject } from '../lib/tauri';
import type { ProjectStructure } from '../types/component';
import styles from '../styles/GalleryView.module.css';

export function GalleryView() {
  const [project, setProject] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [projectRoot, setProjectRoot] = useState<string>('');

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
      setLoading(true);
      setError(null);
      setShowWizard(false);

      const loadedProject = await loadProject(projectRoot, componentPath, extensions);
      setProject(loadedProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setProjectRoot('');
  };

  if (!project && !loading) {
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

  console.log('Render - showWizard:', showWizard, 'projectRoot:', projectRoot);

  return (
    <>
      {showWizard && (
        <ProjectSetupWizard
          projectRoot={projectRoot}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
      {showWizard && <div style={{ position: 'fixed', top: 0, left: 0, background: 'red', color: 'white', padding: '10px', zIndex: 9999 }}>WIZARD SHOULD BE HERE</div>}
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>Component Gallery</h1>
          <p className={styles.subtitle}>
            {project?.components.length || 0} component{project?.components.length !== 1 ? 's' : ''}
          </p>
        </header>

        <div className={styles.grid}>
          {project?.components.map((component, idx) => (
            <ComponentCard key={idx} component={component} />
          ))}
        </div>
      </div>
    </>
  );
}
