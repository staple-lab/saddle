import { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
}

export function ResizablePanel({ children, defaultWidth, minWidth, maxWidth, side }: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = side === 'right'
        ? startX.current - e.clientX
        : e.clientX - startX.current;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [minWidth, maxWidth, side]);

  return (
    <div style={{ width, flexShrink: 0, height: '100%', position: 'relative', display: 'flex' }}>
      {side === 'right' && (
        <div
          onMouseDown={onMouseDown}
          style={{
            width: 5,
            cursor: 'col-resize',
            flexShrink: 0,
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 2,
            width: 1,
            background: 'var(--color-border)',
          }} />
        </div>
      )}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {side === 'left' && (
        <div
          onMouseDown={onMouseDown}
          style={{
            width: 5,
            cursor: 'col-resize',
            flexShrink: 0,
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 2,
            width: 1,
            background: 'var(--color-border)',
          }} />
        </div>
      )}
    </div>
  );
}
