// ============================================
// UIMANAGER.JS - Gestión de la interfaz de usuario
// ============================================

import { getElapsedTime, showNotification } from './utils.js';

export class UIManager {
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
        // Botón cargar CSV
        this.elements.btnLoadCSV.addEventListener('click', () => {
            this.elements.csvFileInput.click();
        });

        // Cambio de archivo CSV
        this.elements.csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            this.dataManager.loadFromFile(file, () => {
                this.updateLastUpdateTime();
                this.applyFiltersAndUpdate();
            });
        });

        // Botón refrescar
        this.elements.btnRefresh.addEventListener('click', () => {
            this.applyFiltersAndUpdate();
            showNotification('Vista actualizada', 'info');
        });

        // Botón exportar
        this.elements.btnExport.addEventListener('click', () => {
            const filtered = this.dataManager.getFilteredAlerts();
            if (filtered.length === 0) {
                showNotification('No hay datos para exportar', 'warning');
                return;
            }
            this.dataManager.exportToCSV(filtered);
        });

        // Filtros
        this.elements.filterStatus.addEventListener('change', () => {
            this.applyFiltersAndUpdate();
        });

        this.elements.filterType.addEventListener('change', () => {
            this.applyFiltersAndUpdate();
        });

        this.elements.searchBox.addEventListener('input', () => {
            this.applyFiltersAndUpdate();
        });

        // Cerrar diálogo
        this.elements.btnCloseDetail.addEventListener('click', () => {
            this.elements.detailDialog.close();
        });

        // Exponer función global para el botón "Ver"
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
                    ${getElapsedTime(alert.timestamp)}
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
        `;
    }

    updateElapsedTimes() {
        const elapsedCells = document.querySelectorAll('.elapsed-time');
        elapsedCells.forEach(cell => {
            const timestamp = parseInt(cell.dataset.timestamp);
            if (!isNaN(timestamp)) {
                cell.textContent = getElapsedTime(timestamp);
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