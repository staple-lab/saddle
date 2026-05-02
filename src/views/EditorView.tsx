import { useState, useEffect, useRef } from 'react';
import type { Component } from '../types/component';
import { ComponentDropdown } from '../components/ComponentDropdown';
import { CodeEditor } from '../components/CodeEditor';
import { StyleEditor } from '../components/StyleEditor';
import { ComponentPreview, type ComponentPreviewHandle } from '../components/ComponentPreview';
import { AIGuidanceEditor } from '../components/AIGuidanceEditor';
import { ResizablePanel } from '../components/ResizablePanel';
import { updateTokens, writeComponentFile, readComponentFile } from '../lib/tauri';
import { MarkdownEditor } from '../components/MarkdownEditor';

interface EditorViewProps {
  components: Component[];
  component: Component;
  onSelectComponent: (component: Component) => void;
  onBack: () => void;
  devServerUrl?: string;
}

type Tab = 'doc' | 'style' | 'code' | 'ai' | 'metadata';

const TABS: { id: Tab; label: string }[] = [
  { id: 'doc', label: 'Doc' },
  { id: 'style', label: 'Style' },
  { id: 'code', label: 'Code' },
  { id: 'ai', label: 'AI' },
  { id: 'metadata', label: 'Metadata' },
];

/**
 * Clone the active variant's full source for a new variant filename.
 * If the source has YAML frontmatter, mutate the `name` and (when default-shaped)
 * `description` fields so the new variant shows up correctly in Saddle's parser.
 * If there's no frontmatter (real-world libraries like Globex), copy the body verbatim.
 */
function cloneVariantSource(originalSource: string, componentName: string, variantName: string): string {
  const fmMatch = originalSource.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return originalSource;

  const [, yaml, body] = fmMatch;
  const lines = yaml.split('\n');

  const out: string[] = [];
  let nameSet = false;
  let descSet = false;
  for (const line of lines) {
    if (!nameSet && /^name\s*:/.test(line)) {
      out.push(`name: ${componentName} ${variantName}`);
      nameSet = true;
      continue;
    }
    // Only auto-rewrite auto-generated descriptions like "Foo Bar variant".
    // Leave hand-written descriptions alone.
    if (!descSet && /^description\s*:/.test(line)) {
      const descValue = line.replace(/^description\s*:\s*/, '');
      const looksAutoGen = /\bvariant\b\s*$/i.test(descValue) && /^[A-Za-z]/.test(descValue);
      if (looksAutoGen) {
        out.push(`description: ${componentName} ${variantName} variant`);
        descSet = true;
        continue;
      }
    }
    out.push(line);
  }
  if (!nameSet) out.unshift(`name: ${componentName} ${variantName}`);

  return `---\n${out.join('\n')}\n---\n${body}`;
}

