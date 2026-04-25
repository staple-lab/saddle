import { useState } from 'react';
import styles from './StyleEditor.module.css';

interface StyleEditorProps {
  tokens: Record<string, string>;
  onTokenChange: (tokenName: string, value: string) => void;
}

// Available design tokens (will load from saddle.config.json later)
const DESIGN_TOKENS = {
  colors: {
    primary: '#7c3aed',
    secondary: '#f8f8f8',
    brand: '#000000',
    accent: '#7c3aed',
    background: '#ffffff',
    surface: '#f8f8f8',
    text: '#2e3338',
    subtext: '#6c7278',
    border: '#e5e7eb',
    error: '#dc2626',
    success: '#16a34a',
    warning: '#ea580c',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  rounded: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '16px',
    full: '9999px',
  },
};

// Detect CSS property category
function getCategoryForProperty(propName: string): keyof typeof DESIGN_TOKENS | null {
  const lower = propName.toLowerCase();
  if (lower.includes('color') || lower.includes('background') || lower.includes('border')) {
    return 'colors';
  }
  if (lower.includes('padding') || lower.includes('margin') || lower.includes('spacing') || lower.includes('gap')) {
    return 'spacing';
  }
  if (lower.includes('radius') || lower.includes('rounded')) {
    return 'rounded';
  }
  return null;
}

export function StyleEditor({ tokens, onTokenChange }: StyleEditorProps) {
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set(Object.keys(tokens)));

  const toggleProp = (propName: string) => {
    const newExpanded = new Set(expandedProps);
    if (newExpanded.has(propName)) {
      newExpanded.delete(propName);
    } else {
      newExpanded.add(propName);
    }
    setExpandedProps(newExpanded);
  };

  const renderPropertyControl = (propName: string, value: string) => {
    const category = getCategoryForProperty(propName);
    const isExpanded = expandedProps.has(propName);

    return (
      <div key={propName} className={styles.property}>
        <div className={styles.propertyHeader} onClick={() => toggleProp(propName)}>
          <span className={styles.propName}>{propName}</span>
          <span className={styles.propValue}>{value}</span>
          {category === 'colors' && (
            <span
              className={styles.colorSwatch}
              style={{ backgroundColor: value }}
            />
          )}
        </div>

        {isExpanded && category && (
          <div className={styles.propertyControls}>
            <div className={styles.tokenGrid}>
              {Object.entries(DESIGN_TOKENS[category]).map(([tokenName, tokenValue]) => (
                <button
                  key={tokenName}
                  className={`${styles.tokenOption} ${value === tokenValue ? styles.selected : ''}`}
                  onClick={() => onTokenChange(propName, tokenValue)}
                  title={`${tokenName}: ${tokenValue}`}
                >
                  {category === 'colors' ? (
                    <>
                      <span
                        className={styles.tokenColorSwatch}
                        style={{ backgroundColor: tokenValue }}
                      />
                      <span className={styles.tokenLabel}>{tokenName}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.tokenLabel}>{tokenName}</span>
                      <span className={styles.tokenValueLabel}>{tokenValue}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            <div className={styles.customInput}>
              <input
                type="text"
                value={value}
                onChange={(e) => onTokenChange(propName, e.target.value)}
                className={styles.customValueInput}
                placeholder="Custom value..."
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!tokens || Object.keys(tokens).length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No style tokens defined</p>
        <p className={styles.hint}>Add tokens to the component frontmatter</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.propertiesList}>
        {Object.entries(tokens).map(([propName, value]) =>
          renderPropertyControl(propName, value)
        )}
      </div>
    </div>
  );
}
