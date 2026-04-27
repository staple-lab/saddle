import { useState, useRef, useEffect } from 'react';
import { Diamond } from 'lucide-react';
import { useTokens, type TokenSlot } from './tokens';

type Props = {
  slot: TokenSlot;
  value: string;
  onPick: (cssVar: string) => void;
};

export function TokenPicker({ slot, value, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const allTokens = useTokens();
  const items = allTokens[slot] ?? [];
  const currentToken = items.find((t) => `var(${t.cssVar})` === value);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={currentToken ? currentToken.name : 'Pick a token'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          height: 24,
          padding: currentToken ? '0 6px' : '0',
          width: currentToken ? 'auto' : 24,
          maxWidth: 80,
          justifyContent: 'center',
          background: open ? '#ffffff' : 'var(--color-stage)',
          color: currentToken ? 'var(--color-accent)' : 'var(--color-fg)',
          border: '1px solid ' + (open ? 'var(--color-accent)' : 'var(--color-border)'),
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <Diamond
          size={9}
          fill="currentColor"
          style={{ color: currentToken ? 'var(--color-accent)' : 'var(--color-fg-muted)', flexShrink: 0 }}
        />
        {currentToken && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentToken.name}</span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            boxShadow: 'var(--elevation-2)',
            padding: 8,
            minWidth: 200,
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 10, color: '#6c7278', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 6px', fontWeight: 600 }}>
            {slot} tokens
          </div>
          {items.map((t) => (
            <button
              key={t.cssVar}
              type="button"
              onClick={() => {
                onPick(`var(${t.cssVar})`);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f8f8')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {slot === 'color' && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    background: t.value,
                    borderRadius: 3,
                    border: '1px solid rgba(0,0,0,0.1)',
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 11, flex: 1 }}>{t.name}</span>
              <span style={{ fontSize: 10, color: '#6c7278', fontFamily: 'SF Mono, monospace' }}>{t.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
