import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const pwaPlugin = VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
    manifest: {
      name: 'Readnice',
      short_name: 'Readnice',
      description: 'A beautiful, mobile-first book reading experience',
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
  });

  // Development mode - run the demo app
  if (mode === 'development') {
    return {
      plugins: [react(), pwaPlugin],
      server: {
        host: true,
        port: 3000,
      },
    };
  }

  // Library build mode
  if (mode === 'lib') {
    return {
      plugins: [
        react(),
        dts({
          include: ['lib'],
          outDir: 'dist',
          rollupTypes: true,
        }),
      ],
      publicDir: false, // Don't copy public folder assets to dist
      build: {
        lib: {
          entry: resolve(__dirname, 'lib/index.ts'),
          name: 'ReactBookReader',
          formats: ['es', 'cjs'],
          fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
          },
        },
        cssCodeSplit: false,
        sourcemap: true,
      },
    };
  }

  // Production mode (default) - build the demo app for GitHub Pages
  return {
    plugins: [react(), pwaPlugin],
    base: process.env.BASE_URL || '/',
    build: {
      outDir: 'dist',
    },
  };
});
