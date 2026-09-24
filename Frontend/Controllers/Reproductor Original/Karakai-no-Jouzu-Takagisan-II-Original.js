
   import { ENV } from '../../Config/config.js';

  // ================= CONFIGURACIÓN DE ENTORNO =================
  const IS_LOCAL =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'file:';

  const SQLSERVER_BASE_URL = IS_LOCAL
      ? 'http://localhost:3001'
      : ENV.AZURE_API_KEY_URL;   // ⚠️ Reemplazar por tu URL real

  console.log(`🔌 SQL Server: ${SQLSERVER_BASE_URL} (${IS_LOCAL ? 'LOCAL' : 'PRODUCCIÓN'})`);

  // ================= CONFIGURACIÓN =================
  const firebaseConfig = {
    apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROYECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
  measurementId: ENV.FIREBASE_MEASUREMENT_ID
  };

  const CLOUDFLARE_BASE_URL = ENV.CLOUDFLARE_API_KEY_URL;

  const GOOGLE_SHEETS_CONFIG = {
    SPREADSHEET_ID: ENV.GOOGLESHEETS_API_KEY_URL,
    HOJA_IFRAMES: 'iframes'
  };

  // Datos de la serie fija
  const nombreSerie = "Karakai no Jouzu Takagisan";
  const temporada = "Temporada 02";
  const idioma = "Sub Español";

  // ================= INICIALIZACIÓN =================
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  let episodios = [];
  let currentEpisode = 0;
  let servidorActivo = null;
  let servicioActivo = 'firebase';

  // ================= FUNCIONES DE CARGA =================

  async function cargarEpisodios() {
    mostrarMensajeCarga();

    try {
      if (servicioActivo === 'firebase') {
        await cargarDesdeFirebase();
      } else if (servicioActivo === 'cloudflare') {
        await cargarDesdeCloudflare();
      } else if (servicioActivo === 'sqlserver') {
        await cargarDesdeSQLServer();
      } else {
        await cargarDesdeGoogleSheets();
      }
      actualizarUI();
    } catch (error) {
      console.error(`Error en ${servicioActivo}:`, error);
      // Fallback circular (ahora incluye sqlserver)
      const servicios = ['firebase', 'cloudflare', 'sqlserver', 'sheets'];
      const idx = servicios.indexOf(servicioActivo);
      const next = servicios[(idx + 1) % servicios.length];
      servicioActivo = next;
      document.getElementById('serviceSelector').value = next;
      actualizarIndicador();
      await cargarEpisodios();
    }
  }

  function mostrarMensajeCarga() {
    const container = document.getElementById('videoContainer');
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; background: rgba(255,255,255,0.3); backdrop-filter: blur(4px); border-radius: 16px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div style="margin-bottom:15px; font-size: 2.5rem;">⏳</div>
        <h3 style="color: #1a1a2e;">Cargando episodios desde ${servicioActivo.toUpperCase()}...</h3>
        <p style="color: #1e3a5f;">${nombreSerie} - ${temporada} (${idioma})</p>
      </div>
    `;
  }

  // ------- Firebase -------
  async function cargarDesdeFirebase() {
    const servidoresSnap = await db
      .collection("animes-series").doc(nombreSerie)
      .collection("Temporadas").doc(temporada)
      .collection("Idiomas").doc(idioma)
      .collection("Servidores").get();

    episodios = [];
    for (const servidorDoc of servidoresSnap.docs) {
      const servidor = servidorDoc.id;
      const epsSnap = await db
        .collection("animes-series").doc(nombreSerie)
        .collection("Temporadas").doc(temporada)
        .collection("Idiomas").doc(idioma)
        .collection("Servidores").doc(servidor)
        .collection("Episodios").get();

      epsSnap.forEach(doc => {
        const nombreEp = doc.id;
        const iframe = doc.data().iframe;
        let ep = episodios.find(e => e.name === nombreEp);
        if (!ep) {
          ep = { name: nombreEp, embeds: {} };
          episodios.push(ep);
        }
        ep.embeds[servidor] = iframe;
      });
    }
    if (episodios.length === 0) throw new Error("No se encontraron episodios en Firebase");
    episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    servidorActivo = Object.keys(episodios[0].embeds)[0];
  }

  // ------- Cloudflare -------
  async function cargarDesdeCloudflare() {
    const resServ = await fetch(`${CLOUDFLARE_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`);
    if (!resServ.ok) throw new Error("Error obteniendo servidores desde Cloudflare");
    const servidores = await resServ.json();
    if (!servidores || servidores.error) throw new Error(servidores.error || "No hay servidores");

    episodios = [];
    for (const servidor of servidores) {
      const resEps = await fetch(`${CLOUDFLARE_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`);
      if (!resEps.ok) continue;
      const epsData = await resEps.json();
      if (!epsData || epsData.error) continue;
      epsData.forEach(epData => {
        let ep = episodios.find(e => e.name === epData.episodio);
        if (!ep) {
          ep = { name: epData.episodio, embeds: {} };
          episodios.push(ep);
        }
        ep.embeds[servidor] = epData.iframe;
      });
    }
    if (episodios.length === 0) throw new Error("No se encontraron episodios en Cloudflare");
    episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    servidorActivo = Object.keys(episodios[0].embeds)[0];
  }

  // ------- SQL Server (NUEVO) 🎯 -------
  async function cargarDesdeSQLServer() {
    console.log(`🔌 Cargando desde SQL Server: ${nombreSerie} - ${temporada} - ${idioma}`);

    // 1. Obtener servidores
    const resServ = await fetch(
      `${SQLSERVER_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
    );
    if (!resServ.ok) throw new Error("Error obteniendo servidores desde SQL Server");

    const servidores = await resServ.json();
    if (!Array.isArray(servidores) || servidores.length === 0) {
      throw new Error("No hay servidores disponibles");
    }

    // 2. Obtener episodios de cada servidor
    episodios = [];
    for (const servidor of servidores) {
      const resEps = await fetch(
        `${SQLSERVER_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
      );
      if (!resEps.ok) {
        console.warn(`No se pudieron obtener episodios para ${servidor}`);
        continue;
      }

      const epsData = await resEps.json();
      if (!Array.isArray(epsData)) continue;

      epsData.forEach(epData => {
        let ep = episodios.find(e => e.name === epData.episodio);
        if (!ep) {
          ep = { name: epData.episodio, embeds: {} };
          episodios.push(ep);
        }
        ep.embeds[servidor] = epData.iframe;
      });
    }

    if (episodios.length === 0) throw new Error("No se encontraron episodios en SQL Server");
    episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    servidorActivo = Object.keys(episodios[0].embeds)[0];

    console.log(`✅ Cargados ${episodios.length} episodios desde SQL Server`);
  }

  // ------- Google Sheets -------
  async function cargarDesdeGoogleSheets() {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEETS_CONFIG.HOJA_IFRAMES)}`;
    const resp = await fetch(csvUrl);
    if (!resp.ok) throw new Error("Error obteniendo CSV de Google Sheets");
    const csvText = await resp.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error("CSV vacío o mal formado");

    episodios = [];
    const servidoresSet = new Set();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const serieCSV = (row[0] || '').trim();
      const tempCSV = (row[1] || '').trim();
      const idiomaCSV = (row[2] || '').trim();
      const servidorCSV = (row[3] || '').trim();
      const epCSV = (row[4] || '').trim();
      const iframeCSV = (row[5] || '').trim();

      if (serieCSV !== nombreSerie || tempCSV !== temporada || idiomaCSV !== idioma) continue;
      if (!epCSV || !iframeCSV || !servidorCSV) continue;

      servidoresSet.add(servidorCSV);
      let ep = episodios.find(e => e.name === epCSV);
      if (!ep) {
        ep = { name: epCSV, embeds: {} };
        episodios.push(ep);
      }
      ep.embeds[servidorCSV] = iframeCSV;
    }

    if (episodios.length === 0) throw new Error("No se encontraron episodios en Google Sheets");
    episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    servidorActivo = Array.from(servidoresSet)[0] || Object.keys(episodios[0].embeds)[0];
  }

  // Utilidad: parsear CSV
  function parseCSV(text) {
    const rows = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let current = '';
      let inside = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inside = !inside;
        else if (ch === ',' && !inside) {
          row.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      row.push(current.trim());
      rows.push(row.map(c => c.replace(/^"|"$/g, '')));
    }
    return rows;
  }

  // ================= ACTUALIZACIÓN DE UI =================

  function actualizarUI() {
    const episodeSel = document.getElementById('episodeSelector');
    episodeSel.innerHTML = '';
    episodios.forEach((ep, idx) => {
      if (ep.embeds[servidorActivo]) {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = ep.name;
        if (idx === currentEpisode) opt.selected = true;
        episodeSel.appendChild(opt);
      }
    });

    const serverSel = document.getElementById('serverSelector');
    serverSel.innerHTML = '';
    const servidoresUnicos = new Set();
    episodios.forEach(ep => {
      for (const s in ep.embeds) servidoresUnicos.add(s);
    });
    servidoresUnicos.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === servidorActivo) opt.selected = true;
      serverSel.appendChild(opt);
    });

    changeVideo(servidorActivo);
    actualizarIndicador();
  }

  function actualizarIndicador() {
    const label = document.getElementById('serviceIndicator');
    const nombres = {
      firebase:   'Firebase',
      cloudflare: 'Cloudflare',
      sheets:     'Google Sheets',
      sqlserver:  'SQL Server'
    };
    const iconos = {
      firebase:   'fa-database',
      cloudflare: 'fa-cloud',
      sheets:     'fa-table',
      sqlserver:  'fa-server'
    };
    const servicio = servicioActivo || 'firebase';
    label.innerHTML = `<i class="fas ${iconos[servicio]}"></i> Servicio: ${nombres[servicio] || servicio}`;
  }

  // ================= FUNCIONES DE CONTROL =================

  function cambiarServicio(nuevo) {
    if (nuevo === servicioActivo) return;
    servicioActivo = nuevo;
    document.getElementById('serviceSelector').value = nuevo;
    actualizarIndicador();
    currentEpisode = 0;
    cargarEpisodios();
  }

  function selectEpisode(index) {
    currentEpisode = parseInt(index);
    changeVideo(servidorActivo);
  }

  function nextEpisode() {
    for (let i = currentEpisode + 1; i < episodios.length; i++) {
      if (episodios[i].embeds[servidorActivo]) {
        currentEpisode = i;
        document.getElementById('episodeSelector').value = i;
        changeVideo(servidorActivo);
        return;
      }
    }
  }

  function previousEpisode() {
    for (let i = currentEpisode - 1; i >= 0; i--) {
      if (episodios[i].embeds[servidorActivo]) {
        currentEpisode = i;
        document.getElementById('episodeSelector').value = i;
        changeVideo(servidorActivo);
        return;
      }
    }
  }

  // ===== FUNCIÓN PARA BUSCAR EPISODIO DISPONIBLE =====
  function irAEpisodioDisponible(plataforma) {
    const primerDisponible = episodios.findIndex(ep => ep.embeds[plataforma]);
    if (primerDisponible !== -1) {
      currentEpisode = primerDisponible;
      document.getElementById('episodeSelector').value = currentEpisode;
      changeVideo(plataforma);
    } else {
      alert("Este servidor no tiene episodios disponibles.");
    }
  }

  function changeVideo(plataforma) {
    servidorActivo = plataforma;
    const container = document.getElementById('videoContainer');
    const embed = episodios[currentEpisode]?.embeds?.[plataforma];

    if (!embed) {
      const idx = episodios.findIndex(ep => ep.embeds[plataforma]);
      if (idx !== -1) {
        currentEpisode = idx;
        document.getElementById('episodeSelector').value = currentEpisode;
        changeVideo(plataforma);
        return;
      }
      container.innerHTML = `
        <div style="padding:20px; background:rgba(255,238,238,0.8); backdrop-filter:blur(4px); color:#a94442; border-radius:10px; text-align:center; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <p style="font-weight:600;">No hay episodios disponibles en <strong>${plataforma}</strong>.</p>
          <div style="margin-top:15px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button onclick="irAEpisodioDisponible('${plataforma.replace(/'/g, "\\'")}')" 
                    style="padding:10px 20px; background:#0d47a1; color:white; border:none; border-radius:40px; cursor:pointer; font-weight:600; transition:0.2s; font-family:'Inter',sans-serif;">
              Buscar episodio disponible
            </button>
            <button onclick="cambiarServicio(document.getElementById('serviceSelector').value)" 
                    style="padding:10px 20px; background:#0288d1; color:white; border:none; border-radius:40px; cursor:pointer; font-weight:600; transition:0.2s; font-family:'Inter',sans-serif;">
              Cambiar servicio
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = embed;
    document.getElementById('episodeSelector').value = currentEpisode;
    document.getElementById('serverSelector').value = servidorActivo;
  }

  // ================= INICIO =================
  cargarEpisodios();

  Object.assign(window, {
    changeVideo,
    cambiarServicio,
    irAEpisodioDisponible,
    selectEpisode,
    nextEpisode,
    previousEpisode
});