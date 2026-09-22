 /* ==================== CONFIGURACIÓN DE ENTORNO ==================== */
const IS_LOCAL =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

// 🔌 Backend de SQL Server (Railway - servicio nuevo)
const SQLSERVER_BASE_URL = IS_LOCAL
    ? 'http://localhost:3001'
    : 'https://reproductor-animes-plus-backend-production.up.railway.app';   // ⚠️ Reemplazar por tu URL real

console.log(`🔌 SQL Server: ${SQLSERVER_BASE_URL} (${IS_LOCAL ? 'LOCAL' : 'PRODUCCIÓN'})`);

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

const CLOUDFLARE_BASE_URL = "https://proyecto-cloudflare.apiprueba2025.workers.dev";

const GOOGLE_SHEETS_CONFIG = {
    SPREADSHEET_ID: '1V4LTYiuTDZ_Y_k6GRyVmFm5-G3rVhE6x1KfIcxJfLqM',
    SHEET_NAME: 'Iframes',
    RANGE: 'A:F'
};

// Variables globales
let nombreSerie = "";
let temporada = "";
let idioma = "";

let episodios = [];
let currentEpisode = 0;
let servidorActivo = null;
let servicioActivo = 'firebase';
let todasLasSeriesRecomendadas = [];

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ==================== SERVICIOS DISPONIBLES ==================== */
const SERVICIOS = {
    firebase:   { nombre: 'Firebase',      icono: '<i class="fas fa-database"></i>', clase: 'service-active' },
    cloudflare: { nombre: 'Cloudflare',    icono: '<i class="fas fa-cloud"></i>',    clase: 'service-cloudflare' },
    sheets:     { nombre: 'Google Sheets', icono: '<i class="fas fa-table"></i>',    clase: 'service-sheets' },
    sqlserver:  { nombre: 'SQL Server',    icono: '<i class="fas fa-server"></i>',   clase: 'service-sqlserver' }
};

