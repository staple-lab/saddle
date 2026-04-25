import { useState } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{
      position: 'relative',
      padding: '0 4px',
    }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 28,
          padding: '0 8px 0 28px',
          background: focused ? '#ffffff' : 'rgba(0, 0, 0, 0.04)',
          border: `1px solid ${focused ? 'var(--color-primary)' : 'transparent'}`,
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--color-fg)',
          outline: 'none',
          transition: 'all 100ms ease',
          boxShadow: focused ? 'var(--elevation-focus)' : 'none',
        }}
      />
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-fg-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </div>
  );
}
