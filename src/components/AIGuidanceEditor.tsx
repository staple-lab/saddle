import { useState } from 'react';

interface AIGuidanceEditorProps {
  frontmatter: any;
  onUpdate: (field: string, value: string) => void;
}

export function AIGuidanceEditor({ frontmatter, onUpdate }: AIGuidanceEditorProps) {
  const [editing, setEditing] = useState<string | null>(null);

  const fields = [
    { key: 'name', label: 'Name', placeholder: 'Component name' },
    { key: 'description', label: 'Description', placeholder: 'Brief description of what this component does', multiline: true },
    { key: 'usage', label: 'Usage Guidelines', placeholder: 'When and how to use this component (AI guidance)', multiline: true, height: 120 },
  ];

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--color-fg-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>
        AI Guidance
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {fields.map((field) => {
          const value = frontmatter?.[field.key] || '';
          const isEditing = editing === field.key;

          return (
            <div key={field.key}>
              <div style={{ fontSize: 10, color: 'var(--color-fg-muted)', marginBottom: 6, fontWeight: 600 }}>
                {field.label}
              </div>
              {field.multiline ? (
                <textarea
                  value={value}
                  onChange={(e) => onUpdate(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%',
                    minHeight: field.height || 60,
                    padding: '8px 10px',
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: 'var(--color-fg)',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                  onFocus={() => setEditing(field.key)}
                  onBlur={() => setEditing(null)}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onUpdate(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: 'var(--color-fg)',
                  }}
                  onFocus={() => setEditing(field.key)}
                  onBlur={() => setEditing(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, padding: 12, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>
          💡 AI Context
        </div>
        <div style={{ fontSize: 11, color: '#1e40af', lineHeight: 1.5 }}>
          This metadata helps Claude Code understand when and how to use this component correctly. Be specific about constraints, common mistakes, and best practices.
        </div>
      </div>
    </div>
  );
}
