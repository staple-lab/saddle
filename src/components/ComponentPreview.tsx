import { useState, useMemo } from 'react';
import { Smartphone, Tablet, Monitor, MonitorSmartphone } from 'lucide-react';

export type Breakpoint = { name: string; width: number };

const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: 'Mobile', width: 375 },
  { name: 'Tablet', width: 768 },
  { name: 'Desktop', width: 1280 },
  { name: 'Full', width: 0 },
];

const BREAKPOINT_ICONS: Record<string, any> = {
  Mobile: Smartphone,
  Tablet: Tablet,
  Desktop: Monitor,
  Full: MonitorSmartphone,
};

function iconForBreakpoint(name: string, width: number) {
  if (BREAKPOINT_ICONS[name]) return BREAKPOINT_ICONS[name];
  if (width <= 480) return Smartphone;
  if (width <= 1024) return Tablet;
  if (width === 0) return MonitorSmartphone;
  return Monitor;
}

interface ComponentPreviewProps {
  code: string;
  frontmatter?: any;
  liveTokens?: Record<string, string>;
  breakpoints?: Breakpoint[];
  devServerUrl?: string;
}

// Extract the JSX from a return(...) statement using bracket-counting
// so that parentheses inside style objects or expressions don't cut it off.
function extractReturnJsx(code: string): string | null {
  const returnIdx = code.indexOf('return');
  if (returnIdx === -1) return null;

  // Find the opening paren after 'return'
  let i = returnIdx + 6; // length of 'return'
  while (i < code.length && code[i] !== '(') {
    if (!/\s/.test(code[i])) return null; // non-whitespace before '(' means no parens
    i++;
  }
  if (i >= code.length) return null;

  // Bracket-count to find the matching close paren
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  const start = i;

  for (; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';

    // Handle string contexts (skip escaped quotes)
    if (inSingleQuote) {
      if (ch === "'" && prev !== '\\') inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (ch === '"' && prev !== '\\') inDoubleQuote = false;
      continue;
    }
    if (inBacktick) {
      if (ch === '`' && prev !== '\\') inBacktick = false;
      continue;
    }

    if (ch === "'") { inSingleQuote = true; continue; }
    if (ch === '"') { inDoubleQuote = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }

    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) {
        // Extract content between outermost parens (exclusive)
        return code.slice(start + 1, i).trim();
      }
    }
  }

  return null;
}

