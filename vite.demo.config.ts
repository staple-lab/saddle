import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the standalone Saddle demo bundle that the marketing site iframes.
// Pulls in real Saddle React components but ships no Tauri dependency.
export default defineConfig({
  plugins: [react()],
  root: 'src/demo',
  base: './',
  build: {
    outDir: '../../website/saddle-demo',
    emptyOutDir: true,
    sourcemap: false,
  },
});
