// analyticsManager.js - Cálculo y visualización de métricas

import { UTILS } from './config.js';

export class AnalyticsManager {
    constructor() {
        this.data = {
            emergencies: [],
            units: []
        };
    }

    updateData(emergencies, units) {
        this.data.emergencies = emergencies || [];
        this.data.units = units || [];
    }

    getOverviewMetrics() {
        const total = this.data.emergencies.length;
        const active = this.data.emergencies.filter(e => e.status !== 3).length;
        const resolved = this.data.emergencies.filter(e => e.status === 3).length;
        const inProgress = this.data.emergencies.filter(e => e.status === 2).length;

        const availableUnits = this.data.units.filter(u => u.active_emergencies === 0).length;
        const busyUnits = this.data.units.filter(u => u.active_emergencies > 0).length;

        return {
            total,
            active,
            resolved,
            inProgress,
            pending: active - inProgress,
            availableUnits,
            busyUnits,
            totalUnits: this.data.units.length
        };
    }

    getResponseTimeMetrics() {
        const resolved = this.data.emergencies.filter(e => e.status === 3);
        
        if (resolved.length === 0) {
            return { average: 0, fastest: 0, slowest: 0 };
        }

        // Simulación de tiempos de respuesta (en tu caso real, necesitarías timestamps)
        const times = resolved.map(() => Math.floor(Math.random() * 30) + 5); // 5-35 minutos
        
        return {
            average: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
            fastest: Math.min(...times),
            slowest: Math.max(...times),
            count: resolved.length
        };
    }

    getEmergencyTypeDistribution() {
        const distribution = {};
        
        this.data.emergencies.forEach(e => {
            const type = e.accident_type?.description || 'Desconocido';
            distribution[type] = (distribution[type] || 0) + 1;
        });

        return Object.entries(distribution).map(([type, count]) => ({
            type,
            count,
            percentage: ((count / this.data.emergencies.length) * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);
    }

    getHourlyDistribution() {
        const hours = Array(24).fill(0);
        
        this.data.emergencies.forEach(e => {
            const hour = new Date(e.timestamp + 'Z').getHours();
            hours[hour]++;
        });

        return hours.map((count, hour) => ({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            count
        }));
    }

    getUnitEfficiency() {
        return this.data.units.map(unit => {
            const assignedEmergencies = this.data.emergencies.filter(
                e => e.assigned_unit === unit.emergency_unit_id
            );

            const resolved = assignedEmergencies.filter(e => e.status === 3).length;
            const total = assignedEmergencies.length;
            const efficiency = total > 0 ? ((resolved / total) * 100).toFixed(1) : 0;

            return {
                name: unit.name,
                total,
                resolved,
                active: unit.active_emergencies,
                efficiency: parseFloat(efficiency)
            };
        }).sort((a, b) => b.efficiency - a.efficiency);
    }

    getHeatmapData() {
        const zones = {};
        
        this.data.emergencies.forEach(e => {
            if (e.latitud && e.longitud) {
                // Redondear coordenadas para crear zonas
                const lat = Math.round(e.latitud * 100) / 100;
                const lon = Math.round(e.longitud * 100) / 100;
                const key = `${lat},${lon}`;
                
                zones[key] = zones[key] || { lat, lon, count: 0 };
                zones[key].count++;
            }
        });

        return Object.values(zones).sort((a, b) => b.count - a.count);
    }

    getNearestUnit(emergencyLat, emergencyLon) {
        if (!this.data.units.length) return null;

        const distances = this.data.units
            .filter(u => u.active_emergencies === 0)
            .map(unit => ({
                unit,
                distance: UTILS.calculateDistance(
                    emergencyLat, 
                    emergencyLon, 
                    unit.latitud, 
                    unit.longitud
                )
            }))
            .sort((a, b) => a.distance - b.distance);

        return distances[0] || null;
    }

    getTimeBasedStats() {
        const now = new Date();
        const today = this.data.emergencies.filter(e => {
            const eDate = new Date(e.timestamp + 'Z');
            return eDate.toDateString() === now.toDateString();
        });

        const thisWeek = this.data.emergencies.filter(e => {
            const eDate = new Date(e.timestamp + 'Z');
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return eDate >= weekAgo;
        });

        const thisMonth = this.data.emergencies.filter(e => {
            const eDate = new Date(e.timestamp + 'Z');
            return eDate.getMonth() === now.getMonth() && 
                   eDate.getFullYear() === now.getFullYear();
        });

        return {
            today: today.length,
            week: thisWeek.length,
            month: thisMonth.length
        };
    }

    exportToCSV() {
        const headers = ['ID', 'Tipo', 'Estado', 'Usuario', 'Unidad', 'Fecha', 'Hora', 'Latitud', 'Longitud'];
        const rows = this.data.emergencies.map(e => [
            e.emergency_id,
            e.accident_type?.description || 'N/A',
            ['Pendiente', 'En Camino', 'Atendido'][e.status - 1],
            e.user?.name || 'N/A',
            e.assigned_unit_rel?.name || 'N/A',
            UTILS.formatDate(e.timestamp + 'Z'),
            UTILS.formatTime(e.timestamp + 'Z'),
            e.latitud,
            e.longitud
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `emergencias_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    generateSummaryReport() {
        const metrics = this.getOverviewMetrics();
        const timeStats = this.getTimeBasedStats();
        const responseTime = this.getResponseTimeMetrics();

        return {
            generated: new Date().toISOString(),
            overview: metrics,
            timeBasedStats: timeStats,
            responseMetrics: responseTime,
            typeDistribution: this.getEmergencyTypeDistribution(),
            unitEfficiency: this.getUnitEfficiency()
        };
    }
}