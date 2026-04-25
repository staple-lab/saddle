import { useState } from 'react';
import type { ProjectStructure } from '../types/component';
import { buildPackage, analyzeDuplicates, analyzeStructure, type DuplicateToken, type StructureDuplicate } from '../lib/tauri';

interface ExportViewProps {
  project: ProjectStructure;
  projectRoot: string;
  onBack: () => void;
}

export function ExportView({ project, projectRoot, onBack }: ExportViewProps) {
  const [exporting, setExporting] = useState(false);
  const [packageName, setPackageName] = useState('@myorg/components');
  const [result, setResult] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateToken[]>([]);
  const [structureDups, setStructureDups] = useState<StructureDuplicate[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const componentsJson = JSON.stringify(project.components);
      const distPath = await buildPackage(projectRoot, packageName, componentsJson);
      setResult(`Package built to ${distPath}`);
    } catch (err) {
      setResult(`Error: ${err}`);
    }
    setExporting(false);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const json = JSON.stringify(project.components);
      const [tokenDups, structDups] = await Promise.all([
        analyzeDuplicates(json),
        analyzeStructure(json),
      ]);
      setDuplicates(tokenDups);
      setStructureDups(structDups);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setAnalyzing(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)' }}>
      <header style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border)',
        background: '#ffffff',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-fg)' }}>Export & Analyze</h2>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Build Package */}
          <Card title="Build npm Package">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-fg)', marginBottom: 4 }}>Package Name</div>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  style={{
                    width: '100%', height: 28, padding: '0 8px',
                    fontSize: 12, fontFamily: 'var(--font-code)',
                    border: '1px solid var(--color-border)', borderRadius: 6,
                    background: '#ffffff', color: 'var(--color-fg)',
                  }}
                />
              </div>
              <Row label="Output" value={`${projectRoot}/dist`} mono />
              <Row label="Components" value={`${project.components.length}`} />
              <Row label="Variants" value={`${project.components.reduce((a, c) => a + c.variants.length, 0)}`} />

              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  height: 34, padding: '0 20px',
                  background: 'var(--color-primary)', color: '#ffffff',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 500,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  opacity: exporting ? 0.6 : 1,
                  boxShadow: 'var(--elevation-1)',
                }}
              >
                {exporting ? 'Building...' : 'Build Package'}
              </button>

              {result && (
                <div style={{
                  padding: 12, borderRadius: 6,
                  background: result.startsWith('Error') ? '#FFF1F0' : '#F0FFF4',
                  border: `1px solid ${result.startsWith('Error') ? '#FFA39E' : '#B7EB8F'}`,
                  fontSize: 12, color: 'var(--color-fg)',
                }}>
                  {result}
                </div>
              )}
            </div>
          </Card>

          {/* Deduplication Analysis */}
          <Card title="Deduplication Analysis">
            <p style={{ fontSize: 12, color: 'var(--color-fg-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>
              Scan all components for duplicate token values and repeated structures that could be extracted into shared tokens.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{
                height: 28, padding: '0 12px',
                background: '#ffffff', color: 'var(--color-fg)',
                border: '1px solid var(--color-border)', borderRadius: 6,
                fontSize: 12, fontWeight: 500,
                cursor: analyzing ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </button>

            {duplicates.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)' }}>
                  Token Duplicates ({duplicates.length})
                </div>
                {duplicates.map((dup, idx) => (
                  <div key={idx} style={{
                    padding: 12, background: '#FFFBE6', border: '1px solid #FFE58F',
                    borderRadius: 6, fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-code)', color: 'var(--color-primary)' }}>{dup.property}</span>: {dup.value}
                    </div>
                    <div style={{ color: 'var(--color-fg-muted)' }}>
                      Found in {dup.occurrences.length} variants. Suggested token: <span style={{ fontFamily: 'var(--font-code)' }}>{dup.suggested_token_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {structureDups.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)' }}>
                  Structure Duplicates ({structureDups.length})
                </div>
                {structureDups.map((dup, idx) => (
                  <div key={idx} style={{
                    padding: 12, background: '#F0F5FF', border: '1px solid #ADC6FF',
                    borderRadius: 6, fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{dup.suggestion}</div>
                    <div style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
                      {dup.occurrences.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!analyzing && duplicates.length === 0 && structureDups.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-fg-subtle)', fontStyle: 'italic' }}>
                No duplicates found yet. Run analysis to scan.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid var(--color-border)',
      borderRadius: 10, padding: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-fg)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--color-fg)', fontFamily: mono ? 'var(--font-code)' : undefined }}>{value}</span>
    </div>
  );
}
