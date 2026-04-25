import { useState } from 'react';
import type { ProjectStructure, Component } from '../types/component';

interface HierarchyViewProps {
  project: ProjectStructure;
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

export function HierarchyView({ project, onSelectComponent }: HierarchyViewProps) {
  const tree = buildTree(project);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([tree.name]));

  const toggleExpand = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpanded(next);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)' }}>
      <header style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border)',
        background: '#ffffff',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-fg)' }}>
          Hierarchy
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-fg-muted)' }}>
          Component organization tree
        </p>
      </header>

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
