import { useState, useEffect } from 'react';
import type { ProjectStructure, Component } from '../types/component';
import { CodeEditor } from '../components/CodeEditor';
import { readDesignDoc, writeDesignDoc } from '../lib/tauri';

interface HierarchyViewProps {
  project: ProjectStructure;
  projectRoot: string;
  onSelectComponent: (component: Component) => void;
}

interface TreeNode {
  name: string;
  type: 'directory' | 'component' | 'variant';
  children: TreeNode[];
  component?: Component;
  depth: number;
}

function buildTree(project: ProjectStructure): TreeNode {
  const root: TreeNode = {
    name: project.rootPath.split('/').pop() || 'Project',
    type: 'directory',
    children: [],
    depth: 0,
  };

  for (const component of project.components) {
    const componentNode: TreeNode = {
      name: component.name,
      type: 'component',
      component,
      children: component.variants.map(v => ({
        name: v.variantName,
        type: 'variant' as const,
        children: [],
        depth: 2,
      })),
      depth: 1,
    };
    root.children.push(componentNode);
  }

  return root;
}

export function HierarchyView({ project, projectRoot, onSelectComponent }: HierarchyViewProps) {
  const tree = buildTree(project);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([tree.name]));
  const [activeTab, setActiveTab] = useState<'tree' | 'designmd'>('tree');
  const [designDoc, setDesignDoc] = useState<string>('');
  const [designDocLoaded, setDesignDocLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeTab === 'designmd' && !designDocLoaded) {
      readDesignDoc(projectRoot)
        .then(content => { setDesignDoc(content); setDesignDocLoaded(true); })
        .catch(() => { setDesignDoc('# Design System\n\nNo design.md found. Create one to document your design system.'); setDesignDocLoaded(true); });
    }
  }, [activeTab, projectRoot, designDocLoaded]);

  const toggleExpand = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpanded(next);
  };

  const handleSaveDesignDoc = async () => {
    setSaving(true);
    try {
      await writeDesignDoc(projectRoot, designDoc);
    } catch (err) {
      console.error('Failed to save design.md:', err);
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'tree' as const, label: 'Component Tree' },
    { id: 'designmd' as const, label: 'design.md' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)' }}>
      {/* Header */}
      <header style={{
        padding: '0 20px',
        borderBottom: '1px solid var(--color-border)',
        background: '#ffffff',
        flexShrink: 0,
        display: 'flex',
        gap: 0,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              height: 40,
              padding: '0 16px',
              background: 'transparent',
              color: activeTab === t.id ? 'var(--color-fg)' : 'var(--color-fg-muted)',
              border: 'none',
              borderBottom: `2px solid ${activeTab === t.id ? 'var(--color-primary)' : 'transparent'}`,
              fontSize: 13,
              fontWeight: activeTab === t.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </header>

      {/* Content */}
      {activeTab === 'tree' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <TreeItem
              node={tree}
              expanded={expanded}
              onToggle={toggleExpand}
              onSelect={onSelectComponent}
            />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
              {projectRoot}/design.md
            </div>
            <button
              onClick={handleSaveDesignDoc}
              disabled={saving}
              style={{
                height: 28,
                padding: '0 12px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 400 }}>
            <CodeEditor
              value={designDoc}
              language="markdown"
              readOnly={false}
              onChange={(v) => { if (v !== undefined) setDesignDoc(v); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TreeItem({ node, expanded, onToggle, onSelect }: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (name: string) => void;
  onSelect: (component: Component) => void;
}) {
  const isExpanded = expanded.has(node.name);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) onToggle(node.name);
          if (node.component) onSelect(node.component);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: 34,
          padding: `0 16px 0 ${16 + node.depth * 20}px`,
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: 13,
          color: node.type === 'component' ? 'var(--color-fg)' : 'var(--color-fg-muted)',
          fontWeight: node.type === 'directory' ? 600 : node.type === 'component' ? 500 : 400,
          transition: 'background 100ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {hasChildren && (
          <span style={{
            fontSize: 10,
            color: 'var(--color-fg-subtle)',
            transition: 'transform 100ms ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}>
            ▶
          </span>
        )}
        {!hasChildren && <span style={{ width: 10 }} />}
        <span>{node.name}</span>
        {node.type === 'component' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-fg-subtle)' }}>
            {node.children.length} variants
          </span>
        )}
      </button>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <TreeItem
              key={idx}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
