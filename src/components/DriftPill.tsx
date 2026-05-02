interface DriftPillProps {
  added: number;
  removed: number;
  onClick: () => void;
}

export function DriftPill({ added, removed, onClick }: DriftPillProps) {
  if (added === 0 && removed === 0) return null;
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added} new file${added === 1 ? '' : 's'}`);
  if (removed > 0) parts.push(`${removed} missing file${removed === 1 ? '' : 's'}`);
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fef7e6',
        border: '1px solid #f5d27a',
        color: '#7a5b08',
        padding: '2px 8px', borderRadius: 10,
        fontSize: 10, cursor: 'pointer',
      }}
    >
      {parts.join(' · ')}
    </button>
  );
}
