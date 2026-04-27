import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { IframeNode } from './ComponentPreview';

interface ElementTreeProps {
  tree: IframeNode | null;
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onHover?: (path: number[] | null) => void;
}

export function ElementTree({ tree, selectedPath, onSelect, onHover }: ElementTreeProps) {
  if (!tree) {
    return (
      <div style={{ padding: 14, fontSize: 12, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
        Waiting for the bridge…
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-fg-subtle)' }}>
          Install <code style={{ fontFamily: 'var(--font-code)' }}>saddle-bridge.js</code> in your project to inspect the live DOM.
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: '6px 0', fontFamily: 'var(--font-code)', fontSize: 12, color: 'var(--color-fg)' }}>
      <Node
        node={tree}
        path={[]}
        depth={0}
        selectedPath={selectedPath}
        onSelect={onSelect}
        onHover={onHover}
        isRoot
      />
    </div>
  );
}

function Node({
  node,
  path,
  depth,
  selectedPath,
  onSelect,
  onHover,
  isRoot,
}: {
  node: IframeNode;
  path: number[];
  depth: number;
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onHover?: (path: number[] | null) => void;
  isRoot?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected =
    selectedPath !== null &&
    selectedPath.length === path.length &&
    selectedPath.every((v, i) => v === path[i]);

  return (
    <div>
      <div
        onClick={() => onSelect(path)}
        onMouseEnter={() => onHover?.(path)}
        onMouseLeave={() => onHover?.(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px 2px',
          paddingLeft: 8 + depth * 12,
          background: isSelected ? 'rgba(0, 122, 255, 0.12)' : 'transparent',
          color: isSelected ? 'var(--color-accent)' : 'var(--color-fg)',
          cursor: 'pointer',
          borderRadius: 3,
        }}
        onMouseEnterCapture={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
        }}
        onMouseLeaveCapture={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent';
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            style={{
              width: 14,
              height: 14,
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-fg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ChevronRight
              size={10}
              style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 100ms' }}
            />
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={{ color: isSelected ? 'var(--color-accent)' : '#a855f7' }}>
          &lt;{node.tag}
        </span>
        {node.id && (
          <span style={{ color: '#06b6d4' }}>
            #{node.id}
          </span>
        )}
        {node.classes && node.classes.length > 0 && (
          <span style={{ color: '#16a34a' }}>
            .{node.classes.join('.')}
          </span>
        )}
        <span style={{ color: isSelected ? 'var(--color-accent)' : '#a855f7' }}>&gt;</span>
        {node.text && (
          <span style={{ color: 'var(--color-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.text}
          </span>
        )}
        {isRoot && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-fg-subtle)' }}>root</span>
        )}
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child, i) => (
            <Node
              key={i}
              node={child}
              path={[...path, i]}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}
