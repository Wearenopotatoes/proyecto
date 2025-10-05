// ============================================
// DASHBOARD OFFLINE - Bundle sin módulos ES6
// Para evitar problemas de CORS con imports
// ============================================

(function() {
    'use strict';

    // =============== UTILIDADES ===============
    const Utils = {
        updateClock() {
            const currentTimeEl = document.getElementById('current-time');
            if (!currentTimeEl) return;

            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            currentTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
        },

        getElapsedTime(timestamp) {
            const diff = Date.now() - (timestamp * 1000);
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m`;
            return `${seconds}s`;
        },

        getMarkerIcon(type) {
            const icons = {
                '1': '🚗',
                '2': '🔥',
                '3': '🏔️',
                '4': '🌊',
                '5': '⚠️'
            };
            return icons[String(type)] || '🚨';
        },

        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 10);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    };

    // =============== MAP MANAGER ===============
    class MapManager {
        constructor() {
            this.map = null;
            this.markers = {};
        }

        initialize() {
            console.log('🗺️ Inicializando mapa con MapLibre GL JS...');
            
            try {
                this.map = new maplibregl.Map({
                    container: 'map',
                    style: this.getMapStyle(),
                    center: [-89.2182, 13.6929],
                    zoom: 11
                });

                this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
                this.map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

                this.map.on('error', (e) => {
                    console.error('❌ Error en el mapa:', e);
                    Utils.showNotification('Error al cargar el mapa', 'error');
                });

                this.map.on('load', () => {
                    console.log('✅ Mapa cargado correctamente');
                    Utils.showNotification('Mapa listo. Carga un CSV para ver alertas.', 'success');
                });

                this.map.on('style.load', () => {
                    console.log('✅ Estilo del mapa cargado');
                });

            } catch (error) {
                console.error('❌ Error fatal al inicializar el mapa:', error);
                Utils.showNotification('Error fatal al cargar el mapa', 'error');
            }
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
                    }
                    // Capa de etiquetas removida para funcionamiento 100% offline
                ]
            };
        }

        updateMarkers(alerts, getPopupContentFn) {
            Object.values(this.markers).forEach(marker => marker.remove());
            this.markers = {};

            alerts.forEach(alert => {
                if (alert.lat && alert.lon) {
                    const el = document.createElement('div');
                    el.className = `marker-icon status-${alert.status}`;
                    el.innerHTML = Utils.getMarkerIcon(alert.type);

                    const popup = new maplibregl.Popup({ offset: 25 })
                        .setHTML(getPopupContentFn(alert));

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([alert.lon, alert.lat])
                        .setPopup(popup)
                        .addTo(this.map);

                    this.markers[alert.id] = marker;
                }
            });

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

            Object.values(this.markers).forEach(marker => {
                const lngLat = marker.getLngLat();
                if (Math.abs(lngLat.lat - lat) < 0.0001 && Math.abs(lngLat.lng - lon) < 0.0001) {
                    marker.togglePopup();
                }
            });
        }
    }

    // =============== DATA MANAGER ===============
    class DataManager {
        constructor() {
            this.alertsData = [];
            this.filteredAlerts = [];
            this.loadTime = null;
        }

        loadFromFile(file, onSuccess) {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                this.parseCSV(e.target.result);
                if (onSuccess) onSuccess();
            };
            
            reader.onerror = () => {
                Utils.showNotification('Error al leer el archivo', 'error');
            };
            
            reader.readAsText(file);
        }

        parseCSV(csvText) {
            try {
                const lines = csvText.split('\n').filter(line => line.trim());
                
                if (lines.length < 2) {
                    Utils.showNotification('El archivo CSV está vacío', 'warning');
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const rawData = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });
                    rawData.push(row);
                }

                this.alertsData = this.processData(rawData);
                this.loadTime = new Date();
                
                Utils.showNotification(`${this.alertsData.length} alertas cargadas`, 'success');
            } catch (error) {
                console.error('Error parseando CSV:', error);
                Utils.showNotification('Error al procesar el CSV', 'error');
            }
        }

        processData(rawData) {
            return rawData.map(row => {
                try {
                    const timestamp = parseInt(row.timestamp);
                    if (isNaN(timestamp)) return null;
                    
                    const date = new Date(timestamp * 1000);
                    
                    return {
                        id: row.id || '',
                        type: row.tipo_accidente || '',
                        timestamp: timestamp,
                        dateObj: date,
                        timeStr: date.toLocaleTimeString('es-SV'),
                        dateStr: date.toLocaleDateString('es-SV'),
                        lat: parseFloat(row.latitud) || 0,
                        lon: parseFloat(row.longitud) || 0,
                        status: row.estado || 'accidente',
                        units: row.unidad ? row.unidad.split('|').filter(u => u) : []
                    };
                } catch (error) {
                    console.error('Error procesando fila:', row, error);
                    return null;
                }
            }).filter(alert => alert !== null && alert.id);
        }

        applyFilters(statusFilter, typeFilter, searchTerm) {
            this.filteredAlerts = this.alertsData.filter(alert => {
                if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
                if (typeFilter !== 'all' && alert.type !== typeFilter) return false;
                
                if (searchTerm) {
                    const text = [
                        alert.id,
                        this.translateType(alert.type),
                        alert.units.join(' ')
                    ].join(' ').toLowerCase();
                    
                    if (!text.includes(searchTerm.toLowerCase())) return false;
                }
                
                return true;
            });

            this.filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);
            return this.filteredAlerts;
        }

        getStatistics() {
            return {
                total: this.alertsData.length,
                active: this.alertsData.filter(a => a.status === 'accidente').length,
                enroute: this.alertsData.filter(a => a.status === 'en_camino').length,
                resolved: this.alertsData.filter(a => a.status === 'resuelto').length
            };
        }

        exportToCSV(alerts) {
            const headers = ['ID', 'Tipo', 'Estado', 'Fecha', 'Hora', 'Latitud', 'Longitud', 'Unidades'];
            const rows = alerts.map(alert => [
                alert.id,
                this.translateType(alert.type),
                this.translateStatus(alert.status),
                alert.dateStr,
                alert.timeStr,
                alert.lat,
                alert.lon,
                alert.units.join(';')
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `alertas_${Date.now()}.csv`;
            link.click();

            Utils.showNotification('Datos exportados', 'success');
        }

        translateType(tipo) {
            const tipos = {
                '1': 'Colisión',
                '2': 'Incendio',
                '3': 'Derrumbe',
                '4': 'Inundación',
                '5': 'Otro'
            };
            return tipos[String(tipo)] || 'Desconocido';
        }

        translateStatus(estado) {
            const estados = {
                'accidente': 'Activa',
                'en_camino': 'En Camino',
                'resuelto': 'Resuelta'
            };
            return estados[estado] || estado;
        }

        getAllAlerts() {
            return this.alertsData;
        }

        getFilteredAlerts() {
            return this.filteredAlerts;
        }

        getLoadTime() {
            return this.loadTime;
        }
    }

    // =============== UI MANAGER ===============
    class UIManager {
        constructor(mapManager, dataManager) {
            this.mapManager = mapManager;
            this.dataManager = dataManager;
            this.initializeElements();
        }

        initializeElements() {
            this.elements = {
                tableBody: document.getElementById('alerts-table-body'),
                totalAlerts: document.getElementById('total-alerts'),
                activeAlerts: document.getElementById('active-alerts'),
                enrouteAlerts: document.getElementById('enroute-alerts'),
                resolvedAlerts: document.getElementById('resolved-alerts'),
                tableCount: document.getElementById('table-count'),
                lastUpdate: document.getElementById('last-update'),
                btnRefresh: document.getElementById('btn-refresh'),
                btnExport: document.getElementById('btn-export'),
                btnLoadCSV: document.getElementById('btn-load-csv'),
                csvFileInput: document.getElementById('csv-file-input'),
                filterStatus: document.getElementById('filter-status'),
                filterType: document.getElementById('filter-type'),
                searchBox: document.getElementById('search-box'),
                detailDialog: document.getElementById('detail-dialog'),
                btnCloseDetail: document.getElementById('btn-close-detail')
            };
        }

        setupEventListeners() {
            this.elements.btnLoadCSV.addEventListener('click', () => {
                this.elements.csvFileInput.click();
            });

            this.elements.csvFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                this.dataManager.loadFromFile(file, () => {
                    this.updateLastUpdateTime();
                    this.applyFiltersAndUpdate();
                });
            });

            this.elements.btnRefresh.addEventListener('click', () => {
                this.applyFiltersAndUpdate();
                Utils.showNotification('Vista actualizada', 'info');
            });

            this.elements.btnExport.addEventListener('click', () => {
                const filtered = this.dataManager.getFilteredAlerts();
                if (filtered.length === 0) {
                    Utils.showNotification('No hay datos para exportar', 'warning');
                    return;
                }
                this.dataManager.exportToCSV(filtered);
            });

            this.elements.filterStatus.addEventListener('change', () => {
                this.applyFiltersAndUpdate();
            });

            this.elements.filterType.addEventListener('change', () => {
                this.applyFiltersAndUpdate();
            });

            this.elements.searchBox.addEventListener('input', () => {
                this.applyFiltersAndUpdate();
            });

            this.elements.btnCloseDetail.addEventListener('click', () => {
                this.elements.detailDialog.close();
            });

            window.showOnMap = (lat, lon) => {
                this.mapManager.flyToLocation(lat, lon);
            };
        }

        applyFiltersAndUpdate() {
            const statusFilter = this.elements.filterStatus.value;
            const typeFilter = this.elements.filterType.value;
            const searchTerm = this.elements.searchBox.value;

            const filtered = this.dataManager.applyFilters(statusFilter, typeFilter, searchTerm);
            
            this.updateStatistics();
            this.updateTable(filtered);
            this.updateMap(filtered);
        }

        updateStatistics() {
            const stats = this.dataManager.getStatistics();
            this.elements.totalAlerts.textContent = stats.total;
            this.elements.activeAlerts.textContent = stats.active;
            this.elements.enrouteAlerts.textContent = stats.enroute;
            this.elements.resolvedAlerts.textContent = stats.resolved;
        }

        updateTable(alerts) {
            this.elements.tableBody.innerHTML = '';
            
            if (alerts.length === 0) {
                this.elements.tableBody.innerHTML = 
                    '<tr><td colspan="6" class="empty-row">📂 No hay alertas. Carga un archivo CSV.</td></tr>';
                this.elements.tableCount.textContent = 'Mostrando 0 de 0 alertas';
                return;
            }

            alerts.forEach(alert => {
                const row = document.createElement('tr');
                row.className = `alert-row status-${alert.status}`;
                
                row.innerHTML = `
                    <td><span class="type-badge">${this.dataManager.translateType(alert.type)}</span></td>
                    <td><span class="status-badge ${alert.status}">${this.dataManager.translateStatus(alert.status)}</span></td>
                    <td>${alert.units.length > 0 ? alert.units.join(', ') : 'N/A'}</td>
                    <td>
                        <div class="time-cell">
                            <div>${alert.timeStr}</div>
                            <div class="time-date">${alert.dateStr}</div>
                        </div>
                    </td>
                    <td class="elapsed-time" data-timestamp="${alert.timestamp}">
                        ${Utils.getElapsedTime(alert.timestamp)}
                    </td>
                    <td>
                        <button class="btn-link" onclick="showOnMap(${alert.lat}, ${alert.lon})">
                            📍 Ver
                        </button>
                    </td>
                `;
                
                this.elements.tableBody.appendChild(row);
            });

            const total = this.dataManager.getAllAlerts().length;
            this.elements.tableCount.textContent = `Mostrando ${alerts.length} de ${total} alertas`;
        }

        updateMap(alerts) {
            this.mapManager.updateMarkers(alerts, (alert) => this.getPopupContent(alert));
        }

        getPopupContent(alert) {
            return `
                <div class="marker-popup">
                    <div class="popup-header">
                        <strong>${this.dataManager.translateType(alert.type)}</strong>
                    </div>
                    <div class="popup-body">
                        <div class="popup-row">
                            <span class="popup-label">Estado:</span>
                            <span class="status-badge ${alert.status}">${this.dataManager.translateStatus(alert.status)}</span>
                        </div>
                        <div class="popup-row">
                            <span class="popup-label">Hora:</span>
                            <span>${alert.timeStr}</span>
                        </div>
                        <div class="popup-row">
                            <span class="popup-label">Hace:</span>
                            <span>${Utils.getElapsedTime(alert.timestamp)}</span>
                        </div>
                        ${alert.units.length > 0 ? `
                        <div class="popup-row">
                            <span class="popup-label">Unidades:</span>
                            <span>${alert.units.join(', ')}</span>
                        </div>
                        ` : ''}
                        <div class="popup-row">
                            <span class="popup-label">Coordenadas:</span>
                            <span>${alert.lat.toFixed(4)}, ${alert.lon.toFixed(4)}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        updateElapsedTimes() {
            const elapsedCells = document.querySelectorAll('.elapsed-time');
            elapsedCells.forEach(cell => {
                const timestamp = parseInt(cell.dataset.timestamp);
                if (!isNaN(timestamp)) {
                    cell.textContent = Utils.getElapsedTime(timestamp);
                }
            });
        }

        updateLastUpdateTime() {
            const loadTime = this.dataManager.getLoadTime();
            if (loadTime) {
                this.elements.lastUpdate.textContent = `Última carga: ${loadTime.toLocaleTimeString('es-SV')}`;
            } else {
                this.elements.lastUpdate.textContent = 'Sin datos cargados';
            }
        }
    }

    // =============== INICIALIZACIÓN ===============
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Iniciando dashboard offline...');
        
        const mapManager = new MapManager();
        const dataManager = new DataManager();
        const uiManager = new UIManager(mapManager, dataManager);

        Utils.updateClock();
        setInterval(() => Utils.updateClock(), 1000);

        mapManager.initialize();
        uiManager.setupEventListeners();

        setInterval(() => uiManager.updateElapsedTimes(), 1000);

        console.log('✅ Dashboard offline inicializado');
    });

})();