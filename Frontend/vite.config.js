import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync } from 'fs';

export default defineConfig({
  base: '/reproductor-video-series/',
  root: './',
  server: {
    port: 5173,
    open: '/index.html'
  },
  plugins: [
    {
      name: 'copiar-carpetas-estaticas',
      closeBundle() {
        const carpetas = ['Controllers', 'Config'];
        carpetas.forEach(carpeta => {
          const src = resolve(__dirname, carpeta);
          const dest = resolve(__dirname, 'dist', carpeta);
          if (existsSync(src)) {
            cpSync(src, dest, { recursive: true });
            console.log(`✅ Copiada carpeta: ${carpeta} → dist/${carpeta}`);
          } else {
            console.warn(`⚠️ No existe: ${carpeta}`);
          }
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        menu: resolve(__dirname, 'Views/Menu-Principal.html'),
        // Añade aquí las rutas de tus interfaces críticas para que Vite las procese al compilar:
        
        reproductorOriginal: resolve(__dirname, 'Views/Reproductor-Original.html'),
        reproductorUniversal: resolve(__dirname, 'Views/Reproductor-Universal.html'),
        reproductorUniversalV1: resolve(__dirname, 'Views/Reproductor-Universal-v1.html'),

        // ===== Views / Reproductor-de-Video-Original =====
        takagisanIOriginal: resolve(__dirname, 'Views/Reproductor-de-Video-Original/Karakai-no-Jouzu-Takagisan-I-Original.html'),
        takagisanIILatinoOriginal: resolve(__dirname, 'Views/Reproductor-de-Video-Original/Karakai-no-Jouzu-Takagisan-II-Latino-Original.html'),
        takagisanIIOriginal: resolve(__dirname, 'Views/Reproductor-de-Video-Original/Karakai-no-Jouzu-Takagisan-II-Original.html'),
        takagisanIIIOriginal: resolve(__dirname, 'Views/Reproductor-de-Video-Original/Karakai-no-Jouzu-Takagisan-III-Original.html'),
        takagisanMovieLatinoOriginal: resolve(__dirname, 'Views/Reproductor-de-Video-Original/Karakai-no-Jouzu-Takagisan-Movie-Latino-Original.html'),
        takagisanMovieOriginal: resolve(__dirname, 'Views/Reproductor-de-Video-Original/Karakai-no-Jouzu-Takagisan-Movie-Original.html'),

        // ===== Views / Tipo-de-Letra =====
        letra19: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-1-9.html'),
        letrasymb: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-Symb.html'),
        letraA: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-A.html'),
        letraB: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-B.html'),
        letraC: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-C.html'),
        letraD: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-D.html'),
        letraE: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-E.html'),
        letraF: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-F.html'),
        letraG: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-G.html'),
        letraH: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-H.html'),
        letraI: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-I.html'),
        letraJ: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-J.html'),
        letraK: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-K.html'),
        letraL: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-L.html'),
        letraM: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-M.html'),
        letraN: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-N.html'),
        letraEnie: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-Ñ.html'),
        letraO: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-O.html'),
        letraP: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-P.html'),
        letraQ: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-Q.html'),
        letraR: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-R.html'),
        letraS: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-S.html'),
        letraT: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-T.html'),
        letraU: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-U.html'),
        letraV: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-V.html'),
        letraW: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-W.html'),
        letraX: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-X.html'),
        letraY: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-Y.html'),
        letraZ: resolve(__dirname, 'Views/Tipo-de-Letra/Letra-Z.html')
      }
    }
  }
});