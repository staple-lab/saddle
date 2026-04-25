import { useState } from 'react';
import type { Component } from '../types/component';
import { CodeEditor } from '../components/CodeEditor';
import { StyleEditor } from '../components/StyleEditor';
import styles from '../styles/EditorView.module.css';

interface EditorViewProps {
  component: Component;
  onBack: () => void;
}

export function EditorView({ component, onBack }: EditorViewProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'style' | 'code' | 'metadata'>('style');
  const selectedVariant = component.variants[selectedVariantIndex];

  const handleTokenChange = (tokenName: string, value: string) => {
    console.log('Token changed:', tokenName, value);
    // TODO: Update frontmatter and regenerate CSS
  };

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

          {/* Tab Selector */}
          <div className={styles.tabSelector}>
            <button
              className={`${styles.tab} ${activeTab === 'style' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('style')}
            >
              Style Editor
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'code' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('code')}
            >
              Code
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'metadata' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('metadata')}
            >
              Metadata
            </button>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === 'style' && (
              <div className={styles.stylePanel}>
                <StyleEditor
                  tokens={selectedVariant.frontmatter?.tokens || {}}
                  onTokenChange={handleTokenChange}
                />
              </div>
            )}

            {activeTab === 'code' && (
              <div className={styles.codePanel}>
                <div className={styles.panelHeader}>
                  <span className={styles.filePath}>{selectedVariant.filePath}</span>
                </div>
                <CodeEditor
                  value={selectedVariant.code}
                  language="typescript"
                  readOnly={false}
                  onChange={(value) => console.log('Code changed:', value?.substring(0, 50))}
                />
              </div>
            )}

            {activeTab === 'metadata' && selectedVariant.frontmatter && (
              <div className={styles.metadataPanel}>
                <div className={styles.metadata}>
                  <div className={styles.metadataItem}>
                    <strong>Name:</strong> {selectedVariant.frontmatter.name || 'N/A'}
                  </div>
                  <div className={styles.metadataItem}>
                    <strong>Description:</strong> {selectedVariant.frontmatter.description || 'N/A'}
                  </div>
                  {selectedVariant.frontmatter.usage && (
                    <div className={styles.metadataItem}>
                      <strong>Usage:</strong>
                      <pre>{selectedVariant.frontmatter.usage}</pre>
                    </div>
                  )}
                  {selectedVariant.frontmatter.props && (
                    <div className={styles.metadataItem}>
                      <strong>Props:</strong>
                      <pre>{JSON.stringify(selectedVariant.frontmatter.props, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
