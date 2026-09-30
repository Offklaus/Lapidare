import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Endereço onde o site mora. Local: "/". GitHub Pages: "/Lapidare/" (definido no workflow).
  base: process.env.VITE_BASE || '/',
  // Porta fixa: o login com Google só aceita origens cadastradas (http://localhost:5173) e os
  // links do WhatsApp usam o endereço do site. Se a 5173 estiver ocupada, o Vite para e avisa
  // em vez de subir em outra porta sem ninguém perceber.
  server: {
    port: 5173,
    strictPort: true,
  },
});
