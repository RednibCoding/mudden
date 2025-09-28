module.exports = {
  content: [
    "./app/components/**/*.{js,vue,ts}",
    "./app/layouts/**/*.vue",
    "./app/pages/**/*.vue",
    "./app/plugins/**/*.{js,ts}",
    "./app/**/*.{js,vue,ts}",
    "./nuxt.config.{js,ts}"
  ],
  theme: {
    extend: {
      colors: {
        'terminal': {
          'bg': '#1a1a1a',
          'text': '#d4d4d4',
          'dim': '#808080',
          'bright': '#ffffff',
          'gray': '#969696',
          'yellow': '#ffd93d',
          'red': '#ff6b6b',
          'cyan': '#74c0fc'
        }
      },
      fontFamily: {
        'mono': ['Courier New', 'Monaco', 'Menlo', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}