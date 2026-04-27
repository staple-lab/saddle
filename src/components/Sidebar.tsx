import { PanelLeftClose, PanelLeft, Folder, Settings, Network, Package, Palette, MoveHorizontal, Square, Type } from 'lucide-react';
import type { ProjectStructure, Component } from '../types/component';

export type AppView = 'components' | 'hierarchy' | 'settings' | 'tokens' | 'export';
export type TokenGroup = 'all' | 'colors' | 'spacing' | 'radius' | 'typography';

interface SidebarProps {
  project: ProjectStructure | null;
  onSelectComponent: (component: Component) => void;
  selectedComponent: Component | null;
  onLoadProject: () => void;
  onConfigure: () => void;
  onExport: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
  tokenGroup: TokenGroup;
  onTokenGroupChange: (group: TokenGroup) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({
  project,
  onSelectComponent,
  selectedComponent,
  onLoadProject,
  onConfigure: _onConfigure,
  onExport,
  view,
  onViewChange,
  tokenGroup,
  onTokenGroupChange,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const goToTokens = (group: TokenGroup) => {
    onTokenGroupChange(group);
    onViewChange('tokens');
  };

  const filteredComponents = project?.components ?? [];

  if (collapsed) {
    return (
      <aside
        data-tauri-drag-region
        style={{
          width: 40,
          flexShrink: 0,
          height: '100%',
          background: '#f5f5f7',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
        }}
      >
        <ToggleButton title="Show sidebar" onClick={onToggleCollapsed}>
          <PanelLeft size={16} />
        </ToggleButton>
      </aside>
    );
  }

  return (
    <aside style={{
      width: 260,
      flexShrink: 0,
      height: '100%',
      background: '#f5f5f7',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <header
        data-tauri-drag-region
        style={{
          height: 36,
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        <ToggleButton title="Hide sidebar" onClick={onToggleCollapsed}>
          <PanelLeftClose size={16} />
        </ToggleButton>
      </header>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!project ? (
          <div style={{ padding: '24px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
              No project loaded
            </div>
          </div>
        ) : (
          <>
            <Section label="Tokens">
              <NavItem icon={<Palette size={14} />} label="Colors" active={view === 'tokens' && tokenGroup === 'colors'} onClick={() => goToTokens('colors')} />
              <NavItem icon={<MoveHorizontal size={14} />} label="Spacing" active={view === 'tokens' && tokenGroup === 'spacing'} onClick={() => goToTokens('spacing')} />
              <NavItem icon={<Square size={14} />} label="Radius" active={view === 'tokens' && tokenGroup === 'radius'} onClick={() => goToTokens('radius')} />
              <NavItem icon={<Type size={14} />} label="Typography" active={view === 'tokens' && tokenGroup === 'typography'} onClick={() => goToTokens('typography')} />
            </Section>

            <Section label="Components">
              {filteredComponents.length === 0 ? (
                <div style={{ padding: '4px 8px', fontSize: 13, color: 'var(--color-fg-subtle)', fontStyle: 'italic' }}>
                  No components found
                </div>
              ) : (
                filteredComponents.map((component, idx) => (
                  <NavItem
                    key={idx}
                    icon={<Folder size={14} />}
                    label={component.name}
                    count={component.variants.length}
                    active={view === 'components' && selectedComponent?.name === component.name}
                    onClick={() => { onSelectComponent(component); onViewChange('components'); }}
                  />
                ))
              )}
            </Section>

            {project.blocks && project.blocks.length > 0 && (
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

            <Section label="Views">
              <NavItem icon={<Network size={14} />} label="Hierarchy" active={view === 'hierarchy'} onClick={() => onViewChange('hierarchy')} />
            </Section>

            <Section label="Ship">
              <NavItem icon={<Package size={14} />} label="Export" active={view === 'export'} onClick={onExport} />
            </Section>
          </>
        )}
      </nav>

      <footer style={{ padding: '12px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {project && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
            <div
              title={project.rootPath}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-fg)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {project.rootPath.split('/').pop()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
              {project.components.length} component{project.components.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
        <button
          onClick={() => (project ? onViewChange('settings') : onLoadProject())}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            height: 32,
            padding: '0 10px',
            background: project ? 'transparent' : 'var(--color-primary)',
            color: project ? 'var(--color-fg)' : '#ffffff',
            border: project ? 'none' : 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: project ? 400 : 500,
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: project ? 'none' : 'var(--elevation-1)',
            transition: 'background 100ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = project ? 'rgba(0,0,0,0.04)' : 'var(--color-primary-press)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = project ? 'transparent' : 'var(--color-primary)';
          }}
        >
          {project ? (
            <>
              <Settings size={14} style={{ flexShrink: 0, color: 'var(--color-fg-muted)' }} />
              <span>Settings</span>
            </>
          ) : (
            'Load Project'
          )}
        </button>
      </footer>
    </aside>
  );
}

function ToggleButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 6,
        borderRadius: 6,
        color: 'var(--color-fg-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
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
