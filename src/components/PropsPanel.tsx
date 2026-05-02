import { useMemo } from 'react';
import type { PropDef, PropSchema } from '../lib/inferProps';

interface PropsPanelProps {
  schema: PropSchema;
  values: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  /** Free-form props the user added beyond the schema. */
  customRows: Array<{ key: string; value: string }>;
  onCustomChange: (next: Array<{ key: string; value: string }>) => void;
}

export function PropsPanel({ schema, values, onChange, customRows, onCustomChange }: PropsPanelProps) {
  const updateValue = (name: string, value: any) => {
    const next = { ...values };
    if (value === undefined || value === '') delete next[name]; else next[name] = value;
    onChange(next);
  };

  const addCustom = () => onCustomChange([...customRows, { key: '', value: '' }]);
  const updateCustom = (idx: number, patch: Partial<{ key: string; value: string }>) => {
    onCustomChange(customRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeCustom = (idx: number) => onCustomChange(customRows.filter((_, i) => i !== idx));

  const fallbackHint = useMemo(() => {
    if (schema.detectedCva) return null;
    return 'No cva config detected — showing common defaults only. Add a cva block for richer enum controls.';
  }, [schema.detectedCva]);

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
        Props derived from this variant&apos;s source. Edits stream live to
        <code style={{ fontFamily: 'var(--font-code)', margin: '0 4px' }}>window.__SADDLE_PROPS__</code>.
      </div>
      {fallbackHint && (
        <div style={{ fontSize: 11, color: 'var(--color-fg-subtle)', fontStyle: 'italic' }}>
          {fallbackHint}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {schema.props.map((def) => (
          <PropRow
            key={def.name}
            def={def}
            value={values[def.name]}
            onChange={(v) => updateValue(def.name, v)}
          />
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--color-fg-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Custom</div>
        {customRows.map((row, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={row.key}
              onChange={(e) => updateCustom(idx, { key: e.target.value })}
              placeholder="prop"
              style={{
                flex: '0 0 35%', height: 28, padding: '0 8px',
                border: '1px solid var(--color-border)', borderRadius: 6,
                fontSize: 12, fontFamily: 'var(--font-code)',
              }}
            />
            <input
              value={row.value}
              onChange={(e) => updateCustom(idx, { value: e.target.value })}
              placeholder="value"
              style={{
                flex: 1, height: 28, padding: '0 8px',
                border: '1px solid var(--color-border)', borderRadius: 6,
                fontSize: 12, fontFamily: 'var(--font-code)',
              }}
            />
            <button
              onClick={() => removeCustom(idx)}
              style={{
                flex: '0 0 28px', height: 28, padding: 0,
                background: 'transparent', border: '1px solid var(--color-border)',
                borderRadius: 6, fontSize: 14, color: 'var(--color-fg-muted)',
                cursor: 'pointer',
              }}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={addCustom}
          style={{
            height: 28, padding: '0 12px',
            background: 'transparent', border: '1px dashed var(--color-border)',
            borderRadius: 6, fontSize: 12, fontWeight: 500,
            color: 'var(--color-fg)', cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          + Add custom prop
        </button>
      </div>
    </div>
  );
}

function PropRow({ def, value, onChange }: { def: PropDef; value: any; onChange: (v: any) => void }) {
  const labelEl = (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{def.name}</span>
      <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-code)' }}>
        {def.kind === 'enum' ? 'enum' : def.kind}
      </span>
      {def.default !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--color-fg-subtle)' }} title="Default value from source">
          default: {String(def.default)}
        </span>
      )}
    </div>
  );

  if (def.kind === 'enum') {
    const current = value ?? '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {labelEl}
        <select
          value={current}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={{
            height: 28, padding: '0 8px',
            border: '1px solid var(--color-border)', borderRadius: 6,
            fontSize: 12, fontFamily: 'var(--font-code)',
            background: '#fff',
          }}
        >
          <option value="">{def.default !== undefined ? `(default: ${def.default})` : '(unset)'}</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (def.kind === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked || undefined)}
        />
        {labelEl}
      </label>
    );
  }

  if (def.kind === 'number') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {labelEl}
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          style={{
            height: 28, padding: '0 8px',
            border: '1px solid var(--color-border)', borderRadius: 6,
            fontSize: 12, fontFamily: 'var(--font-code)',
          }}
        />
      </div>
    );
  }

  // string
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {labelEl}
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={def.default !== undefined ? String(def.default) : ''}
        style={{
          height: 28, padding: '0 8px',
          border: '1px solid var(--color-border)', borderRadius: 6,
          fontSize: 12, fontFamily: 'var(--font-code)',
        }}
      />
    </div>
  );
}
