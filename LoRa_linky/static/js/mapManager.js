// js/mapManager.js

// --- Almacenes para los marcadores ---
export let alertMarkers = {};
export let unitMarkers = {};

// --- Iconos Personalizados para el Mapa ---
const iconAccidente = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
const iconEnCamino = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
const iconUnidad = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-blue'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });

/**
 * Inicializa el mapa de Leaflet y sus capas.
 * @returns {object} La instancia del mapa de Leaflet.
 */
export function initializeMap() {
    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });
    const mapaSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    const map = L.map('map', {
        center: [13.7942, -88.8965],
        zoom: 9,
        layers: [mapaCalles]
    });

    L.control.layers({ "Calles": mapaCalles, "Satélite": mapaSatelital }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    
    return map;
}

/**
 * Limpia y dibuja todos los marcadores (alertas y unidades) en el mapa.
 * @param {object} map - La instancia del mapa de Leaflet.
 * @param {Array} alerts - El array de alertas.
 * @param {Array} units - El array de unidades.
 */
export function drawMarkers(map, alerts, units) {
    // Limpia marcadores anteriores
    Object.values(alertMarkers).forEach(marker => marker.remove());
    Object.values(unitMarkers).forEach(marker => marker.remove());
    alertMarkers = {};
    unitMarkers = {};

    // Dibuja marcadores de alertas activas
    alerts.forEach(alert => {
        if (alert.status !== 3 && alert.latitud && alert.longitud) {
            const icon = alert.status === 2 ? iconEnCamino : iconAccidente;
            const popupTexto = `<b>Tipo:</b> ${alert.accident_type?.description || 'N/A'}`;
            const marker = L.marker([alert.latitud, alert.longitud], { icon }).addTo(map).bindPopup(popupTexto);
            alertMarkers[alert.emergency_id] = marker;
        }
    });

    // Dibuja marcadores de unidades
    units.forEach(unit => {
        if (unit.latitud && unit.longitud) {
            const statusText = unit.active_emergencies === 0 ? 'Disponible' : 'Ocupada';
            const popupTexto = `<b>Unidad:</b> ${unit.name}<br><b>Estado:</b> ${statusText}`;
            const marker = L.marker([unit.latitud, unit.longitud], { icon: iconUnidad }).addTo(map).bindPopup(popupTexto);
            unitMarkers[unit.emergency_unit_id] = marker;
        }
    });
}

/**
 * Anima el mapa para centrarse en una ubicación específica.
 * @param {object} map - La instancia del mapa de Leaflet.
 * @param {number} lat - Latitud.
 * @param {number} lon - Longitud.
 */
export function flyToLocation(map, lat, lon) {
    map.flyTo([lat, lon], 15, {
        animate: true,
        duration: 1.5
    });
}