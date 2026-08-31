import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this from /VisionX/. The dev server stays at the root,
// while `preview` mirrors the deployed path so it matches what Pages serves.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/VisionX/' : '/',
  plugins: [react()],
  server: { port: 5173, open: false },
}))
