import { Editor } from '@monaco-editor/react';
import styles from './CodeEditor.module.css';

interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string | undefined) => void;
}

export function CodeEditor({ value, language = 'typescript', readOnly = false, onChange }: CodeEditorProps) {
  return (
    <div className={styles.editorContainer}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={value}
        onChange={onChange}
        theme="vs-light"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'all',
          fontFamily: '"SF Mono", "JetBrains Mono", Monaco, "Courier New", monospace',
        }}
      />
    </div>
  );
}
