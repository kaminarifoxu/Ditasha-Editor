import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import path from 'node:path';
const base = import.meta.dirname;
const file = (name) => path.join(base, 'adapter', name);
export default defineConfig({
  base: './',
  publicDir: 'source/public',
  plugins: [
    react(),
    tailwind(),
    wasm(),
    {
      name: 'ditasha-local-panels',
      transform(code, id) {
        if (id.endsWith('/assets-panel-store.tsx'))
          return code.replace(
            /export const TAB_KEYS = \[[\s\S]*?\] as const;/,
            'export const TAB_KEYS = ["media", "text", "effects", "settings"] as const;',
          );
      },
    },
  ],
  resolve: {
    alias: [
      ...[
        'changelog/components/changelog-notification',
        'feedback/components/feedback-popover',
        'subtitles/components/assets-view',
        'sounds/components/assets-view',
        'stickers/components/assets-view',
      ].map((p) => ({ find: '@/' + p, replacement: file('offline.tsx') })),
      { find: '@/fonts/google-fonts', replacement: file('fonts.ts') },
      { find: 'next/navigation', replacement: file('navigation.tsx') },
      { find: 'next/link', replacement: file('link.tsx') },
      { find: 'next/image', replacement: file('image.tsx') },
      { find: '@', replacement: path.join(base, 'source/src') },
    ],
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'esnext',
    outDir: '../../craft-runtime/opencut',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
