    // ================= CONFIGURACIÓN =================
    const firebaseConfig = {
      apiKey: "AIzaSyB6MY2y5uyum87PdUHUpY8NNh4D73Yhx4U",
      authDomain: "animes-plus-89b93.firebaseapp.com",
      projectId: "animes-plus-89b93",
      storageBucket: "animes-plus-89b93.appspot.com",
      messagingSenderId: "402867181985",
      appId: "1:402867181985:web:d695b12977fe4270dbd3e0",
      measurementId: "G-DN632G7XJT"
    };
    
    // Configuración de Cloudflare
    const cloudflareConfig = {
      baseURL: 'https://proyecto-cloudflare.apiprueba2025.workers.dev',
      endpoints: {
        indiceSeries: '/indice-series',
        buscarIndice: '/buscar-indice'
      }
    };
    
    // Configuración de Google Sheets
    const googleSheetsConfig = {
      SPREADSHEET_ID: '1V4LTYiuTDZ_Y_k6GRyVmFm5-G3rVhE6x1KfIcxJfLqM',
      SHEET_NAME: 'Indices',
      RANGE: 'A:H'
    };

    // ================= VARIABLES GLOBALES =================
    let servicioActual = 'firebase';
    let firebaseInicializado = false;
    let db;
    let series = [];
    let todas = [];
    let pagina = 0;
    const porPagina = 10;
    const letraActual = 'p';

    // ================= INICIALIZAR FIREBASE =================
    function inicializarFirebase() {
      if (!firebaseInicializado) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseInicializado = true;
      }
    }

    // ================= CAMBIAR SERVICIO =================
    function cambiarServicio(servicio) {
      servicioActual = servicio;
      
      // Actualizar botones
      document.getElementById('btnFirebase').classList.toggle('activo', servicio === 'firebase');
      document.getElementById('btnCloudflare').classList.toggle('activo', servicio === 'cloudflare');
      document.getElementById('btnSheets').classList.toggle('activo', servicio === 'sheets');
      
      // Actualizar estado
      let servicioTexto = '';
      if (servicio === 'firebase') servicioTexto = 'Firebase';
      else if (servicio === 'cloudflare') servicioTexto = 'Cloudflare';
      else servicioTexto = 'Google Sheets';
      
      document.getElementById('estadoServicio').textContent = `Servicio: ${servicioTexto}`;
      
      // Recargar datos
      cargarSeries();
    }

    // ================= MOSTRAR/OCULTAR MENSAJES =================
    function mostrarCarga(mensaje) {
      document.getElementById('cargaContainer').style.display = 'block';
      document.getElementById('errorContainer').style.display = 'none';
      document.getElementById('cardsContainer').innerHTML = '';
      document.getElementById('servicioCarga').textContent = mensaje;
    }

    function ocultarCarga() {
      document.getElementById('cargaContainer').style.display = 'none';
    }

    function mostrarError(mensaje) {
      document.getElementById('errorContainer').style.display = 'block';
      document.getElementById('errorContainer').innerHTML = mensaje;
      document.getElementById('cargaContainer').style.display = 'none';
      document.getElementById('cardsContainer').innerHTML = '';
    }

    function ocultarError() {
      document.getElementById('errorContainer').style.display = 'none';
    }

    // ================= FUNCIONES DE OBTENCIÓN DE DATOS =================
    async function obtenerDeCloudflare(endpoint, params = {}) {
      try {
        let url = cloudflareConfig.baseURL + endpoint;
        if (Object.keys(params).length > 0) {
          const queryParams = new URLSearchParams(params);
          url += '?' + queryParams.toString();
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error al obtener datos de Cloudflare:', error);
        throw error;
      }
    }

    async function obtenerDeGoogleSheets() {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${googleSheetsConfig.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${googleSheetsConfig.SHEET_NAME}`;
        console.log("Cargando desde Google Sheets URL:", csvUrl);
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        const csvText = await response.text();
        console.log("Datos CSV recibidos:", csvText.substring(0, 500));
        const rows = parseGoogleSheetsCSV(csvText);
        if (rows.length === 0) {
          throw new Error("No se encontraron datos en Google Sheets");
        }
        const headers = rows[0].map(h => h.trim().toLowerCase());
        console.log("Encabezados encontrados:", headers);
        const indexId = headers.findIndex(h => h.includes('id') || h.includes('nombre') || h.includes('serie'));
        const indexNombreSec = headers.findIndex(h => h.includes('nombresec') || h.includes('título'));
        const indexNombreSec02 = headers.findIndex(h => h.includes('nombresec02') || h.includes('subtítulo'));
        const indexAnio = headers.findIndex(h => h.includes('año') || h.includes('anio') || h.includes('year'));
        const indexCategoria = headers.findIndex(h => h.includes('categoria') || h.includes('categoría') || h.includes('género'));
        const indexIdioma = headers.findIndex(h => h.includes('idioma') || h.includes('language'));
        const indexImagen = headers.findIndex(h => h.includes('imagen') || h.includes('image') || h.includes('portada'));
        const indexSitio = headers.findIndex(h => h.includes('sitio') || h.includes('link') || h.includes('url'));
        if (indexId === -1 || indexNombreSec === -1 || indexImagen === -1 || indexSitio === -1) {
          console.error("Encabezados necesarios no encontrados:", {
            id: indexId, nombresec: indexNombreSec, imagen: indexImagen, sitio: indexSitio
          });
          throw new Error("Formato de Google Sheets incorrecto. Se necesitan columnas: ID/Nombre, NombreSec, Imagen, Sitio");
        }
        const datos = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length <= Math.max(indexId, indexNombreSec, indexImagen, indexSitio)) continue;
          const id = (row[indexId] || '').trim();
          const nombresec = (row[indexNombreSec] || '').trim();
          const nombresec02 = indexNombreSec02 !== -1 ? (row[indexNombreSec02] || '').trim() : '';
          const año = indexAnio !== -1 ? (row[indexAnio] || '').trim() : '';
          const categoria = indexCategoria !== -1 ? (row[indexCategoria] || '').trim() : 'Sin categoría';
          const idioma = indexIdioma !== -1 ? (row[indexIdioma] || '').trim() : 'Español';
          const imagen = (row[indexImagen] || '').trim();
          const sitio = (row[indexSitio] || '').trim();
          if (!id || !nombresec || !imagen || !sitio) continue;
          datos.push({
            id: id,
            nombresec: nombresec,
            nombresec02: nombresec02,
            año: año,
            categoria: categoria,
            idioma: idioma,
            imagen: imagen,
            sitio: sitio
          });
        }
        return datos;
      } catch (error) {
        console.error("Error cargando desde Google Sheets:", error);
        throw error;
      }
    }

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
        const cleanedRow = row.map(cell => cell.replace(/^"|"$/g, ''));
        rows.push(cleanedRow);
      }
      return rows;
    }

    // ================= CARGAR SERIES =================
    async function cargarSeries() {
      try {
        ocultarError();
        let servicioTexto = '';
        if (servicioActual === 'firebase') servicioTexto = 'Firebase';
        else if (servicioActual === 'cloudflare') servicioTexto = 'Cloudflare';
        else servicioTexto = 'Google Sheets';
        mostrarCarga(servicioTexto);
        if (servicioActual === 'firebase') {
          await cargarDesdeFirebase();
        } else if (servicioActual === 'cloudflare') {
          await cargarDesdeCloudflare();
        } else {
          await cargarDesdeGoogleSheets();
        }
        ocultarCarga();
      } catch (error) {
        console.error(`Error al cargar desde ${servicioActual}:`, error);
        ocultarCarga();
        let servicioAlternativo = '';
        if (servicioActual === 'firebase') servicioAlternativo = 'cloudflare';
        else if (servicioActual === 'cloudflare') servicioAlternativo = 'sheets';
        else servicioAlternativo = 'firebase';
        mostrarError(`
          <strong>Error al cargar desde ${servicioActual}</strong><br>
          ${error.message}<br><br>
          <button onclick="cambiarServicio('${servicioAlternativo}')">
            Intentar con ${servicioAlternativo === 'firebase' ? 'Firebase' : servicioAlternativo === 'cloudflare' ? 'Cloudflare' : 'Google Sheets'}
          </button>
        `);
      }
    }

    async function cargarDesdeFirebase() {
      inicializarFirebase();
      const snapshot = await db.collection("animes-series-indice").get();
      todas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      series = todas.filter(serie => serie.id.toLowerCase().startsWith(letraActual));
      pagina = 0;
      actualizarSelector();
      mostrarPagina();
    }

    async function cargarDesdeCloudflare() {
      const datos = await obtenerDeCloudflare(cloudflareConfig.endpoints.indiceSeries);
      todas = datos.map(item => ({
        id: item.nombreSerie,
        nombresec: item.nombresec,
        nombresec02: item.nombresec02,
        año: item.año,
        categoria: item.categoria,
        idioma: item.idioma,
        imagen: item.imagen,
        sitio: item.sitio
      }));
      series = todas.filter(serie => serie.id.toLowerCase().startsWith(letraActual));
      pagina = 0;
      actualizarSelector();
      mostrarPagina();
    }

    async function cargarDesdeGoogleSheets() {
      const datos = await obtenerDeGoogleSheets();
      todas = datos.map(item => ({
        id: item.id,
        nombresec: item.nombresec,
        nombresec02: item.nombresec02,
        año: item.año,
        categoria: item.categoria,
        idioma: item.idioma,
        imagen: item.imagen,
        sitio: item.sitio
      }));
      series = todas.filter(serie => serie.id.toLowerCase().startsWith(letraActual));
      pagina = 0;
      actualizarSelector();
      mostrarPagina();
      console.log(`Cargadas ${series.length} series desde Google Sheets (letra ${letraActual.toUpperCase()})`);
    }

    // ================= ACTUALIZAR SELECTOR =================
    function actualizarSelector() {
      const nombreSelector = document.getElementById("nombreSelector");
      let opciones = `<option value="">Todas las series con la letra "${letraActual.toUpperCase()}" (${series.length})</option>`;
      opciones += series.map(s => `<option value="${s.id}">${s.id}</option>`).join('');
      nombreSelector.innerHTML = opciones;
      nombreSelector.selectedIndex = 0;
    }

    // ================= MOSTRAR PÁGINA =================
    function mostrarPagina() {
      const contenedor = document.getElementById("cardsContainer");
      contenedor.innerHTML = "";
      const inicio = pagina * porPagina;
      const fin = inicio + porPagina;
      const filtradas = series.slice(inicio, fin);

      filtradas.forEach((s, i) => {
        const wrapper = document.createElement("div");
        wrapper.className = "carta-wrapper";
        if (i % 2 === 1) wrapper.classList.add("carta-superpuesta");

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="card-imagen">
            <img src="${s.imagen}" alt="${s.nombresec}" onerror="this.src='https://via.placeholder.com/160x250?text=Sin+Imagen'"/>
          </div>
          <div class="card-contenido">
            <div class="nombre-id">${s.id}</div>
            <div class="titulo">${s.nombresec}</div>
            <div class="subtitulo">${s.nombresec02 || ""}</div>
            <div class="subtitulo">${s.año} - ${s.idioma}</div>
            <div class="etiquetas">
              ${s.categoria.split(',').map(c => `<span>${c.trim()}</span>`).join('')}
            </div>
            <button class="boton-ver" onclick="window.open('${s.sitio}', '_blank')">Ver Ahora</button>
          </div>
        `;
        wrapper.appendChild(card);
        contenedor.appendChild(wrapper);
      });

      actualizarInfoPagina();
    }

    function actualizarInfoPagina() {
      const totalPaginas = Math.ceil(series.length / porPagina);
      document.getElementById("infoPagina").textContent = `Página ${pagina + 1} de ${totalPaginas}`;
    }

    // ================= NAVEGACIÓN =================
    function paginaSiguiente() {
      if ((pagina + 1) * porPagina < series.length) {
        pagina++;
        mostrarPagina();
      }
    }

    function paginaAnterior() {
      if (pagina > 0) {
        pagina--;
        mostrarPagina();
      }
    }

    // ================= EVENTOS =================
    document.getElementById("nombreSelector").addEventListener("change", e => {
      const seleccion = e.target.value;
      pagina = 0;
      if (seleccion === "") {
        mostrarPagina();
        return;
      }
      const contenedor = document.getElementById("cardsContainer");
      contenedor.innerHTML = "";
      const filtradas = series.filter(s => s.id === seleccion);
      filtradas.forEach((s, i) => {
        const wrapper = document.createElement("div");
        wrapper.className = "carta-wrapper";
        if (i % 2 === 1) wrapper.classList.add("carta-superpuesta");
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="card-imagen">
            <img src="${s.imagen}" alt="${s.nombresec}" onerror="this.src='https://via.placeholder.com/160x250?text=Sin+Imagen'"/>
          </div>
          <div class="card-contenido">
            <div class="nombre-id">${s.id}</div>
            <div class="titulo">${s.nombresec}</div>
            <div class="subtitulo">${s.nombresec02 || ""}</div>
            <div class="subtitulo">${s.año} - ${s.idioma}</div>
            <div class="etiquetas">
              ${s.categoria.split(',').map(c => `<span>${c.trim()}</span>`).join('')}
            </div>
            <button class="boton-ver" onclick="window.open('${s.sitio}', '_blank')">Ver Ahora</button>
          </div>
        `;
        wrapper.appendChild(card);
        contenedor.appendChild(wrapper);
      });
    });

    document.getElementById("buscador").addEventListener("input", e => {
      const texto = e.target.value.toLowerCase();
      pagina = 0;
      const contenedor = document.getElementById("cardsContainer");
      contenedor.innerHTML = "";
      const resultados = series.filter(s => s.id.toLowerCase().includes(texto));
      resultados.slice(0, porPagina).forEach((s, i) => {
        const wrapper = document.createElement("div");
        wrapper.className = "carta-wrapper";
        if (i % 2 === 1) wrapper.classList.add("carta-superpuesta");
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="card-imagen">
            <img src="${s.imagen}" alt="${s.nombresec}" onerror="this.src='https://via.placeholder.com/160x250?text=Sin+Imagen'"/>
          </div>
          <div class="card-contenido">
            <div class="nombre-id">${s.id}</div>
            <div class="titulo">${s.nombresec}</div>
            <div class="subtitulo">${s.nombresec02 || ""}</div>
            <div class="subtitulo">${s.año} - ${s.idioma}</div>
            <div class="etiquetas">
              ${s.categoria.split(',').map(c => `<span>${c.trim()}</span>`).join('')}
            </div>
            <button class="boton-ver" onclick="window.open('${s.sitio}', '_blank')">Ver Ahora</button>
          </div>
        `;
        wrapper.appendChild(card);
        contenedor.appendChild(wrapper);
      });
    });

    // ================= INICIO =================
    document.addEventListener('DOMContentLoaded', function() {
      cargarSeries();
    });