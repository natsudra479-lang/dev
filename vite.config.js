import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'F09_PREVIEW/CODEBASE'),
  publicDir: path.resolve(__dirname, 'F09_PREVIEW/CODEBASE/public'),
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
