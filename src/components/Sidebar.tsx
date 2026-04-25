import { useState } from 'react';
import type { ProjectStructure, Component } from '../types/component';

interface SidebarProps {
  project: ProjectStructure | null;
  onSelectComponent: (component: Component) => void;
  selectedComponent: Component | null;
  onLoadProject: () => void;
  onConfigure: () => void;
  onExport: () => void;
  view: 'components' | 'export';
}

export function Sidebar({ project, onSelectComponent, selectedComponent, onLoadProject, onConfigure, onExport, view }: SidebarProps) {
  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        height: '100%',
        background: 'var(--color-surface-elev)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <header style={{ padding: '12px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              boxShadow: 'var(--elevation-1)',
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-fg)' }}>
            {project ? 'Components' : 'Saddle'}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!project ? (
          <div style={{ padding: '20px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              No project loaded. Select a component library to get started.
            </div>
          </div>
        ) : (
          <Section label="Components">
            {project.components.length === 0 ? (
              <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--color-fg-subtle)', fontStyle: 'italic' }}>
                No components found
              </div>
            ) : (
              project.components.map((component, idx) => (
                <NavItem
                  key={idx}
                  label={component.name}
                  subtitle={`${component.variants.length} variant${component.variants.length !== 1 ? 's' : ''}`}
                  active={selectedComponent?.name === component.name}
                  onClick={() => onSelectComponent(component)}
                />
              ))
            )}
          </Section>
        )}

        {project && (
          <>
            <Section label="Project">
              <NavItem
                label="Configure"
                icon="⚙"
                active={false}
                onClick={onConfigure}
              />
            </Section>

            <Section label="Ship">
              <NavItem
                label="Export"
                icon="↗"
                active={view === 'export'}
                onClick={onExport}
              />
            </Section>
          </>
        )}
      </nav>

      {/* Footer */}
      <footer style={{ padding: 8, borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <button
          onClick={onLoadProject}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: project ? 'transparent' : 'var(--color-primary)',
            color: project ? 'var(--color-fg)' : '#ffffff',
            border: project ? '1px solid var(--color-border)' : 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: project ? 'none' : 'var(--elevation-1)',
            transition: 'all 100ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = project ? 'rgba(0, 0, 0, 0.04)' : 'var(--color-primary-press)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = project ? 'transparent' : 'var(--color-primary)';
          }}
        >
          {project ? 'Load Different Project' : '+ Load Project'}
        </button>
      </footer>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          padding: '0 8px 4px',
          fontSize: 10,
          color: 'var(--color-fg-subtle)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({
  icon,
  label,
  subtitle,
  active,
  onClick,
}: {
  icon?: string;
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
        gap: 6,
        width: '100%',
        padding: '4px 8px',
        background: active ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 100ms ease',
        color: active ? 'var(--color-primary)' : 'var(--color-fg)',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon && (
        <span style={{ fontSize: 12, lineHeight: 1, opacity: 0.6 }}>
          {icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, letterSpacing: '-0.003em' }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: active ? 'var(--color-primary)' : 'var(--color-fg-subtle)', opacity: active ? 0.7 : 1, marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
    </button>
  );
}
