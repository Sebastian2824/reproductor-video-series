import { ENV } from '../Config/config.js';

/* ==================== CONFIGURACIÓN DE ENTORNO ==================== */
const IS_LOCAL =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

// 🔌 Backend de SQL Server (Railway - servicio nuevo)
const SQLSERVER_BASE_URL = IS_LOCAL
    ? 'http://localhost:3001'
    : ENV.AZURE_API_KEY_URL;   // ⚠️ Reemplazar por tu URL real

console.log(`🔌 SQL Server: ${SQLSERVER_BASE_URL} (${IS_LOCAL ? 'LOCAL' : 'PRODUCCIÓN'})`);

/* ==================== CONFIGURACIÓN ==================== */
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
    HOJA_IFRAMES: 'Iframes',
    RANGO_IFRAMES: 'A:F'
};

// VARIABLES DE LA SERIE ESPECÍFICA (MANTENIENDO LAS ORIGINALES)
const nombreSerie = "Karakai no Jouzu Takagisan";
const temporada = "Temporada 01";
const idioma = "Sub Español";

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let episodios = [];
let currentEpisode = 0;
let servidorActivo = null;
let servicioActivo = 'firebase';

/* ==================== SERVICIOS DISPONIBLES ==================== */
const SERVICIOS = {
    firebase:   { nombre: 'Firebase' },
    cloudflare: { nombre: 'Cloudflare' },
    sheets:     { nombre: 'Google Sheets' },
    sqlserver:  { nombre: 'SQL Server' }
};

/* ==================== DROPDOWN DE SERVICIO ==================== */
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

    currentEpisode = 0;
    cargarEpisodios();

    cerrarDropdown();
}

