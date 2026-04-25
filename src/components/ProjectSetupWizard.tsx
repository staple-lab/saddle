import { useState, useEffect } from 'react';
import { scanProjectDirectory } from '../lib/tauri';
import styles from './ProjectSetupWizard.module.css';

interface ProjectSetupWizardProps {
  projectRoot: string;
  onComplete: (componentPath: string, extensions: string[]) => void;
  onCancel: () => void;
}

export function ProjectSetupWizard({ projectRoot, onComplete, onCancel }: ProjectSetupWizardProps) {
  const [detectedPaths, setDetectedPaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [customPath, setCustomPath] = useState<string>('');
  const [extensions, setExtensions] = useState<string[]>(['.tsx', '.jsx']);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    detectComponentPaths();
  }, []);

  const detectComponentPaths = async () => {
    try {
      const files = await scanProjectDirectory(projectRoot);

      // Look for common component directory patterns
      const componentDirs = files
        .filter(f => f.is_dir && (
          f.name === 'components' ||
          f.path.includes('/components') ||
          f.path.includes('\\components')
        ))
        .map(f => f.path.replace(projectRoot, '').replace(/^[\/\\]/, ''));

      // Remove duplicates
      const unique = [...new Set(componentDirs)];
      setDetectedPaths(unique);

      if (unique.length > 0) {
        setSelectedPath(unique[0]);
      }
    } catch (err) {
      console.error('Error detecting paths:', err);
    } finally {
      setScanning(false);
    }
  };

  const toggleExtension = (ext: string) => {
    setExtensions(prev =>
      prev.includes(ext)
        ? prev.filter(e => e !== ext)
        : [...prev, ext]
    );
  };

  const handleComplete = () => {
    const finalPath = selectedPath === 'custom' ? customPath : selectedPath;
    if (finalPath && extensions.length > 0) {
      onComplete(finalPath, extensions);
    }
  };

  if (scanning) {
    return (
      <div className={styles.wizard}>
        <div className={styles.content}>
          <h2>Scanning project...</h2>
          <p>Looking for component directories</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <div className={styles.content}>
        <h2>Project Setup</h2>
        <p className={styles.projectPath}>Project: {projectRoot}</p>

        <div className={styles.section}>
          <h3>Where are your components located?</h3>
          {detectedPaths.length > 0 ? (
            <div className={styles.radioGroup}>
              {detectedPaths.map((path, idx) => (
                <label key={idx} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="componentPath"
                    value={path}
                    checked={selectedPath === path}
                    onChange={(e) => setSelectedPath(e.target.value)}
                  />
                  <span>{path}</span>
                </label>
              ))}
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="componentPath"
                  value="custom"
                  checked={selectedPath === 'custom'}
                  onChange={(e) => setSelectedPath(e.target.value)}
                />
                <span>Custom path...</span>
              </label>
            </div>
          ) : (
            <p className={styles.note}>No component directories detected. Enter a custom path below.</p>
          )}

          {(selectedPath === 'custom' || detectedPaths.length === 0) && (
            <div className={styles.customPathInput}>
              <input
                type="text"
                className={styles.input}
                placeholder="src/components"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
              <button
                type="button"
                className={styles.browseButton}
                onClick={async () => {
                  const { open } = await import('@tauri-apps/plugin-dialog');
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: 'Select Component Directory',
                    defaultPath: projectRoot,
                  });
                  if (selected) {
                    const relativePath = (selected as string).replace(projectRoot, '').replace(/^[\/\\]/, '');
                    setCustomPath(relativePath);
                  }
                }}
              >
                Browse...
              </button>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3>Component file extensions</h3>
          <div className={styles.checkboxGroup}>
            {['.tsx', '.jsx', '.ts', '.js'].map(ext => (
              <label key={ext} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={extensions.includes(ext)}
                  onChange={() => toggleExtension(ext)}
                />
                <span>{ext}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={onCancel} className={styles.cancelButton}>
            Cancel
          </button>
          <button
            onClick={handleComplete}
            className={styles.completeButton}
            disabled={(!selectedPath && !customPath) || extensions.length === 0}
          >
            Load Components
          </button>
        </div>
      </div>
    </div>
  );
}
