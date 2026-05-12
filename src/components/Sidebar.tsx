import { Folder, Palette, MoveHorizontal, Square, Type, BoxSelect } from 'lucide-react';
import type { ProjectStructure } from '../types/component';

export type AppView = 'components' | 'hierarchy' | 'settings' | 'tokens' | 'export' | 'blocks';
export type TokenGroup = 'all' | 'colors' | 'spacing' | 'radius' | 'shadows' | 'typography';

interface SidebarProps {
  project: ProjectStructure;
  view: AppView;
  onViewChange: (view: AppView) => void;
  tokenGroup: TokenGroup;
  onTokenGroupChange: (group: TokenGroup) => void;
}

export function Sidebar({
  project,
  view,
  onViewChange,
  tokenGroup,
  onTokenGroupChange,
}: SidebarProps) {
  const goToTokens = (group: TokenGroup) => {
    onTokenGroupChange(group);
    onViewChange('tokens');
  };

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      height: '100%',
      background: '#f5f5f7',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {view === 'tokens' && (
          <Section label="Tokens">
            <NavItem icon={<Palette size={14} />} label="Colors" active={tokenGroup === 'colors'} onClick={() => goToTokens('colors')} />
            <NavItem icon={<MoveHorizontal size={14} />} label="Spacing" active={tokenGroup === 'spacing'} onClick={() => goToTokens('spacing')} />
            <NavItem icon={<Square size={14} />} label="Radius" active={tokenGroup === 'radius'} onClick={() => goToTokens('radius')} />
            <NavItem icon={<BoxSelect size={14} />} label="Shadows" active={tokenGroup === 'shadows'} onClick={() => goToTokens('shadows')} />
            <NavItem icon={<Type size={14} />} label="Typography" active={tokenGroup === 'typography'} onClick={() => goToTokens('typography')} />
          </Section>
        )}

        {view === 'blocks' && project.blocks && project.blocks.length > 0 && (
          <Section label="Blocks">
            {project.blocks.map((block, idx) => (
              <NavItem
                key={`block-${idx}`}
                icon={<Folder size={14} />}
                label={block.name}
                count={block.components.length}
                active={false}
                onClick={() => {}}
              />
            ))}
          </Section>
        )}
      </nav>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        padding: '0 4px 4px',
        fontSize: 11,
        color: 'var(--color-fg-muted)',
        fontWeight: 600,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({ icon, label, count, active, onClick }: {
  icon?: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        height: 30,
        padding: '0 8px',
        background: active ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 100ms ease',
        color: 'var(--color-fg)',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'rgba(0, 0, 0, 0.08)' : 'transparent'; }}
    >
      {icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-fg-muted)', flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {typeof count === 'number' && (
        <span style={{ fontSize: 12, color: 'var(--color-fg-muted)', flexShrink: 0, fontWeight: 400 }}>
          {count}
        </span>
      )}
    </button>
  );
}
