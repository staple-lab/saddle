// Design tokens - semantic groups holding direct color values, plus scalar slots.
import { useSyncExternalStore } from 'react';

export type TokenSlot =
  | 'color'
  | 'space'
  | 'radius'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing';

export type Token = {
  name: string;
  cssVar: string;
  value: string;
  slot: TokenSlot;
};

export type ColorToken = {
  name: string;  // 'bg' | 'bg-hover' | 'text' | 'border'
  value: string; // '#2563eb' or 'var(--primary-bg)'
};

export type SemanticGroup = {
  id: string;          // 'primary'
  label: string;       // 'Primary'
  tokens: ColorToken[];
};

const defaultGroups: SemanticGroup[] = [
  {
    id: 'primary',
    label: 'Primary',
    tokens: [
      { name: 'bg', value: '#2563eb' },
      { name: 'bg-hover', value: '#1d4ed8' },
      { name: 'bg-subtle', value: '#eff6ff' },
      { name: 'text', value: '#1e3a8a' },
      { name: 'text-on', value: '#ffffff' },
      { name: 'border', value: '#bfdbfe' },
    ],
  },
  {
    id: 'secondary',
    label: 'Secondary',
    tokens: [
      { name: 'bg', value: '#9333ea' },
      { name: 'bg-hover', value: '#7e22ce' },
      { name: 'bg-subtle', value: '#faf5ff' },
      { name: 'text', value: '#581c87' },
      { name: 'text-on', value: '#ffffff' },
      { name: 'border', value: '#e9d5ff' },
    ],
  },
  {
    id: 'neutral',
    label: 'Neutral',
    tokens: [
      { name: 'bg', value: '#ffffff' },
      { name: 'bg-muted', value: '#f3f4f6' },
      { name: 'bg-emphasis', value: '#111827' },
      { name: 'text', value: '#111827' },
      { name: 'text-muted', value: '#4b5563' },
      { name: 'border', value: '#e5e7eb' },
      { name: 'border-emphasis', value: '#d1d5db' },
    ],
  },
  {
    id: 'success',
    label: 'Success',
    tokens: [
      { name: 'bg', value: '#16a34a' },
      { name: 'text', value: '#14532d' },
      { name: 'border', value: '#bbf7d0' },
    ],
  },
  {
    id: 'warning',
    label: 'Warning',
    tokens: [
      { name: 'bg', value: '#eab308' },
      { name: 'text', value: '#713f12' },
      { name: 'border', value: '#fef08a' },
    ],
  },
  {
    id: 'destructive',
    label: 'Destructive',
    tokens: [
      { name: 'bg', value: '#dc2626' },
      { name: 'bg-hover', value: '#b91c1c' },
      { name: 'text', value: '#7f1d1d' },
      { name: 'text-on', value: '#ffffff' },
      { name: 'border', value: '#fecaca' },
    ],
  },
];

const defaultScalarTokens = {
  space: [
    { name: 'xs', cssVar: '--spacing-xs', value: '4px', slot: 'space' as TokenSlot },
    { name: 'sm', cssVar: '--spacing-sm', value: '8px', slot: 'space' as TokenSlot },
    { name: 'md', cssVar: '--spacing-md', value: '16px', slot: 'space' as TokenSlot },
    { name: 'lg', cssVar: '--spacing-lg', value: '24px', slot: 'space' as TokenSlot },
    { name: 'xl', cssVar: '--spacing-xl', value: '32px', slot: 'space' as TokenSlot },
  ],
  radius: [
    { name: 'none', cssVar: '--rounded-none', value: '0px', slot: 'radius' as TokenSlot },
    { name: 'sm', cssVar: '--rounded-sm', value: '6px', slot: 'radius' as TokenSlot },
    { name: 'md', cssVar: '--rounded-md', value: '8px', slot: 'radius' as TokenSlot },
    { name: 'lg', cssVar: '--rounded-lg', value: '12px', slot: 'radius' as TokenSlot },
    { name: 'full', cssVar: '--rounded-full', value: '9999px', slot: 'radius' as TokenSlot },
  ],
  fontFamily: [
    { name: 'sans', cssVar: '--font-family-sans', value: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', slot: 'fontFamily' as TokenSlot },
    { name: 'mono', cssVar: '--font-family-mono', value: '"SF Mono", Menlo, Consolas, monospace', slot: 'fontFamily' as TokenSlot },
  ],
  fontSize: [
    { name: 'xs', cssVar: '--font-size-xs', value: '11px', slot: 'fontSize' as TokenSlot },
    { name: 'sm', cssVar: '--font-size-sm', value: '13px', slot: 'fontSize' as TokenSlot },
    { name: 'base', cssVar: '--font-size-base', value: '14px', slot: 'fontSize' as TokenSlot },
    { name: 'lg', cssVar: '--font-size-lg', value: '16px', slot: 'fontSize' as TokenSlot },
    { name: 'xl', cssVar: '--font-size-xl', value: '18px', slot: 'fontSize' as TokenSlot },
    { name: '2xl', cssVar: '--font-size-2xl', value: '24px', slot: 'fontSize' as TokenSlot },
  ],
  fontWeight: [
    { name: 'regular', cssVar: '--font-weight-regular', value: '400', slot: 'fontWeight' as TokenSlot },
    { name: 'medium', cssVar: '--font-weight-medium', value: '500', slot: 'fontWeight' as TokenSlot },
    { name: 'semibold', cssVar: '--font-weight-semibold', value: '600', slot: 'fontWeight' as TokenSlot },
    { name: 'bold', cssVar: '--font-weight-bold', value: '700', slot: 'fontWeight' as TokenSlot },
  ],
  lineHeight: [
    { name: 'tight', cssVar: '--line-height-tight', value: '1.2', slot: 'lineHeight' as TokenSlot },
    { name: 'normal', cssVar: '--line-height-normal', value: '1.5', slot: 'lineHeight' as TokenSlot },
    { name: 'loose', cssVar: '--line-height-loose', value: '1.75', slot: 'lineHeight' as TokenSlot },
  ],
  letterSpacing: [
    { name: 'tight', cssVar: '--letter-spacing-tight', value: '-0.01em', slot: 'letterSpacing' as TokenSlot },
    { name: 'normal', cssVar: '--letter-spacing-normal', value: '0', slot: 'letterSpacing' as TokenSlot },
    { name: 'wide', cssVar: '--letter-spacing-wide', value: '0.02em', slot: 'letterSpacing' as TokenSlot },
  ],
};

export type TokenStore = {
  semanticGroups: SemanticGroup[];
  color: Token[]; // derived from groups
  space: Token[];
  radius: Token[];
  fontFamily: Token[];
  fontSize: Token[];
  fontWeight: Token[];
  lineHeight: Token[];
  letterSpacing: Token[];
};

function deriveColorTokens(groups: SemanticGroup[]): Token[] {
  const out: Token[] = [];
  for (const g of groups) {
    for (const t of g.tokens) {
      out.push({
        name: `${g.id}-${t.name}`,
        cssVar: `--${g.id}-${t.name}`,
        value: t.value,
        slot: 'color',
      });
    }
  }
  return out;
}

function buildStore(groups: SemanticGroup[], scalars = defaultScalarTokens): TokenStore {
  return {
    semanticGroups: groups,
    color: deriveColorTokens(groups),
    ...scalars,
  };
}

let _store: TokenStore = buildStore(defaultGroups);
const listeners = new Set<() => void>();
function notify() { listeners.forEach((fn) => fn()); }

function applyToDocument(store: TokenStore) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const g of store.semanticGroups) {
    for (const t of g.tokens) {
      root.style.setProperty(`--${g.id}-${t.name}`, t.value);
    }
  }
  for (const slot of ['space', 'radius', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as TokenSlot[]) {
    for (const t of store[slot]) {
      root.style.setProperty(t.cssVar, t.value);
    }
  }
}

