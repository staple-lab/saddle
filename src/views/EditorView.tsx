import { useState, useEffect } from 'react';
import type { Component } from '../types/component';
import { CodeEditor } from '../components/CodeEditor';
import { StyleEditor } from '../components/StyleEditor';
import { updateTokens } from '../lib/tauri';

interface EditorViewProps {
  component: Component;
  onBack: () => void;
}

type Tab = 'style' | 'code' | 'metadata';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style', label: 'Style' },
  { id: 'code', label: 'Code' },
  { id: 'metadata', label: 'Metadata' },
];

export function EditorView({ component, onBack }: EditorViewProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('style');
  const [localTokens, setLocalTokens] = useState<Record<string, string>>({});
  const selectedVariant = component.variants[selectedVariantIndex];

  // Initialize local tokens from variant
  useEffect(() => {
    if (selectedVariant.frontmatter?.tokens) {
      setLocalTokens(selectedVariant.frontmatter.tokens);
    }
  }, [selectedVariantIndex]);

  const handleTokenChange = async (tokenName: string, value: string) => {
    const newTokens = { ...localTokens, [tokenName]: value };
    setLocalTokens(newTokens);

    try {
      await updateTokens(selectedVariant.filePath, newTokens);
      console.log('✓ Tokens saved to', selectedVariant.filePath);
    } catch (err) {
      console.error('Failed to save tokens:', err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flex: 1 }}>
      {/* Center Stage */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)' }}>
        {/* Header */}
        <header
          style={{
            flexShrink: 0,
            padding: '18px 28px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-elev)',
            backdropFilter: 'saturate(180%) blur(18px)',
            WebkitBackdropFilter: 'saturate(180%) blur(18px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <button
              onClick={onBack}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                color: 'var(--color-primary)',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              ← Back
            </button>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--color-fg)' }}>
              {component.name}
            </h2>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
            {component.variants.length} variant{component.variants.length !== 1 ? 's' : ''}
          </div>
        </header>

        {/* Variant Selector */}
        {component.variants.length > 1 && (
          <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {component.variants.map((variant, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedVariantIndex(idx)}
                  style={{
                    padding: '6px 14px',
                    background: idx === selectedVariantIndex ? 'var(--color-primary)' : 'transparent',
                    color: idx === selectedVariantIndex ? '#ffffff' : 'var(--color-fg)',
                    border: '1px solid ' + (idx === selectedVariantIndex ? 'var(--color-primary)' : 'var(--color-border)'),
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  {variant.variantName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview Area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <div style={{ fontSize: 12, color: 'var(--color-fg-subtle)', fontStyle: 'italic' }}>
            Live preview coming soon
          </div>
        </div>
      </main>

      {/* Right Panel (Inspector) */}
      <aside
        style={{
          width: 360,
          flexShrink: 0,
          height: '100%',
          background: 'var(--color-surface-elev)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Tab Header */}
        <header style={{ padding: '12px 14px 0', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <nav style={{ display: 'flex', gap: 2 }}>
            {TABS.map((t) => {
              const isActive = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    color: isActive ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                    border: 'none',
                    borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    marginBottom: -1,
                    transition: 'color 120ms ease',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'style' && (
            <StyleEditor
              tokens={localTokens}
              onTokenChange={handleTokenChange}
            />
          )}

          {tab === 'code' && (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-code)' }}>
                {selectedVariant.filePath}
              </div>
              <div style={{ flex: 1, minHeight: 400 }}>
                <CodeEditor
                  value={selectedVariant.code}
                  language="typescript"
                  readOnly={false}
                  onChange={(value) => console.log('Code changed')}
                />
              </div>
            </div>
          )}

          {tab === 'metadata' && selectedVariant.frontmatter && (
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--color-fg-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
                Component Metadata
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--color-fg-muted)', marginBottom: 4 }}>Name</div>
                  <div style={{ fontSize: 12, color: 'var(--color-fg)' }}>{selectedVariant.frontmatter.name || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--color-fg-muted)', marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 12, color: 'var(--color-fg)', lineHeight: 1.5 }}>
                    {selectedVariant.frontmatter.description || 'N/A'}
                  </div>
                </div>
                {selectedVariant.frontmatter.usage && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-fg-muted)', marginBottom: 4 }}>Usage Guidelines</div>
                    <div style={{ fontSize: 12, color: 'var(--color-fg)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {selectedVariant.frontmatter.usage}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
