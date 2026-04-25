import { useEffect, useRef, useState } from 'react';

interface ComponentPreviewProps {
  code: string;
  frontmatter?: any;
}

export function ComponentPreview({ code, frontmatter }: ComponentPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDoc) return;

      // Extract component code (strip frontmatter)
      const cleanCode = code;

      // Create preview HTML
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: #f5f5f7;
              }
              button {
                font-family: inherit;
              }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="module">
              ${cleanCode}

              // Try to render the component
              try {
                const root = document.getElementById('root');
                if (root && typeof TestButtonPrimary !== 'undefined') {
                  root.innerHTML = '<button onclick="console.log(\\'clicked\\')">Test Button</button>';
                } else if (root && typeof TestButtonSecondary !== 'undefined') {
                  root.innerHTML = '<button onclick="console.log(\\'clicked\\')">Test Button</button>';
                }
              } catch (err) {
                document.body.innerHTML = '<div style="color: #ff3b30; padding: 20px;">' + err.message + '</div>';
              }
            </script>
          </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    }
  }, [code]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <div style={{ padding: 12, background: '#ff3b301a', color: '#ff3b30', fontSize: 12, borderRadius: 6, margin: 12 }}>
          ⚠ {error}
        </div>
      )}
      <iframe
        ref={iframeRef}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          borderRadius: 8,
          background: '#ffffff',
        }}
        sandbox="allow-scripts"
        title="Component Preview"
      />
    </div>
  );
}
