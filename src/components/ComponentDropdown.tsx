import { useEffect, useMemo, useRef, useState } from 'react';
import type { Component, ComponentVariant } from '../types/component';

interface ComponentDropdownProps {
  components: Component[];
  selectedComponent: Component | null;
  selectedVariant: ComponentVariant | null;
  onSelect: (component: Component, variant: ComponentVariant) => void;
}

export function ComponentDropdown({
  components,
  selectedComponent,
  selectedVariant,
  onSelect,
}: ComponentDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return components;
    return components
      .map((c) => ({
        ...c,
        variants: c.variants.filter((v) =>
          `${c.name}.${v.variantName}`.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.variants.length > 0);
  }, [components, filter]);

  const label = selectedComponent && selectedVariant
    ? `${selectedComponent.name} · ${selectedVariant.variantName}`
    : 'Select component';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 28, padding: '0 10px',
          background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: 'var(--color-fg)',
          cursor: 'pointer',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--color-fg-muted)', fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 32, left: 0,
            minWidth: 280, maxHeight: 360, overflow: 'auto',
            background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            zIndex: 50, padding: 6,
          }}
        >
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            style={{
              width: '100%', height: 28, padding: '0 8px',
              border: '1px solid var(--color-border)', borderRadius: 6,
              fontSize: 12, marginBottom: 4, outline: 'none',
            }}
          />
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-fg-muted)' }}>
              No matches
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.directory}>
              <div style={{ padding: '6px 8px 2px', fontSize: 10, color: 'var(--color-fg-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                {c.name}
              </div>
              {c.variants.map((v) => {
                const isActive = selectedVariant?.filePath === v.filePath;
                return (
                  <button
                    key={v.filePath}
                    type="button"
                    onClick={() => { onSelect(c, v); setOpen(false); setFilter(''); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 10px', borderRadius: 4, border: 'none',
                      background: isActive ? 'rgba(0,113,227,0.08)' : 'transparent',
                      color: v.missing ? 'var(--color-danger)' : 'var(--color-fg)',
                      textDecoration: v.missing ? 'line-through' : 'none',
                      fontSize: 13, cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {v.variantName}{v.missing ? ' ⚠' : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
