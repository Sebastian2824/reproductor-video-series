  // Configuración de Firebase
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
  const CLOUDFLARE_ENDPOINT = 'https://proyecto-cloudflare.apiprueba2025.workers.dev';

  // Configuración de Google Sheets
  const GOOGLE_SHEETS_CONFIG = {
    SPREADSHEET_ID: '1V4LTYiuTDZ_Y_k6GRyVmFm5-G3rVhE6x1KfIcxJfLqM',
    SHEET_NAME: 'Portadas',
    RANGE: 'A:D'
  };

  // Estado de la aplicación
  let servicioActivo = 'firebase';
  let todasLasSeries = [];
  let nombresUnicos = new Set();
  const ITEMS_POR_PAGINA = 12;
  let currentPage = 1;

  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // Función para cambiar entre servicios
  function cambiarServicio(nuevoServicio) {
    if (servicioActivo === nuevoServicio) {
      cerrarDropdown();
      return;
    }
    
    servicioActivo = nuevoServicio;
    updateServiceUI();
    currentPage = 1;
    cargarSeries();
    cerrarDropdown();
  }

  function updateServiceUI() {
    const indicator = document.getElementById('serviceIndicator');
    if (servicioActivo === 'firebase') {
      indicator.innerHTML = '<i class="fas fa-database"></i> Firebase';
    } else if (servicioActivo === 'cloudflare') {
      indicator.innerHTML = '<i class="fas fa-cloud"></i> Cloudflare';
    } else if (servicioActivo === 'sheets') {
      indicator.innerHTML = '<i class="fas fa-table"></i> Google Sheets';
    }
    
    document.querySelectorAll('.service-dropdown-item').forEach(item => {
      const itemService = item.getAttribute('data-service');
      if (itemService === servicioActivo) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  async function cargarSeries() {
    if (servicioActivo === 'firebase') {
      await cargarSeriesFirebase();
    } else if (servicioActivo === 'cloudflare') {
      await cargarSeriesCloudflare();
    } else {
      await cargarSeriesGoogleSheets();
    }
  }

  async function cargarSeriesFirebase() {
    try {
      const snapshotSeries = await db.collection("animes-series-portadas").get();
      const datosTemporales = [];

      for (const docSerie of snapshotSeries.docs) {
        const nombreSerie = docSerie.id;
        nombresUnicos.add(nombreSerie);

        const snapshotTemporadas = await db.collection("animes-series-portadas")
          .doc(nombreSerie).collection("Temporadas").get();

        snapshotTemporadas.forEach(docTemporada => {
          const temporadaCompleta = docTemporada.id;
          const data = docTemporada.data();
          const imagen = data.imagen || "https://via.placeholder.com/300x400?text=Sin+Imagen";
          const sitio = `Reproductor-Universal.html?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporadaCompleta)}`;

          datosTemporales.push({
            nombre: nombreSerie,
            temporadaCompleta: temporadaCompleta,
            imagen: imagen,
            sitio: sitio
          });
        });
      }

      todasLasSeries = datosTemporales;
      poblarMenuSeries();
      renderizarSeries();
    } catch (error) {
      console.error("Error cargando desde Firebase:", error);
      servicioActivo = 'cloudflare';
      updateServiceUI();
      showError("Error al conectar con Firebase. Cambiando a Cloudflare...");
      await cargarSeriesCloudflare();
    }
  }

  async function cargarSeriesCloudflare() {
    try {
      const response = await fetch(`${CLOUDFLARE_ENDPOINT}/portadas`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const portadas = await response.json();
      const datosTemporales = [];

      portadas.forEach(portada => {
        const nombreSerie = portada.nombreSerie;
        nombresUnicos.add(nombreSerie);
        const temporadaCompleta = portada.temporada;
        const sitio = `Reproductor-Universal.html?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporadaCompleta)}`;
        datosTemporales.push({
          nombre: nombreSerie,
          temporadaCompleta: temporadaCompleta,
          imagen: portada.imagen || "https://via.placeholder.com/300x400?text=Sin+Imagen",
          sitio: sitio
        });
      });

      todasLasSeries = datosTemporales;
      poblarMenuSeries();
      renderizarSeries();
    } catch (error) {
      console.error("Error cargando desde Cloudflare:", error);
      servicioActivo = 'sheets';
      updateServiceUI();
      showError("Error al conectar con Cloudflare. Cambiando a Google Sheets...");
      await cargarSeriesGoogleSheets();
    }
  }

  async function cargarSeriesGoogleSheets() {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${GOOGLE_SHEETS_CONFIG.SHEET_NAME}`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const csvText = await response.text();
      const rows = parseGoogleSheetsCSV(csvText);
      
      const datosTemporales = [];
      const processedRows = new Set();

      rows.forEach((row, index) => {
        if (index === 0 && (row[0]?.toLowerCase().includes('nombre') || row[0]?.toLowerCase().includes('serie'))) {
          return;
        }
        const nombreSerie = (row[0] || '').trim();
        const temporadaCompleta = (row[1] || '').trim();
        const imagen = (row[2] || '').trim();
        if (!nombreSerie || !temporadaCompleta) return;
        const rowKey = `${nombreSerie}|${temporadaCompleta}`;
        if (processedRows.has(rowKey)) return;
        processedRows.add(rowKey);
        nombresUnicos.add(nombreSerie);
        const sitio = `Reproductor-Universal.html?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporadaCompleta)}`;
        datosTemporales.push({
          nombre: nombreSerie,
          temporadaCompleta: temporadaCompleta,
          imagen: imagen || "https://via.placeholder.com/300x400?text=Sin+Imagen",
          sitio: sitio
        });
      });

      if (datosTemporales.length === 0) throw new Error("No se encontraron datos en Google Sheets");
      todasLasSeries = datosTemporales;
      poblarMenuSeries();
      renderizarSeries();
      showSuccess(`Cargadas ${datosTemporales.length} series desde Google Sheets`);
    } catch (error) {
      console.error("Error cargando desde Google Sheets:", error);
      servicioActivo = 'firebase';
      updateServiceUI();
      showError("Error al conectar con Google Sheets. Volviendo a Firebase...");
      await cargarSeriesFirebase();
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

  function showError(message) {
    console.error(message);
    alert(message);
  }

  function showSuccess(message) {
    console.log(message);
  }

  function toggleDropdown() {
    document.getElementById('serviceDropdown').classList.toggle('active');
  }

  function cerrarDropdown() {
    document.getElementById('serviceDropdown').classList.remove('active');
  }

  function poblarMenuSeries() {
    const select = document.getElementById("menuSeries");
    select.innerHTML = '<option value="">Todas las series</option>';
    [...nombresUnicos].sort().forEach(nombre => {
      const opcion = document.createElement("option");
      opcion.value = nombre;
      opcion.textContent = nombre;
      select.appendChild(opcion);
    });
  }

  function renderizarSeries() {
    const contenedor = document.getElementById("contenedorSeries");
    contenedor.innerHTML = "";

    const filtroNombre = document.getElementById("buscador").value.toLowerCase();
    const filtroSeleccionado = document.getElementById("menuSeries").value;
    const orden = document.getElementById("ordenar").value;

    let filtradas = todasLasSeries.filter(s => {
      const coincideTexto = s.nombre.toLowerCase().includes(filtroNombre);
      const coincideSeleccion = !filtroSeleccionado || s.nombre === filtroSeleccionado;
      return coincideTexto && coincideSeleccion;
    });

    filtradas.sort((a, b) => {
      if (orden === "az") return a.nombre.localeCompare(b.nombre);
      else return b.nombre.localeCompare(a.nombre);
    });

    const totalPaginas = Math.ceil(filtradas.length / ITEMS_POR_PAGINA);
    if (currentPage > totalPaginas) currentPage = 1;

    const inicio = (currentPage - 1) * ITEMS_POR_PAGINA;
    const paginadas = filtradas.slice(inicio, inicio + ITEMS_POR_PAGINA);

    if (paginadas.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>No se encontraron series</h3>
          <p>Intenta cambiar los filtros o seleccionar otro servicio.</p>
        </div>
      `;
      return;
    }

    paginadas.forEach(serie => {
      const card = document.createElement("div");
      card.className = "serie-card";
      card.innerHTML = `
        <img src="${serie.imagen}" alt="Portada de ${serie.nombre}" onerror="this.src='https://via.placeholder.com/300x400?text=Imagen+No+Disponible'">
        <div class="serie-info">
          <h3>${serie.nombre}</h3>
          <p>${serie.temporadaCompleta}</p>
          <a class="btn-ver" href="${serie.sitio}">Ver</a>
        </div>
      `;
      contenedor.appendChild(card);
    });

    renderizarPaginacion(totalPaginas);
  }

  function renderizarPaginacion(totalPaginas) {
    let paginacionContenedor = document.getElementById("paginacion");
    if (!paginacionContenedor) {
      paginacionContenedor = document.createElement("div");
      paginacionContenedor.id = "paginacion";
      document.querySelector(".main-content").appendChild(paginacionContenedor);
    }
    
    paginacionContenedor.innerHTML = "";
    if (totalPaginas <= 1) return;

    const btnAnterior = document.createElement("button");
    btnAnterior.innerHTML = "&#8592;";
    btnAnterior.disabled = currentPage === 1;
    btnAnterior.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderizarSeries(); }
    });

    const texto = document.createElement("span");
    texto.textContent = `Página ${String(currentPage).padStart(2, '0')} - ${String(totalPaginas).padStart(2, '0')}`;

    const btnSiguiente = document.createElement("button");
    btnSiguiente.innerHTML = "&#8594;";
    btnSiguiente.disabled = currentPage === totalPaginas;
    btnSiguiente.addEventListener("click", () => {
      if (currentPage < totalPaginas) { currentPage++; renderizarSeries(); }
    });

    paginacionContenedor.appendChild(btnAnterior);
    paginacionContenedor.appendChild(texto);
    paginacionContenedor.appendChild(btnSiguiente);
  }

  // Event Listeners
  document.getElementById("serviceToggleBtn").addEventListener("click", toggleDropdown);
  
  document.querySelectorAll('.service-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const servicio = item.getAttribute('data-service');
      cambiarServicio(servicio);
    });
  });
  
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('serviceDropdown');
    if (!dropdown.contains(e.target)) cerrarDropdown();
  });
  
  document.getElementById("buscador").addEventListener("input", () => {
    currentPage = 1;
    renderizarSeries();
  });
  document.getElementById("menuSeries").addEventListener("change", () => {
    currentPage = 1;
    renderizarSeries();
  });
  document.getElementById("ordenar").addEventListener("change", () => {
    currentPage = 1;
    renderizarSeries();
  });

  // Cargar datos iniciales
  cargarSeries();