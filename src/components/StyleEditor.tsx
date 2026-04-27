import { useState, useMemo } from 'react';
import { TokenPicker } from '../tokens/TokenPicker';
import { detectTokenSlot } from '../lib/cssProperties';

interface StyleEditorProps {
  tokens: Record<string, string>;
  code?: string;
  onTokenChange: (key: string, value: string) => void;
  onStateChange?: (state: string) => void;
}

type FieldDef = { label: string; key: string };
type Row = FieldDef | [FieldDef, FieldDef];
type SectionDef = { title: string; rows: Row[] };

const SECTIONS: SectionDef[] = [
  {
    title: 'Layout',
    rows: [
      [
        { label: 'Padding X', key: 'paddingInline' },
        { label: 'Padding Y', key: 'paddingBlock' },
      ],
      { label: 'Gap', key: 'gap' },
    ],
  },
  {
    title: 'Background',
    rows: [{ label: 'Background', key: 'backgroundColor' }],
  },
  {
    title: 'Border',
    rows: [
      [
        { label: 'Radius', key: 'borderRadius' },
        { label: 'Width', key: 'borderWidth' },
      ],
      { label: 'Color', key: 'borderColor' },
    ],
  },
  {
    title: 'Typography',
    rows: [
      [
        { label: 'Color', key: 'color' },
        { label: 'Size', key: 'fontSize' },
      ],
      [
        { label: 'Weight', key: 'fontWeight' },
        { label: 'Line height', key: 'lineHeight' },
      ],
      { label: 'Family', key: 'fontFamily' },
    ],
  },
  {
    title: 'Shadow',
    rows: [{ label: 'Box shadow', key: 'boxShadow' }],
  },
];

const STATES = ['default', 'hover', 'focus', 'active', 'disabled'] as const;
type ElementState = (typeof STATES)[number];

function extractCodeStyles(code: string): Record<string, string> {
  const styles: Record<string, string> = {};
  const marker = 'style={{';
  let searchFrom = 0;

  while (true) {
    const startIdx = code.indexOf(marker, searchFrom);
    if (startIdx === -1) break;

    let depth = 2;
    let i = startIdx + marker.length;
    let inStr: string | null = null;

    while (i < code.length && depth > 0) {
      const ch = code[i];
      if (inStr) {
        if (ch === inStr && code[i - 1] !== '\\') inStr = null;
      } else {
        if (ch === "'" || ch === '"' || ch === '`') inStr = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth > 0) i++;
    }

    const block = code.substring(startIdx + marker.length, i);

    const propRegex = /(\w+)\s*:\s*/g;
    let propMatch;
    while ((propMatch = propRegex.exec(block)) !== null) {
      const key = propMatch[1];
      const valStart = propMatch.index + propMatch[0].length;
      let value = '';

      let vi = valStart;
      let vInStr: string | null = null;
      let vDepth = 0;

      while (vi < block.length) {
        const vc = block[vi];
        if (vInStr) {
          if (vc === vInStr && block[vi - 1] !== '\\') vInStr = null;
        } else {
          if (vc === "'" || vc === '"' || vc === '`') vInStr = vc;
          else if (vc === '(' || vc === '{' || vc === '[') vDepth++;
          else if (vc === ')' || vc === '}' || vc === ']') {
            if (vDepth > 0) vDepth--;
            else break;
          }
          else if ((vc === ',' || vc === '\n') && vDepth === 0) break;
        }
        vi++;
      }

      value = block.substring(valStart, vi).trim();
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      if (value && !value.includes('?') && !value.includes('=>') && key !== 'transition') {
        styles[key] = value;
      }
    }

    searchFrom = i + 1;
  }

  return styles;
}

function readField(values: Record<string, string>, key: string): string {
  if (values[key] !== undefined) return values[key];
  // Logical-property fallbacks for Padding X / Y
  if (key === 'paddingInline') {
    const l = values.paddingLeft, r = values.paddingRight;
    if (l && l === r) return l;
    return values.paddingInline ?? '';
  }
  if (key === 'paddingBlock') {
    const t = values.paddingTop, b = values.paddingBottom;
    if (t && t === b) return t;
    return values.paddingBlock ?? '';
  }
  return '';
}

export function StyleEditor({ tokens, code, onTokenChange, onStateChange }: StyleEditorProps) {
  const [state, setState] = useState<ElementState>('default');

  const pickState = (s: ElementState) => {
    setState(s);
    onStateChange?.(s);
  };

  const codeStyles = useMemo(() => (code ? extractCodeStyles(code) : {}), [code]);
  const allValues: Record<string, string> = useMemo(
    () => ({ ...codeStyles, ...tokens }),
    [codeStyles, tokens]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Section title="State">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATES.map((s) => (
            <StatePill key={s} active={state === s} onClick={() => pickState(s)}>
              {s}
            </StatePill>
          ))}
        </div>
      </Section>

      {SECTIONS.map(({ title, rows }) => (
        <Section key={title} title={title}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, idx) => {
              if (Array.isArray(row)) {
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {row.map((field) => (
                      <div key={field.key} style={{ minWidth: 0 }}>
                        <Field
                          label={field.label}
                          value={readField(allValues, field.key)}
                          onChange={(v) => onTokenChange(field.key, v)}
                          propertyKey={field.key}
                        />
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <Field
                  key={idx}
                  label={row.label}
                  value={readField(allValues, row.key)}
                  onChange={(v) => onTokenChange(row.key, v)}
                  propertyKey={row.key}
                />
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-fg-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function StatePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 24,
        padding: '0 9px',
        background: active ? '#ffffff' : 'transparent',
        border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
        boxShadow: active ? '0 0 0 2px rgba(0, 122, 255, 0.18)' : 'none',
        borderRadius: 5,
        fontSize: 11,
        color: active ? 'var(--color-accent)' : 'var(--color-fg-muted)',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  propertyKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  propertyKey: string;
}) {
  const slot = detectTokenSlot(propertyKey, value);
  const isColor = slot === 'color';
  const colorVal = isColor ? (value.startsWith('var(') ? getComputedVar(value) : value) : null;

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-fg-muted)',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {isColor && (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 3,
              border: '1px solid var(--color-border)',
              background: colorVal || 'transparent',
              flexShrink: 0,
            }}
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          style={{
            flex: 1,
            minWidth: 0,
            height: 24,
            padding: '0 6px',
            fontSize: 11,
            fontFamily: value.startsWith('var(') ? 'var(--font-code)' : 'inherit',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: '#ffffff',
            color: 'var(--color-fg)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent)';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 122, 255, 0.18)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {slot && <TokenPicker slot={slot} value={value} onPick={(v) => onChange(v)} />}
      </div>
    </div>
  );
}

function getComputedVar(expr: string): string {
  const match = expr.match(/var\((--[^,)]+)/);
  if (!match) return expr;
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || expr;
  } catch {
    return expr;
  }
}
