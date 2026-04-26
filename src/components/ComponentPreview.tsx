import { useMemo } from 'react';

interface ComponentPreviewProps {
  code: string;
  frontmatter?: any;
  liveTokens?: Record<string, string>;
}

// Parse JSX into renderable HTML, preserving the full DOM hierarchy
function jsxToHtml(code: string, tokens: Record<string, string>): string {
  // Find the return statement
  const returnMatch = code.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*\}?\s*$/);
  if (!returnMatch) return '<div>No renderable JSX found</div>';

  let jsx = returnMatch[1].trim();

  // Replace JSX expressions with static values
  // {label} -> "Label"
  jsx = jsx.replace(/\{label\}/g, 'Label');
  jsx = jsx.replace(/\{title\}/g, 'Title');
  jsx = jsx.replace(/\{children\s*\|\|\s*['"]([^'"]+)['"]\}/g, '$1');
  jsx = jsx.replace(/\{children\}/g, 'Content goes here');
  jsx = jsx.replace(/\{initials\}/g, 'AB');
  jsx = jsx.replace(/\{placeholder\}/g, '');
  // Remove conditional renders like {x && (...)}
  jsx = jsx.replace(/\{[\w.]+\s*&&\s*\(([\s\S]*?)\)\}/g, '$1');
  jsx = jsx.replace(/\{[\w.]+\s*\?\s*<[\s\S]*?:\s*([\s\S]*?)\}/g, '$1');
  // Remove simple expressions like {opt}
  jsx = jsx.replace(/\{(\w+)\}/g, '$1');
  // Remove event handlers
  jsx = jsx.replace(/\s*on\w+={[^}]*}/g, '');
  // Remove ref, key attributes
  jsx = jsx.replace(/\s*(?:ref|key)={[^}]*}/g, '');

  // Convert className to class
  jsx = jsx.replace(/className={[^}]*}/g, '');
  jsx = jsx.replace(/className="([^"]*)"/g, 'class="$1"');

  // Convert style={{ ... }} to style="..."
  jsx = jsx.replace(/style=\{\{([\s\S]*?)\}\}/g, (_, styleBlock) => {
    const pairs: string[] = [];
    // Match key: 'value' or key: "value" or key: number
    const propRegex = /(\w+)\s*:\s*(?:['"]([^'"]*?)['"]|(\d+))/g;
    let m;
    while ((m = propRegex.exec(styleBlock)) !== null) {
      const prop = m[1].replace(/([A-Z])/g, '-$1').toLowerCase();
      const val = m[2] || m[3];
      pairs.push(`${prop}: ${val}`);
    }
    // Also check for token references: key: checked ? 'x' : 'y'
    const ternaryRegex = /(\w+)\s*:\s*\w+\s*\?\s*['"]([^'"]*)['"]\s*:\s*['"]([^'"]*)['"]/g;
    while ((m = ternaryRegex.exec(styleBlock)) !== null) {
      const prop = m[1].replace(/([A-Z])/g, '-$1').toLowerCase();
      pairs.push(`${prop}: ${m[3]}`); // use the false/default value
    }
    return `style="${pairs.join('; ')}"`;
  });

  // Apply live token overrides to the root element's style
  if (Object.keys(tokens).length > 0) {
    const tokenStyle = Object.entries(tokens)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
      .join('; ');

    // Add tokens to the first element's style
    const firstStyleMatch = jsx.match(/style="([^"]*)"/);
    if (firstStyleMatch) {
      jsx = jsx.replace(firstStyleMatch[0], `style="${firstStyleMatch[1]}; ${tokenStyle}"`);
    } else {
      // No style attribute on root, add one
      jsx = jsx.replace(/<(\w+)/, `<$1 style="${tokenStyle}"`);
    }
  }

  // Convert self-closing tags
  jsx = jsx.replace(/<(\w+)([^>]*)\/>/g, '<$1$2></$1>');

  // Remove JSX fragments
  jsx = jsx.replace(/<>/g, '').replace(/<\/>/g, '');

  // Clean up any remaining JSX expressions
  jsx = jsx.replace(/\{[^}]*\}/g, '');

  // Remove type/interface/import lines that might have leaked
  jsx = jsx.replace(/import\s+.*?;/g, '');

  return jsx;
}

export function ComponentPreview({ code, frontmatter, liveTokens }: ComponentPreviewProps) {
  const tokens = liveTokens || frontmatter?.tokens || {};
  const componentName = frontmatter?.name || 'Component';

  const renderedHtml = useMemo(() => jsxToHtml(code, tokens), [code, tokens]);

  const srcdoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<style>
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <iframe
        srcDoc={srcdoc}
        style={{
          flex: 1,
          width: '100%',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          background: '#ffffff',
        }}
        sandbox="allow-scripts"
        title="Component Preview"
      />
    </div>
  );
}
