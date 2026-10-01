import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vexflow') && /(?:glyphs|metrics)\.js$/.test(id)) return 'notation-fonts';
          if (id.includes('vexflow')) return 'notation-engine';
        },
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
