import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dream-motion/shared': resolve(__dirname, '../../packages/shared/src'),
      '@dream-motion/schema': resolve(__dirname, '../../packages/schema/src'),
      '@dream-motion/runtime': resolve(__dirname, '../../packages/runtime/src'),
      '@dream-motion/export': resolve(__dirname, '../../packages/export/src')
    }
  }
});
