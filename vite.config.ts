import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Compresse PNG/JPG/SVG au build sans modifier les imports dans le code.
      // Gain typique : 60-80% de poids sur les fichiers de src/img.
      ViteImageOptimizer({
        png: { quality: 80 },
        jpg: { quality: 78, progressive: true },
        jpeg: { quality: 78, progressive: true },
        webp: { lossless: false, quality: 82 },
        svg: {
          multipass: true,
          plugins: [
            { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            motion: ['motion'],
          },
        },
      },
    },
  };
});