function updateServiceUI() {
    const toggleText = document.getElementById('serviceToggleText');
    const servicio = SERVICIOS[servicioActivo];

    if (servicio) {
        toggleText.textContent = `Cambiar servicio (${servicio.nombre})`;
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

/* ==================== CARGA DE EPISODIOS (ENRUTADOR) ==================== */
async function cargarEpisodios() {
    if (servicioActivo === 'firebase') {
        await cargarEpisodiosDesdeFirebase();
    } else if (servicioActivo === 'cloudflare') {
        await cargarEpisodiosDesdeCloudflare();
    } else if (servicioActivo === 'sqlserver') {
        await cargarEpisodiosDesdeSQLServer();
    } else {
        await cargarEpisodiosDesdeGoogleSheets();
    }
}

/* ==================== SQL SERVER (NUEVO) 🎯 ==================== */
async function cargarEpisodiosDesdeSQLServer() {
    try {
        mostrarMensajeCarga('SQL Server');
        console.log(`🔌 Cargando episodios desde SQL Server: ${nombreSerie} - ${temporada} - ${idioma}`);

        // 1. Obtener servidores disponibles
        const servidoresResponse = await fetch(
            `${SQLSERVER_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );

        if (!servidoresResponse.ok) {
            throw new Error(`Error HTTP: ${servidoresResponse.status}`);
        }

        const servidores = await servidoresResponse.json();

        if (!Array.isArray(servidores) || servidores.length === 0) {
            throw new Error("No se encontraron servidores disponibles");
        }

        // 2. Obtener episodios de cada servidor
        episodios = [];

        for (const servidor of servidores) {
            const episodiosResponse = await fetch(
                `${SQLSERVER_BASE_URL}/episodios?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}&servidor=${encodeURIComponent(servidor)}`
            );

            if (!episodiosResponse.ok) {
                console.warn(`No se pudieron obtener episodios para ${servidor}`);
                continue;
            }

            const episodiosData = await episodiosResponse.json();

            if (!Array.isArray(episodiosData)) {
                console.warn(`Formato inválido para ${servidor}`);
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
        mostrarErrorCarga(`SQL Server: ${error.message}`);

        // Fallback a Google Sheets
        if (servicioActivo === 'sqlserver') {
            servicioActivo = 'sheets';
            updateServiceUI();
            setTimeout(() => {
                cargarEpisodiosDesdeGoogleSheets();
            }, 1000);
        }
    }
}

/* ==================== GOOGLE SHEETS ==================== */
async function cargarEpisodiosDesdeGoogleSheets() {
    try {
        console.log("Cargando desde Google Sheets...");
        mostrarMensajeCarga('Google Sheets');

        const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEETS_CONFIG.HOJA_IFRAMES)}`;

        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const csvText = await response.text();
        const rows = parseGoogleSheetsCSV(csvText);

        if (rows.length === 0) throw new Error("No se encontraron datos en Google Sheets");

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

            if (nombreSerieCSV !== nombreSerie || temporadaCSV !== temporada) continue;

            if (idiomaCSV !== '' && idiomaCSV !== idioma) continue;

            if (!episodioCSV || !iframeCSV || !servidorCSV) {
                console.warn("Fila ignorada - datos incompletos:", row);
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

        if (!servidorActivo) throw new Error("No se encontraron servidores disponibles");

        updateHeaderInfo();
        renderEpisodeSelector();
        renderServerOptions();
        changeVideo(servidorActivo);
        renderSidebar();

        console.log(`Cargados ${episodios.length} episodios desde Google Sheets`);

    } catch (error) {
        console.error("Error cargando desde Google Sheets:", error);
        mostrarErrorCarga(`Google Sheets: ${error.message}`);

        if (servicioActivo === 'sheets') {
            servicioActivo = 'firebase';
            updateServiceUI();
            setTimeout(() => {
                cargarEpisodiosDesdeFirebase();
            }, 1000);
        }
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

function mostrarMensajeCarga(servicio) {
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #e9ecef; border-radius: 10px;">
            <div style="margin-bottom: 15px;">⏳</div>
            <h3 style="margin-top: 0; color: #003a73;">Cargando desde ${servicio}...</h3>
            <p>${nombreSerie}</p>
            <p>${temporada} - ${idioma}</p>
        </div>
    `;
}

function mostrarErrorCarga(mensaje) {
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #fff3cd; border-radius: 10px; color: #856404;">
            <h3 style="margin-top: 0;">⚠️ Error de carga</h3>
            <p>${mensaje}</p>
            <button onclick="reintentarCarga()" style="margin-top: 15px; padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Reintentar
            </button>
        </div>
    `;
}

function reintentarCarga() {
    cargarEpisodios();
}

/* ==================== FIREBASE ==================== */
async function cargarEpisodiosDesdeFirebase() {
    try {
        mostrarMensajeCarga('Firebase');

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
        mostrarErrorCarga(`Firebase: ${error.message}`);

        if (servicioActivo === 'firebase') {
            servicioActivo = 'cloudflare';
            updateServiceUI();
            setTimeout(() => {
                cargarEpisodiosDesdeCloudflare();
            }, 1000);
        }
    }
}

/* ==================== CLOUDFLARE ==================== */
async function cargarEpisodiosDesdeCloudflare() {
    try {
        mostrarMensajeCarga('Cloudflare');

        const servidoresResponse = await fetch(
            `${CLOUDFLARE_BASE_URL}/servidores?serie=${encodeURIComponent(nombreSerie)}&temporada=${encodeURIComponent(temporada)}&idioma=${encodeURIComponent(idioma)}`
        );

        if (!servidoresResponse.ok) throw new Error(`Error HTTP: ${servidoresResponse.status}`);

        const servidores = await servidoresResponse.json();

        if (!servidores || servidores.error) {
            throw new Error(servidores.error || "Error obteniendo servidores");
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
            throw new Error("No se encontraron episodios en Cloudflare");
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
        mostrarErrorCarga(`Cloudflare: ${error.message}`);

        // Fallback a SQL Server (antes iba a Sheets)
        if (servicioActivo === 'cloudflare') {
            servicioActivo = 'sqlserver';
            updateServiceUI();
            setTimeout(() => {
                cargarEpisodiosDesdeSQLServer();
            }, 1000);
        }
    }
}

/* ==================== FUNCIONES DE REPRODUCCIÓN ==================== */
function renderEpisodeSelector() {
    const selector = document.querySelector('.episode-selector');
    selector.innerHTML = '';
    episodios.forEach((ep, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = ep.name;
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

function updateHeaderInfo() {
    document.getElementById("serieTitle").textContent = nombreSerie;
    document.getElementById("seasonLang").textContent = `${temporada} | ${idioma}`;
    document.getElementById("episodeCount").textContent = `${episodios.length} episodios`;
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
        videoDetails.textContent = `${nombreSerie} | ${temporada} | ${episodios[currentEpisode].name} | ${servidor} (No disponible)`;
        renderServerOptions?.();
        renderSidebar?.();
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

        if (modifiedEmbed.includes('style="')) {
            modifiedEmbed = modifiedEmbed.replace(
                /style="[^"]*"/,
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
    else if (servidor.toLowerCase().includes('odysee')) {
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.paddingBottom = '56.25%';
        container.style.height = '0';
        container.style.overflow = 'hidden';
        container.style.borderRadius = '10px';
        container.style.backgroundColor = '#000';

        let modifiedEmbed = embed;

        if (modifiedEmbed.includes('style="')) {
            modifiedEmbed = modifiedEmbed.replace(
                /style="[^"]*"/,
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
        videoDetails.textContent = `${nombreSerie} | ${temporada} | ${episodios[currentEpisode].name} | ${servidor}`;
    }

    renderServerOptions?.();
    renderSidebar?.();
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
    return "https://excelpic.s3.us-west-2.amazonaws.com/QESGQPMOPKR1/blob-NCnd1741995020243.webp";
}

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
        if (dropdown && !dropdown.contains(e.target)) {
            cerrarDropdown();
        }
    });

    updateServiceUI();
    cargarEpisodios();
});

Object.assign(window, {
    changeVideo,
    irAEpisodioDisponible,
    selectEpisode,
    nextEpisode,
    previousEpisode
});