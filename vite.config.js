const { defineConfig } = require('vite');
const reactPlugin = require('@vitejs/plugin-react');
const tailwindPlugin = require('@tailwindcss/vite');
const path = require('path');

const react = reactPlugin.default || reactPlugin;
const tailwindcss = tailwindPlugin.default || tailwindPlugin;

module.exports = defineConfig({
  root: path.join(__dirname, 'client'),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4180', changeOrigin: true }
    }
  },
  build: { outDir: path.join(__dirname, 'dist'), emptyOutDir: true }
});
