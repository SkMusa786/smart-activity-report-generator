import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim()

  if (mode === 'production' && !apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL must be set for production builds.')
  }

  if (mode === 'production' && process.env.VERCEL && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(apiBaseUrl)) {
    throw new Error('VITE_API_BASE_URL must point to the deployed backend, not localhost.')
  }

  return {
    plugins: [react()],
  }
})
