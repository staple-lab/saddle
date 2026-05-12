import { Settings } from 'lucide-react';
import type { AppView } from './Sidebar';

type Section = 'components' | 'tokens' | 'blocks';

interface TopBarProps {
  view: AppView;
  onSelectSection: (section: Section) => void;
  onOpenSettings: () => void;
  showBlocks: boolean;
}

export function TopBar({ view, onSelectSection, onOpenSettings, showBlocks }: TopBarProps) {
  const activeSection: Section | null =
    view === 'tokens' ? 'tokens'
    : view === 'components' ? 'components'
    : view === 'blocks' ? 'blocks'
    : null;

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 44,
        flexShrink: 0,
        background: '#f5f5f7',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingLeft: 96,
        paddingRight: 12,
        gap: 8,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          background: 'rgba(0,0,0,0.05)',
          borderRadius: 8,
        }}
      >
        <SegmentButton
          label="Components"
          active={activeSection === 'components'}
          onClick={() => onSelectSection('components')}
        />
        <SegmentButton
          label="Tokens"
          active={activeSection === 'tokens'}
          onClick={() => onSelectSection('tokens')}
        />
        {showBlocks && (
          <SegmentButton
            label="Blocks"
            active={activeSection === 'blocks'}
            onClick={() => onSelectSection('blocks')}
          />
        )}
      </div>
      <button
        onClick={onOpenSettings}
        title="Settings"
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: view === 'settings' ? 'rgba(0,0,0,0.08)' : 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--color-fg-muted)',
        }}
        onMouseEnter={(e) => {
          if (view !== 'settings') e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
        }}
        onMouseLeave={(e) => {
          if (view !== 'settings') e.currentTarget.style.background = 'transparent';
        }}
      >
        <Settings size={15} />
      </button>
    </div>
  );
}

function SegmentButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 24,
        padding: '0 12px',
        background: active ? '#ffffff' : 'transparent',
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        color: active ? 'var(--color-fg)' : 'var(--color-fg-muted)',
        cursor: 'pointer',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        transition: 'background 80ms, color 80ms',
      }}
    >
      {label}
    </button>
  );
}
