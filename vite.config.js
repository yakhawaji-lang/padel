import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Redirect /pay-invite/* to /app/pay-invite/* so invite links work when opened without /app base */
function redirectPayInvite() {
  return {
    name: 'redirect-pay-invite',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/pay-invite/') && !req.url.startsWith('/app/')) {
          res.writeHead(302, { Location: '/app' + req.url })
          res.end()
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  base: '/app/',
  plugins: [react(), redirectPayInvite()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    chunkSizeWarningLimit: 600
  }
})

