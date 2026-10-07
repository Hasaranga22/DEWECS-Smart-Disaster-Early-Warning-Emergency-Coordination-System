import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/shared/**'],
      exclude: [
        '**/__tests__/**',
        '**/adapters/prisma/**',
        'src/generated/**',
        'src/app/**',
        'src/components/**',
        '**/client/**'
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
});
