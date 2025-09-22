// js/apiService.js

// --- Configuración de la API ---
const API_BASE_URL = 'https://loralink.live';
const API_KEY = 'linkONxM0Jn';

/**
 * Función central para todas las llamadas a la API.
 * Añade la API Key y maneja errores de forma centralizada.
 * @param {string} endpoint - El endpoint de la API al que llamar (ej. '/emergencies').
 * @param {object} options - Opciones de Fetch (ej. method, body).
 * @returns {Promise<object|null>} - La respuesta JSON de la API.
 */
export async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers,
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }));
        console.error(`Error en API [${endpoint}]:`, errorData);
        throw new Error(`Error en la API: ${response.statusText}`);
    }
    
    if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
    }

    return response.json();
}