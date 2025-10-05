// ============================================
// DATAMANAGER.JS - Gestión de datos CSV
// ============================================

import { showNotification } from './utils.js';

export class DataManager {
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
            showNotification('Error al leer el archivo', 'error');
        };
        
        reader.readAsText(file);
    }

    parseCSV(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                showNotification('El archivo CSV está vacío', 'warning');
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
            
            showNotification(`${this.alertsData.length} alertas cargadas`, 'success');
        } catch (error) {
            console.error('Error parseando CSV:', error);
            showNotification('Error al procesar el CSV', 'error');
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

        showNotification('Datos exportados', 'success');
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