// Parse a CSS-in-JS style object block (the content between {{ and }})
// into a CSS style string. Handles quoted values with parens inside,
// unquoted numeric values, template literals, and ternary expressions.
function parseStyleBlock(styleBlock: string): string {
  const pairs: string[] = [];

  // Tokenize style properties manually to handle complex values
  let i = 0;
  while (i < styleBlock.length) {
    // Skip whitespace and commas
    while (i < styleBlock.length && /[\s,]/.test(styleBlock[i])) i++;
    if (i >= styleBlock.length) break;

    // Read property name (camelCase identifier)
    const nameStart = i;
    while (i < styleBlock.length && /[\w]/.test(styleBlock[i])) i++;
    const propName = styleBlock.slice(nameStart, i);
    if (!propName) { i++; continue; }

    // Skip whitespace then expect ':'
    while (i < styleBlock.length && styleBlock[i] === ' ') i++;
    if (i >= styleBlock.length || styleBlock[i] !== ':') continue;
    i++; // skip ':'
    while (i < styleBlock.length && styleBlock[i] === ' ') i++;

    // Read value — collect until we hit a comma at depth 0 or end of block
    const valueStart = i;
    let depth = 0;
    let inSQ = false, inDQ = false, inBT = false;

    while (i < styleBlock.length) {
      const ch = styleBlock[i];
      const prev = i > 0 ? styleBlock[i - 1] : '';

      if (inSQ) { if (ch === "'" && prev !== '\\') inSQ = false; i++; continue; }
      if (inDQ) { if (ch === '"' && prev !== '\\') inDQ = false; i++; continue; }
      if (inBT) { if (ch === '`' && prev !== '\\') inBT = false; i++; continue; }

      if (ch === "'") { inSQ = true; i++; continue; }
      if (ch === '"') { inDQ = true; i++; continue; }
      if (ch === '`') { inBT = true; i++; continue; }

      if (ch === '(' || ch === '{' || ch === '[') { depth++; i++; continue; }
      if (ch === ')' || ch === '}' || ch === ']') { depth--; i++; continue; }

      // Comma at depth 0 terminates the value
      if (ch === ',' && depth === 0) break;
      // Newline at depth 0 with content already collected can also terminate
      if (ch === '\n' && depth === 0 && i > valueStart) {
        // Peek ahead: if next non-whitespace is an identifier followed by ':', this value is done
        let peek = i + 1;
        while (peek < styleBlock.length && /[ \t]/.test(styleBlock[peek])) peek++;
        const rest = styleBlock.slice(peek);
        if (/^[\w]+\s*:/.test(rest)) break;
      }

      i++;
    }

    let rawValue = styleBlock.slice(valueStart, i).trim();
    // Remove trailing comma if present
    if (rawValue.endsWith(',')) rawValue = rawValue.slice(0, -1).trim();

    // Convert camelCase prop to kebab-case
    const cssProp = propName.replace(/([A-Z])/g, '-$1').toLowerCase();

    // Resolve the value
    let cssValue: string | null = null;

    // Ternary expression: take the falsy branch (safer for preview)
    const ternaryMatch = rawValue.match(/^\w+\s*\?\s*(.+?)\s*:\s*(.+)$/s);
    if (ternaryMatch) {
      let fallback = ternaryMatch[2].trim();
      // Strip quotes
      if ((fallback.startsWith("'") && fallback.endsWith("'")) ||
          (fallback.startsWith('"') && fallback.endsWith('"'))) {
        fallback = fallback.slice(1, -1);
      }
      cssValue = fallback;
    }

    // Quoted string value
    if (!cssValue) {
      const quotedMatch = rawValue.match(/^['"](.*)['"]$/s);
      if (quotedMatch) {
        cssValue = quotedMatch[1];
      }
    }

    // Template literal
    if (!cssValue) {
      const templateMatch = rawValue.match(/^`(.*)`$/s);
      if (templateMatch) {
        // Replace ${...} expressions with placeholder
        cssValue = templateMatch[1].replace(/\$\{[^}]*\}/g, '0');
      }
    }

    // Numeric value (e.g., fontWeight: 500, lineHeight: 1.5)
    if (!cssValue) {
      const numericMatch = rawValue.match(/^[\d.]+$/);
      if (numericMatch) {
        cssValue = rawValue;
      }
    }

    // Variable reference or expression — skip if we can't resolve
    if (!cssValue && /^['"`\d]/.test(rawValue)) {
      cssValue = rawValue.replace(/^['"`]|['"`]$/g, '');
    }

    if (cssValue !== null) {
      pairs.push(`${cssProp}: ${cssValue}`);
    }
  }

  return pairs.join('; ');
}

// Find matching {{ ... }} for style attributes, using bracket counting
function replaceStyleBlocks(jsx: string): string {
  let result = '';
  let i = 0;

  while (i < jsx.length) {
    const styleIdx = jsx.indexOf('style={{', i);
    if (styleIdx === -1) {
      result += jsx.slice(i);
      break;
    }

    result += jsx.slice(i, styleIdx);

    // Find the start of the inner object (after 'style={{')
    let j = styleIdx + 'style={{'.length;
    let depth = 2; // We've consumed two opening braces

    let inSQ = false, inDQ = false, inBT = false;

    while (j < jsx.length && depth > 0) {
      const ch = jsx[j];
      const prev = j > 0 ? jsx[j - 1] : '';

      if (inSQ) { if (ch === "'" && prev !== '\\') inSQ = false; j++; continue; }
      if (inDQ) { if (ch === '"' && prev !== '\\') inDQ = false; j++; continue; }
      if (inBT) { if (ch === '`' && prev !== '\\') inBT = false; j++; continue; }

      if (ch === "'") { inSQ = true; j++; continue; }
      if (ch === '"') { inDQ = true; j++; continue; }
      if (ch === '`') { inBT = true; j++; continue; }

      if (ch === '{') depth++;
      if (ch === '}') depth--;

      j++;
    }

    // Extract the content between style={{ and }}
    const innerContent = jsx.slice(styleIdx + 'style={{'.length, j - 2);
    const cssString = parseStyleBlock(innerContent);
    result += `style="${cssString}"`;

    i = j;
  }

  return result;
}

// Parse JSX into renderable HTML, preserving the full DOM hierarchy
function jsxToHtml(code: string, tokens: Record<string, string>): string {
  const jsx = extractReturnJsx(code);
  if (!jsx) return '<div>No renderable JSX found</div>';

  let html = jsx;

  // --- Substitute known prop expressions ---
  html = html.replace(/\{label\}/gi, 'Label');
  html = html.replace(/\{title\}/gi, 'Title');
  html = html.replace(/\{children\s*\|\|\s*['"]([^'"]+)['"]\}/g, '$1');
  html = html.replace(/\{children\}/gi, 'Content goes here');
  html = html.replace(/\{initials\}/gi, 'AB');
  html = html.replace(/\{placeholder\}/gi, '');
  html = html.replace(/\{value\}/gi, 'Value');
  html = html.replace(/\{text\}/gi, 'Text');
  html = html.replace(/\{description\}/gi, 'Description text');
  html = html.replace(/\{subtitle\}/gi, 'Subtitle');
  html = html.replace(/\{name\}/gi, 'Name');

  // --- Conditional rendering: {expr && (<jsx>)} using bracket counting ---
  let prevHtml = '';
  while (prevHtml !== html) {
    prevHtml = html;
    html = resolveConditionalExpressions(html);
  }

  // --- Ternary in JSX: {expr ? <A/> : <B/>} — take the truthy branch for display ---
  // Simple ternary with string values
  html = html.replace(/\{[\w.]+\s*\?\s*['"]([^'"]*)['"]\s*:\s*['"][^'"]*['"]\s*\}/g, '$1');
  // Ternary with JSX — take first branch
  html = html.replace(/\{[\w.]+\s*\?\s*((?:<[\s\S]*?>[\s\S]*?<\/[\s\S]*?>)|(?:<[\s\S]*?\/>))\s*:\s*[\s\S]*?\}/g, '$1');

  // --- Remove event handlers (onClick, onChange, etc.) ---
  html = removeJsxAttributes(html, /^on[A-Z]/);

  // --- Remove React-specific attributes ---
  html = removeJsxAttributes(html, /^(ref|key|dangerouslySetInnerHTML)$/);

  // --- className handling ---
  html = html.replace(/className=\{[^}]*\}/g, '');
  html = html.replace(/className="([^"]*)"/g, 'class="$1"');

  // --- Parse style={{ ... }} blocks with bracket counting ---
  html = replaceStyleBlocks(html);

  // --- Apply live token overrides to root element ---
  if (Object.keys(tokens).length > 0) {
    // Map custom token names to valid CSS properties
    const tokenNameMap: Record<string, string> = {
      textColor: 'color',
      bgColor: 'background-color',
      activeColor: 'background-color',
      inactiveColor: 'background-color',
      thumbColor: 'color',
    };

    const tokenStyle = Object.entries(tokens)
      .filter(([, v]) => v !== '') // skip empty values
      .map(([k, v]) => {
        const cssName = tokenNameMap[k] || k.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssName}: ${v} !important`;
      })
      .join('; ');

    const firstStyleMatch = html.match(/style="([^"]*)"/);
    if (firstStyleMatch) {
      html = html.replace(firstStyleMatch[0], `style="${firstStyleMatch[1]}; ${tokenStyle}"`);
    } else {
      html = html.replace(/<(\w+)/, `<$1 style="${tokenStyle}"`);
    }
  }

  // --- Self-closing tags ---
  html = html.replace(/<(\w+)([^>]*)\/>/g, '<$1$2></$1>');

  // --- Remove fragments ---
  html = html.replace(/<>/g, '').replace(/<\/>/g, '');

  // --- Remove remaining JSX expressions that weren't substituted ---
  html = html.replace(/\{[^}]*\}/g, '');

  // --- Clean up imports that might have leaked in ---
  html = html.replace(/import\s+.*?;/g, '');

  return html;
}

// Remove JSX attribute expressions that match a given pattern
// Handles both string attributes and expression attributes with nested braces
function removeJsxAttributes(html: string, pattern: RegExp): string {
  let result = '';
  let i = 0;

  while (i < html.length) {
    // Look for attribute-like patterns: whitespace + identifier + =
    if (/\s/.test(html[i])) {
      // Check if the upcoming text is an attribute name matching our pattern
      let nameStart = i + 1;
      while (nameStart < html.length && /\s/.test(html[nameStart])) nameStart++;
      let nameEnd = nameStart;
      while (nameEnd < html.length && /[\w]/.test(html[nameEnd])) nameEnd++;
      const attrName = html.slice(nameStart, nameEnd);

      if (attrName && pattern.test(attrName) && nameEnd < html.length && html[nameEnd] === '=') {
        // Skip this attribute entirely
        let j = nameEnd + 1; // past '='
        if (j < html.length && html[j] === '{') {
          // Expression value — count braces
          let depth = 0;
          while (j < html.length) {
            if (html[j] === '{') depth++;
            if (html[j] === '}') { depth--; if (depth === 0) { j++; break; } }
            j++;
          }
        } else if (j < html.length && (html[j] === '"' || html[j] === "'")) {
          // String value
          const quote = html[j];
          j++;
          while (j < html.length && html[j] !== quote) j++;
          j++; // past closing quote
        }
        i = j;
        continue;
      }
    }

    result += html[i];
    i++;
  }

  return result;
}

// Resolve {expr && (content)} conditional expressions using bracket counting
function resolveConditionalExpressions(html: string): string {
  // Match the opening: { identifier && (
  const regex = /\{[\w.]+\s*&&\s*\(/g;
  let match;
  let result = '';
  let lastIdx = 0;

  while ((match = regex.exec(html)) !== null) {
    result += html.slice(lastIdx, match.index);

    // From the opening paren, count brackets to find the matching ) then }
    let i = match.index + match[0].length; // past the '('
    let parenDepth = 1;
    let inSQ = false, inDQ = false, inBT = false;

    while (i < html.length && parenDepth > 0) {
      const ch = html[i];
      const prev = i > 0 ? html[i - 1] : '';

      if (inSQ) { if (ch === "'" && prev !== '\\') inSQ = false; i++; continue; }
      if (inDQ) { if (ch === '"' && prev !== '\\') inDQ = false; i++; continue; }
      if (inBT) { if (ch === '`' && prev !== '\\') inBT = false; i++; continue; }

      if (ch === "'") { inSQ = true; i++; continue; }
      if (ch === '"') { inDQ = true; i++; continue; }
      if (ch === '`') { inBT = true; i++; continue; }

      if (ch === '(') parenDepth++;
      if (ch === ')') parenDepth--;
      i++;
    }

    // i is now past the matching ')'. Skip whitespace then expect '}'
    const innerContent = html.slice(match.index + match[0].length, i - 1);
    let j = i;
    while (j < html.length && /\s/.test(html[j])) j++;
    if (j < html.length && html[j] === '}') j++;

    // Include the inner content (assume condition is truthy for preview)
    result += innerContent;
    lastIdx = j;
    regex.lastIndex = j;
  }

  result += html.slice(lastIdx);
  return result;
}

export function ComponentPreview({ code, frontmatter, liveTokens, devServerUrl, breakpoints }: ComponentPreviewProps) {
  const tokens = liveTokens || frontmatter?.tokens || {};
  const [mode, setMode] = useState<'isolated' | 'devserver'>(devServerUrl ? 'devserver' : 'isolated');
  const [breakpoint, setBreakpoint] = useState<number>(0);
  const [editingBreakpoints, setEditingBreakpoints] = useState(false);
  const [customBreakpoints, setCustomBreakpoints] = useState<Breakpoint[]>(breakpoints || DEFAULT_BREAKPOINTS);
  const [newBpName, setNewBpName] = useState('');
  const [newBpWidth, setNewBpWidth] = useState('');

  const activeBreakpoints = customBreakpoints;

  const tokensKey = JSON.stringify(tokens);
  console.log('PREVIEW RENDER - tokens:', tokens, 'key:', tokensKey);
  const renderedHtml = useMemo(() => {
    const html = jsxToHtml(code, tokens);
    console.log('PREVIEW HTML generated, length:', html.length);
    return html;
  }, [code, tokensKey]);

  const isolatedSrcdoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<style>
  :root {
    --spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px;
    --spacing-lg: 20px; --spacing-xl: 24px; --spacing-xxl: 32px;
    --colors-primary: #007AFF; --colors-secondary: #f5f5f7;
    --colors-brand: #1d1d1f; --colors-accent: #007AFF;
    --colors-background: #ffffff; --colors-surface: #f5f5f7;
    --colors-text: #1d1d1f; --colors-subtext: #86868b;
    --colors-border: #d1d1d6; --colors-error: #FF3B30;
    --colors-success: #34C759; --colors-warning: #FF9500;
    --rounded-none: 0px; --rounded-sm: 4px; --rounded-md: 8px;
    --rounded-lg: 12px; --rounded-full: 9999px;
    --font-size-xs: 11px; --font-size-sm: 13px;
    --font-size-base: 14px; --font-size-lg: 16px; --font-size-xl: 18px;
  }
  * { box-sizing: border-box; }
  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-font-smoothing: antialiased;
  }
  button { font-family: inherit; cursor: pointer; }
  input, select, textarea { font-family: inherit; }
  img { display: block; }
</style>
</head>
<body>
  ${renderedHtml}
</body>
</html>`, [renderedHtml]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar: Breakpoints + Mode */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0', flexShrink: 0, gap: 8,
      }}>
        {/* Breakpoint switcher */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.03)', borderRadius: 6, padding: 2 }}>
          {activeBreakpoints.map(bp => {
            const Icon = iconForBreakpoint(bp.name, bp.width);
            const isActive = breakpoint === bp.width;
            return (
              <button
                key={bp.name}
                onClick={() => setBreakpoint(bp.width)}
                title={bp.width ? `${bp.name} (${bp.width}px)` : 'Full width'}
                style={{
                  height: 26, padding: '0 8px',
                  background: isActive ? '#fff' : 'transparent',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 100ms',
                }}
              >
                <Icon size={12} />
                {isActive && <span>{bp.width ? `${bp.width}px` : 'Full'}</span>}
              </button>
            );
          })}
          {/* Edit breakpoints toggle */}
          <button
            onClick={() => setEditingBreakpoints(!editingBreakpoints)}
            title="Configure breakpoints"
            style={{
              height: 26, width: 26,
              background: editingBreakpoints ? 'var(--color-primary)' : 'transparent',
              color: editingBreakpoints ? '#fff' : 'var(--color-fg-subtle)',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
            }}
          >
            +
          </button>
        </div>

        {breakpoint > 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
            {breakpoint}px
          </span>
        )}
      </div>

      {/* Breakpoint Configuration Panel */}
      {editingBreakpoints && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
          background: '#fff', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-fg)' }}>Breakpoints</div>
          {customBreakpoints.filter(bp => bp.width > 0).map((bp, idx) => (
            <div key={bp.name} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={bp.name}
                onChange={(e) => {
                  const next = [...customBreakpoints];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setCustomBreakpoints(next);
                }}
                style={{
                  flex: 1, height: 26, padding: '0 8px', fontSize: 11,
                  border: '1px solid var(--color-border)', borderRadius: 4,
                  background: '#fff', color: 'var(--color-fg)',
                }}
              />
              <input
                type="number"
                value={bp.width}
                onChange={(e) => {
                  const next = [...customBreakpoints];
                  next[idx] = { ...next[idx], width: parseInt(e.target.value) || 0 };
                  setCustomBreakpoints(next);
                }}
                style={{
                  width: 72, height: 26, padding: '0 8px', fontSize: 11,
                  fontFamily: 'var(--font-code)',
                  border: '1px solid var(--color-border)', borderRadius: 4,
                  background: '#fff', color: 'var(--color-fg)',
                  textAlign: 'right',
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--color-fg-subtle)' }}>px</span>
              <button
                onClick={() => setCustomBreakpoints(customBreakpoints.filter((_, i) => i !== idx))}
                style={{
                  width: 22, height: 22, background: 'none', border: 'none',
                  color: 'var(--color-fg-subtle)', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-fg-subtle)'; }}
              >
                x
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={newBpName}
              onChange={(e) => setNewBpName(e.target.value)}
              placeholder="Name"
              style={{
                flex: 1, height: 26, padding: '0 8px', fontSize: 11,
                border: '1px solid var(--color-border)', borderRadius: 4,
                background: '#fafafa', color: 'var(--color-fg)',
              }}
            />
            <input
              type="number"
              value={newBpWidth}
              onChange={(e) => setNewBpWidth(e.target.value)}
              placeholder="px"
              style={{
                width: 72, height: 26, padding: '0 8px', fontSize: 11,
                fontFamily: 'var(--font-code)',
                border: '1px solid var(--color-border)', borderRadius: 4,
                background: '#fafafa', color: 'var(--color-fg)',
                textAlign: 'right',
              }}
            />
            <button
              onClick={() => {
                if (newBpName && newBpWidth) {
                  const fullIdx = customBreakpoints.findIndex(bp => bp.width === 0);
                  const insert = { name: newBpName, width: parseInt(newBpWidth) };
                  const next = [...customBreakpoints];
                  if (fullIdx >= 0) next.splice(fullIdx, 0, insert);
                  else next.push(insert);
                  next.sort((a, b) => (a.width || 99999) - (b.width || 99999));
                  setCustomBreakpoints(next);
                  setNewBpName('');
                  setNewBpWidth('');
                }
              }}
              style={{
                height: 26, padding: '0 10px',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 4,
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      {devServerUrl && (
        <div style={{
          display: 'flex', gap: 4, padding: '8px 0', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode('isolated')}
            style={{
              height: 24, padding: '0 10px',
              background: mode === 'isolated' ? 'var(--color-primary)' : '#fff',
              color: mode === 'isolated' ? '#fff' : 'var(--color-fg)',
              border: mode === 'isolated' ? 'none' : '1px solid var(--color-border)',
              borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Isolated
          </button>
          <button
            onClick={() => setMode('devserver')}
            style={{
              height: 24, padding: '0 10px',
              background: mode === 'devserver' ? 'var(--color-primary)' : '#fff',
              color: mode === 'devserver' ? '#fff' : 'var(--color-fg)',
              border: mode === 'devserver' ? 'none' : '1px solid var(--color-border)',
              borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Dev Server
          </button>
          {mode === 'devserver' && (
            <span style={{ fontSize: 11, color: 'var(--color-fg-muted)', alignSelf: 'center', marginLeft: 8 }}>
              {devServerUrl}
            </span>
          )}
        </div>
      )}

      {/* Preview with breakpoint constraint */}
      <div style={{
        flex: 1, display: 'flex', justifyContent: 'center', minHeight: 0,
        background: breakpoint > 0 ? 'var(--color-stage)' : 'transparent',
        padding: breakpoint > 0 ? 8 : 0,
        transition: 'all 150ms',
      }}>
        {mode === 'devserver' && devServerUrl ? (
          <iframe
            src={devServerUrl}
            style={{
              width: breakpoint > 0 ? breakpoint : '100%',
              maxWidth: '100%',
              height: '100%',
              border: '1px solid var(--color-border)',
              borderRadius: 10, background: '#ffffff',
              transition: 'width 200ms ease',
            }}
            title="Dev Server Preview"
          />
        ) : (
          <iframe
            srcDoc={isolatedSrcdoc}
            style={{
              width: breakpoint > 0 ? breakpoint : '100%',
              maxWidth: '100%',
              height: '100%',
              border: '1px solid var(--color-border)',
              borderRadius: 10, background: '#ffffff',
              transition: 'width 200ms ease',
            }}
            sandbox="allow-scripts"
            title="Component Preview"
          />
        )}
      </div>
    </div>
  );
}
