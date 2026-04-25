import { useState, useRef, useEffect } from 'react';
import { tokens, type TokenSlot } from './tokens';

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

  const items = tokens[slot] ?? [];
  const currentToken = items.find((t) => `var(${t.cssVar})` === value);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          background: open ? '#eff6ff' : '#f8fafc',
          color: '#7c3aed',
          border: '1px solid ' + (open ? '#7c3aed' : '#e5e7eb'),
          borderRadius: '4px',
          fontSize: 11,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {currentToken ? currentToken.name : 'token'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 6,
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
