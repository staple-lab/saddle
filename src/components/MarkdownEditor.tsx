import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeEditor } from './CodeEditor';

interface MarkdownEditorProps {
  filePath: string;
  initialContent: string;
  onSave: (path: string, content: string) => Promise<void>;
}

export function MarkdownEditor({ filePath, initialContent, onSave }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [filePath, initialContent]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onSave(filePath, content).catch((err) => console.error('md save failed', err));
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, filePath]);

  const handleBlur = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    onSave(filePath, content).catch((err) => console.error('md save failed', err));
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div
        style={{ flex: 1, minHeight: 0, borderRight: '1px solid var(--color-border)' }}
        onBlur={handleBlur}
      >
        <CodeEditor
          value={content}
          language="markdown"
          readOnly={false}
          onChange={(next) => setContent(next ?? '')}
        />
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        padding: '14px 16px', background: '#fff',
        fontSize: 13, lineHeight: 1.6, color: 'var(--color-fg)',
      }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
