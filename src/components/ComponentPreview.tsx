import { useMemo } from 'react';

interface ComponentPreviewProps {
  code: string;
  frontmatter?: any;
  liveTokens?: Record<string, string>;
}

export function ComponentPreview({ code, frontmatter, liveTokens }: ComponentPreviewProps) {
  const tokens = liveTokens || frontmatter?.tokens || {};

  // Build inline style string from tokens
  const tokenStyles = Object.entries(tokens)
    .map(([key, value]) => {
      const cssProp = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssProp}: ${value}`;
    })
    .join('; ');

  const srcdoc = useMemo(() => `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .preview-component {
    ${tokenStyles}
  }
</style>
</head>
<body>
  <div class="preview-component" style="${tokenStyles}">
    ${frontmatter?.name || 'Component'}
  </div>
</body>
</html>`, [code, tokenStyles, frontmatter?.name]);

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
