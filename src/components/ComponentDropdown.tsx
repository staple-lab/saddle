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
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) { setPopoverRect(null); return; }
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPopoverRect({ top: r.bottom + 4, left: r.left });
    }
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
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
          background: '#fff',
          border: `1px solid ${open ? 'var(--color-accent)' : 'var(--color-border)'}`,
          boxShadow: open ? '0 0 0 2px rgba(224, 124, 62, 0.22)' : 'none',
          borderRadius: 6,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: 'var(--color-fg)',
          cursor: 'pointer',
          transition: 'border-color 100ms, box-shadow 100ms',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--color-fg-muted)', fontSize: 9 }}>▾</span>
      </button>

      {open && popoverRect && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed', top: popoverRect.top, left: popoverRect.left,
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
                  <VariantItem
                    key={v.filePath}
                    label={`${v.variantName}${v.missing ? ' ⚠' : ''}`}
                    isActive={isActive}
                    isMissing={!!v.missing}
                    onClick={() => { onSelect(c, v); setOpen(false); setFilter(''); }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantItem({
  label,
  isActive,
  isMissing,
  onClick,
}: {
  label: string;
  isActive: boolean;
  isMissing: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const background = isActive
    ? 'rgba(224, 124, 62, 0.12)'
    : hover
      ? 'rgba(0,0,0,0.04)'
      : 'transparent';
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '6px 10px', borderRadius: 4, border: 'none',
        background,
        color: isMissing
          ? 'var(--color-danger)'
          : isActive
            ? 'var(--color-accent)'
            : 'var(--color-fg)',
        textDecoration: isMissing ? 'line-through' : 'none',
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        cursor: 'pointer',
        transition: 'background 80ms ease, color 80ms ease',
      }}
    >
      {label}
    </button>
  );
}