export function EditorView({ components, component, onSelectComponent, devServerUrl }: EditorViewProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('doc');
  const [localTokens, setLocalTokens] = useState<Record<string, string>>({});
  const [selectedElementPath, setSelectedElementPath] = useState<number[] | null>(null);
  const [selectedElementStyles, setSelectedElementStyles] = useState<Record<string, string> | null>(null);
  const previewRef = useRef<ComponentPreviewHandle | null>(null);
  const [newVariantOpen, setNewVariantOpen] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantBusy, setNewVariantBusy] = useState(false);
  const [newVariantError, setNewVariantError] = useState<string | null>(null);
  const selectedVariant = component.variants[selectedVariantIndex];

  useEffect(() => {
    const t = selectedVariant.frontmatter?.tokens || {};
    console.log('INIT localTokens from frontmatter:', t);
    setLocalTokens(t);
  }, [selectedVariantIndex]);

  useEffect(() => {
    setSelectedVariantIndex(0);
  }, [component.directory]);

  // camelCase → kebab-case so the visible value in the field matches what the bridge
  // applies to the live element.
  const toKebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

  const clearSelection = () => {
    if (selectedElementPath) {
      previewRef.current?.setElementState(selectedElementPath, 'default');
    }
    setSelectedElementPath(null);
    setSelectedElementStyles(null);
    setTab('doc');
  };

  const submitNewVariant = async () => {
    const slug = newVariantName.trim().replace(/[^a-zA-Z0-9]+/g, '');
    if (!slug) {
      setNewVariantError('Use letters or numbers.');
      return;
    }
    setNewVariantBusy(true);
    setNewVariantError(null);
    const newPath = `${component.directory}/${component.name}.${slug}.tsx`;
    console.log('[clone-variant] writing', { from: selectedVariant.filePath, to: newPath });
    try {
      const original = await readComponentFile(selectedVariant.filePath);
      const cloned = cloneVariantSource(original, component.name, slug);
      await writeComponentFile(newPath, cloned);
      console.log('[clone-variant] wrote', newPath);
      setNewVariantOpen(false);
    } catch (err) {
      console.error('[clone-variant] failed', err);
      setNewVariantError(String(err));
    } finally {
      setNewVariantBusy(false);
    }
  };

  // Esc closes the new-variant modal first; otherwise deselects the element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (newVariantOpen) {
        if (!newVariantBusy) setNewVariantOpen(false);
        return;
      }
      if (selectedElementPath) clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementPath, newVariantOpen, newVariantBusy]);

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
        <div style={{
          height: 38, padding: '0 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--color-border)',
          background: '#fff',
          flexShrink: 0,
        }}>
          <ComponentDropdown
            components={components}
            selectedComponent={component}
            selectedVariant={selectedVariant}
            onSelect={(comp, variant) => {
              const idx = comp.variants.findIndex((v) => v.filePath === variant.filePath);
              if (comp.directory !== component.directory) {
                onSelectComponent(comp);
                // After parent re-renders with new component, the useEffect above resets index to 0.
                // We don't need to call setSelectedVariantIndex here in the cross-component case.
              } else if (idx >= 0) {
                setSelectedVariantIndex(idx);
              }
            }}
          />
        </div>

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
            onNewVariant={() => {
              console.log('[new-variant] handler fired in EditorView, opening modal');
              setNewVariantName('');
              setNewVariantError(null);
              setNewVariantOpen(true);
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

      {/* Right Panel - Inspector (resizable). Always visible. */}
      <ResizablePanel defaultWidth={480} minWidth={320} maxWidth={720} side="right">
        {/* Component / variant header */}
        <div
          style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            title={component.name}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {component.name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)', flexShrink: 0 }}>
            · {selectedVariant.variantName}
          </span>
        </div>

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
                type="button"
                onClick={(e) => { e.stopPropagation(); setTab(t.id); }}
                style={{
                  height: 36,
                  padding: '0 12px',
                  background: 'transparent',
                  color: isActive ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? 'var(--color-accent)' : 'transparent'}`,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
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
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {tab === 'doc' && (
            <MarkdownEditor
              filePath={selectedVariant.docPath}
              initialContent={selectedVariant.docContent}
              onSave={async (path, content) => {
                await writeComponentFile(path, content);
              }}
            />
          )}

          {tab === 'style' && (
            selectedElementPath ? (
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
            ) : (
              <EmptyTab message="Select an element in the preview to inspect its styles." />
            )
          )}

          {tab === 'code' && (
            selectedElementPath ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
                  {selectedVariant.filePath.split('/').pop()}
                </div>
                <div style={{ flex: 1, minHeight: 400 }}>
                  <CodeEditor value={selectedVariant.code} language="typescript" readOnly={false} onChange={() => {}} />
                </div>
              </div>
            ) : (
              <EmptyTab message="Select an element in the preview to view its source." />
            )
          )}

          {tab === 'ai' && (
            selectedElementPath ? (
              <AIGuidanceEditor
                frontmatter={selectedVariant.frontmatter || {}}
                onUpdate={(field, value) => {
                  console.log(`AI guidance: ${field} = ${value}`);
                }}
              />
            ) : (
              <EmptyTab message="Select an element in the preview to edit AI guidance." />
            )
          )}

          {tab === 'metadata' && (
            selectedElementPath && selectedVariant.frontmatter ? (
              <MetadataPanel frontmatter={selectedVariant.frontmatter} />
            ) : (
              <EmptyTab message="Select an element in the preview to view metadata." />
            )
          )}
        </div>
      </ResizablePanel>

      {newVariantOpen && (
        <div
          onClick={() => !newVariantBusy && setNewVariantOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 24px 60px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.08)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-fg)' }}>
              New variant
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
              Clones <strong style={{ color: 'var(--color-fg)' }}>{component.name}.{selectedVariant.variantName}</strong>. Letters and numbers only.
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Ghost"
              value={newVariantName}
              onChange={(e) => { setNewVariantName(e.target.value); setNewVariantError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submitNewVariant(); }
                else if (e.key === 'Escape') { e.preventDefault(); setNewVariantOpen(false); }
              }}
              disabled={newVariantBusy}
              style={{
                height: 34,
                padding: '0 10px',
                fontSize: 13,
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {newVariantError && (
              <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{newVariantError}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setNewVariantOpen(false)}
                disabled={newVariantBusy}
                style={{
                  height: 30,
                  padding: '0 14px',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  color: 'var(--color-fg)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: newVariantBusy ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewVariant}
                disabled={newVariantBusy || !newVariantName.trim()}
                style={{
                  height: 30,
                  padding: '0 14px',
                  background: 'var(--color-fg)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: newVariantBusy || !newVariantName.trim() ? 'default' : 'pointer',
                  opacity: newVariantBusy || !newVariantName.trim() ? 0.55 : 1,
                }}
              >
                {newVariantBusy ? 'Creating…' : 'Clone variant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div style={{ padding: 24, fontSize: 12, color: 'var(--color-fg-muted)', textAlign: 'center' }}>
      {message}
    </div>
  );
}

function MetadataPanel({ frontmatter }: { frontmatter: any }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {frontmatter.name && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Name</div>
            <div style={{ fontSize: 13, color: 'var(--color-fg)' }}>{frontmatter.name}</div>
          </div>
        )}
        {frontmatter.description && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Description</div>
            <div style={{ fontSize: 13, color: 'var(--color-fg)', lineHeight: 1.5 }}>{frontmatter.description}</div>
          </div>
        )}
        {frontmatter.usage && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Usage</div>
            <div style={{ fontSize: 13, color: 'var(--color-fg)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{frontmatter.usage}</div>
          </div>
        )}
      </div>
    </div>
  );
}
