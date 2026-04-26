import { useState, useMemo } from 'react';
import { TokenPicker } from '../tokens/TokenPicker';
import { detectTokenSlot } from '../lib/cssProperties';
import { ChevronRight } from 'lucide-react';

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

// Extract ALL inline styles from component code using bracket-counting
function extractCodeStyles(code: string): Record<string, string> {
  const styles: Record<string, string> = {};
  const marker = 'style={{';
  let searchFrom = 0;

  while (true) {
    const startIdx = code.indexOf(marker, searchFrom);
    if (startIdx === -1) break;

    // Find matching }} using bracket counting
    let depth = 2; // we're past the {{
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

    // Parse key: value pairs from the block
    const propRegex = /(\w+)\s*:\s*/g;
    let propMatch;
    while ((propMatch = propRegex.exec(block)) !== null) {
      const key = propMatch[1];
      let valStart = propMatch.index + propMatch[0].length;
      let value = '';

      // Read value: handle quoted strings, numbers, and expressions
      let vi = valStart;
      let vInStr: string | null = null;
      let vDepth = 0;

      while (vi < block.length) {
        const vc = block[vi];
        if (vInStr) {
          if (vc === vInStr && block[vi - 1] !== '\\') {
            vInStr = null;
          }
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
      // Strip quotes
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      // Skip ternary/complex expressions, keep simple values
      if (value && !value.includes('?') && !value.includes('=>') && key !== 'transition') {
        styles[key] = value;
      }
    }

    searchFrom = i + 1;
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
            <div
              onClick={() => toggleSection(section)}
              role="button"
              tabIndex={0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                height: 34,
                padding: '0 12px',
                background: isExpanded ? 'rgba(0,0,0,0.02)' : 'transparent',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? 'rgba(0,0,0,0.02)' : 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  color: 'var(--color-fg-subtle)',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                  transition: 'transform 150ms ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}><ChevronRight size={10} /></span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-fg)' }}>{section}</span>
              </div>
              <span style={{ fontSize: 10, color: activeProps.length > 0 ? 'var(--color-primary)' : 'var(--color-fg-subtle)', fontWeight: 600 }}>
                {activeProps.length > 0 ? activeProps.length : ''}
              </span>
            </div>

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
                    onRemove={tokens.hasOwnProperty(prop) ? () => {
                      const next = { ...tokens };
                      delete next[prop];
                      onTokenChange('__remove__' + prop, '');
                    } : undefined}
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

function PropertyRow({ name, value, isToken, onChange, onRemove }: {
  name: string;
  value: string;
  isToken: boolean;
  onChange: (v: string) => void;
  onRemove?: () => void;
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

      {/* Token picker for token properties */}
      {isToken && slot && (
        <TokenPicker slot={slot} value={value} onPick={(v) => onChange(v)} />
      )}

      {/* Convert to token button for non-token properties */}
      {!isToken && (
        <button
          onClick={() => onChange(value)}
          title="Convert to editable token"
          style={{
            height: 20, padding: '0 6px',
            background: 'transparent', border: '1px solid var(--color-border)',
            borderRadius: 3, cursor: 'pointer',
            fontSize: 9, color: 'var(--color-primary)', fontWeight: 600,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          Tokenize
        </button>
      )}

      {/* Remove button */}
      {isToken && onRemove && (
        <button
          onClick={onRemove}
          title="Remove property"
          style={{
            width: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            color: 'var(--color-fg-subtle)',
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'rgba(255,59,48,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-fg-subtle)'; e.currentTarget.style.background = 'transparent'; }}
        >
          x
        </button>
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
