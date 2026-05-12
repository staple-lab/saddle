import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useTokens, addToken, addColorToken, addGroup, type TokenSlot } from './tokens';

type Props = {
  slot: TokenSlot;
  /** Current css-var expression, e.g. `var(--spacing-md)`. */
  value: string;
  onPick: (cssVar: string) => void;
};

export function TokenDropdown({ slot, value, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (adding) nameRef.current?.focus();
  }, [adding]);

  const allTokens = useTokens();
  const items = allTokens[slot] ?? [];
  const currentToken = items.find((t) => `var(${t.cssVar})` === value);

  const submitNewToken = () => {
    const name = newName.trim();
    const v = newValue.trim();
    if (!name || !v) return;

    let cssVar: string;
    if (slot === 'color') {
      // For colors we need a group. Use existing 'Custom' group or create one.
      let custom = allTokens.semanticGroups.find((g) => g.id === 'custom');
      if (!custom) {
        addGroup('Custom');
        // addGroup uses slug(label) → 'custom'
      }
      addColorToken('custom', name, v);
      cssVar = `--custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    } else {
      cssVar = addToken(slot, name, v);
    }

    onPick(`var(${cssVar})`);
    setNewName('');
    setNewValue('');
    setAdding(false);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', height: 24, padding: '0 6px',
          background: '#ffffff',
          border: '1px solid ' + (open ? 'var(--color-accent)' : 'var(--color-border)'),
          borderRadius: 4,
          color: 'var(--color-fg)',
          fontSize: 11,
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: open ? '0 0 0 2px rgba(224, 124, 62, 0.22)' : 'none',
          minWidth: 0,
        }}
      >
        {slot === 'color' && currentToken && (
          <span style={{
            width: 12, height: 12, borderRadius: 2,
            background: currentToken.value, flexShrink: 0,
            border: '1px solid rgba(0,0,0,0.1)',
          }} />
        )}
        <span style={{
          flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: currentToken ? 'var(--font-code)' : 'inherit',
          color: currentToken ? 'var(--color-accent)' : 'var(--color-fg-muted)',
        }}>
          {currentToken ? currentToken.name : (value || 'Pick a token')}
        </span>
        <ChevronDown size={11} style={{ color: 'var(--color-fg-muted)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: 220,
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            padding: 4,
            zIndex: 20,
            maxHeight: 320,
            overflow: 'auto',
          }}
        >
          <div style={{
            fontSize: 9, color: '#6c7278',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '6px 8px 4px', fontWeight: 600,
          }}>
            {slot} tokens
          </div>
          {items.length === 0 && !adding && (
            <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--color-fg-muted)' }}>
              No tokens defined yet.
            </div>
          )}
          {items.map((t) => {
            const isActive = `var(${t.cssVar})` === value;
            return (
              <button
                key={t.cssVar}
                type="button"
                onClick={() => { onPick(`var(${t.cssVar})`); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '5px 8px',
                  background: isActive ? 'rgba(224, 124, 62, 0.10)' : 'transparent',
                  border: 'none', borderRadius: 4,
                  cursor: 'pointer', textAlign: 'left',
                  fontSize: 12,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f6f6f7'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {slot === 'color' && (
                  <span style={{
                    width: 14, height: 14, borderRadius: 2,
                    background: t.value, border: '1px solid rgba(0,0,0,0.1)',
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ fontFamily: 'var(--font-code)', fontSize: 11, flex: 1 }}>{t.name}</span>
                <span style={{ fontFamily: 'var(--font-code)', fontSize: 10, color: '#6c7278' }}>{t.value}</span>
              </button>
            );
          })}

          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

          {adding ? (
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                ref={nameRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="token-name"
                style={inputStyle}
                onKeyDown={(e) => { if (e.key === 'Enter') submitNewToken(); if (e.key === 'Escape') setAdding(false); }}
              />
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={slot === 'color' ? '#000000' : 'value'}
                style={inputStyle}
                onKeyDown={(e) => { if (e.key === 'Enter') submitNewToken(); if (e.key === 'Escape') setAdding(false); }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  style={miniButtonGhost}
                >Cancel</button>
                <button
                  type="button"
                  onClick={submitNewToken}
                  disabled={!newName.trim() || !newValue.trim()}
                  style={{
                    ...miniButtonPrimary,
                    opacity: (!newName.trim() || !newValue.trim()) ? 0.5 : 1,
                  }}
                >Add</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '6px 8px',
                background: 'transparent', border: 'none', borderRadius: 4,
                cursor: 'pointer', textAlign: 'left',
                fontSize: 11, color: 'var(--color-accent)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f6f6f7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Plus size={11} /> Add token…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 26, padding: '0 8px',
  border: '1px solid var(--color-border)', borderRadius: 4,
  fontSize: 11, fontFamily: 'var(--font-code)',
  background: '#ffffff', outline: 'none',
};

const miniButtonGhost: React.CSSProperties = {
  height: 24, padding: '0 10px',
  background: 'transparent', border: '1px solid var(--color-border)',
  borderRadius: 4, fontSize: 11, cursor: 'pointer',
};

const miniButtonPrimary: React.CSSProperties = {
  height: 24, padding: '0 10px',
  background: 'var(--color-fg)', border: 'none',
  borderRadius: 4, fontSize: 11, fontWeight: 500, color: '#fff',
  cursor: 'pointer',
};