applyToDocument(_store);

export function getTokens(): TokenStore { return _store; }

function commit(next: TokenStore) { _store = next; applyToDocument(next); notify(); }

export function useTokens(): TokenStore {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getTokens,
    getTokens
  );
}

function pickScalars(s: TokenStore) {
  return {
    space: s.space, radius: s.radius,
    fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
    lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
  };
}

function slug(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '');
}

// --- Group mutations ---
export function addGroup(label: string) {
  const baseId = slug(label) || 'group';
  let id = baseId, n = 2;
  while (_store.semanticGroups.some((g) => g.id === id)) { id = `${baseId}-${n++}`; }
  const next: SemanticGroup = {
    id,
    label,
    tokens: [
      { name: 'bg', value: '#000000' },
      { name: 'text', value: '#ffffff' },
    ],
  };
  commit(buildStore([..._store.semanticGroups, next], pickScalars(_store)));
}

export function updateGroupLabel(id: string, label: string) {
  const groups = _store.semanticGroups.map((g) => (g.id === id ? { ...g, label } : g));
  commit(buildStore(groups, pickScalars(_store)));
}

export function removeGroup(id: string) {
  commit(buildStore(_store.semanticGroups.filter((g) => g.id !== id), pickScalars(_store)));
}

// --- Token mutations within a group ---
export function addColorToken(groupId: string, name: string, value: string) {
  const cleanName = slug(name) || 'token';
  const groups = _store.semanticGroups.map((g) => {
    if (g.id !== groupId) return g;
    if (g.tokens.some((t) => t.name === cleanName)) return g;
    return { ...g, tokens: [...g.tokens, { name: cleanName, value }] };
  });
  commit(buildStore(groups, pickScalars(_store)));
}

export function updateColorTokenName(groupId: string, oldName: string, newName: string) {
  const cleanName = slug(newName) || oldName;
  const groups = _store.semanticGroups.map((g) => {
    if (g.id !== groupId) return g;
    if (cleanName !== oldName && g.tokens.some((t) => t.name === cleanName)) return g;
    return { ...g, tokens: g.tokens.map((t) => (t.name === oldName ? { ...t, name: cleanName } : t)) };
  });
  commit(buildStore(groups, pickScalars(_store)));
}

export function updateColorTokenValue(groupId: string, name: string, value: string) {
  const groups = _store.semanticGroups.map((g) => {
    if (g.id !== groupId) return g;
    return { ...g, tokens: g.tokens.map((t) => (t.name === name ? { ...t, value } : t)) };
  });
  commit(buildStore(groups, pickScalars(_store)));
}

export function removeColorToken(groupId: string, name: string) {
  const groups = _store.semanticGroups.map((g) => {
    if (g.id !== groupId) return g;
    return { ...g, tokens: g.tokens.filter((t) => t.name !== name) };
  });
  commit(buildStore(groups, pickScalars(_store)));
}

// --- Scalar token edit ---
export function updateToken(slot: TokenSlot, name: string, value: string) {
  if (slot === 'color') return;
  const scalars = pickScalars(_store);
  const next = {
    ...scalars,
    [slot]: scalars[slot as keyof typeof scalars].map((t) => (t.name === name ? { ...t, value } : t)),
  };
  commit(buildStore(_store.semanticGroups, next));
}

export const tokens = new Proxy({} as Record<TokenSlot, Token[]>, {
  get(_t, key: string) { return (_store as unknown as Record<string, Token[]>)[key]; },
  ownKeys() { return ['color', 'space', 'radius', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']; },
});

export function loadTokensFromConfig(_config: unknown) {
  commit(buildStore(defaultGroups));
}
