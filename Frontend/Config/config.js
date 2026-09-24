// Frontend/Config/config.js
// Centralizador defensivo de variables de entorno para Vite

export const ENV = {
  // --- Firebase ---
  FIREBASE_API_KEY:             import.meta.env.VITE_FIREBASE_API_KEY || '',
  FIREBASE_AUTH_DOMAIN:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  FIREBASE_PROYECT_ID:          import.meta.env.VITE_FIREBASE_PROYECT_ID || '',
  FIREBASE_STORAGE_BUCKET:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  FIREBASE_APP_ID:              import.meta.env.VITE_FIREBASE_APP_ID || '',
  FIREBASE_MEASUREMENT_ID:      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',

  // --- Cloudflare ---
  CLOUDFLARE_API_KEY_URL:       import.meta.env.VITE_CLOUDFLARE_API_KEY_URL || '',
  CLOUDFLARE_WORKER_URL:        import.meta.env.VITE_CLOUDFLARE_WORKER_URL || '',

  // --- Google Sheets ---
  GOOGLESHEETS_API_KEY_URL:     import.meta.env.VITE_GOOGLESHEETS_API_KEY_URL || '',

  // --- Azure / SQL Server ---
  AZURE_API_KEY_URL:            import.meta.env.VITE_AZURE_API_KEY_URL || '',
  SQLSERVER_PROD_URL:           import.meta.env.VITE_SQLSERVER_PROD_URL || ''
};

console.log('✅ [config.js] Árbol de dependencias inyectado con éxito');
