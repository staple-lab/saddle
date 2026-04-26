import { useState, useEffect } from 'react';
import type { Component } from '../types/component';
import { CodeEditor } from '../components/CodeEditor';
import { StyleEditor } from '../components/StyleEditor';
import { ComponentPreview } from '../components/ComponentPreview';
import { AIGuidanceEditor } from '../components/AIGuidanceEditor';
import { ResizablePanel } from '../components/ResizablePanel';
import { updateTokens, createVariant } from '../lib/tauri';

interface EditorViewProps {
  component: Component;
  onBack: () => void;
}

type Tab = 'style' | 'code' | 'ai' | 'metadata';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style', label: 'Style' },
  { id: 'code', label: 'Code' },
  { id: 'ai', label: 'AI' },
  { id: 'metadata', label: 'Metadata' },
];

export function EditorView({ component }: EditorViewProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('style');
  const [localTokens, setLocalTokens] = useState<Record<string, string>>({});
  const selectedVariant = component.variants[selectedVariantIndex];

  useEffect(() => {
    if (selectedVariant.frontmatter?.tokens) {
      setLocalTokens(selectedVariant.frontmatter.tokens);
    }
  }, [selectedVariantIndex]);

  const handleTokenChange = async (tokenName: string, value: string) => {
    // Handle removal
    if (tokenName.startsWith('__remove__')) {
      const propToRemove = tokenName.replace('__remove__', '');
      const newTokens = { ...localTokens };
      delete newTokens[propToRemove];
      setLocalTokens(newTokens);
      try {
        await updateTokens(selectedVariant.filePath, newTokens);
      } catch (err) {
        console.error('Failed to save tokens:', err);
      }
      return;
    }

    const newTokens = { ...localTokens, [tokenName]: value };
    setLocalTokens(newTokens);
    try {
      await updateTokens(selectedVariant.filePath, newTokens);
    } catch (err) {
      console.error('Failed to save tokens:', err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', flex: 1, overflow: 'hidden' }}>
      {/* Center Stage - Preview */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)' }}>
        {/* Variant bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--color-border)',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {component.variants.map((variant, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedVariantIndex(idx)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  background: idx === selectedVariantIndex ? 'var(--color-primary)' : '#ffffff',
                  color: idx === selectedVariantIndex ? '#ffffff' : 'var(--color-fg)',
                  border: idx === selectedVariantIndex ? 'none' : '1px solid var(--color-border)',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 100ms ease',
                }}
              >
                {variant.variantName}
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              const name = prompt('Variant name (e.g. Ghost, Outlined):');
              if (!name) return;
              try {
                await createVariant(component.directory, component.name, name);
                alert(`Created ${component.name}.${name}.tsx - reload project to see it`);
              } catch (err) {
                alert(`Failed: ${err}`);
              }
            }}
            style={{
              height: 28, padding: '0 10px',
              background: '#ffffff', color: 'var(--color-fg)',
              border: '1px solid var(--color-border)', borderRadius: 6,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              boxShadow: 'var(--elevation-1)',
            }}
          >
            + New Variant
          </button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, padding: 20 }}>
          <ComponentPreview
            code={selectedVariant.code}
            frontmatter={selectedVariant.frontmatter}
            liveTokens={localTokens}
          />
        </div>
      </main>

      {/* Right Panel - Inspector (resizable) */}
      <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={520} side="right">
        {/* Tabs */}
        <header style={{
          background: '#ffffff',
          padding: '0 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          display: 'flex',
          gap: 0,
        }}>
          {TABS.map((t) => {
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  height: 40,
                  padding: '0 12px',
                  background: 'transparent',
                  color: isActive ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'color 100ms ease',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </header>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'style' && (
            <StyleEditor tokens={localTokens} code={selectedVariant.code} onTokenChange={handleTokenChange} />
          )}

          {tab === 'code' && (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
                {selectedVariant.filePath.split('/').pop()}
              </div>
              <div style={{ flex: 1, minHeight: 400 }}>
                <CodeEditor
                  value={selectedVariant.code}
                  language="typescript"
                  readOnly={false}
                  onChange={() => {}}
                />
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <AIGuidanceEditor
              frontmatter={selectedVariant.frontmatter || {}}
              onUpdate={(field, value) => {
                console.log(`AI guidance: ${field} = ${value}`);
              }}
            />
          )}

          {tab === 'metadata' && selectedVariant.frontmatter && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedVariant.frontmatter.name && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Name</div>
                    <div style={{ fontSize: 13, color: 'var(--color-fg)' }}>{selectedVariant.frontmatter.name}</div>
                  </div>
                )}
                {selectedVariant.frontmatter.description && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Description</div>
                    <div style={{ fontSize: 13, color: 'var(--color-fg)', lineHeight: 1.5 }}>{selectedVariant.frontmatter.description}</div>
                  </div>
                )}
                {selectedVariant.frontmatter.usage && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Usage</div>
                    <div style={{ fontSize: 13, color: 'var(--color-fg)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selectedVariant.frontmatter.usage}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ResizablePanel>
    </div>
  );
}
