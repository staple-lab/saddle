import { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import {
  useTokens,
  updateToken,
  addGroup,
  updateGroupLabel,
  removeGroup,
  addColorToken,
  updateColorTokenName,
  updateColorTokenValue,
  removeColorToken,
  type Token,
  type TokenSlot,
  type ColorToken,
  type SemanticGroup,
} from '../tokens/tokens';
import type { TokenGroup } from '../components/Sidebar';

const SLOT_LABELS: Record<TokenSlot, string> = {
  color: 'Colors',
  space: 'Spacing',
  radius: 'Radius',
  fontFamily: 'Font family',
  fontSize: 'Font size',
  fontWeight: 'Font weight',
  lineHeight: 'Line height',
  letterSpacing: 'Letter spacing',
};

type Group = { id: TokenGroup; title: string; slots: TokenSlot[] };
const GROUPS: Group[] = [
  { id: 'colors', title: 'Colors', slots: ['color'] },
  { id: 'spacing', title: 'Spacing', slots: ['space'] },
  { id: 'radius', title: 'Radius', slots: ['radius'] },
  { id: 'typography', title: 'Typography', slots: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] },
];

export function TokensView({ groupFilter = 'all' }: { groupFilter?: TokenGroup }) {
  const tokens = useTokens();
  const visible = groupFilter === 'all' ? GROUPS : GROUPS.filter((g) => g.id === groupFilter);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-stage)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 32px 64px' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 600, color: 'var(--color-fg)' }}>Tokens</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-fg-muted)' }}>
            Group your tokens by intent. Click anything to edit inline.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {visible.map((group) => {
            if (group.id === 'colors') {
              return <ColorsCard key="colors" groups={tokens.semanticGroups} />;
            }
            const populated = group.slots.filter((s) => (tokens[s] ?? []).length > 0);
            if (populated.length === 0) return null;
            const total = populated.reduce((n, s) => n + (tokens[s]?.length ?? 0), 0);
            const showSubheaders = populated.length > 1;
            return (
              <section key={group.title} style={cardStyle}>
                <CardHeader title={group.title} count={total} unit="token" />
                {populated.map((slot, idx) => (
                  <div key={slot} style={{ marginTop: idx === 0 ? 0 : 18 }}>
                    {showSubheaders && <SubLabel>{SLOT_LABELS[slot]}</SubLabel>}
                    <ScalarList items={tokens[slot]} slot={slot} />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------
// COLOR GROUPS
// --------------------------------------------------------------------------------------

function ColorsCard({ groups }: { groups: SemanticGroup[] }) {
  return (
    <section style={cardStyle}>
      <CardHeader title="Colors" count={groups.length} unit="group" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g) => <GroupCard key={g.id} group={g} />)}
        <NewGroupRow />
      </div>
    </section>
  );
}

function GroupCard({ group }: { group: SemanticGroup }) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--color-stage)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <InlineLabel
          value={group.label}
          onCommit={(v) => updateGroupLabel(group.id, v)}
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-fg)', flex: 1, minWidth: 0 }}
        />
        <code style={{ fontSize: 10, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
          --{group.id}-*
        </code>
        <button
          onClick={() => removeGroup(group.id)}
          title="Remove group"
          style={iconButtonStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-fg-subtle)'; }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {group.tokens.map((t) => (
          <TokenRow key={t.name} groupId={group.id} token={t} />
        ))}
        <AddTokenRow groupId={group.id} />
      </div>
    </div>
  );
}

