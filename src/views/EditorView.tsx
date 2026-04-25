import { useState } from 'react';
import type { Component } from '../types/component';
import styles from '../styles/EditorView.module.css';

interface EditorViewProps {
  component: Component;
  onBack: () => void;
}

export function EditorView({ component, onBack }: EditorViewProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const selectedVariant = component.variants[selectedVariantIndex];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back to Gallery
        </button>
        <div className={styles.headerContent}>
          <h1>{component.name}</h1>
          <p className={styles.subtitle}>{component.variants.length} variants</p>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Left: Preview Panel */}
        <div className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <h2>Preview</h2>
          </div>
          <div className={styles.previewContent}>
            <p className={styles.placeholder}>Live preview coming soon</p>
          </div>
        </div>

        {/* Right: Tabbed Panels */}
        <div className={styles.rightPanel}>
          {/* Variant Selector */}
          <div className={styles.variantSelector}>
            {component.variants.map((variant, idx) => (
              <button
                key={idx}
                className={`${styles.variantTab} ${idx === selectedVariantIndex ? styles.active : ''}`}
                onClick={() => setSelectedVariantIndex(idx)}
              >
                {variant.variantName}
              </button>
            ))}
          </div>

          {/* Code Display */}
          <div className={styles.codePanel}>
            <div className={styles.panelHeader}>
              <h3>Code</h3>
              <span className={styles.filePath}>{selectedVariant.filePath}</span>
            </div>
            <pre className={styles.codeBlock}>
              <code>{selectedVariant.code}</code>
            </pre>
          </div>

          {/* Frontmatter Display */}
          {selectedVariant.frontmatter && (
            <div className={styles.metadataPanel}>
              <div className={styles.panelHeader}>
                <h3>Metadata</h3>
              </div>
              <div className={styles.metadata}>
                <div className={styles.metadataItem}>
                  <strong>Name:</strong> {selectedVariant.frontmatter.name || 'N/A'}
                </div>
                <div className={styles.metadataItem}>
                  <strong>Description:</strong> {selectedVariant.frontmatter.description || 'N/A'}
                </div>
                {selectedVariant.frontmatter.tokens && (
                  <div className={styles.metadataItem}>
                    <strong>Tokens:</strong>
                    <pre>{JSON.stringify(selectedVariant.frontmatter.tokens, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
