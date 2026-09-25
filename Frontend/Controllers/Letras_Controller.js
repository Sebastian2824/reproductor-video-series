import { ENV } from '../Config/config.js';

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

const cloudflareConfig = {
    baseURL: ENV.CLOUDFLARE_API_KEY_URL,
    endpoints: {
        indiceSeries: '/indice-series',
        buscarIndice: '/buscar-indice'
    }
};

const googleSheetsConfig = {
    SPREADSHEET_ID: ENV.GOOGLESHEETS_API_KEY_URL,
    SHEET_NAME: 'Indices',
    RANGE: 'A:H'
};

// ================= CATEGORÍAS VÁLIDAS =================
// Letras a-z + ñ, más categorías especiales:
//   0-9   → números
//   sym   → símbolos
const CATEGORIAS_ESPECIALES = ['0-9', 'sym'];
const ES_CATEGORIA_ESPECIAL = (v) => CATEGORIAS_ESPECIALES.includes(v);

// Helper: ¿el string es una letra (a-z o ñ)?
const ES_LETRA = (v) => /^[a-zñ]$/i.test(v);

// ================= DETECCIÓN AUTOMÁTICA DE LA LETRA =================
function detectarLetra() {
    // 1. Query string  → ?letra=a  |  ?letra=0-9  |  ?letra=sym
    const urlParams = new URLSearchParams(window.location.search);
    const urlLetra = (urlParams.get('letra') || '').toLowerCase();
    if (ES_LETRA(urlLetra) || ES_CATEGORIA_ESPECIAL(urlLetra)) {
        console.log(`🔤 Categoría detectada por URL: ${urlLetra}`);
        return urlLetra;
    }

    // 2. data-letra en <html> o <body>
    const dataLetra = (
        document.documentElement.dataset.letra ||
        (document.body && document.body.dataset.letra) ||
        ''
    ).toLowerCase();
    if (ES_LETRA(dataLetra) || ES_CATEGORIA_ESPECIAL(dataLetra)) {
        console.log(`🔤 Categoría detectada por data-letra: ${dataLetra}`);
        return dataLetra;
    }

    // 3. Nombre del archivo: LETRA-A.html, Letra-0-9.html, Letra-Sym.html…
    const filename = window.location.pathname.split('/').pop().split('?')[0];

    // Primero intenta con las categorías especiales
    if (/letra[-_\s]*0[-_\s]*9/i.test(filename)) {
        console.log(`🔤 Categoría detectada por filename (${filename}): 0-9`);
        return '0-9';
    }
    if (/letra[-_\s]*(sym|simbolos|símbolos)/i.test(filename)) {
        console.log(`🔤 Categoría detectada por filename (${filename}): sym`);
        return 'sym';
    }

    // Luego letra normal
    const match = filename.match(/letra[-_\s]*([a-zñ])/i);
    if (match) {
        console.log(`🔤 Letra detectada por filename (${filename}): ${match[1].toUpperCase()}`);
        return match[1].toLowerCase();
    }

    // 4. Fallback
    console.warn('⚠️ No se pudo detectar la categoría. Usando "a" por defecto.');
    return 'a';
}

const letraActual = detectarLetra();

// ================= ACTUALIZAR TÍTULO DINÁMICAMENTE =================
document.addEventListener('DOMContentLoaded', () => {
    let titulo;
    if (letraActual === '0-9')      titulo = 'Series - Números (0-9)';
    else if (letraActual === 'sym') titulo = 'Series - Símbolos';
    else                            titulo = `Series - Letra ${letraActual.toUpperCase()}`;
    document.title = titulo;
});

// ================= VARIABLES GLOBALES =================
let servicioActual = 'firebase';
let firebaseInicializado = false;
let db;
let series = [];
let todas = [];
let pagina = 0;
const porPagina = 10;

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
    document.getElementById('btnSQLServer').classList.toggle('activo', servicio === 'sqlserver');

    // Actualizar estado
    let servicioTexto = '';
    if (servicio === 'firebase') servicioTexto = 'Firebase';
    else if (servicio === 'cloudflare') servicioTexto = 'Cloudflare';
    else if (servicio === 'sqlserver') servicioTexto = 'SQL Server';
    else servicioTexto = 'Google Sheets';

    document.getElementById('estadoServicio').textContent = `Servicio: ${servicioTexto}`;

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

