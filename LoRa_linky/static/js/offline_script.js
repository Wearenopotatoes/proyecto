// ============================================
// DASHBOARD OFFLINE - LoRaLink
// JavaScript puro que lee CSV directamente del cliente
// Sin dependencias de API
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias DOM ---
    const tableBody = document.getElementById('alerts-table-body');
    const currentTimeEl = document.getElementById('current-time');
    const totalAlertsEl = document.getElementById('total-alerts');
    const activeAlertsEl = document.getElementById('active-alerts');
    const enrouteAlertsEl = document.getElementById('enroute-alerts');
    const resolvedAlertsEl = document.getElementById('resolved-alerts');
    const tableCountEl = document.getElementById('table-count');
    const lastUpdateEl = document.getElementById('last-update');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnExport = document.getElementById('btn-export');
    const btnLoadCSV = document.getElementById('btn-load-csv');
    const csvFileInput = document.getElementById('csv-file-input');
    const filterStatus = document.getElementById('filter-status');
    const filterType = document.getElementById('filter-type');
    const searchBox = document.getElementById('search-box');
    const detailDialog = document.getElementById('detail-dialog');
    const btnCloseDetail = document.getElementById('btn-close-detail');
    const detailContent = document.getElementById('detail-content');

    // --- Variables Globales ---
    let map;
    const alertMarkers = L.markerClusterGroup();
    let alertsData = []; // Almacenamiento local en memoria
    let filteredAlerts = [];
    let loadTime = null;

    // --- Inicialización del Reloj ---
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        currentTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    // --- Inicialización del Mapa ---
    function initializeMap() {
        // Mapa offline usando teselas locales (si están disponibles)
        const mapaOffline = L.tileLayer('/tiles/{z}/{x}/{y}.png', {
            attribution: 'Mapa Offline',
            minZoom: 5,
            maxZoom: 18
        });

        map = L.map('map', {
            layers: [mapaOffline]
        }).setView([13.6929, -89.2182], 13);
        
        map.addLayer(alertMarkers);
    }

    // --- Cargar CSV desde archivo ---
    function handleCSVUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const csvContent = e.target.result;
            parseCSV(csvContent);
        };
        reader.onerror = function() {
            showNotification('Error al leer el archivo', 'error');
        };
        reader.readAsText(file);
    }

    // --- Parsear CSV manualmente ---
    function parseCSV(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                showNotification('El archivo CSV está vacío', 'warning');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
            }

            alertsData = processCSVData(data);
            loadTime = new Date();
            updateLastUpdateTime();
            applyFilters();
            showNotification(`${alertsData.length} alertas cargadas correctamente`, 'success');
        } catch (error) {
            console.error('Error parseando CSV:', error);
            showNotification('Error al procesar el archivo CSV', 'error');
        }
    }

    // --- Procesar Datos del CSV ---
    function processCSVData(rawData) {
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

    // --- Calcular Tiempo Transcurrido ---
    function getElapsedTime(timestamp) {
        const now = Date.now();
        const alertTime = timestamp * 1000;
        const diff = now - alertTime;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    }

    // --- Actualizar Estadísticas ---
    function updateStatistics(alerts) {
        const total = alerts.length;
        const active = alerts.filter(a => a.status === 'accidente').length;
        const enroute = alerts.filter(a => a.status === 'en_camino').length;
        const resolved = alerts.filter(a => a.status === 'resuelto').length;

        totalAlertsEl.textContent = total;
        activeAlertsEl.textContent = active;
        enrouteAlertsEl.textContent = enroute;
        resolvedAlertsEl.textContent = resolved;
    }

    // --- Actualizar Tabla ---
    function updateTable(alerts) {
        tableBody.innerHTML = '';
        
        if (alerts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-row">📂 No hay alertas. Carga un archivo CSV para comenzar.</td></tr>';
            tableCountEl.textContent = 'Mostrando 0 de 0 alertas';
            return;
        }

        alerts.forEach(alert => {
            const row = document.createElement('tr');
            row.className = `alert-row status-${alert.status}`;
            row.dataset.alertId = alert.id;
            
            row.innerHTML = `
                <td>
                    <span class="type-badge">${traducirTipoAccidente(alert.type)}</span>
                </td>
                <td>
                    <span class="status-badge ${alert.status}">
                        ${traducirEstado(alert.status)}
                    </span>
                </td>
                <td>${alert.units.length > 0 ? alert.units.join(', ') : 'N/A'}</td>
                <td>
                    <div class="time-cell">
                        <div>${alert.timeStr}</div>
                        <div class="time-date">${alert.dateStr}</div>
                    </div>
                </td>
                <td class="elapsed-time" data-timestamp="${alert.timestamp}">
                    ${getElapsedTime(alert.timestamp)}
                </td>
                <td>
                    <button class="btn-link" onclick="showOnMap(${alert.lat}, ${alert.lon})">
                        📍 Ver
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });

        tableCountEl.textContent = `Mostrando ${alerts.length} de ${alertsData.length} alertas`;
    }

    // --- Actualizar Mapa ---
    function updateMap(alerts) {
        alertMarkers.clearLayers();
        
        alerts.forEach(alert => {
            if (alert.lat && alert.lon) {
                const marker = L.marker([alert.lat, alert.lon], {
                    icon: L.divIcon({
                        className: `marker-icon status-${alert.status}`,
                        html: getMarkerIcon(alert.type),
                        iconSize: [35, 35],
                        iconAnchor: [17, 17]
                    })
                });

                marker.bindPopup(`
                    <div class="marker-popup">
                        <div class="popup-header">
                            <strong>${traducirTipoAccidente(alert.type)}</strong>
                        </div>
                        <div class="popup-body">
                            <div class="popup-row">
                                <span class="popup-label">Estado:</span>
                                <span class="status-badge ${alert.status}">${traducirEstado(alert.status)}</span>
                            </div>
                            <div class="popup-row">
                                <span class="popup-label">Hora:</span>
                                <span>${alert.timeStr}</span>
                            </div>
                            <div class="popup-row">
                                <span class="popup-label">Hace:</span>
                                <span>${getElapsedTime(alert.timestamp)}</span>
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
                `);

                alertMarkers.addLayer(marker);
            }
        });
    }

    // --- Mostrar ubicación en el mapa ---
    window.showOnMap = function(lat, lon) {
        map.setView([lat, lon], 16);
        // Encontrar y abrir el popup del marcador
        alertMarkers.eachLayer(layer => {
            const latlng = layer.getLatLng();
            if (Math.abs(latlng.lat - lat) < 0.0001 && Math.abs(latlng.lng - lon) < 0.0001) {
                layer.openPopup();
            }
        });
    };

    // --- Aplicar Filtros ---
    function applyFilters() {
        const statusFilter = filterStatus.value;
        const typeFilter = filterType.value;
        const searchTerm = searchBox.value.toLowerCase();

        filteredAlerts = alertsData.filter(alert => {
            if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
            if (typeFilter !== 'all' && alert.type !== typeFilter) return false;

            if (searchTerm) {
                const searchableText = [
                    alert.id,
                    traducirTipoAccidente(alert.type),
                    alert.units.join(' ')
                ].join(' ').toLowerCase();

                if (!searchableText.includes(searchTerm)) return false;
            }

            return true;
        });

        filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);

        updateStatistics(alertsData);
        updateTable(filteredAlerts);
        updateMap(filteredAlerts);
    }

    // --- Actualizar Tiempos Transcurridos ---
    function updateElapsedTimes() {
        const elapsedCells = document.querySelectorAll('.elapsed-time');
        elapsedCells.forEach(cell => {
            const timestamp = parseInt(cell.dataset.timestamp);
            if (!isNaN(timestamp)) {
                cell.textContent = getElapsedTime(timestamp);
            }
        });
    }

    // --- Actualizar Última Actualización ---
    function updateLastUpdateTime() {
        if (loadTime) {
            lastUpdateEl.textContent = `Última carga: ${loadTime.toLocaleTimeString('es-SV')}`;
        } else {
            lastUpdateEl.textContent = 'Sin datos cargados';
        }
    }

    // --- Exportar Datos Filtrados ---
    function exportToCSV() {
        if (filteredAlerts.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }

        const headers = ['ID', 'Tipo', 'Estado', 'Fecha', 'Hora', 'Latitud', 'Longitud', 'Unidades', 'Tiempo Transcurrido'];
        const rows = filteredAlerts.map(alert => [
            alert.id,
            traducirTipoAccidente(alert.type),
            traducirEstado(alert.status),
            alert.dateStr,
            alert.timeStr,
            alert.lat,
            alert.lon,
            alert.units.join(';'),
            getElapsedTime(alert.timestamp)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `alertas_offline_${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Datos exportados correctamente', 'success');
    }

    // --- Funciones de Utilidad ---
    function traducirTipoAccidente(tipoId) {
        const tipos = {
            '1': 'Colisión',
            '2': 'Incendio',
            '3': 'Derrumbe',
            '4': 'Inundación',
            '5': 'Otro'
        };
        return tipos[String(tipoId)] || 'Desconocido';
    }

    function traducirEstado(estado) {
        const estados = {
            'accidente': 'Activa',
            'en_camino': 'En Camino',
            'resuelto': 'Resuelta'
        };
        return estados[estado] || estado;
    }

    function getMarkerIcon(type) {
        const icons = {
            '1': '🚗',
            '2': '🔥',
            '3': '🏚️',
            '4': '🌊',
            '5': '⚠️'
        };
        return icons[String(type)] || '🚨';
    }

    function showNotification(message, type = 'info') {
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

    // --- Event Listeners ---
    btnLoadCSV.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', handleCSVUpload);
    btnRefresh.addEventListener('click', () => {
        applyFilters();
        showNotification('Vista actualizada', 'info');
    });
    btnExport.addEventListener('click', exportToCSV);
    filterStatus.addEventListener('change', applyFilters);
    filterType.addEventListener('change', applyFilters);
    searchBox.addEventListener('input', applyFilters);
    btnCloseDetail.addEventListener('click', () => detailDialog.close());

    // --- Inicialización ---
    initializeMap();
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(updateElapsedTimes, 1000);
    updateLastUpdateTime();

    // Mensaje inicial
    showNotification('Dashboard Offline listo. Carga un archivo CSV para comenzar.', 'info');
});