function TokenRow({ groupId, token }: { groupId: string; token: ColorToken }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr 130px 24px',
        alignItems: 'center',
        gap: 10,
        padding: '4px 4px 4px 0',
        borderRadius: 6,
      }}
    >
      <ColorSwatch
        value={token.value}
        onChange={(v) => updateColorTokenValue(groupId, token.name, v)}
      />
      <InlineLabel
        value={token.name}
        onCommit={(v) => updateColorTokenName(groupId, token.name, v)}
        style={{ fontSize: 12, fontFamily: 'var(--font-code)', color: 'var(--color-fg)', minWidth: 0 }}
      />
      <input
        type="text"
        value={token.value}
        onChange={(e) => updateColorTokenValue(groupId, token.name, e.target.value)}
        spellCheck={false}
        style={{ ...inputStyle, height: 26, fontSize: 11, fontFamily: 'var(--font-code)' }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 122, 255, 0.18)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      <button
        onClick={() => removeColorToken(groupId, token.name)}
        title="Remove token"
        style={iconButtonStyle}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-fg-subtle)'; }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function AddTokenRow({ groupId }: { groupId: string }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('#000000');
  const submit = () => {
    if (!name.trim()) return;
    addColorToken(groupId, name.trim(), value);
    setName('');
    setValue('#000000');
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr 130px 24px',
        alignItems: 'center',
        gap: 10,
        padding: '6px 4px 4px 0',
        marginTop: 4,
        borderTop: '1px solid var(--color-border)',
      }}
    >
      <ColorSwatch value={value} onChange={setValue} />
      <input
        type="text"
        placeholder="token name (e.g. bg-active)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        style={{ ...inputStyle, height: 26, fontFamily: 'var(--font-code)', fontSize: 11 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        spellCheck={false}
        style={{ ...inputStyle, height: 26, fontSize: 11, fontFamily: 'var(--font-code)' }}
      />
      <button
        onClick={submit}
        title="Add token"
        style={iconButtonStyle}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-fg-subtle)'; }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function NewGroupRow() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const submit = () => {
    if (!label.trim()) return;
    addGroup(label.trim());
    setLabel('');
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 28,
          padding: '0 10px',
          background: 'transparent',
          border: '1px dashed var(--color-border)',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--color-fg-muted)',
          fontWeight: 500,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-fg-muted)'; e.currentTarget.style.color = 'var(--color-fg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-fg-muted)'; }}
      >
        <Plus size={12} /> New group
      </button>
    );
  }
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        border: '1px solid var(--color-accent)',
        borderRadius: 10,
        background: '#ffffff',
      }}
    >
      <input
        autoFocus
        type="text"
        placeholder="Group name (e.g. Info)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        style={{ ...inputStyle, height: 28, flex: 1 }}
      />
      <button onClick={submit} style={primaryButtonStyle}>Add</button>
      <button onClick={() => setOpen(false)} style={ghostButtonStyle}>Cancel</button>
    </div>
  );
}

// --------------------------------------------------------------------------------------
// SHARED CONTROLS
// --------------------------------------------------------------------------------------

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // For non-hex values (var refs etc.), fall back to the resolved CSS-var value, but
  // also show the swatch with the literal string applied directly.
  const display = value.startsWith('var(') ? resolveVar(value) || value : value;
  return (
    <label
      style={{
        position: 'relative',
        width: 22,
        height: 22,
        borderRadius: 4,
        border: '1px solid var(--color-border)',
        background: display,
        cursor: 'pointer',
        flexShrink: 0,
      }}
      title={value}
    >
      <input
        type="color"
        value={normalizeHex(display)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
        }}
      />
    </label>
  );
}

function normalizeHex(v: string): string {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const [, r, g, b] = v.match(/^#(.)(.)(.)$/)!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

function resolveVar(expr: string): string {
  const match = expr.match(/var\((--[^,)]+)/);
  if (!match) return '';
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  } catch {
    return '';
  }
}

function InlineLabel({
  value,
  onCommit,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== value) onCommit(draft); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        style={{
          ...style,
          height: 24,
          padding: '0 6px',
          margin: '-2px -6px',
          border: '1px solid var(--color-accent)',
          borderRadius: 4,
          background: '#ffffff',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      style={{
        ...style,
        cursor: 'text',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value}
    </span>
  );
}

// --------------------------------------------------------------------------------------
// SCALAR (non-color) tokens
// --------------------------------------------------------------------------------------

function ScalarList({ items, slot }: { items: Token[]; slot: TokenSlot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((t, idx) => (
        <div
          key={t.cssVar}
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 220px',
            alignItems: 'center',
            gap: 12,
            padding: '10px 0',
            borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-fg)' }}>{t.name}</div>
          <code style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>{t.cssVar}</code>
          <input
            type="text"
            value={t.value}
            onChange={(e) => updateToken(slot, t.name, e.target.value)}
            spellCheck={false}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 122, 255, 0.18)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      ))}
    </div>
  );
}

function CardHeader({ title, count, unit }: { title: string; count: number; unit: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-fg-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </h2>
      <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>{count} {unit}{count === 1 ? '' : 's'}</span>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 8, fontWeight: 500 }}>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: '18px 20px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 28,
  padding: '0 8px',
  fontSize: 12,
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  background: '#ffffff',
  color: 'var(--color-fg)',
  outline: 'none',
  boxSizing: 'border-box',
};

const iconButtonStyle: React.CSSProperties = {
  width: 24, height: 24, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', borderRadius: 4,
  cursor: 'pointer', color: 'var(--color-fg-subtle)',
  flexShrink: 0,
  transition: 'color 100ms',
};

const primaryButtonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  background: 'var(--color-fg)',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const ghostButtonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  background: 'transparent',
  color: 'var(--color-fg-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};