// ================= FILTRAR POR CATEGORÍA =================
function filtrarPorCategoria(lista) {
    // Detectar el primer carácter significativo del nombre
    const obtenerPrimerCaracter = (str) => {
        const limpio = (str || '').trim();
        if (!limpio) return '';
        // Buscar el primer carácter alfanumérico o símbolo real (ignora espacios)
        for (const ch of limpio) {
            if (ch.trim() === '') continue; // saltar espacios
            return ch;
        }
        return '';
    };

    if (letraActual === '0-9') {
        // Series que empiezan con dígito 0-9
        return lista.filter(s => /^[0-9]/.test(obtenerPrimerCaracter(s.id)));
    }

    if (letraActual === 'sym') {
        // Series que empiezan con un símbolo (NO letra, NO número, NO espacio)
        return lista.filter(s => {
            const ch = obtenerPrimerCaracter(s.id);
            return ch && !/[a-z0-9ñ]/i.test(ch);
        });
    }

    // Letra normal (incluye ñ)
    return lista.filter(s => obtenerPrimerCaracter(s.id).toLowerCase() === letraActual);
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

// ⭐ NUEVO: función para SQL Server
async function obtenerDeSQLServer(endpoint, params = {}) {
    try {
        let url = SQLSERVER_BASE_URL + endpoint;
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
        console.error('Error al obtener datos de SQL Server:', error);
        throw error;
    }
}

async function obtenerDeGoogleSheets() {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${googleSheetsConfig.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${googleSheetsConfig.SHEET_NAME}`;
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);
        if (rows.length === 0) {
            throw new Error("No se encontraron datos en Google Sheets");
        }
        const headers = rows[0].map(h => h.trim().toLowerCase());
        const indexId = headers.findIndex(h => h.includes('id') || h.includes('nombre') || h.includes('serie'));
        const indexNombreSec = headers.findIndex(h => h.includes('nombresec') || h.includes('título'));
        const indexNombreSec02 = headers.findIndex(h => h.includes('nombresec02') || h.includes('subtítulo'));
        const indexAnio = headers.findIndex(h => h.includes('año') || h.includes('anio') || h.includes('year'));
        const indexCategoria = headers.findIndex(h => h.includes('categoria') || h.includes('categoría') || h.includes('género'));
        const indexIdioma = headers.findIndex(h => h.includes('idioma') || h.includes('language'));
        const indexImagen = headers.findIndex(h => h.includes('imagen') || h.includes('image') || h.includes('portada'));
        const indexSitio = headers.findIndex(h => h.includes('sitio') || h.includes('link') || h.includes('url'));

        if (indexId === -1 || indexNombreSec === -1 || indexImagen === -1 || indexSitio === -1) {
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

            datos.push({ id, nombresec, nombresec02, año, categoria, idioma, imagen, sitio });
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
            if (char === '"') insideQuotes = !insideQuotes;
            else if (char === ',' && !insideQuotes) {
                row.push(currentCell.trim());
                currentCell = '';
            } else currentCell += char;
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
        else if (servicioActual === 'sqlserver') servicioTexto = 'SQL Server';
        else servicioTexto = 'Google Sheets';
        mostrarCarga(servicioTexto);

        if (servicioActual === 'firebase') {
            await cargarDesdeFirebase();
        } else if (servicioActual === 'cloudflare') {
            await cargarDesdeCloudflare();
        } else if (servicioActual === 'sqlserver') {
            await cargarDesdeSQLServer();
        } else {
            await cargarDesdeGoogleSheets();
        }
        ocultarCarga();
    } catch (error) {
        console.error(`Error al cargar desde ${servicioActual}:`, error);
        ocultarCarga();

        // Fallback circular: Firebase → Cloudflare → SQL Server → Sheets → Firebase
        const orden = ['firebase', 'cloudflare', 'sqlserver', 'sheets'];
        const idx = orden.indexOf(servicioActual);
        const siguiente = orden[(idx + 1) % orden.length];

        const nombres = {
            firebase:   'Firebase',
            cloudflare: 'Cloudflare',
            sqlserver:  'SQL Server',
            sheets:     'Google Sheets'
        };

        mostrarError(`
            <strong>Error al cargar desde ${servicioActual}</strong><br>
            ${error.message}<br><br>
            <button onclick="cambiarServicio('${siguiente}')">
                Intentar con ${nombres[siguiente]}
            </button>
        `);
    }
}

async function cargarDesdeFirebase() {
    inicializarFirebase();
    const snapshot = await db.collection("animes-series-indice").get();
    todas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    series = filtrarPorCategoria(todas);    pagina = 0;
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
    series = filtrarPorCategoria(todas);    pagina = 0;
    actualizarSelector();
    mostrarPagina();
}

// ⭐ NUEVO: Cargar desde SQL Server
async function cargarDesdeSQLServer() {
    console.log(`🔌 Cargando índice desde SQL Server (letra ${letraActual.toUpperCase()})...`);
    const datos = await obtenerDeSQLServer('/indice-series');

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
    series = filtrarPorCategoria(todas);    pagina = 0;
    actualizarSelector();
    mostrarPagina();
    console.log(`✅ Cargadas ${series.length} series desde SQL Server (letra ${letraActual.toUpperCase()})`);
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
    series = filtrarPorCategoria(todas);    pagina = 0;
    actualizarSelector();
    mostrarPagina();
    console.log(`Cargadas ${series.length} series desde Google Sheets (letra ${letraActual.toUpperCase()})`);
}

// ================= ACTUALIZAR SELECTOR =================
function actualizarSelector() {
    const nombreSelector = document.getElementById("nombreSelector");
    let etiqueta;
    if (letraActual === '0-9')      etiqueta = 'Números (0-9)';
    else if (letraActual === 'sym') etiqueta = 'Símbolos';
    else                            etiqueta = `Letra "${letraActual.toUpperCase()}"`;

    let opciones = `<option value="">Todas las series con ${etiqueta} (${series.length})</option>`;
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

Object.assign(window, {
    paginaSiguiente,
    paginaAnterior,
    cambiarServicio
});
