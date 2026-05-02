import { useEffect, useMemo, useState } from 'react';
import { scanProjectDirectory, type FileInfo } from '../lib/tauri';

export interface PickerProps {
  projectRoot: string;
  existing: { selectedFiles: string[] }; // relative paths already in the manifest
  mode: 'first-load' | 'reconfigure' | 'diff';
  onSave: (selectedRelativeFiles: string[], extensions: string[]) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_EXTENSIONS = ['.tsx', '.jsx'];
const ALL_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];
const TEST_GLOBS = ['.test.', '.spec.', '.stories.'];

export function ManifestPicker({ projectRoot, existing, mode, onSave, onCancel }: PickerProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [scanning, setScanning] = useState(true);
  const [extensions, setExtensions] = useState<string[]>(DEFAULT_EXTENSIONS);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    scanProjectDirectory(projectRoot)
      .then((scan) => {
        if (cancelled) return;
        setFiles(scan);
        const init = new Set<string>();
        if (mode === 'first-load') {
          for (const f of scan) {
            if (f.is_dir) continue;
            const rel = relativise(f.path, projectRoot);
            if (!DEFAULT_EXTENSIONS.some((e) => rel.endsWith(e))) continue;
            if (TEST_GLOBS.some((g) => rel.includes(g))) continue;
            if (rel.split('/').includes('components')) init.add(rel);
          }
        } else {
          for (const rel of existing.selectedFiles) init.add(rel);
        }
        setSelected(init);
        const exp = new Set<string>();
        for (const rel of init) {
          let p = rel;
          while (p.includes('/')) {
            p = p.slice(0, p.lastIndexOf('/'));
            exp.add(p);
          }
        }
        setExpanded(exp);
      })
      .catch((err) => console.error('scan failed', err))
      .finally(() => { if (!cancelled) setScanning(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRoot]);

  const tree = useMemo(() => buildTree(files, projectRoot), [files, projectRoot]);

  const visibleNodes = useMemo(
    () => filterTree(tree, filter, extensions),
    [tree, filter, extensions],
  );

  const toggleFile = (relPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath); else next.add(relPath);
      return next;
    });
  };

  const toggleFolder = (_folderRel: string, descendants: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const matching = descendants.filter((d) => extensions.some((e) => d.endsWith(e)));
      const allChecked = matching.length > 0 && matching.every((d) => next.has(d));
      if (allChecked) {
        for (const d of matching) next.delete(d);
      } else {
        for (const d of matching) next.add(d);
      }
      return next;
    });
  };

  const handleSave = async () => {
    await onSave(Array.from(selected), extensions);
  };

  if (scanning) {
    return <div style={modalShellStyle}><div style={modalContentStyle}><h3 style={{ padding: 24 }}>Scanning project…</h3></div></div>;
  }

  return (
    <div style={modalShellStyle}>
      <div style={modalContentStyle}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Choose components</div>
          <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
            Pick the files that should appear in your gallery. Saved to <code>saddle.manifest.json</code> at the project root.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--color-border)', alignItems: 'center', fontSize: 11 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter… (matches path, name, variant)"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 }}
          />
          <span style={{ color: 'var(--color-fg-muted)' }}>Extensions:</span>
          {ALL_EXTENSIONS.map((ext) => {
            const on = extensions.includes(ext);
            return (
              <button
                key={ext}
                type="button"
                onClick={() => setExtensions((prev) => prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext])}
                style={{
                  background: on ? 'var(--color-primary)' : '#fff',
                  color: on ? '#fff' : 'var(--color-fg-muted)',
                  border: on ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  padding: '2px 8px', borderRadius: 10,
                  fontSize: 10, cursor: 'pointer',
                }}
              >
                {ext}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '10px 20px', height: 360, overflow: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.9 }}>
          <TreeNodes
            nodes={visibleNodes}
            depth={0}
            selected={selected}
            expanded={expanded}
            onToggleExpand={(rel) => setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(rel)) next.delete(rel); else next.add(rel);
              return next;
            })}
            onToggleFile={toggleFile}
            onToggleFolder={toggleFolder}
            extensions={extensions}
            mode={mode}
            existingFiles={new Set(existing.selectedFiles)}
          />
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
            {summarise(selected)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={cancelButtonStyle}>Cancel</button>
            <button onClick={handleSave} style={primaryButtonStyle}>Save manifest</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- helpers ----

function relativise(absolute: string, root: string): string {
  const a = absolute.replace(/\\/g, '/');
  const r = root.replace(/\\/g, '/');
  return a.startsWith(r) ? a.slice(r.length).replace(/^\/+/, '') : a;
}

interface TreeNode {
  rel: string;
  name: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(files: FileInfo[], root: string): TreeNode[] {
  const byRel = new Map<string, TreeNode>();
  for (const f of files) {
    const rel = relativise(f.path, root);
    if (!rel) continue;
    byRel.set(rel, { rel, name: rel.split('/').pop() ?? rel, isDir: f.is_dir, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byRel.values()) {
    const parentRel = node.rel.includes('/') ? node.rel.slice(0, node.rel.lastIndexOf('/')) : '';
    if (!parentRel) {
      roots.push(node);
      continue;
    }
    const parent = byRel.get(parentRel);
    if (parent) parent.children.push(node); else roots.push(node);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

function filterTree(nodes: TreeNode[], filter: string, extensions: string[]): TreeNode[] {
  const q = filter.trim().toLowerCase();
  const matchesExt = (n: TreeNode) =>
    n.isDir || extensions.some((e) => n.rel.endsWith(e));
  const matchesFilter = (n: TreeNode) =>
    !q || n.rel.toLowerCase().includes(q);
  const recur = (input: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const n of input) {
      if (n.isDir) {
        const kids = recur(n.children);
        const keep = kids.length > 0 || (matchesFilter(n) && matchesExt(n));
        if (keep) out.push({ ...n, children: kids });
      } else if (matchesExt(n) && matchesFilter(n)) {
        out.push(n);
      }
    }
    return out;
  };
  return recur(nodes);
}

function summarise(selected: Set<string>): string {
  const sel = Array.from(selected);
  const compDirs = new Set<string>();
  for (const f of sel) {
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    if (dir) compDirs.add(dir);
  }
  return `${sel.length} variant${sel.length === 1 ? '' : 's'} across ${compDirs.size} component${compDirs.size === 1 ? '' : 's'} selected`;
}

const modalShellStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.32)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const modalContentStyle: React.CSSProperties = {
  width: 720, maxWidth: '100%',
  background: '#fff', borderRadius: 12,
  boxShadow: '0 24px 60px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.08)',
  display: 'flex', flexDirection: 'column',
};

const cancelButtonStyle: React.CSSProperties = {
  height: 28, padding: '0 14px',
  background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6,
  fontSize: 12, cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  height: 28, padding: '0 14px',
  background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: 6,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
};

interface TreeNodesProps {
  nodes: TreeNode[];
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (rel: string) => void;
  onToggleFile: (rel: string) => void;
  onToggleFolder: (folderRel: string, descendants: string[]) => void;
  extensions: string[];
  mode: 'first-load' | 'reconfigure' | 'diff';
  existingFiles: Set<string>;
}

function TreeNodes(props: TreeNodesProps) {
  const { nodes, depth, selected, expanded, onToggleExpand, onToggleFile, onToggleFolder, extensions, mode, existingFiles } = props;
  return (
    <>
      {nodes.map((n) => {
        const isExpanded = expanded.has(n.rel);
        if (n.isDir) {
          const descendants = collectFiles(n);
          const matching = descendants.filter((d) => extensions.some((e) => d.endsWith(e)));
          const allChecked = matching.length > 0 && matching.every((d) => selected.has(d));
          const someChecked = matching.some((d) => selected.has(d));
          const state: 'none' | 'partial' | 'all' = allChecked ? 'all' : someChecked ? 'partial' : 'none';
          return (
            <div key={n.rel}>
              <div style={{ paddingLeft: depth * 14 }}>
                <span onClick={() => onToggleExpand(n.rel)} style={{ cursor: 'pointer', color: 'var(--color-primary)' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>{' '}
                <span onClick={() => onToggleFolder(n.rel, descendants)} style={{ cursor: 'pointer' }}>
                  {state === 'all' ? '☑' : state === 'partial' ? '▪' : '☐'}
                </span>{' '}
                📁 {n.name}
              </div>
              {isExpanded && (
                <TreeNodes {...props} nodes={n.children} depth={depth + 1} />
              )}
            </div>
          );
        }
        const isSelected = selected.has(n.rel);
        const isTest = TEST_GLOBS.some((g) => n.rel.includes(g));
        const isNew = mode === 'diff' && !existingFiles.has(n.rel);
        return (
          <div
            key={n.rel}
            onClick={() => onToggleFile(n.rel)}
            style={{ paddingLeft: depth * 14 + 14, cursor: 'pointer', color: isSelected ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}
          >
            <span style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-fg-muted)' }}>{isSelected ? '☑' : '☐'}</span>{' '}
            {n.name}
            {isTest && <span style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-body)', marginLeft: 6 }}>· test file (auto-skipped)</span>}
            {isNew && <span style={{ color: 'var(--color-success, #16a34a)', marginLeft: 6 }}>●</span>}
          </div>
        );
      })}
    </>
  );
}

function collectFiles(n: TreeNode): string[] {
  if (!n.isDir) return [n.rel];
  return n.children.flatMap(collectFiles);
}
