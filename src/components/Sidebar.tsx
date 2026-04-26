import { useState } from 'react';
import type { ProjectStructure, Component } from '../types/component';
import { SearchBar } from './SearchBar';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import saddleLogo from '/saddle-logo.png?url';

export type AppView = 'components' | 'hierarchy' | 'dashboard' | 'export';

interface SidebarProps {
  project: ProjectStructure | null;
  onSelectComponent: (component: Component) => void;
  selectedComponent: Component | null;
  onLoadProject: () => void;
  onConfigure: () => void;
  onExport: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
}

export function Sidebar({ project, onSelectComponent, selectedComponent, onLoadProject, onConfigure: _onConfigure, onExport, view, onViewChange }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const filteredComponents = project?.components.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <aside style={{
      width: collapsed ? 48 : 260,
      flexShrink: 0,
      height: '100%',
      background: '#f5f5f7',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 150ms ease',
      overflow: 'hidden',
    }}>
      <header style={{ padding: collapsed ? '12px 0' : '16px', flexShrink: 0, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            title="Expand sidebar"
          >
            <img src={saddleLogo} alt="Saddle" style={{ height: 22, objectFit: 'contain' }} />
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={saddleLogo} alt="Saddle" style={{ height: 24, objectFit: 'contain' }} />
              {project && (
                <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
                  {project.rootPath.split('/').pop()}
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-fg-subtle)', fontSize: 14, padding: '0 2px',
              }}
            >
              <PanelLeftClose size={14} />
            </button>
          </>
        )}
      </header>

      <nav style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 4px' : '8px 12px', display: collapsed ? 'none' : 'flex', flexDirection: 'column', gap: 16 }}>
        {!project ? (
          <div style={{ padding: '24px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
              No project loaded
            </div>
          </div>
        ) : (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Filter components..." />

            <Section label="Components">
              {filteredComponents.length === 0 ? (
                <div style={{ padding: '4px', fontSize: 13, color: 'var(--color-fg-subtle)', fontStyle: 'italic' }}>
                  {search ? 'No matches' : 'No components found'}
                </div>
              ) : (
                filteredComponents.map((component, idx) => (
                  <NavItem
                    key={idx}
                    label={component.name}
                    subtitle={`${component.variants.length} variant${component.variants.length !== 1 ? 's' : ''}`}
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
                    label={block.name}
                    subtitle={`${block.components.length} components`}
                    active={false}
                    onClick={() => {}}
                  />
                ))}
              </Section>
            )}

            <Section label="Views">
              <NavItem label="Hierarchy" active={view === 'hierarchy'} onClick={() => onViewChange('hierarchy')} />
              <NavItem label="Dashboard" active={view === 'dashboard'} onClick={() => onViewChange('dashboard')} />
            </Section>

            <Section label="Ship">
              <NavItem label="Export" active={view === 'export'} onClick={onExport} />
            </Section>
          </>
        )}
      </nav>

      <footer style={{ padding: '12px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: collapsed ? 'none' : 'block' }}>
        <button
          onClick={onLoadProject}
          style={{
            width: '100%',
            height: 34,
            padding: '0 16px',
            background: project ? '#ffffff' : 'var(--color-primary)',
            color: project ? 'var(--color-fg)' : '#ffffff',
            border: project ? '1px solid var(--color-border)' : 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: 'var(--elevation-1)',
            transition: 'all 100ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = project ? '#f5f5f7' : 'var(--color-primary-press)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = project ? '#ffffff' : 'var(--color-primary)';
          }}
        >
          {project ? 'Load Different Project' : 'Load Project'}
        </button>
      </footer>
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

function NavItem({ label, subtitle, active, onClick }: {
  label: string;
  subtitle?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minHeight: 28,
        padding: '6px 8px',
        background: active ? 'rgba(0, 122, 255, 0.1)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 100ms ease',
        color: active ? 'var(--color-primary)' : 'var(--color-fg)',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'rgba(0, 122, 255, 0.1)' : 'transparent'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{label}</div>
        {subtitle && (
          <div style={{ fontSize: 11, color: active ? 'var(--color-primary)' : 'var(--color-fg-muted)', marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
    </button>
  );
}
