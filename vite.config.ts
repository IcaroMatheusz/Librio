import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY

  if (process.env.VITE_ELECTRON_BUILD && (!supabaseUrl?.trim() || !supabaseAnonKey?.trim())) {
    throw new Error(
      'Build desktop sem Supabase configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente ou no arquivo .env.',
    )
  }

  return {
    base: process.env.VITE_ELECTRON_BUILD ? './' : '/',
    plugins: [react(), tailwindcss()],
  }
})
