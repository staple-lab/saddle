export function TopBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 44,
        flexShrink: 0,
        background: '#f5f5f7',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 96,
        paddingRight: 12,
        userSelect: 'none',
      }}
    />
  );
}
