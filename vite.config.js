import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'F09_PREVIEW/CODEBASE'),
  publicDir: path.resolve(__dirname, 'F09_PREVIEW/CODEBASE/public'),
  base: process.env.VITE_BASE || './',
  server: {
    host: true,
    allowedHosts: ['.monkeycode-ai.live', '.manus.computer'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
