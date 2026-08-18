import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api 代理到本地后端，前端无需处理 CORS
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
