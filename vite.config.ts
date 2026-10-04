import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const layaTarget = env.VITE_LAYA_API_URL || 'http://127.0.0.1:8000'
  const proxyPath = env.VITE_LAYA_PROXY_PATH || '/laya-api'

  return {
    plugins: [react()],
    server: {
      proxy: {
        [proxyPath]: {
          target: layaTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${proxyPath}`), ''),
        },
      },
    },
  }
})


