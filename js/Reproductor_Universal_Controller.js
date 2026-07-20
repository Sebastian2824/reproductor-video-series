 /* ==================== CONFIGURACIÓN ==================== */
    const firebaseConfig = {
      apiKey: "AIzaSyB6MY2y5uyum87PdUHUpY8NNh4D73Yhx4U",
      authDomain: "animes-plus-89b93.firebaseapp.com",
      projectId: "animes-plus-89b93",
      storageBucket: "animes-plus-89b93.appspot.com",
      messagingSenderId: "402867181985",
      appId: "1:402867181985:web:d695b12977fe4270dbd3e0",
      measurementId: "G-DN632G7XJT"
    };

    // URL base para Cloudflare Workers
    const CLOUDFLARE_BASE_URL = "https://proyecto-cloudflare.apiprueba2025.workers.dev";

    // CONFIGURACIÓN DE GOOGLE SHEETS (MISMO ID DEL MENÚ PRINCIPAL)
    const GOOGLE_SHEETS_CONFIG = {
      SPREADSHEET_ID: '1V4LTYiuTDZ_Y_k6GRyVmFm5-G3rVhE6x1KfIcxJfLqM',
      HOJA_PORTADAS: 'Portadas',
      HOJA_IFRAMES: 'iframes', // Nombre de la hoja para los iframes
      RANGO_PORTADAS: 'A:D',
      RANGO_IFRAMES: 'A:F' // Ajusta según tus columnas
    };

    // Variables globales dinámicas
    let nombreSerie = "";
    let temporada = "";
    let idioma = "";
    
    let episodios = [];
    let currentEpisode = 0;
    let servidorActivo = null;
    let servicioActivo = 'firebase'; // 'firebase', 'cloudflare' o 'sheets'
    let todasLasSeriesRecomendadas = [];

    // Inicializar Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    /* ==================== FUNCIONES DE NAVEGACIÓN ==================== */
    function volverAlCatalogo() {
      window.location.href = "Menu-Principal.html";
    }

    function obtenerParametrosURL() {
      const urlParams = new URLSearchParams(window.location.search);
      nombreSerie = urlParams.get('serie') || "";
      
      const tempIdioma = urlParams.get('temporada') || "";
      
      if (tempIdioma.includes(" - ")) {
        const partes = tempIdioma.split(" - ");
        temporada = partes[0] || "";
        idioma = partes[1] || "Sub Español";
      } else {
        temporada = tempIdioma;
        idioma = "Sub Español";
      }
      
      if (!nombreSerie || !temporada) {
        mostrarError("No se especificó la serie o temporada");
        return false;
      }
      
      document.title = `${nombreSerie} - ${temporada}`;
      
      return true;
    }

    function mostrarError(mensaje) {
      const videoContainer = document.getElementById('videoContainer');
      videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #fff3cd; border-radius: 10px; color: #856404;">
          <h3 style="margin-top: 0;">⚠️ Error</h3>
          <p>${mensaje}</p>
          <button onclick="volverAlCatalogo()" style="margin-top: 15px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Volver al catálogo
          </button>
        </div>
      `;
      
      document.getElementById("serieTitle").textContent = "Error";
      document.getElementById("seasonLang").textContent = "Parámetros incorrectos";
      document.getElementById("episodeCount").textContent = "0 episodios";
    }

    /* ==================== NUEVAS FUNCIONES PARA DROPDOWN DE SERVICIO ==================== */
    function toggleDropdown() {
      const dropdown = document.getElementById('serviceDropdown');
      dropdown.classList.toggle('active');
    }

    function cerrarDropdown() {
      const dropdown = document.getElementById('serviceDropdown');
      dropdown.classList.remove('active');
    }

    function cambiarServicio(nuevoServicio) {
      if (servicioActivo === nuevoServicio) {
        cerrarDropdown();
        return;
      }
      
      servicioActivo = nuevoServicio;
      updateServiceUI();
      
      // Recargar datos con el nuevo servicio
      currentEpisode = 0;
      cargarEpisodios();
      cargarSeriesRecomendadas();
      
      cerrarDropdown();
    }

    function updateServiceUI() {
      const toggleText = document.getElementById('serviceToggleText');
      const recomendacionesIndicator = document.getElementById('recomendacionesServiceIndicator');
      const recomendacionesIndicatorMobile = document.getElementById('recomendacionesServiceIndicatorMobile');
      
      let servicioNombre = '';
      let icono = '';
      let claseIndicador = '';
      
      if (servicioActivo === 'firebase') {
        servicioNombre = 'Firebase';
        icono = '<i class="fas fa-database"></i>';
        claseIndicador = 'service-active';
        toggleText.textContent = 'Cambiar servicio (Firebase)';
      } else if (servicioActivo === 'cloudflare') {
        servicioNombre = 'Cloudflare';
        icono = '<i class="fas fa-cloud"></i>';
        claseIndicador = 'service-cloudflare';
        toggleText.textContent = 'Cambiar servicio (Cloudflare)';
      } else if (servicioActivo === 'sheets') {
        servicioNombre = 'Google Sheets';
        icono = '<i class="fas fa-table"></i>';
        claseIndicador = 'service-sheets';
        toggleText.textContent = 'Cambiar servicio (Google Sheets)';
      }
      
      // Actualizar indicadores
      recomendacionesIndicator.innerHTML = `${icono} ${servicioNombre}`;
      recomendacionesIndicator.className = `service-status-indicator ${claseIndicador}`;
      
      recomendacionesIndicatorMobile.innerHTML = `${icono} ${servicioNombre}`;
      recomendacionesIndicatorMobile.className = `service-status-indicator ${claseIndicador}`;
      
      // Actualizar opciones activas en el dropdown
      document.querySelectorAll('.service-dropdown-item').forEach(item => {
        const itemService = item.getAttribute('data-service');
        if (itemService === servicioActivo) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }

    async function cargarEpisodios() {
      if (!obtenerParametrosURL()) return;
      
      mostrarMensajeCarga();
      
      if (servicioActivo === 'firebase') {
        await cargarEpisodiosDesdeFirebase();
      } else if (servicioActivo === 'cloudflare') {
        await cargarEpisodiosDesdeCloudflare();
      } else {
        await cargarEpisodiosDesdeGoogleSheets();
      }
      
      await cargarSeriesRecomendadas();
      gestionarPosicionRecomendaciones();
    }

    function mostrarMensajeCarga() {
      const videoContainer = document.getElementById('videoContainer');
      let servicioNombre = '';
      
      if (servicioActivo === 'firebase') servicioNombre = 'Firebase';
      else if (servicioActivo === 'cloudflare') servicioNombre = 'Cloudflare';
      else servicioNombre = 'Google Sheets';
      
      videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #e9ecef; border-radius: 10px;">
          <div style="margin-bottom: 15px;">⏳</div>
          <h3 style="margin-top: 0; color: #003a73;">Cargando episodios...</h3>
          <p>${nombreSerie}</p>
          <p>${temporada} - ${idioma}</p>
          <p style="font-size: 12px; color: #666;">Servicio: ${servicioNombre}</p>
        </div>
      `;
    }

    /* ==================== FUNCIÓN: GOOGLE SHEETS ==================== */
    async function cargarEpisodiosDesdeGoogleSheets() {
      try {
        console.log("Cargando desde Google Sheets...");
        
        // URL para obtener datos de la hoja iframes
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEETS_CONFIG.HOJA_IFRAMES)}`;
        
        console.log("URL Sheets:", csvUrl);
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log("Datos CSV recibidos:", csvText.substring(0, 500));
        
        // Parsear CSV
        const rows = parseGoogleSheetsCSV(csvText);
        
        if (rows.length === 0) {
          throw new Error("No se encontraron datos en Google Sheets");
        }
        
        episodios = [];
        const servidoresDisponibles = new Set();
        
        // Asumimos esta estructura de columnas (ajusta según tu hoja):
        // Columna A: Nombre de la serie
        // Columna B: Temporada
        // Columna C: Idioma
        // Columna D: Servidor
        // Columna E: Episodio
        // Columna F: Iframe
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          
          // Saltar encabezado si existe
          if (i === 0 && (row[0]?.toLowerCase().includes('nombre') || row[0]?.toLowerCase().includes('serie'))) {
            console.log("Encabezados encontrados:", row);
            continue;
          }
          
          const nombreSerieCSV = (row[0] || '').trim();
          const temporadaCSV = (row[1] || '').trim();
          const idiomaCSV = (row[2] || '').trim();
          const servidorCSV = (row[3] || '').trim();
          const episodioCSV = (row[4] || '').trim();
          const iframeCSV = (row[5] || '').trim();
          
          // Filtrar por la serie y temporada actual
          if (nombreSerieCSV !== nombreSerie || temporadaCSV !== temporada) {
            continue;
          }
          
          // Filtrar por idioma (o usar el primer idioma disponible si no coincide)
          if (i === 1 && idiomaCSV !== idioma) {
            // Si el primer registro tiene idioma diferente, cambiar el idioma global
            idioma = idiomaCSV;
            console.log(`Idioma cambiado a: ${idioma}`);
          }
          
          if (idiomaCSV !== idioma) {
            continue;
          }
          
          if (!episodioCSV || !iframeCSV || !servidorCSV) {
            console.warn("Fila ignorada - datos incompletos:", row);
            continue;
          }
          
          // Agregar servidor a la lista de disponibles
          servidoresDisponibles.add(servidorCSV);
          
          // Buscar o crear el episodio
          let episodio = episodios.find(e => e.name === episodioCSV);
          if (!episodio) {
            episodio = { name: episodioCSV, embeds: {} };
            episodios.push(episodio);
          }
          
          // Agregar el iframe para este servidor
          episodio.embeds[servidorCSV] = iframeCSV;
        }
        
        if (episodios.length === 0) {
          throw new Error(`No se encontraron episodios para ${nombreSerie} - ${temporada} (${idioma}) en Google Sheets`);
        }
        
        // Ordenar episodios
        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        
        // Seleccionar primer servidor disponible
        servidorActivo = Array.from(servidoresDisponibles)[0] || null;
        
        if (!servidorActivo) {
          throw new Error("No se encontraron servidores disponibles");
        }
        
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
        
        console.log(`Cargados ${episodios.length} episodios desde Google Sheets`);
        
      } catch (error) {
        console.error("Error cargando desde Google Sheets:", error);
        // Si Google Sheets falla, intentar con Firebase automáticamente
        if (servicioActivo === 'sheets') {
          servicioActivo = 'firebase';
          updateServiceUI();
          await cargarEpisodiosDesdeFirebase();
        }
      }
    }

    // Función auxiliar para parsear CSV (igual que en el menú principal)
    function parseGoogleSheetsCSV(text) {
      const rows = [];
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const row = [];
        let currentCell = '';
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            row.push(currentCell.trim());
            currentCell = '';
          } else {
            currentCell += char;
          }
        }
        
        row.push(currentCell.trim());
        
        const cleanedRow = row.map(cell => {
          return cell.replace(/^"|"$/g, '');
        });
        
        rows.push(cleanedRow);
      }
      
      return rows;
    }

    /* ==================== FUNCIONES PARA POSICIÓN DE RECOMENDACIONES ==================== */
    function gestionarPosicionRecomendaciones() {
      const isMobile = window.innerWidth <= 900;
      const recomendacionesDesktop = document.getElementById('recomendacionesDesktop');
      const recomendacionesMobile = document.getElementById('recomendacionesMobile');
      
      if (isMobile) {
        recomendacionesDesktop.style.display = 'none';
        recomendacionesMobile.style.display = 'block';
        
        const gridDesktop = document.getElementById('recomendacionesGrid');
        const gridMobile = document.getElementById('recomendacionesGridMobile');
        
        if (gridDesktop && gridMobile) {
          gridMobile.innerHTML = gridDesktop.innerHTML;
        }
      } else {
        recomendacionesDesktop.style.display = 'block';
        recomendacionesMobile.style.display = 'none';
      }
    }

    window.addEventListener('resize', gestionarPosicionRecomendaciones);

    /* ==================== FUNCIONES PARA SERIES RECOMENDADAS ==================== */
    async function cargarSeriesRecomendadas() {
      try {
        if (servicioActivo === 'firebase') {
          await cargarSeriesRecomendadasFirebase();
        } else if (servicioActivo === 'cloudflare') {
          await cargarSeriesRecomendadasCloudflare();
        } else {
          await cargarSeriesRecomendadasGoogleSheets();
        }
      } catch (error) {
        console.error("Error cargando series recomendadas:", error);
        mostrarRecomendacionesError();
      }
    }

    /* ==================== FUNCIÓN: RECOMENDACIONES DESDE GOOGLE SHEETS ==================== */
    async function cargarSeriesRecomendadasGoogleSheets() {
      try {
        // URL para obtener datos de la hoja Portadas
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEETS_CONFIG.HOJA_PORTADAS)}`;
        
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);
        
        const todasSeries = [];
        const temporadasMismaSerie = [];
        
        // Asumimos esta estructura para Portadas (igual que en el menú principal):
        // Columna A: Nombre de la serie
        // Columna B: Temporada completa (ej: "Temporada 01 - Sub Español")
        // Columna C: URL de la imagen
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          
          // Saltar encabezado
          if (i === 0 && (row[0]?.toLowerCase().includes('nombre') || row[0]?.toLowerCase().includes('serie'))) {
            continue;
          }
          
          const nombreSerieActual = (row[0] || '').trim();
          const temporadaCompleta = (row[1] || '').trim();
          const imagen = (row[2] || '').trim() || "https://via.placeholder.com/300x400?text=Sin+Imagen";
          
          if (!nombreSerieActual || !temporadaCompleta) {
            continue;
          }
          
          const serieData = {
            nombre: nombreSerieActual,
            temporadaCompleta: temporadaCompleta,
            imagen: imagen
          };
          
          // Separar temporadas de la misma serie
          if (nombreSerieActual === nombreSerie) {
            // Saltar la temporada actual
            if (temporadaCompleta !== `${temporada} - ${idioma}`) {
              temporadasMismaSerie.push(serieData);
            }
          } else {
            todasSeries.push(serieData);
          }
        }
        
        todasLasSeriesRecomendadas = todasSeries;
        mostrarRecomendaciones(temporadasMismaSerie);
        
      } catch (error) {
        console.error("Error cargando recomendaciones desde Google Sheets:", error);
        throw error;
      }
    }

    /* ==================== FUNCIONES EXISTENTES (MANTENIDAS SIN CAMBIOS) ==================== */
    async function cargarSeriesRecomendadasFirebase() {
      try {
        const snapshotSeries = await db.collection("animes-series-portadas").get();
        const todasSeries = [];
        const temporadasMismaSerie = [];

        for (const docSerie of snapshotSeries.docs) {
          const nombreSerieActual = docSerie.id;
          
          const snapshotTemporadas = await db.collection("animes-series-portadas")
            .doc(nombreSerieActual).collection("Temporadas").get();

          const temporadasDocs = snapshotTemporadas.docs;
          for (const docTemporada of temporadasDocs) {
            const temporadaCompleta = docTemporada.id;
            const data = docTemporada.data();
            const imagen = data.imagen || "https://via.placeholder.com/300x400?text=Sin+Imagen";

            const serieData = {
              nombre: nombreSerieActual,
              temporadaCompleta: temporadaCompleta,
              imagen: imagen
            };

            if (nombreSerieActual === nombreSerie) {
              if (temporadaCompleta !== `${temporada} - ${idioma}`) {
                temporadasMismaSerie.push(serieData);
              }
            } else {
              todasSeries.push(serieData);
            }
          }
        }

        todasLasSeriesRecomendadas = todasSeries;
        mostrarRecomendaciones(temporadasMismaSerie);
      } catch (error) {
        console.error("Error cargando recomendaciones desde Firebase:", error);
        throw error;
      }
    }

    async function cargarSeriesRecomendadasCloudflare() {
      try {
        const response = await fetch(`${CLOUDFLARE_BASE_URL}/portadas`);
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const portadas = await response.json();
        const todasSeries = [];
        const temporadasMismaSerie = [];

        for (const portada of portadas) {
          const nombreSerieActual = portada.nombreSerie;
          const temporadaCompleta = portada.temporada;
          
          const serieData = {
            nombre: nombreSerieActual,
            temporadaCompleta: temporadaCompleta,
            imagen: portada.imagen || "https://via.placeholder.com/300x400?text=Sin+Imagen"
          };

          if (nombreSerieActual === nombreSerie) {
            if (temporadaCompleta !== `${temporada} - ${idioma}`) {
              temporadasMismaSerie.push(serieData);
            }
          } else {
            todasSeries.push(serieData);
          }
        }

        todasLasSeriesRecomendadas = todasSeries;
        mostrarRecomendaciones(temporadasMismaSerie);
      } catch (error) {
        console.error("Error cargando recomendaciones desde Cloudflare:", error);
        throw error;
      }
    }

    function mostrarRecomendaciones(temporadasMismaSerie = []) {
      const recomendacionesGrid = document.getElementById('recomendacionesGrid');
      const recomendacionesGridMobile = document.getElementById('recomendacionesGridMobile');
      
      const loadingHTML = `
        <div class="loading-recomendaciones">
          <div style="margin-bottom: 10px;">⏳</div>
          Cargando recomendaciones...
        </div>
      `;
      
      recomendacionesGrid.innerHTML = loadingHTML;
      if (recomendacionesGridMobile) {
        recomendacionesGridMobile.innerHTML = loadingHTML;
      }

      const recomendaciones = seleccionarRecomendaciones(temporadasMismaSerie);
      
      if (recomendaciones.length === 0) {
        const noResultsHTML = `
          <div class="loading-recomendaciones">
            <p>No hay series recomendadas disponibles</p>
          </div>
        `;
        recomendacionesGrid.innerHTML = noResultsHTML;
        if (recomendacionesGridMobile) {
          recomendacionesGridMobile.innerHTML = noResultsHTML;
        }
        return;
      }

      const cardsHTML = generarCardsHTML(recomendaciones);
      recomendacionesGrid.innerHTML = cardsHTML;
      if (recomendacionesGridMobile) {
        recomendacionesGridMobile.innerHTML = cardsHTML;
      }
    }

    function generarCardsHTML(recomendaciones) {
      let html = '';
      for (const serie of recomendaciones) {
        const nombreEscapado = serie.nombre.replace(/'/g, "\\'");
        const temporadaEscapada = serie.temporadaCompleta.replace(/'/g, "\\'");
        
        html += `
          <div class="recomendacion-card">
            <img src="${serie.imagen}" alt="${serie.nombre}" class="recomendacion-img">
            <div class="recomendacion-info">
              <h4 title="${serie.nombre}">${serie.nombre}</h4>
              <p>${serie.temporadaCompleta}</p>
              <button class="btn-recomendacion" onclick="cargarSerieRecomendada('${encodeURIComponent(serie.nombre)}', '${encodeURIComponent(serie.temporadaCompleta)}')">
                Ver
              </button>
            </div>
          </div>
        `;
      }
      return html;
    }

    function seleccionarRecomendaciones(temporadasMismaSerie = []) {
      const resultado = [];
      
      for (let i = 0; i < Math.min(temporadasMismaSerie.length, 2); i++) {
        resultado.push(temporadasMismaSerie[i]);
      }
      
      if (resultado.length >= 3) {
        return resultado.slice(0, 3);
      }
      
      const seriesSimilares = [];
      for (const serie of todasLasSeriesRecomendadas) {
        let yaExiste = false;
        for (const r of resultado) {
          if (r.nombre === serie.nombre && r.temporadaCompleta === serie.temporadaCompleta) {
            yaExiste = true;
            break;
          }
        }
        if (yaExiste) continue;
        
        const palabrasSerieActual = nombreSerie.toLowerCase().split(' ');
        const palabrasSerieOtra = serie.nombre.toLowerCase().split(' ');
        
        const palabrasComunes = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'y', 'e', 'o', 'u', 'en', 'a', 'al'];
        
        let esSimilar = false;
        for (const palabra of palabrasSerieActual) {
          if (palabra.length > 2 && !palabrasComunes.includes(palabra)) {
            for (const p of palabrasSerieOtra) {
              if (p.includes(palabra) || palabra.includes(p)) {
                esSimilar = true;
                break;
              }
            }
            if (esSimilar) break;
          }
        }
        
        if (esSimilar) {
          seriesSimilares.push(serie);
        }
      }
      
      for (const similar of seriesSimilares) {
        if (resultado.length >= 3) break;
        resultado.push(similar);
      }
      
      if (resultado.length >= 3) {
        return resultado.slice(0, 3);
      }
      
      const seriesAleatorias = [...todasLasSeriesRecomendadas];
      
      for (let i = seriesAleatorias.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seriesAleatorias[i], seriesAleatorias[j]] = [seriesAleatorias[j], seriesAleatorias[i]];
      }
      
      for (const aleatoria of seriesAleatorias) {
        if (resultado.length >= 3) break;
        
        let esDuplicado = false;
        for (const r of resultado) {
          if (r.nombre === aleatoria.nombre && r.temporadaCompleta === aleatoria.temporadaCompleta) {
            esDuplicado = true;
            break;
          }
        }
        
        if (!esDuplicado) {
          resultado.push(aleatoria);
        }
      }
      
      return resultado.slice(0, 3);
    }

    function mostrarRecomendacionesError() {
      const errorHTML = `
        <div class="loading-recomendaciones">
          <p style="color: #dc3545;">Error cargando recomendaciones</p>
          <button onclick="cargarSeriesRecomendadas()" style="margin-top: 10px; padding: 8px 15px; background: #003a73; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">
            Reintentar
          </button>
        </div>
      `;
      
      document.getElementById('recomendacionesGrid').innerHTML = errorHTML;
      const gridMobile = document.getElementById('recomendacionesGridMobile');
      if (gridMobile) {
        gridMobile.innerHTML = errorHTML;
      }
    }

    /* ==================== FUNCIONES PARA CARGA DE SERIE RECOMENDADA ==================== */
    function cargarSerieRecomendada(serieNombre, temporadaCompleta) {
      serieNombre = decodeURIComponent(serieNombre);
      temporadaCompleta = decodeURIComponent(temporadaCompleta);
      
      mostrarMensajeCargaCompleta(serieNombre, temporadaCompleta);
      
      nombreSerie = serieNombre;
      const tempIdioma = temporadaCompleta;
      
      if (tempIdioma.includes(" - ")) {
        const partes = tempIdioma.split(" - ");
        temporada = partes[0] || "";
        idioma = partes[1] || "Sub Español";
      } else {
        temporada = tempIdioma;
        idioma = "Sub Español";
      }
      
      const nuevaURL = `Reproductor-Universal.html?serie=${encodeURIComponent(serieNombre)}&temporada=${encodeURIComponent(temporadaCompleta)}`;
      window.history.pushState({}, '', nuevaURL);
      
      document.title = `${nombreSerie} - ${temporada}`;
      currentEpisode = 0;
      
      const selector = document.querySelector('.episode-selector');
      selector.innerHTML = '<option value="">Cargando episodios...</option>';
      
      document.getElementById("serieTitle").textContent = nombreSerie;
      document.getElementById("seasonLang").textContent = `${temporada} - ${idioma}`;
      document.getElementById("episodeCount").textContent = "Cargando...";
      
      const sidebar = document.getElementById('sidebarPlaylist');
      sidebar.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Cargando episodios...</div>';
      
      const serverSelect = document.getElementById("serverSelect");
      serverSelect.innerHTML = '<option value="">Cargando servidores...</option>';
      
      cargarEpisodiosDeSerieRecomendada();
    }

    function mostrarMensajeCargaCompleta(serieNombre, temporadaCompleta) {
      const videoContainer = document.getElementById('videoContainer');
      const videoDetails = document.getElementById("videoDetails");
      
      let servicioNombre = '';
      if (servicioActivo === 'firebase') servicioNombre = 'Firebase';
      else if (servicioActivo === 'cloudflare') servicioNombre = 'Cloudflare';
      else servicioNombre = 'Google Sheets';
      
      videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #e9ecef; border-radius: 10px;">
          <div style="margin-bottom: 15px;">⏳</div>
          <h3 style="margin-top: 0; color: #003a73;">Cargando nueva serie...</h3>
          <p><strong>${serieNombre}</strong></p>
          <p>${temporadaCompleta}</p>
          <p style="font-size: 12px; color: #666;">Servicio: ${servicioNombre}</p>
        </div>
      `;
      
      videoDetails.textContent = `${serieNombre} | ${temporadaCompleta} | Cargando...`;
    }

    async function cargarEpisodiosDeSerieRecomendada() {
      if (!nombreSerie || !temporada) return;
      
      if (servicioActivo === 'firebase') {
        await cargarEpisodiosDesdeFirebaseParaRecomendada();
      } else if (servicioActivo === 'cloudflare') {
        await cargarEpisodiosDesdeCloudflareParaRecomendada();
      } else {
        await cargarEpisodiosDesdeGoogleSheetsParaRecomendada();
      }
      
      await cargarSeriesRecomendadas();
    }

    /* ==================== FUNCIÓN: CARGA DE GOOGLE SHEETS PARA RECOMENDADA ==================== */
    async function cargarEpisodiosDesdeGoogleSheetsParaRecomendada() {
      try {
        console.log("Cargando serie recomendada desde Google Sheets...");
        
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEETS_CONFIG.HOJA_IFRAMES)}`;
        
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);
        
        episodios = [];
        const servidoresDisponibles = new Set();
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          
          if (i === 0 && (row[0]?.toLowerCase().includes('nombre') || row[0]?.toLowerCase().includes('serie'))) {
            continue;
          }
          
          const nombreSerieCSV = (row[0] || '').trim();
          const temporadaCSV = (row[1] || '').trim();
          const idiomaCSV = (row[2] || '').trim();
          const servidorCSV = (row[3] || '').trim();
          const episodioCSV = (row[4] || '').trim();
          const iframeCSV = (row[5] || '').trim();
          
          if (nombreSerieCSV !== nombreSerie || temporadaCSV !== temporada) {
            continue;
          }
          
          if (i === 1 && idiomaCSV !== idioma) {
            idioma = idiomaCSV;
            console.log(`Idioma cambiado a: ${idioma}`);
          }
          
          if (idiomaCSV !== idioma) {
            continue;
          }
          
          if (!episodioCSV || !iframeCSV || !servidorCSV) {
            continue;
          }
          
          servidoresDisponibles.add(servidorCSV);
          
          let episodio = episodios.find(e => e.name === episodioCSV);
          if (!episodio) {
            episodio = { name: episodioCSV, embeds: {} };
            episodios.push(episodio);
          }
          
          episodio.embeds[servidorCSV] = iframeCSV;
        }
        
        if (episodios.length === 0) {
          throw new Error(`No se encontraron episodios para ${nombreSerie} - ${temporada} (${idioma}) en Google Sheets`);
        }
        
        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Array.from(servidoresDisponibles)[0] || null;
        
        if (!servidorActivo) {
          throw new Error("No se encontraron servidores disponibles");
        }
        
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
        
      } catch (error) {
        console.error("Error cargando desde Google Sheets:", error);
        mostrarErrorCargaRecomendada(error.message);
        
        if (servicioActivo === 'sheets') {
          servicioActivo = 'firebase';
          updateServiceUI();
          await cargarEpisodiosDesdeFirebaseParaRecomendada();
        }
      }
    }

    function mostrarErrorCargaRecomendada(mensajeError) {
      const videoContainer = document.getElementById('videoContainer');
      const videoDetails = document.getElementById("videoDetails");
      const selector = document.querySelector('.episode-selector');
      const sidebar = document.getElementById('sidebarPlaylist');
      const serverSelect = document.getElementById("serverSelect");
      
      videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #fff3cd; border-radius: 10px; color: #856404;">
          <h3 style="margin-top: 0;">⚠️ Error al cargar la serie</h3>
          <p>${mensajeError}</p>
          <button onclick="cargarEpisodiosDeSerieRecomendada()" style="margin-top: 15px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Reintentar
          </button>
        </div>
      `;
      
      videoDetails.textContent = `${nombreSerie} | ${temporada} - ${idioma} | Error`;
      selector.innerHTML = '<option value="">Error al cargar episodios</option>';
      serverSelect.innerHTML = '<option value="">Error al cargar servidores</option>';
      sidebar.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error al cargar episodios</div>';
      
      document.getElementById("episodeCount").textContent = "0 episodios (Error)";
    }

    /* ==================== FUNCIONES EXISTENTES DE FIREBASE Y CLOUDFLARE (MANTENIDAS) ==================== */
    async function cargarEpisodiosDesdeFirebase() {
      try {
        const idiomaDocRef = db
          .collection("animes-series").doc(nombreSerie)
          .collection("Temporadas").doc(temporada)
          .collection("Idiomas").doc(idioma);
        
        const idiomaDoc = await idiomaDocRef.get();
        
        if (!idiomaDoc.exists) {
          const idiomasSnap = await db
            .collection("animes-series").doc(nombreSerie)
            .collection("Temporadas").doc(temporada)
            .collection("Idiomas").get();
          
          if (idiomasSnap.empty) {
            throw new Error(`No se encontró el idioma "${idioma}" ni alternativos`);
          }
          
          const primerIdioma = idiomasSnap.docs[0].id;
          idioma = primerIdioma;
        }

        const servidoresSnap = await db
          .collection("animes-series").doc(nombreSerie)
          .collection("Temporadas").doc(temporada)
          .collection("Idiomas").doc(idioma)
          .collection("Servidores").get();

        episodios = [];

        for (const servidorDoc of servidoresSnap.docs) {
          const servidor = servidorDoc.id;
          const epsSnapshot = await db
            .collection("animes-series").doc(nombreSerie)
            .collection("Temporadas").doc(temporada)
            .collection("Idiomas").doc(idioma)
            .collection("Servidores").doc(servidor)
            .collection("Episodios").get();

          epsSnapshot.forEach(doc => {
            const nombreEp = doc.id;
            const iframe = doc.data().iframe;

            let episodio = episodios.find(e => e.name === nombreEp);
            if (!episodio) {
              episodio = { name: nombreEp, embeds: {} };
              episodios.push(episodio);
            }

            episodio.embeds[servidor] = iframe;
          });
        }

        if (episodios.length === 0) {
          throw new Error(`No se encontraron episodios para ${nombreSerie} - ${temporada} (${idioma})`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0];
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
      } catch (error) {
        console.error("Error cargando desde Firebase:", error);
        if (servicioActivo === 'firebase') {
          servicioActivo = 'cloudflare';
          updateServiceUI();
          await cargarEpisodiosDesdeCloudflare();
        }
      }
    }

    async function cargarEpisodiosDesdeCloudflare() {
      try {
        const servidoresResponse = await fetch(
          `${CLOUDFLARE_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );
        
        if (!servidoresResponse.ok) {
          throw new Error(`Error HTTP: ${servidoresResponse.status}`);
        }
        
        const servidores = await servidoresResponse.json();
        
        if (!servidores || servidores.error) {
          const idiomasResponse = await fetch(
            `${CLOUDFLARE_BASE_URL}/idiomas?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}`
          );
          
          if (idiomasResponse.ok) {
            const idiomasDisponibles = await idiomasResponse.json();
            throw new Error(`Idioma "${idioma}" no disponible. Idiomas disponibles: ${idiomasDisponibles.join(', ')}`);
          } else {
            throw new Error("Error obteniendo servidores");
          }
        }

        episodios = [];

        for (const servidor of servidores) {
          const episodiosResponse = await fetch(
            `${CLOUDFLARE_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
          );
          
          if (!episodiosResponse.ok) {
            console.warn(`No se pudieron obtener episodios para ${servidor}`);
            continue;
          }
          
          const episodiosData = await episodiosResponse.json();
          
          if (!episodiosData || episodiosData.error) {
            console.warn(`Error obteniendo episodios para ${servidor}:`, episodiosData.error);
            continue;
          }

          episodiosData.forEach(epData => {
            let episodio = episodios.find(e => e.name === epData.episodio);
            if (!episodio) {
              episodio = { name: epData.episodio, embeds: {} };
              episodios.push(episodio);
            }
            episodio.embeds[servidor] = epData.iframe;
          });
        }

        if (episodios.length === 0) {
          throw new Error(`No se encontraron episodios en Cloudflare para ${idioma}`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0];
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
      } catch (error) {
        console.error("Error cargando desde Cloudflare:", error);
        if (servicioActivo === 'cloudflare') {
          servicioActivo = 'firebase';
          updateServiceUI();
          await cargarEpisodiosDesdeFirebase();
        }
      }
    }

    async function cargarEpisodiosDesdeFirebaseParaRecomendada() {
      try {
        const idiomaDocRef = db
          .collection("animes-series").doc(nombreSerie)
          .collection("Temporadas").doc(temporada)
          .collection("Idiomas").doc(idioma);
        
        const idiomaDoc = await idiomaDocRef.get();
        
        if (!idiomaDoc.exists) {
          const idiomasSnap = await db
            .collection("animes-series").doc(nombreSerie)
            .collection("Temporadas").doc(temporada)
            .collection("Idiomas").get();
          
          if (idiomasSnap.empty) {
            throw new Error(`No se encontró el idioma "${idioma}" ni alternativos`);
          }
          
          const primerIdioma = idiomasSnap.docs[0].id;
          idioma = primerIdioma;
        }

        const servidoresSnap = await db
          .collection("animes-series").doc(nombreSerie)
          .collection("Temporadas").doc(temporada)
          .collection("Idiomas").doc(idioma)
          .collection("Servidores").get();

        episodios = [];

        for (const servidorDoc of servidoresSnap.docs) {
          const servidor = servidorDoc.id;
          const epsSnapshot = await db
            .collection("animes-series").doc(nombreSerie)
            .collection("Temporadas").doc(temporada)
            .collection("Idiomas").doc(idioma)
            .collection("Servidores").doc(servidor)
            .collection("Episodios").get();

          epsSnapshot.forEach(doc => {
            const nombreEp = doc.id;
            const iframe = doc.data().iframe;

            let episodio = episodios.find(e => e.name === nombreEp);
            if (!episodio) {
              episodio = { name: nombreEp, embeds: {} };
              episodios.push(episodio);
            }

            episodio.embeds[servidor] = iframe;
          });
        }

        if (episodios.length === 0) {
          throw new Error(`No se encontraron episodios para ${nombreSerie} - ${temporada} (${idioma})`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0];
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
      } catch (error) {
        console.error("Error cargando desde Firebase:", error);
        mostrarErrorCargaRecomendada(error.message);
        if (servicioActivo === 'firebase') {
          servicioActivo = 'cloudflare';
          updateServiceUI();
          await cargarEpisodiosDesdeCloudflareParaRecomendada();
        }
      }
    }

    async function cargarEpisodiosDesdeCloudflareParaRecomendada() {
      try {
        const servidoresResponse = await fetch(
          `${CLOUDFLARE_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );
        
        if (!servidoresResponse.ok) {
          throw new Error(`Error HTTP: ${servidoresResponse.status}`);
        }
        
        const servidores = await servidoresResponse.json();
        
        if (!servidores || servidores.error) {
          const idiomasResponse = await fetch(
            `${CLOUDFLARE_BASE_URL}/idiomas?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}`
          );
          
          if (idiomasResponse.ok) {
            const idiomasDisponibles = await idiomasResponse.json();
            throw new Error(`Idioma "${idioma}" no disponible. Idiomas disponibles: ${idiomasDisponibles.join(', ')}`);
          } else {
            throw new Error("Error obteniendo servidores");
          }
        }

        episodios = [];

        for (const servidor of servidores) {
          const episodiosResponse = await fetch(
            `${CLOUDFLARE_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
          );
          
          if (!episodiosResponse.ok) {
            console.warn(`No se pudieron obtener episodios para ${servidor}`);
            continue;
          }
          
          const episodiosData = await episodiosResponse.json();
          
          if (!episodiosData || episodiosData.error) {
            console.warn(`Error obteniendo episodios para ${servidor}:`, episodiosData.error);
            continue;
          }

          episodiosData.forEach(epData => {
            let episodio = episodios.find(e => e.name === epData.episodio);
            if (!episodio) {
              episodio = { name: epData.episodio, embeds: {} };
              episodios.push(episodio);
            }
            episodio.embeds[servidor] = epData.iframe;
          });
        }

        if (episodios.length === 0) {
          throw new Error(`No se encontraron episodios en Cloudflare para ${idioma}`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0];
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
      } catch (error) {
        console.error("Error cargando desde Cloudflare:", error);
        mostrarErrorCargaRecomendada(error.message);
        if (servicioActivo === 'cloudflare') {
          servicioActivo = 'firebase';
          updateServiceUI();
          await cargarEpisodiosDesdeFirebaseParaRecomendada();
        }
      }
    }

    /* ==================== FUNCIONES AUXILIARES SIN CAMBIOS ==================== */
    function updateHeaderInfo() {
      document.getElementById("serieTitle").textContent = nombreSerie;
      document.getElementById("seasonLang").textContent = `${temporada} - ${idioma}`;
      document.getElementById("episodeCount").textContent = `${episodios.length} episodios`;
    }

    function renderEpisodeSelector() {
      const selector = document.querySelector('.episode-selector');
      selector.innerHTML = '';
      episodios.forEach((ep, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = ep.name;
        if (index === currentEpisode) option.selected = true;
        selector.appendChild(option);
      });
      selector.onchange = () => {
        currentEpisode = parseInt(selector.value);
        changeVideo(servidorActivo);
      };
    }

    function renderServerOptions() {
      const serverSelect = document.getElementById("serverSelect");
      serverSelect.innerHTML = '';
      const servidores = [...new Set(episodios.flatMap(ep => Object.keys(ep.embeds)))];
      servidores.forEach(server => {
        const option = document.createElement('option');
        option.value = server;
        option.textContent = server;
        if (server === servidorActivo) option.selected = true;
        serverSelect.appendChild(option);
      });
    }

    function renderSidebar() {
      const sidebar = document.getElementById('sidebarPlaylist');
      sidebar.innerHTML = '';
      episodios.forEach((ep, index) => {
        if (ep.embeds[servidorActivo]) {
          const item = document.createElement('div');
          item.className = 'episode-item';
          if (index === currentEpisode) item.classList.add('active');
          item.onclick = () => {
            currentEpisode = index;
            renderEpisodeSelector();
            renderServerOptions();
            changeVideo(servidorActivo);
          };
          const img = document.createElement('img');
          img.src = getCustomThumbnailURL(servidorActivo);
          img.className = 'thumbnail';
          const info = document.createElement('div');
          info.className = 'episode-info';
          const title = document.createElement('div');
          title.className = 'episode-title';
          title.textContent = ep.name;
          const server = document.createElement('div');
          server.className = 'episode-server';
          server.textContent = servidorActivo;
          info.appendChild(title);
          info.appendChild(server);
          item.appendChild(img);
          item.appendChild(info);
          sidebar.appendChild(item);
        }
      });
    }

    function selectEpisode(index) {
      currentEpisode = parseInt(index);
      changeVideo(servidorActivo);
    }

    function nextEpisode() {
      if (currentEpisode < episodios.length - 1) {
        currentEpisode++;
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
      }
    }

    function previousEpisode() {
      if (currentEpisode > 0) {
        currentEpisode--;
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
      }
    }

    function changeVideo(servidor) {
      servidorActivo = servidor;
      const videoContainer = document.getElementById('videoContainer');
      const videoDetails = document.getElementById("videoDetails");

      videoContainer.innerHTML = '';

      const embed = episodios[currentEpisode].embeds[servidor];

      if (!embed) {
        videoContainer.innerHTML = `
          <div style="padding: 20px; background-color: #ffeeee; color: #a94442; border-radius: 10px; text-align: center;">
            <p style="font-weight: bold;">Este episodio (<strong>${episodios[currentEpisode].name}</strong>) no está disponible en el servidor: <u>${servidor}</u> por varias razones (Copyright o no se pudo subir al Servidor).</p>
            <button onclick="irAEpisodioDisponible('${servidor.replace(/'/g, "\\'")}')" style="margin-top:10px; padding: 10px 20px; background-color: #003a73; color: white; border: none; border-radius: 8px; cursor: pointer;">
              Ir a los episodios disponibles
            </button>
          </div>
        `;
        videoDetails.textContent = `${nombreSerie} | ${temporada} - ${idioma} | ${episodios[currentEpisode].name} | ${servidor} (No disponible)`;
        renderServerOptions();
        renderSidebar();
        return;
      }

      if (servidor === 'abyss') {
        const iframe = document.getElementById('abyssIframe') || document.createElement('iframe');
        iframe.id = 'abyssIframe';
        iframe.style.display = 'block';
        iframe.style.width = '100%';
        iframe.style.minHeight = '440px';
        iframe.style.border = 'none';
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');
        iframe.srcdoc = episodios[currentEpisode].embeds[servidor];
        videoContainer.appendChild(iframe);
      } 
      else if (servidor.toLowerCase().includes('jumpshare')) {
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.paddingBottom = '56.25%';
        container.style.height = '0';
        container.style.overflow = 'hidden';
        container.style.borderRadius = '10px';
        container.style.backgroundColor = '#000';
        
        let modifiedEmbed = embed;
        
        if (modifiedEmbed.includes('position: absolute')) {
          modifiedEmbed = modifiedEmbed.replace(
            'style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"',
            'style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"'
          );
        } else {
          modifiedEmbed = modifiedEmbed.replace(
            '<iframe',
            '<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"'
          );
        }
        
        container.innerHTML = modifiedEmbed;
        videoContainer.appendChild(container);
      }
      else if (servidor === 'Tokio Video') {
        let modifiedEmbed = embed.replace(/style="[^"]*max-width:[^";]*;?[^"]*"/gi, '');
        videoContainer.innerHTML = modifiedEmbed;
      }
      else {
        videoContainer.innerHTML = embed;
      }

      if (videoDetails) {
        videoDetails.textContent = `${nombreSerie} | ${temporada} - ${idioma} | ${episodios[currentEpisode].name} | ${servidor}`;
      }

      renderServerOptions();
      renderSidebar();
    }

    function irAEpisodioDisponible(servidor) {
      let encontrado = false;

      for (let i = 0; i < episodios.length; i++) {
        if (episodios[i].embeds[servidor]) {
          currentEpisode = i;
          changeVideo(servidor);
          encontrado = true;
          break;
        }
      }

      if (!encontrado) {
        const videoContainer = document.getElementById('videoContainer');
        videoContainer.innerHTML = `
          <div style="padding: 20px; background-color: #fff8e1; color: #8a6d3b; border-radius: 10px; text-align: center;">
            <p>No se encontraron episodios disponibles en el servidor: <u>${servidor}</u>.</p>
          </div>
        `;
      }
    }

    function getCustomThumbnailURL() {
      return "https://timelinecovers.pro/facebook-cover/download/anime-your-name-star-fall-facebook-cover.jpg";
    }

    /* ==================== INICIALIZACIÓN ==================== */
    document.addEventListener('DOMContentLoaded', function() {
      // Event Listeners para el dropdown
      document.getElementById("serviceToggleBtn").addEventListener("click", toggleDropdown);
      
      // Event listeners para las opciones del dropdown
      document.querySelectorAll('.service-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const servicio = item.getAttribute('data-service');
          cambiarServicio(servicio);
        });
      });
      
      // Cerrar dropdown al hacer clic fuera
      document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('serviceDropdown');
        if (dropdown && !dropdown.contains(e.target)) {
          cerrarDropdown();
        }
      });
      
      updateServiceUI();
      
      if (obtenerParametrosURL()) {
        cargarEpisodios();
      } else {
        mostrarError("Por favor, selecciona una serie desde el catálogo principal.");
      }
    });