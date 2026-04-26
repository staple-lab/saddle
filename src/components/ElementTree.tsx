import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';

interface ElementNode {
  tag: string;
  className?: string;
  styles: Record<string, string>;
  children: ElementNode[];
  text?: string;
}

interface ElementTreeProps {
  code: string;
  tokens: Record<string, string>;
  onSelectElement: (styles: Record<string, string>, path: string) => void;
  selectedPath: string | null;
}

// Parse JSX code into a simplified element tree
function parseJSXToTree(code: string, tokens: Record<string, string>): ElementNode[] {
  const nodes: ElementNode[] = [];

  // Find return statement
  const returnMatch = code.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*\}?\s*;?\s*$/);
  if (!returnMatch) return nodes;

  const jsx = returnMatch[1];
  parseJSXBlock(jsx, nodes, tokens);
  return nodes;
}

function parseJSXBlock(jsx: string, nodes: ElementNode[], tokens: Record<string, string>) {
  // Match opening tags with their attributes
  const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  const selfClosingRegex = /<(\w+)([^>]*)\/>/g;

  let match;

  // Self-closing tags
  while ((match = selfClosingRegex.exec(jsx)) !== null) {
    const [, tag, attrs] = match;
    const styles = extractInlineStyles(attrs, tokens);
    const className = extractClassName(attrs);
    nodes.push({ tag, className, styles, children: [], text: undefined });
  }

  // Tags with children
  const tagRegex2 = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  while ((match = tagRegex2.exec(jsx)) !== null) {
    const [, tag, attrs, inner] = match;
    const styles = extractInlineStyles(attrs, tokens);
    const className = extractClassName(attrs);
    const children: ElementNode[] = [];

    // Check for text content
    const textContent = inner.replace(/<[^>]*>/g, '').trim();
    const text = textContent.startsWith('{') ? textContent : textContent || undefined;

    // Recurse into children
    if (inner.includes('<')) {
      parseJSXBlock(inner, children, tokens);
    }

    nodes.push({ tag, className, styles, children, text });
  }
}

function extractInlineStyles(attrs: string, tokens: Record<string, string>): Record<string, string> {
  const styles: Record<string, string> = {};

  // Match style={{ ... }}
  const styleMatch = attrs.match(/style=\{\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\}/);
  if (styleMatch) {
    const block = styleMatch[1];
    const propRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = propRegex.exec(block)) !== null) {
      styles[m[1]] = m[2];
    }
  }

  // Merge with frontmatter tokens (tokens override/supplement)
  return { ...styles, ...tokens };
}

function extractClassName(attrs: string): string | undefined {
  const match = attrs.match(/className=\{?["']?([^"'\s}]+)/);
  return match ? match[1] : undefined;
}

export function ElementTree({ code, tokens, onSelectElement, selectedPath }: ElementTreeProps) {
  const tree = useMemo(() => parseJSXToTree(code, tokens), [code, tokens]);

  if (tree.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
        No elements parsed from component code
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-code)', fontSize: 12, padding: '8px 0' }}>
      {tree.map((node, idx) => (
        <TreeNode
          key={idx}
          node={node}
          depth={0}
          path={`${idx}`}
          onSelect={onSelectElement}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, path, onSelect, selectedPath }: {
  node: ElementNode;
  depth: number;
  path: string;
  onSelect: (styles: Record<string, string>, path: string) => void;
  selectedPath: string | null;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children.length > 0 || node.text;
  const isSelected = selectedPath === path;
  const styleCount = Object.keys(node.styles).length;

  return (
    <div>
      <div
        onClick={() => {
          onSelect(node.styles, path);
          if (hasChildren) setExpanded(!expanded);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px 3px ' + (12 + depth * 16) + 'px',
          cursor: 'pointer',
          background: isSelected ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
          transition: 'background 80ms',
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        {hasChildren && (
          <span style={{
            fontSize: 8, color: 'var(--color-fg-subtle)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 80ms', display: 'inline-block',
          }}>
<ChevronRight size={10} />
          </span>
        )}
        {!hasChildren && <span style={{ width: 8 }} />}

        <span style={{ color: '#881280' }}>&lt;{node.tag}</span>
        {node.className && (
          <span style={{ color: '#994500' }}>.{node.className}</span>
        )}
        <span style={{ color: '#881280' }}>&gt;</span>

        {styleCount > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 10,
            color: 'var(--color-primary)', fontWeight: 600,
            background: 'rgba(0,122,255,0.08)', padding: '1px 5px',
            borderRadius: 3,
          }}>
            {styleCount} styles
          </span>
        )}
      </div>

      {expanded && (
        <>
          {/* Show computed styles inline when selected */}
          {isSelected && styleCount > 0 && (
            <div style={{
              margin: '0 0 0 ' + (28 + depth * 16) + 'px',
              padding: '4px 8px',
              background: '#fafafa',
              borderLeft: '2px solid var(--color-border)',
              fontSize: 11,
            }}>
              {Object.entries(node.styles).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 4, padding: '1px 0' }}>
                  <span style={{ color: '#007AFF' }}>{k}</span>
                  <span style={{ color: '#666' }}>:</span>
                  <span style={{ color: '#1d1d1f' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {node.text && (
            <div style={{
              padding: '2px 8px 2px ' + (28 + depth * 16) + 'px',
              color: '#1d1d1f', fontSize: 11,
            }}>
              {node.text}
            </div>
          )}

          {node.children.map((child, idx) => (
            <TreeNode
              key={idx}
              node={child}
              depth={depth + 1}
              path={`${path}.${idx}`}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}

          <div style={{
            padding: '2px 8px 2px ' + (12 + depth * 16) + 'px',
            color: '#881280', fontSize: 12,
          }}>
            &lt;/{node.tag}&gt;
          </div>
        </>
      )}
    </div>
  );
}