/* ==================== NAVEGACIÓN ==================== */
function volverAlCatalogo() {
    window.location.href = "../Views/Menu-Principal.html";
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

/* ==================== DROPDOWN DE SERVICIO ==================== */
function toggleDropdown() {
    document.getElementById('serviceDropdown').classList.toggle('active');
}

function cerrarDropdown() {
    document.getElementById('serviceDropdown').classList.remove('active');
}

function cambiarServicio(nuevoServicio) {
    if (servicioActivo === nuevoServicio) {
        cerrarDropdown();
        return;
    }

    servicioActivo = nuevoServicio;
    updateServiceUI();

    currentEpisode = 0;
    cargarEpisodios();
    cargarSeriesRecomendadas();

    cerrarDropdown();
}

function updateServiceUI() {
    const toggleText = document.getElementById('serviceToggleText');
    const recomendacionesIndicator = document.getElementById('recomendacionesServiceIndicator');
    const recomendacionesIndicatorMobile = document.getElementById('recomendacionesServiceIndicatorMobile');

    const servicio = SERVICIOS[servicioActivo];
    if (!servicio) return;

    toggleText.textContent = `Cambiar servicio (${servicio.nombre})`;

    [recomendacionesIndicator, recomendacionesIndicatorMobile].forEach(el => {
        if (el) {
            el.innerHTML = `${servicio.icono} ${servicio.nombre}`;
            el.className = `service-status-indicator ${servicio.clase}`;
        }
    });

    document.querySelectorAll('.service-dropdown-item').forEach(item => {
        const itemService = item.getAttribute('data-service');
        if (itemService === servicioActivo) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/* ==================== CARGA DE EPISODIOS (ENRUTADOR) ==================== */
async function cargarEpisodios() {
    if (!obtenerParametrosURL()) return;

    mostrarMensajeCarga();

    if (servicioActivo === 'firebase') {
        await cargarEpisodiosDesdeFirebase();
    } else if (servicioActivo === 'cloudflare') {
        await cargarEpisodiosDesdeCloudflare();
    } else if (servicioActivo === 'sqlserver') {
        await cargarEpisodiosDesdeSQLServer();
    } else {
        await cargarEpisodiosDesdeGoogleSheets();
    }

    await cargarSeriesRecomendadas();
    gestionarPosicionRecomendaciones();
}

function mostrarMensajeCarga() {
    const videoContainer = document.getElementById('videoContainer');
    const servicio = SERVICIOS[servicioActivo];

    videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #e9ecef; border-radius: 10px;">
            <div style="margin-bottom: 15px;">⏳</div>
            <h3 style="margin-top: 0; color: #003a73;">Cargando episodios...</h3>
            <p>${nombreSerie}</p>
            <p>${temporada} - ${idioma}</p>
            <p style="font-size: 12px; color: #666;">Servicio: ${servicio?.nombre || servicioActivo}</p>
        </div>
    `;
}

/* ==================== SQL SERVER (NUEVO) 🎯 ==================== */
async function cargarEpisodiosDesdeSQLServer() {
    try {
        console.log(`🔌 Cargando episodios desde SQL Server: ${nombreSerie} - ${temporada} - ${idioma}`);

        const servidoresResponse = await fetch(
            `${SQLSERVER_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );

        if (!servidoresResponse.ok) throw new Error(`Error HTTP: ${servidoresResponse.status}`);

        const servidores = await servidoresResponse.json();

        if (!Array.isArray(servidores) || servidores.length === 0) {
            // Intentar idiomas alternativos
            const idiomasResponse = await fetch(
                `${SQLSERVER_BASE_URL}/idiomas?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}`
            );

            if (idiomasResponse.ok) {
                const idiomasDisponibles = await idiomasResponse.json();
                if (Array.isArray(idiomasDisponibles) && idiomasDisponibles.length > 0) {
                    idioma = idiomasDisponibles[0];
                    console.log(`🔄 Idioma cambiado a: ${idioma}`);
                    return cargarEpisodiosDesdeSQLServer();
                }
                throw new Error(`Idioma "${idioma}" no disponible. Idiomas disponibles: ${idiomasDisponibles.join(', ')}`);
            }
            throw new Error("No se encontraron servidores disponibles");
        }

        episodios = [];

        for (const servidor of servidores) {
            const episodiosResponse = await fetch(
                `${SQLSERVER_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
            );

            if (!episodiosResponse.ok) continue;

            const episodiosData = await episodiosResponse.json();
            if (!Array.isArray(episodiosData)) continue;

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
            throw new Error(`No se encontraron episodios en SQL Server para ${idioma}`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0];
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();

        console.log(`✅ Cargados ${episodios.length} episodios desde SQL Server`);

    } catch (error) {
        console.error("Error cargando desde SQL Server:", error);
        if (servicioActivo === 'sqlserver') {
            servicioActivo = 'sheets';
            updateServiceUI();
            await cargarEpisodiosDesdeGoogleSheets();
        }
    }
}

/* ==================== FIREBASE ==================== */
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

            idioma = idiomasSnap.docs[0].id;
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
        servicioActivo = 'cloudflare';
        updateServiceUI();
        await cargarEpisodiosDesdeCloudflare();
    }
}

/* ==================== CLOUDFLARE ==================== */
async function cargarEpisodiosDesdeCloudflare() {
    try {
        const servidoresResponse = await fetch(
            `${CLOUDFLARE_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );

        if (!servidoresResponse.ok) throw new Error(`Error HTTP: ${servidoresResponse.status}`);

        const servidores = await servidoresResponse.json();

        if (!servidores || servidores.error) {
            const idiomasResponse = await fetch(
                `${CLOUDFLARE_BASE_URL}/idiomas?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}`
            );

            if (idiomasResponse.ok) {
                const idiomasDisponibles = await idiomasResponse.json();
                throw new Error(`Idioma "${idioma}" no disponible. Idiomas disponibles: ${idiomasDisponibles.join(', ')}`);
            }
            throw new Error("Error obteniendo servidores");
        }

        episodios = [];

        for (const servidor of servidores) {
            const episodiosResponse = await fetch(
                `${CLOUDFLARE_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
            );

            if (!episodiosResponse.ok) continue;

            const episodiosData = await episodiosResponse.json();
            if (!episodiosData || episodiosData.error) continue;

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
        servicioActivo = 'sqlserver';   // 👈 Ahora va a SQL Server
        updateServiceUI();
        await cargarEpisodiosDesdeSQLServer();
    }
}

/* ==================== GOOGLE SHEETS ==================== */
async function cargarEpisodiosDesdeGoogleSheets() {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${GOOGLE_SHEETS_CONFIG.SHEET_NAME}`;

        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);

        if (rows.length === 0) throw new Error("No se encontraron datos en Google Sheets");

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const indexSerie = headers.findIndex(h => h.includes('serie') || h.includes('nombre'));
        const indexTemporada = headers.findIndex(h => h.includes('temporada') || h.includes('season'));
        const indexIdioma = headers.findIndex(h => h.includes('idioma') || h.includes('language'));
        const indexServidor = headers.findIndex(h => h.includes('servidor') || h.includes('server'));
        const indexEpisodio = headers.findIndex(h => h.includes('episodio') || h.includes('episode'));
        const indexIframe = headers.findIndex(h => h.includes('iframe') || h.includes('embed'));

        if (indexSerie === -1 || indexTemporada === -1 || indexEpisodio === -1 || indexIframe === -1) {
            throw new Error("Formato de Google Sheets incorrecto. Se necesitan columnas: Serie, Temporada, Episodio, Iframe");
        }

        episodios = [];
        const processedRows = new Set();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length <= Math.max(indexSerie, indexTemporada, indexEpisodio, indexIframe)) continue;

            const rowSerie = (row[indexSerie] || '').trim();
            const rowTemporada = (row[indexTemporada] || '').trim();
            const rowIdioma = indexIdioma !== -1 ? (row[indexIdioma] || '').trim() : idioma;
            const rowServidor = indexServidor !== -1 ? (row[indexServidor] || 'Default').trim() : 'Default';
            const rowEpisodio = (row[indexEpisodio] || '').trim();
            const rowIframe = (row[indexIframe] || '').trim();

            if (rowSerie.toLowerCase() !== nombreSerie.toLowerCase() ||
                rowTemporada !== temporada ||
                rowIdioma.toLowerCase() !== idioma.toLowerCase()) continue;

            if (!rowEpisodio || !rowIframe) continue;

            const rowKey = `${rowEpisodio}|${rowServidor}`;
            if (processedRows.has(rowKey)) continue;
            processedRows.add(rowKey);

            let episodio = episodios.find(e => e.name === rowEpisodio);
            if (!episodio) {
                episodio = { name: rowEpisodio, embeds: {} };
                episodios.push(episodio);
            }

            episodio.embeds[rowServidor] = rowIframe;
        }

        if (episodios.length === 0) {
            throw new Error(`No se encontraron episodios en Google Sheets para ${nombreSerie} - ${temporada} (${idioma})`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0] || 'Default';
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();

    } catch (error) {
        console.error("Error cargando desde Google Sheets:", error);
        servicioActivo = 'firebase';
        updateServiceUI();
        await cargarEpisodiosDesdeFirebase();
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

/* ==================== FUNCIONES DE REPRODUCCIÓN ==================== */
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
            img.src = "https://excelpic.s3.us-west-2.amazonaws.com/QESGQPMOPKR1/blob-NCnd1741995020243.webp";
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

        const parser = new DOMParser();
        const doc = parser.parseFromString(embed, 'text/html');
        const iframe = doc.querySelector('iframe');

        if (iframe) {
            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '10px';
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('webkitallowfullscreen', '');
            iframe.setAttribute('mozallowfullscreen', '');
            container.appendChild(iframe);
            videoContainer.appendChild(container);
        } else {
            videoContainer.innerHTML = embed;
        }
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

/* ==================== RECOMENDACIONES (ENRUTADOR) ==================== */
async function cargarSeriesRecomendadas() {
    try {
        if (servicioActivo === 'firebase') {
            await cargarSeriesRecomendadasFirebase();
        } else if (servicioActivo === 'cloudflare') {
            await cargarSeriesRecomendadasCloudflare();
        } else if (servicioActivo === 'sqlserver') {
            await cargarSeriesRecomendadasSQLServer();
        } else {
            await cargarSeriesRecomendadasGoogleSheets();
        }
    } catch (error) {
        console.error("Error cargando series recomendadas:", error);
        mostrarRecomendacionesError();
    }
}

/* ==================== RECOMENDACIONES SQL SERVER (NUEVO) 🎯 ==================== */
async function cargarSeriesRecomendadasSQLServer() {
    try {
        const response = await fetch(`${SQLSERVER_BASE_URL}/portadas`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const portadas = await response.json();
        if (!Array.isArray(portadas)) throw new Error('Formato de respuesta inválido');

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
        console.error("Error cargando recomendaciones desde SQL Server:", error);
        throw error;
    }
}

/* ==================== RECOMENDACIONES FIREBASE ==================== */
async function cargarSeriesRecomendadasFirebase() {
    try {
        const snapshotSeries = await db.collection("animes-series-portadas").get();
        const todasSeries = [];
        const temporadasMismaSerie = [];

        for (const docSerie of snapshotSeries.docs) {
            const nombreSerieActual = docSerie.id;

            const snapshotTemporadas = await db.collection("animes-series-portadas")
                .doc(nombreSerieActual).collection("Temporadas").get();

            for (const docTemporada of snapshotTemporadas.docs) {
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

/* ==================== RECOMENDACIONES CLOUDFLARE ==================== */
async function cargarSeriesRecomendadasCloudflare() {
    try {
        const response = await fetch(`${CLOUDFLARE_BASE_URL}/portadas`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
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

/* ==================== RECOMENDACIONES GOOGLE SHEETS ==================== */
async function cargarSeriesRecomendadasGoogleSheets() {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Portadas`;
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);
        const todasSeries = [];
        const temporadasMismaSerie = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (i === 0 && (row[0]?.toLowerCase().includes('nombre') || row[0]?.toLowerCase().includes('serie'))) continue;
            const nombreSerieActual = (row[0] || '').trim();
            const temporadaCompleta = (row[1] || '').trim();
            const imagen = (row[2] || '').trim() || "https://via.placeholder.com/300x400?text=Sin+Imagen";
            if (!nombreSerieActual || !temporadaCompleta) continue;
            const serieData = { nombre: nombreSerieActual, temporadaCompleta, imagen };
            if (nombreSerieActual === nombreSerie) {
                if (temporadaCompleta !== `${temporada} - ${idioma}`) temporadasMismaSerie.push(serieData);
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

function mostrarRecomendaciones(temporadasMismaSerie = []) {
    const grid = document.getElementById('recomendacionesGrid');
    const gridMobile = document.getElementById('recomendacionesGridMobile');
    const loadingHTML = `<div class="loading-recomendaciones"><div style="margin-bottom:10px;">⏳</div>Cargando recomendaciones...</div>`;
    grid.innerHTML = loadingHTML;
    if (gridMobile) gridMobile.innerHTML = loadingHTML;

    const recomendaciones = seleccionarRecomendaciones(temporadasMismaSerie);
    if (recomendaciones.length === 0) {
        const noResults = `<div class="loading-recomendaciones"><p>No hay series recomendadas disponibles</p></div>`;
        grid.innerHTML = noResults;
        if (gridMobile) gridMobile.innerHTML = noResults;
        return;
    }
    const cardsHTML = generarCardsHTML(recomendaciones);
    grid.innerHTML = cardsHTML;
    if (gridMobile) gridMobile.innerHTML = cardsHTML;
}

function generarCardsHTML(recomendaciones) {
    let html = '';
    for (const serie of recomendaciones) {
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
    for (let i = 0; i < Math.min(temporadasMismaSerie.length, 2); i++) resultado.push(temporadasMismaSerie[i]);
    if (resultado.length >= 3) return resultado.slice(0, 3);

    const seriesSimilares = [];
    for (const serie of todasLasSeriesRecomendadas) {
        let yaExiste = false;
        for (const r of resultado) if (r.nombre === serie.nombre && r.temporadaCompleta === serie.temporadaCompleta) { yaExiste = true; break; }
        if (yaExiste) continue;
        const palabrasSerieActual = nombreSerie.toLowerCase().split(' ');
        const palabrasSerieOtra = serie.nombre.toLowerCase().split(' ');
        const comunes = ['el','la','los','las','un','una','unos','unas','de','del','y','e','o','u','en','a','al'];
        let esSimilar = false;
        for (const p of palabrasSerieActual) {
            if (p.length > 2 && !comunes.includes(p)) {
                for (const q of palabrasSerieOtra) {
                    if (q.includes(p) || p.includes(q)) { esSimilar = true; break; }
                }
                if (esSimilar) break;
            }
        }
        if (esSimilar) seriesSimilares.push(serie);
    }
    for (const similar of seriesSimilares) { if (resultado.length >= 3) break; resultado.push(similar); }
    if (resultado.length >= 3) return resultado.slice(0, 3);

    const aleatorias = [...todasLasSeriesRecomendadas];
    for (let i = aleatorias.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [aleatorias[i], aleatorias[j]] = [aleatorias[j], aleatorias[i]];
    }
    for (const a of aleatorias) {
        if (resultado.length >= 3) break;
        let dup = false;
        for (const r of resultado) if (r.nombre === a.nombre && r.temporadaCompleta === a.temporadaCompleta) { dup = true; break; }
        if (!dup) resultado.push(a);
    }
    return resultado.slice(0, 3);
}

function mostrarRecomendacionesError() {
    const errorHTML = `<div class="loading-recomendaciones"><p style="color:#dc3545;">Error cargando recomendaciones</p><button onclick="cargarSeriesRecomendadas()" style="margin-top:10px;padding:8px 15px;background:#003a73;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;">Reintentar</button></div>`;
    document.getElementById('recomendacionesGrid').innerHTML = errorHTML;
    const gridMobile = document.getElementById('recomendacionesGridMobile');
    if (gridMobile) gridMobile.innerHTML = errorHTML;
}

/* ==================== CARGAR SERIE RECOMENDADA ==================== */
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
    const nuevaURL = `reproductor_universal.html?serie=${encodeURIComponent(serieNombre)}&temporada=${encodeURIComponent(temporadaCompleta)}`;
    window.history.pushState({}, '', nuevaURL);
    document.title = `${nombreSerie} - ${temporada}`;
    currentEpisode = 0;
    const selector = document.querySelector('.episode-selector');
    selector.innerHTML = '<option value="">Cargando episodios...</option>';
    document.getElementById("serieTitle").textContent = nombreSerie;
    document.getElementById("seasonLang").textContent = `${temporada} - ${idioma}`;
    document.getElementById("episodeCount").textContent = "Cargando...";
    document.getElementById('sidebarPlaylist').innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Cargando episodios...</div>';
    document.getElementById("serverSelect").innerHTML = '<option value="">Cargando servidores...</option>';
    cargarEpisodiosDeSerieRecomendada();
}

function mostrarMensajeCargaCompleta(serieNombre, temporadaCompleta) {
    const videoContainer = document.getElementById('videoContainer');
    const videoDetails = document.getElementById("videoDetails");
    const servicio = SERVICIOS[servicioActivo];
    videoContainer.innerHTML = `
        <div style="padding:40px;text-align:center;background:#e9ecef;border-radius:10px;">
            <div style="margin-bottom:15px;">⏳</div>
            <h3 style="margin-top:0;color:#003a73;">Cargando nueva serie...</h3>
            <p><strong>${serieNombre}</strong></p>
            <p>${temporadaCompleta}</p>
            <p style="font-size:12px;color:#666;">Servicio: ${servicio?.nombre || servicioActivo}</p>
        </div>
    `;
    videoDetails.textContent = `${serieNombre} | ${temporadaCompleta} | Cargando...`;
}

async function cargarEpisodiosDeSerieRecomendada() {
    if (!nombreSerie || !temporada) return;
    if (servicioActivo === 'firebase') await cargarEpisodiosDesdeFirebaseParaRecomendada();
    else if (servicioActivo === 'cloudflare') await cargarEpisodiosDesdeCloudflareParaRecomendada();
    else if (servicioActivo === 'sqlserver') await cargarEpisodiosDesdeSQLServerParaRecomendada();
    else await cargarEpisodiosDesdeGoogleSheetsParaRecomendada();
    await cargarSeriesRecomendadas();
}

/* ==================== SQL SERVER PARA RECOMENDADA (NUEVO) 🎯 ==================== */
async function cargarEpisodiosDesdeSQLServerParaRecomendada() {
    try {
        const servidoresResponse = await fetch(
            `${SQLSERVER_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );

        if (!servidoresResponse.ok) throw new Error(`Error HTTP: ${servidoresResponse.status}`);

        const servidores = await servidoresResponse.json();

        if (!Array.isArray(servidores) || servidores.length === 0) {
            throw new Error("No se encontraron servidores disponibles");
        }

        episodios = [];

        for (const servidor of servidores) {
            const episodiosResponse = await fetch(
                `${SQLSERVER_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
            );

            if (!episodiosResponse.ok) continue;

            const episodiosData = await episodiosResponse.json();
            if (!Array.isArray(episodiosData)) continue;

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
            throw new Error(`No se encontraron episodios en SQL Server`);
        }

        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0];
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
    } catch (error) {
        console.error("Error cargando recomendada desde SQL Server:", error);
        mostrarErrorCargaRecomendada(error.message);
        if (servicioActivo === 'sqlserver') {
            servicioActivo = 'sheets';
            updateServiceUI();
            await cargarEpisodiosDesdeGoogleSheetsParaRecomendada();
        }
    }
}

/* ==================== FIREBASE PARA RECOMENDADA ==================== */
async function cargarEpisodiosDesdeFirebaseParaRecomendada() {
    try {
        const idiomaDocRef = db.collection("animes-series").doc(nombreSerie).collection("Temporadas").doc(temporada).collection("Idiomas").doc(idioma);
        const idiomaDoc = await idiomaDocRef.get();
        if (!idiomaDoc.exists) {
            const idiomasSnap = await db.collection("animes-series").doc(nombreSerie).collection("Temporadas").doc(temporada).collection("Idiomas").get();
            if (idiomasSnap.empty) throw new Error(`No se encontró el idioma "${idioma}" ni alternativos`);
            idioma = idiomasSnap.docs[0].id;
        }
        const servidoresSnap = await db.collection("animes-series").doc(nombreSerie).collection("Temporadas").doc(temporada).collection("Idiomas").doc(idioma).collection("Servidores").get();
        episodios = [];
        for (const servidorDoc of servidoresSnap.docs) {
            const servidor = servidorDoc.id;
            const epsSnapshot = await db.collection("animes-series").doc(nombreSerie).collection("Temporadas").doc(temporada).collection("Idiomas").doc(idioma).collection("Servidores").doc(servidor).collection("Episodios").get();
            epsSnapshot.forEach(doc => {
                const nombreEp = doc.id;
                const iframe = doc.data().iframe;
                let episodio = episodios.find(e => e.name === nombreEp);
                if (!episodio) { episodio = { name: nombreEp, embeds: {} }; episodios.push(episodio); }
                episodio.embeds[servidor] = iframe;
            });
        }
        if (episodios.length === 0) throw new Error(`No se encontraron episodios para ${nombreSerie} - ${temporada} (${idioma})`);
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
        if (servicioActivo === 'firebase') { servicioActivo = 'cloudflare'; updateServiceUI(); await cargarEpisodiosDesdeCloudflareParaRecomendada(); }
    }
}

/* ==================== CLOUDFLARE PARA RECOMENDADA ==================== */
async function cargarEpisodiosDesdeCloudflareParaRecomendada() {
    try {
        const servidoresResponse = await fetch(`${CLOUDFLARE_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`);
        if (!servidoresResponse.ok) throw new Error(`Error HTTP: ${servidoresResponse.status}`);
        const servidores = await servidoresResponse.json();
        if (!servidores || servidores.error) {
            const idiomasResponse = await fetch(`${CLOUDFLARE_BASE_URL}/idiomas?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}`);
            if (idiomasResponse.ok) {
                const idiomasDisponibles = await idiomasResponse.json();
                throw new Error(`Idioma "${idioma}" no disponible. Idiomas disponibles: ${idiomasDisponibles.join(', ')}`);
            } else throw new Error("Error obteniendo servidores");
        }
        episodios = [];
        for (const servidor of servidores) {
            const episodiosResponse = await fetch(`${CLOUDFLARE_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`);
            if (!episodiosResponse.ok) continue;
            const episodiosData = await episodiosResponse.json();
            if (!episodiosData || episodiosData.error) continue;
            episodiosData.forEach(epData => {
                let episodio = episodios.find(e => e.name === epData.episodio);
                if (!episodio) { episodio = { name: epData.episodio, embeds: {} }; episodios.push(episodio); }
                episodio.embeds[servidor] = epData.iframe;
            });
        }
        if (episodios.length === 0) throw new Error(`No se encontraron episodios en Cloudflare para ${idioma}`);
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
        if (servicioActivo === 'cloudflare') { servicioActivo = 'sqlserver'; updateServiceUI(); await cargarEpisodiosDesdeSQLServerParaRecomendada(); }
    }
}

/* ==================== GOOGLE SHEETS PARA RECOMENDADA ==================== */
async function cargarEpisodiosDesdeGoogleSheetsParaRecomendada() {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${GOOGLE_SHEETS_CONFIG.SHEET_NAME}`;
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);
        if (rows.length === 0) throw new Error("No se encontraron datos en Google Sheets");
        const headers = rows[0].map(h => h.trim().toLowerCase());
        const indexSerie = headers.findIndex(h => h.includes('serie') || h.includes('nombre'));
        const indexTemporada = headers.findIndex(h => h.includes('temporada') || h.includes('season'));
        const indexIdioma = headers.findIndex(h => h.includes('idioma') || h.includes('language'));
        const indexServidor = headers.findIndex(h => h.includes('servidor') || h.includes('server'));
        const indexEpisodio = headers.findIndex(h => h.includes('episodio') || h.includes('episode'));
        const indexIframe = headers.findIndex(h => h.includes('iframe') || h.includes('embed'));
        if (indexSerie === -1 || indexTemporada === -1 || indexEpisodio === -1 || indexIframe === -1) throw new Error("Formato de Google Sheets incorrecto");
        episodios = [];
        const processedRows = new Set();
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length <= Math.max(indexSerie, indexTemporada, indexEpisodio, indexIframe)) continue;
            const rowSerie = (row[indexSerie] || '').trim();
            const rowTemporada = (row[indexTemporada] || '').trim();
            const rowIdioma = indexIdioma !== -1 ? (row[indexIdioma] || '').trim() : idioma;
            const rowServidor = indexServidor !== -1 ? (row[indexServidor] || 'Default').trim() : 'Default';
            const rowEpisodio = (row[indexEpisodio] || '').trim();
            const rowIframe = (row[indexIframe] || '').trim();
            if (rowSerie.toLowerCase() !== nombreSerie.toLowerCase() || rowTemporada !== temporada || rowIdioma.toLowerCase() !== idioma.toLowerCase()) continue;
            if (!rowEpisodio || !rowIframe) continue;
            const key = `${rowEpisodio}|${rowServidor}`;
            if (processedRows.has(key)) continue;
            processedRows.add(key);
            let episodio = episodios.find(e => e.name === rowEpisodio);
            if (!episodio) { episodio = { name: rowEpisodio, embeds: {} }; episodios.push(episodio); }
            episodio.embeds[rowServidor] = rowIframe;
        }
        if (episodios.length === 0) throw new Error(`No se encontraron episodios en Google Sheets para ${nombreSerie} - ${temporada} (${idioma})`);
        episodios.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
        servidorActivo = Object.keys(episodios[0].embeds)[0] || 'Default';
        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();
    } catch (error) {
        console.error("Error cargando desde Google Sheets:", error);
        mostrarErrorCargaRecomendada(error.message);
        if (servicioActivo === 'sheets') { servicioActivo = 'firebase'; updateServiceUI(); await cargarEpisodiosDesdeFirebaseParaRecomendada(); }
    }
}

function mostrarErrorCargaRecomendada(mensajeError) {
    const videoContainer = document.getElementById('videoContainer');
    const videoDetails = document.getElementById("videoDetails");
    const selector = document.querySelector('.episode-selector');
    const sidebar = document.getElementById('sidebarPlaylist');
    const serverSelect = document.getElementById("serverSelect");
    videoContainer.innerHTML = `
        <div style="padding:40px;text-align:center;background:#fff3cd;border-radius:10px;color:#856404;">
            <h3 style="margin-top:0;">⚠️ Error al cargar la serie</h3>
            <p>${mensajeError}</p>
            <button onclick="cargarEpisodiosDeSerieRecomendada()" style="margin-top:15px;padding:10px 20px;background:#6c757d;color:#fff;border:none;border-radius:5px;cursor:pointer;">Reintentar</button>
        </div>
    `;
    videoDetails.textContent = `${nombreSerie} | ${temporada} - ${idioma} | Error`;
    selector.innerHTML = '<option value="">Error al cargar episodios</option>';
    serverSelect.innerHTML = '<option value="">Error al cargar servidores</option>';
    sidebar.innerHTML = '<div style="padding:20px;text-align:center;color:#dc3545;">Error al cargar episodios</div>';
    document.getElementById("episodeCount").textContent = "0 episodios (Error)";
}

function gestionarPosicionRecomendaciones() {
    const isMobile = window.innerWidth <= 900;
    const desktop = document.getElementById('recomendacionesDesktop');
    const mobile = document.getElementById('recomendacionesMobile');
    if (isMobile) {
        desktop.style.display = 'none';
        mobile.style.display = 'block';
        const gridDesktop = document.getElementById('recomendacionesGrid');
        const gridMobile = document.getElementById('recomendacionesGridMobile');
        if (gridDesktop && gridMobile) gridMobile.innerHTML = gridDesktop.innerHTML;
    } else {
        desktop.style.display = 'block';
        mobile.style.display = 'none';
    }
}
window.addEventListener('resize', gestionarPosicionRecomendaciones);

/* ==================== INICIALIZACIÓN ==================== */
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("serviceToggleBtn").addEventListener("click", toggleDropdown);
    document.querySelectorAll('.service-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const servicio = item.getAttribute('data-service');
            cambiarServicio(servicio);
        });
    });
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('serviceDropdown');
        if (dropdown && !dropdown.contains(e.target)) cerrarDropdown();
    });
    updateServiceUI();
    if (obtenerParametrosURL()) {
        cargarEpisodios();
    } else {
        mostrarError("Por favor, selecciona una serie desde el catálogo principal.");
    }
});