import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/web3-swap/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})