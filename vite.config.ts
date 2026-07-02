import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase';
              if (id.includes('pdfmake')) return 'pdfmake';
              if (id.includes('vfs_fonts')) return 'pdfmake-fonts';
              if (id.includes('xlsx')) return 'xlsx';
              if (id.includes('docx') || id.includes('file-saver')) return 'docx';
              if (id.includes('pptxgenjs')) return 'pptx';
              if (id.includes('react-markdown')) return 'markdown';
              if (id.includes('lucide-react') || id.includes('motion') || id.includes('react-hot-toast')) return 'ui';
              if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            }

            const normalized = id.split(path.sep).join('/');
            if (normalized.includes('/src/features/proposals/') || normalized.includes('/src/components/proposals/')) {
              return 'proposals';
            }
            if (normalized.includes('/src/components/admin/')) {
              return 'admin';
            }
            if (normalized.includes('/src/components/editorial/') || normalized.includes('/src/lib/publishing/')) {
              return 'editorial';
            }
          }
        }
      }
    }
  };
});
