import { useState, useEffect, useRef } from 'react';
import type { Component } from '../types/component';
import { CodeEditor } from '../components/CodeEditor';
import { StyleEditor } from '../components/StyleEditor';
import { ComponentPreview, type ComponentPreviewHandle } from '../components/ComponentPreview';
import { AIGuidanceEditor } from '../components/AIGuidanceEditor';
import { ResizablePanel } from '../components/ResizablePanel';
import { updateTokens, createVariant } from '../lib/tauri';

interface EditorViewProps {
  component: Component;
  onBack: () => void;
  devServerUrl?: string;
}

type Tab = 'style' | 'code' | 'ai' | 'metadata';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style', label: 'Style' },
  { id: 'code', label: 'Code' },
  { id: 'ai', label: 'AI' },
  { id: 'metadata', label: 'Metadata' },
];

export function EditorView({ component, devServerUrl }: EditorViewProps) {
  const [selectedVariantIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('style');
  const [localTokens, setLocalTokens] = useState<Record<string, string>>({});
  const [selectedElementPath, setSelectedElementPath] = useState<number[] | null>(null);
  const [selectedElementStyles, setSelectedElementStyles] = useState<Record<string, string> | null>(null);
  const previewRef = useRef<ComponentPreviewHandle | null>(null);
  const selectedVariant = component.variants[selectedVariantIndex];

  useEffect(() => {
    const t = selectedVariant.frontmatter?.tokens || {};
    console.log('INIT localTokens from frontmatter:', t);
    setLocalTokens(t);
  }, [selectedVariantIndex]);

  // camelCase → kebab-case so the visible value in the field matches what the bridge
  // applies to the live element.
  const toKebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

  const clearSelection = () => {
    if (selectedElementPath) {
      previewRef.current?.setElementState(selectedElementPath, 'default');
    }
    setSelectedElementPath(null);
    setSelectedElementStyles(null);
  };

  // Esc to deselect the current element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedElementPath) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementPath]);

  const handleTokenChange = async (tokenName: string, value: string) => {
    // Handle removal
    if (tokenName.startsWith('__remove__')) {
      const propToRemove = tokenName.replace('__remove__', '');
      const newTokens = { ...localTokens };
      delete newTokens[propToRemove];
      setLocalTokens(newTokens);
      if (selectedElementPath) {
        previewRef.current?.setElementStyles(selectedElementPath, { [propToRemove]: '' });
        // Reflect the cleared value so the field reads empty.
        setSelectedElementStyles((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          delete next[propToRemove];
          delete next[toKebab(propToRemove)];
          return next;
        });
      }
      try {
        await updateTokens(selectedVariant.filePath, newTokens);
      } catch (err) {
        console.error('Failed to save tokens:', err);
      }
      return;
    }

    const newTokens = { ...localTokens, [tokenName]: value };
    setLocalTokens(newTokens);

    if (selectedElementPath) {
      previewRef.current?.setElementStyles(selectedElementPath, { [tokenName]: value });
      // Mirror the edit into selectedElementStyles so the StyleEditor field shows the new value
      // (it reads from selectedElementStyles when an element is selected).
      setSelectedElementStyles((prev) => ({
        ...(prev ?? {}),
        [tokenName]: value,
        [toKebab(tokenName)]: value,
      }));
    }

    try {
      await updateTokens(selectedVariant.filePath, newTokens);
    } catch (err) {
      console.error('Failed to save tokens:', err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', flex: 1, overflow: 'hidden' }}>

      {/* Center Stage - Preview */}
      <main
        onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
        style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)', overflow: 'hidden' }}
      >

        {/* Preview */}
        <div
          onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
          style={{ flex: 1, minHeight: 0, padding: 20, display: 'flex', flexDirection: 'column' }}
        >
          <ComponentPreview
            ref={previewRef}
            code={selectedVariant.code}
            frontmatter={selectedVariant.frontmatter}
            liveTokens={localTokens}
            devServerUrl={devServerUrl}
            componentName={component.name}
            selectedPath={selectedElementPath}
            onCanvasClick={clearSelection}
            onNewVariant={async () => {
              const name = prompt('Variant name (e.g. Ghost, Outlined):');
              if (!name) return;
              try {
                await createVariant(component.directory, component.name, name);
                alert(`Created ${component.name}.${name}.tsx - reload project to see it`);
              } catch (err) {
                alert(`Failed: ${err}`);
              }
            }}
            onElementSelected={(path, styles) => {
              // Bridge sends kebab-case (from getComputedStyle); StyleEditor uses camelCase.
              // Store both forms so reads & edits both work.
              const merged: Record<string, string> = {};
              for (const [k, v] of Object.entries(styles)) {
                merged[k] = v;
                merged[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
              }
              setSelectedElementPath(path);
              setSelectedElementStyles(merged);
              setTab('style');
            }}
          />
        </div>
      </main>

      {/* Right Panel - Inspector (resizable). Only shows when an element is selected. */}
      {selectedElementPath && (
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
            <StyleEditor
              tokens={selectedElementStyles ?? localTokens}
              code={selectedVariant.code}
              onTokenChange={handleTokenChange}
              onStateChange={(state) => {
                if (selectedElementPath) {
                  previewRef.current?.setElementState(selectedElementPath, state);
                }
              }}
            />
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
      )}
    </div>
  );
}
