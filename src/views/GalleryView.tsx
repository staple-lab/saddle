// src/views/GalleryView.tsx
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ComponentCard } from '../components/ComponentCard';
import { loadProject } from '../lib/tauri';
import type { ProjectStructure } from '../types/component';
import styles from '../styles/GalleryView.module.css';

export function GalleryView() {
  const [project, setProject] = useState<ProjectStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Component Library Root Directory',
      });

      if (!selectedPath) {
        setLoading(false);
        return;
      }

      const loadedProject = await loadProject(selectedPath as string);
      setProject(loadedProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
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

  return (
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
  );
}
