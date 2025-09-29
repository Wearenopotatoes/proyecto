// js/mapManager.js

export let alertMarkers = {};
export let unitMarkers = {};

const iconAccidente = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
const iconEnCamino = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
const iconUnidadDisponible = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-blue'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
const iconUnidadOcupada = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-purple'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });

/**
 * Inicializa el mapa de Leaflet y sus capas.
 */
export function initializeMap() {
    const initialCenter = [13.7942, -88.8965];
    const initialZoom = 9;

    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });
    const mapaSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    const map = L.map('map', {
        center: initialCenter,
        zoom: initialZoom,
        layers: [mapaCalles]
    });

    L.control.layers({ "Calles": mapaCalles, "Satélite": mapaSatelital }).addTo(map);

    const CenterControl = L.Control.extend({
        onAdd: function(map) {
            const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-center');
            btn.innerHTML = '<a href="#" title="Centrar Mapa" role="button"></a>';
            btn.onclick = (e) => {
                e.preventDefault();
                map.flyTo(initialCenter, initialZoom);
            }
            return btn;
        }
    });
    new CenterControl({ position: 'topright' }).addTo(map);

    setTimeout(() => map.invalidateSize(), 100);
    return map;
}

/**
 * Limpia y dibuja todos los marcadores en el mapa.
 */
export function drawMarkers(map, alerts, units, onMarkerClick) {
    Object.values(alertMarkers).forEach(marker => marker.remove());
    Object.values(unitMarkers).forEach(marker => marker.remove());
    alertMarkers = {};
    unitMarkers = {};

    alerts.forEach(alert => {
        if (alert.status !== 3 && alert.latitud && alert.longitud) {
            const icon = alert.status === 2 ? iconEnCamino : iconAccidente;
            const popupTexto = `<b>Tipo:</b> ${alert.accident_type?.description || 'N/A'}`;
            const marker = L.marker([alert.latitud, alert.longitud], { icon }).addTo(map).bindPopup(popupTexto);
            marker.on('click', () => onMarkerClick(alert.emergency_id));
            alertMarkers[alert.emergency_id] = marker;
        }
    });

    units.forEach(unit => {
        if (unit.latitud && unit.longitud) {
            const isAvailable = unit.active_emergencies === 0;
            const icon = isAvailable ? iconUnidadDisponible : iconUnidadOcupada;
            const statusText = isAvailable ? 'Disponible' : 'Ocupada';
            const popupTexto = `<b>Unidad:</b> ${unit.name}<br><b>Estado:</b> ${statusText}`;
            const marker = L.marker([unit.latitud, unit.longitud], { icon }).addTo(map).bindPopup(popupTexto);
            unitMarkers[unit.emergency_unit_id] = marker;
        }
    });
}

/**
 * Anima el mapa para centrarse en una ubicación específica.
 */
export function flyToLocation(map, lat, lon) {
    map.flyTo([lat, lon], 15, {
        animate: true,
        duration: 1.5
    });
}