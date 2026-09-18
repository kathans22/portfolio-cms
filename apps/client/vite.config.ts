import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The shared packages ship compiled CommonJS for the Node server; the browser bundle
// reads their TypeScript source directly (Vite only converts CJS under node_modules).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@portfolio/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@portfolio/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
});
