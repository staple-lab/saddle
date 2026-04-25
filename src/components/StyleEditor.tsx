import { useState, useMemo } from 'react';
import { TokenPicker } from '../tokens/TokenPicker';
import { detectTokenSlot } from '../lib/cssProperties';

interface StyleEditorProps {
  tokens: Record<string, string>;
  code?: string;
  onTokenChange: (key: string, value: string) => void;
}

// All CSS properties a component could use, organized like Figma
const ALL_PROPERTIES: { section: string; props: string[] }[] = [
  {
    section: 'Layout',
    props: ['display', 'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'overflow', 'float', 'clear',
            'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignContent', 'alignSelf',
            'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'order',
            'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow', 'gridGap'],
  },
  {
    section: 'Size',
    props: ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio'],
  },
  {
    section: 'Spacing',
    props: ['padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap', 'rowGap', 'columnGap'],
  },
  {
    section: 'Fill',
    props: ['backgroundColor', 'background', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
            'backgroundRepeat', 'backgroundClip', 'opacity'],
  },
  {
    section: 'Stroke',
    props: ['border', 'borderWidth', 'borderStyle', 'borderColor',
            'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
            'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
            'borderBottomRightRadius', 'borderBottomLeftRadius',
            'outline', 'outlineWidth', 'outlineStyle', 'outlineColor', 'outlineOffset'],
  },
  {
    section: 'Typography',
    props: ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
            'lineHeight', 'letterSpacing', 'textAlign', 'textDecoration', 'textTransform',
            'whiteSpace', 'wordBreak', 'wordSpacing', 'textOverflow', 'textShadow',
            'textIndent', 'verticalAlign'],
  },
  {
    section: 'Effects',
    props: ['boxShadow', 'filter', 'backdropFilter', 'mixBlendMode',
            'transform', 'transformOrigin', 'transition', 'animation',
            'cursor', 'pointerEvents', 'userSelect', 'willChange'],
  },
];

// Extract inline styles from component code
function extractCodeStyles(code: string): Record<string, string> {
  const styles: Record<string, string> = {};
  const styleBlockRegex = /style=\{\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\}/g;
  let match;
  while ((match = styleBlockRegex.exec(code)) !== null) {
    const block = match[1];
    const propRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
    let propMatch;
    while ((propMatch = propRegex.exec(block)) !== null) {
      styles[propMatch[1]] = propMatch[2];
    }
  }
  return styles;
}

export function StyleEditor({ tokens, code, onTokenChange }: StyleEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Fill', 'Spacing', 'Stroke', 'Typography']));
  const [addingProp, setAddingProp] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Merge: frontmatter tokens + code inline styles
  const codeStyles = useMemo(() => code ? extractCodeStyles(code) : {}, [code]);
  const allValues: Record<string, string> = useMemo(() => ({ ...codeStyles, ...tokens }), [codeStyles, tokens]);

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setExpandedSections(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
      {/* Search */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter properties..."
          style={{
            width: '100%',
            height: 26,
            padding: '0 8px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: 'var(--color-stage)',
            color: 'var(--color-fg)',
          }}
        />
      </div>

      {/* Property Sections */}
      {ALL_PROPERTIES.map(({ section, props }) => {
        const isExpanded = expandedSections.has(section);
        const filtered = searchFilter
          ? props.filter(p => p.toLowerCase().includes(searchFilter.toLowerCase()))
          : props;

        // Properties that have values (from tokens or code)
        const activeProps = filtered.filter(p => allValues[p] !== undefined);
        const inactiveProps = filtered.filter(p => allValues[p] === undefined);

        if (searchFilter && filtered.length === 0) return null;

        return (
          <div key={section} style={{ borderBottom: '1px solid var(--color-border)' }}>
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                height: 32,
                padding: '0 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 9,
                  color: 'var(--color-fg-subtle)',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 100ms',
                  display: 'inline-block',
                }}>▶</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-fg)' }}>{section}</span>
              </div>
              {activeProps.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 600 }}>
                  {activeProps.length}
                </span>
              )}
            </button>

            {/* Properties */}
            {isExpanded && (
              <div style={{ padding: '0 12px 8px' }}>
                {/* Active properties (have values) */}
                {activeProps.map(prop => (
                  <PropertyRow
                    key={prop}
                    name={prop}
                    value={allValues[prop]}
                    isToken={tokens.hasOwnProperty(prop)}
                    onChange={(v) => onTokenChange(prop, v)}
                  />
                ))}

                {/* Add property button */}
                {addingProp === section ? (
                  <div style={{ padding: '4px 0' }}>
                    <select
                      autoFocus
                      onChange={(e) => {
                        if (e.target.value) {
                          onTokenChange(e.target.value, '');
                          setAddingProp(null);
                        }
                      }}
                      onBlur={() => setAddingProp(null)}
                      style={{
                        width: '100%',
                        height: 26,
                        padding: '0 4px',
                        fontSize: 11,
                        border: '1px solid var(--color-primary)',
                        borderRadius: 4,
                        background: '#ffffff',
                        color: 'var(--color-fg)',
                        fontFamily: 'var(--font-code)',
                      }}
                    >
                      <option value="">Select property...</option>
                      {inactiveProps.map(p => (
                        <option key={p} value={p}>{camelToLabel(p)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingProp(section)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      height: 24,
                      padding: '0 4px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: 'var(--color-primary)',
                      fontWeight: 500,
                      marginTop: 2,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,122,255,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    + Add
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PropertyRow({ name, value, isToken, onChange }: {
  name: string;
  value: string;
  isToken: boolean;
  onChange: (v: string) => void;
}) {
  const slot = detectTokenSlot(name, value);
  const isColor = slot === 'color';
  const colorVal = isColor ? (value.startsWith('var(') ? getComputedVar(value) : value) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28 }}>
      {/* Color swatch */}
      {isColor && (
        <div style={{
          width: 16, height: 16,
          borderRadius: 3,
          border: '1px solid var(--color-border)',
          background: colorVal || 'transparent',
          flexShrink: 0,
        }} />
      )}

      {/* Property name */}
      <span style={{
        width: 90,
        fontSize: 11,
        color: isToken ? 'var(--color-primary)' : 'var(--color-fg-muted)',
        fontWeight: isToken ? 500 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }} title={name}>
        {camelToLabel(name)}
      </span>

      {/* Value input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!isToken}
        style={{
          flex: 1,
          minWidth: 0,
          height: 22,
          padding: '0 6px',
          fontSize: 11,
          fontFamily: 'var(--font-code)',
          border: '1px solid transparent',
          borderRadius: 3,
          background: isToken ? '#ffffff' : 'transparent',
          color: 'var(--color-fg)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
      />

      {/* Token picker */}
      {isToken && slot && (
        <TokenPicker slot={slot} value={value} onPick={(v) => onChange(v)} />
      )}
    </div>
  );
}

function camelToLabel(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

function getComputedVar(expr: string): string {
  const match = expr.match(/var\((--[^,)]+)/);
  if (!match) return expr;
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || expr;
  } catch { return expr; }
}
