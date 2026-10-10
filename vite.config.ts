import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from https://wgm51.github.io/language_flashcard/ on GitHub Pages.
  base: '/language_flashcard/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Language Flashcards',
        short_name: 'Flashcards',
        description: 'Hands-free spaced-repetition flashcards.',
        theme_color: '#1f6f5c',
        background_color: '#f6f7f5',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
});
