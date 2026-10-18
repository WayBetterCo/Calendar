import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: { externalizeDeps: true },
  },
  preload: {
    build: { externalizeDeps: true },
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    server: {
      proxy: {
        '/weather-api': {
          target: 'https://api.open-meteo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/weather-api/, ''),
        },
        '/weather-geocode-api': {
          target: 'https://geocoding-api.open-meteo.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/weather-geocode-api/, ''),
        },
        '/weather-zipcode-api': {
          target: 'https://api.zippopotam.us',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/weather-zipcode-api/, ''),
        },
      },
    },
    plugins: [react()],
  },
});
