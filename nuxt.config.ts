// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  // Explicitly use app directory structure
  srcDir: 'app/',
  serverDir: 'server/',
  
  // Fix HMR issues with Nuxt 4.x
  vite: {
    optimizeDeps: {
      exclude: ['fsevents']
    },
    server: {
      hmr: {
        port: 24678
      }
    }
  },
  
  // Development configuration
  devServer: {
    port: 3000,
    host: 'localhost'
  },
  
  // Nitro configuration for better stability
  nitro: {
    experimental: {
      wasm: false
    },
    esbuild: {
      options: {
        target: 'es2022'
      }
    }
  },
  
  // Router configuration to prevent _path redefinition
  router: {
    options: {
      strict: false
    }
  }
})
