// src/App.tsx
import { GalleryView } from './views/GalleryView';
import './styles/theme.css';

function App() {
  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <GalleryView />
    </div>
  );
}

export default App;
