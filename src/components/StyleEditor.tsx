import { useState } from 'react';
import styles from './StyleEditor.module.css';

interface StyleEditorProps {
  tokens: Record<string, any>;
  onTokenChange: (tokenName: string, value: string) => void;
}

export function StyleEditor({ tokens, onTokenChange }: StyleEditorProps) {
  const [editingToken, setEditingToken] = useState<string | null>(null);

  const renderTokenControl = (key: string, value: any) => {
    // Detect token type from value
    const isColor = typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'));
    const isSpacing = typeof value === 'string' && (value.includes('px') || value.includes('rem'));
    const isBorderRadius = key.toLowerCase().includes('radius');

    if (isColor) {
      return (
        <div className={styles.tokenControl}>
          <label className={styles.tokenLabel}>
            <span className={styles.tokenName}>{key}</span>
            <div className={styles.colorControl}>
              <input
                type="color"
                value={value.startsWith('#') ? value : '#000000'}
                onChange={(e) => onTokenChange(key, e.target.value)}
                className={styles.colorPicker}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onTokenChange(key, e.target.value)}
                className={styles.colorInput}
              />
            </div>
          </label>
        </div>
      );
    }

    if (isSpacing || isBorderRadius) {
      // Extract numeric value
      const numericValue = parseInt(value) || 0;
      const unit = value.replace(numericValue.toString(), '') || 'px';

      return (
        <div className={styles.tokenControl}>
          <label className={styles.tokenLabel}>
            <span className={styles.tokenName}>{key}</span>
            <div className={styles.sliderControl}>
              <input
                type="range"
                min="0"
                max={isBorderRadius ? "50" : "100"}
                value={numericValue}
                onChange={(e) => onTokenChange(key, `${e.target.value}${unit}`)}
                className={styles.slider}
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onTokenChange(key, e.target.value)}
                className={styles.valueInput}
              />
            </div>
          </label>
        </div>
      );
    }

    // Default: text input
    return (
      <div className={styles.tokenControl}>
        <label className={styles.tokenLabel}>
          <span className={styles.tokenName}>{key}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onTokenChange(key, e.target.value)}
            className={styles.textInput}
          />
        </label>
      </div>
    );
  };

  if (!tokens || Object.keys(tokens).length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No tokens defined for this variant</p>
        <button className={styles.addButton}>+ Add Token</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tokenList}>
        {Object.entries(tokens).map(([key, value]) => (
          <div key={key} className={styles.token}>
            {renderTokenControl(key, value)}
          </div>
        ))}
      </div>
      <button className={styles.addButton}>+ Add Token</button>
    </div>
  );
}
