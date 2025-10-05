// ============================================
// MAPMANAGER.JS - Gestión del mapa y marcadores
// ============================================

import { showNotification, getMarkerIcon } from './utils.js';

export class MapManager {
    constructor() {
        this.map = null;
        this.markers = {};
    }

    initialize() {
        console.log('Inicializando mapa con MapLibre GL JS...');
        
        this.map = new maplibregl.Map({
            container: 'map',
            style: this.getMapStyle(),
            center: [-89.2182, 13.6929], // San Salvador
            zoom: 11
        });

        // Controles
        this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
        this.map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        // Eventos
        this.map.on('error', (e) => console.warn('Error en el mapa:', e));
        this.map.on('load', () => {
            console.log('Mapa cargado correctamente');
            showNotification('Mapa listo. Carga un CSV para ver alertas.', 'success');
        });
    }

    getMapStyle() {
        return {
            version: 8,
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: {
                'mbtiles-source': {
                    type: 'vector',
                    tiles: [window.location.origin + '/tiles/{z}/{x}/{y}.pbf'],
                    minzoom: 0,
                    maxzoom: 14
                }
            },
            layers: [
                {
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': '#f8f4f0' }
                },
                {
                    id: 'water',
                    type: 'fill',
                    source: 'mbtiles-source',
                    'source-layer': 'water',
                    paint: { 'fill-color': '#a0c8f0' }
                },
                {
                    id: 'landuse',
                    type: 'fill',
                    source: 'mbtiles-source',
                    'source-layer': 'landuse',
                    filter: ['==', 'class', 'park'],
                    paint: { 'fill-color': '#d4e7c5' }
                },
                {
                    id: 'building',
                    type: 'fill',
                    source: 'mbtiles-source',
                    'source-layer': 'building',
                    paint: {
                        'fill-color': '#d9d0c9',
                        'fill-opacity': 0.7
                    }
                },
                {
                    id: 'roads',
                    type: 'line',
                    source: 'mbtiles-source',
                    'source-layer': 'transportation',
                    paint: {
                        'line-color': '#fff',
                        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 0.5, 12, 3, 16, 8]
                    }
                },
                {
                    id: 'roads-major',
                    type: 'line',
                    source: 'mbtiles-source',
                    'source-layer': 'transportation',
                    filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
                    paint: {
                        'line-color': '#ffa500',
                        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 5, 1, 12, 4, 16, 10]
                    }
                },
                {
                    id: 'place-labels',
                    type: 'symbol',
                    source: 'mbtiles-source',
                    'source-layer': 'place',
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14]
                    },
                    paint: {
                        'text-color': '#333',
                        'text-halo-color': '#fff',
                        'text-halo-width': 2
                    }
                }
            ]
        };
    }

    updateMarkers(alerts, getPopupContent) {
        // Limpiar marcadores anteriores
        Object.values(this.markers).forEach(marker => marker.remove());
        this.markers = {};

        // Añadir nuevos marcadores
        alerts.forEach(alert => {
            if (alert.lat && alert.lon) {
                const el = document.createElement('div');
                el.className = `marker-icon status-${alert.status}`;
                el.innerHTML = getMarkerIcon(alert.type);

                const popup = new maplibregl.Popup({ offset: 25 })
                    .setHTML(getPopupContent(alert));

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([alert.lon, alert.lat])
                    .setPopup(popup)
                    .addTo(this.map);

                this.markers[alert.id] = marker;
            }
        });

        // Ajustar vista si hay marcadores
        if (alerts.length > 0) {
            const bounds = new maplibregl.LngLatBounds();
            alerts.forEach(alert => {
                if (alert.lat && alert.lon) {
                    bounds.extend([alert.lon, alert.lat]);
                }
            });
            this.map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }
    }

    flyToLocation(lat, lon) {
        this.map.flyTo({
            center: [lon, lat],
            zoom: 16,
            duration: 1000
        });

        // Buscar y abrir el marcador correspondiente
        Object.values(this.markers).forEach(marker => {
            const lngLat = marker.getLngLat();
            if (Math.abs(lngLat.lat - lat) < 0.0001 && Math.abs(lngLat.lng - lon) < 0.0001) {
                marker.togglePopup();
            }
        });
    }
}