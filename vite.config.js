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
    target: 'es2020',
    cssTarget: 'chrome87',
    minify: 'esbuild',
    cssMinify: 'esbuild',
    sourcemap: 'hidden',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
          if (id.match(/[\\\/]react[\\\/]/)) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('leaflet'))   return 'vendor-leaflet'
          if (id.includes('chart') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('jsbarcode') || id.includes('qrcode')) return 'vendor-codes'
          return 'vendor'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  css: {
    devSourcemap: true
  }
})
