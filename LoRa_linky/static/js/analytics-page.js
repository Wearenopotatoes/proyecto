// analytics-page.js - Dashboard de analíticas avanzadas

import { apiFetch } from './apiService.js';
import { CONFIG } from './config.js';
import { AnalyticsManager } from './analyticsManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const analytics = new AnalyticsManager();
    
    const btnRefresh = document.getElementById('btn-refresh-analytics');

    // Elementos del DOM
    const totalEmergenciesEl = document.getElementById('total-emergencies');
    const activeEmergenciesEl = document.getElementById('active-emergencies');
    const resolvedEmergenciesEl = document.getElementById('resolved-emergencies');
    const avgResponseEl = document.getElementById('avg-response');
    
    const todayCountEl = document.getElementById('today-count');
    const weekCountEl = document.getElementById('week-count');
    const monthCountEl = document.getElementById('month-count');
    
    const typeDistributionEl = document.getElementById('type-distribution');
    const unitEfficiencyEl = document.getElementById('unit-efficiency');
    const hourlyChartEl = document.getElementById('hourly-chart');
    const heatmapZonesEl = document.getElementById('heatmap-zones');

    async function loadAnalytics() {
        try {
            // Cargar datos
            const [emergencies, baseUnits] = await Promise.all([
                apiFetch('/emergencies'),
                apiFetch('/emergency-units')
            ]);

            // Cargar stats de unidades
            const statsPromises = baseUnits.map(unit =>
                apiFetch(`/emergency-units/${unit.emergency_unit_id}/stats`)
                .catch(() => ({ active_emergencies: 0 }))
            );
            const allStats = await Promise.all(statsPromises);
            const units = baseUnits.map((unit, index) => ({
                ...unit,
                active_emergencies: allStats[index].active_emergencies
            }));

            // Actualizar analytics manager
            analytics.updateData(emergencies, units);

            // Renderizar todas las secciones
            renderOverviewMetrics();
            renderTemporalStats();
            renderTypeDistribution();
            renderUnitEfficiency();
            renderHourlyChart();
            renderHeatmapZones();

        } catch (error) {
            console.error('Error al cargar analíticas:', error);
        }
    }

    function renderOverviewMetrics() {
        const metrics = analytics.getOverviewMetrics();
        const responseTime = analytics.getResponseTimeMetrics();

        totalEmergenciesEl.textContent = metrics.total;
        activeEmergenciesEl.textContent = metrics.active;
        resolvedEmergenciesEl.textContent = metrics.resolved;
        avgResponseEl.textContent = responseTime.average > 0 
            ? `${responseTime.average} min` 
            : 'N/A';

        // Animación de conteo
        animateCounter(totalEmergenciesEl, metrics.total);
        animateCounter(activeEmergenciesEl, metrics.active);
        animateCounter(resolvedEmergenciesEl, metrics.resolved);
    }

    function renderTemporalStats() {
        const timeStats = analytics.getTimeBasedStats();

        todayCountEl.textContent = timeStats.today;
        weekCountEl.textContent = timeStats.week;
        monthCountEl.textContent = timeStats.month;

        animateCounter(todayCountEl, timeStats.today);
        animateCounter(weekCountEl, timeStats.week);
        animateCounter(monthCountEl, timeStats.month);
    }

    function renderTypeDistribution() {
        const distribution = analytics.getEmergencyTypeDistribution();

        if (distribution.length === 0) {
            typeDistributionEl.innerHTML = '<p class="empty-state">No hay datos disponibles</p>';
            return;
        }

        typeDistributionEl.innerHTML = distribution.map(item => `
            <div class="distribution-item">
                <div class="distribution-header">
                    <span class="distribution-type">${item.type}</span>
                    <span class="distribution-count">${item.count}</span>
                </div>
                <div class="distribution-bar-container">
                    <div class="distribution-bar" style="width: ${item.percentage}%">
                        <span class="distribution-percentage">${item.percentage}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderUnitEfficiency() {
        const efficiency = analytics.getUnitEfficiency();

        if (efficiency.length === 0) {
            unitEfficiencyEl.innerHTML = '<p class="empty-state">No hay datos disponibles</p>';
            return;
        }

        unitEfficiencyEl.innerHTML = efficiency.map((unit, index) => `
            <div class="efficiency-item ${index === 0 ? 'efficiency-top' : ''}">
                <div class="efficiency-header">
                    <span class="efficiency-rank">#${index + 1}</span>
                    <span class="efficiency-name">${unit.name}</span>
                    <span class="efficiency-score ${getEfficiencyClass(unit.efficiency)}">
                        ${unit.efficiency}%
                    </span>
                </div>
                <div class="efficiency-stats">
                    <span>✓ ${unit.resolved} resueltas</span>
                    <span>📍 ${unit.active} activas</span>
                    <span>📊 ${unit.total} total</span>
                </div>
            </div>
        `).join('');
    }

    function getEfficiencyClass(efficiency) {
        if (efficiency >= 80) return 'efficiency-high';
        if (efficiency >= 50) return 'efficiency-medium';
        return 'efficiency-low';
    }

    function renderHourlyChart() {
        const hourlyData = analytics.getHourlyDistribution();
        const maxCount = Math.max(...hourlyData.map(h => h.count), 1);

        hourlyChartEl.innerHTML = `
            <div class="hourly-bars">
                ${hourlyData.map(item => {
                    const heightPercent = (item.count / maxCount) * 100;
                    return `
                        <div class="hourly-bar-wrapper" title="${item.hour}: ${item.count} emergencias">
                            <div class="hourly-bar" style="height: ${heightPercent}%">
                                ${item.count > 0 ? `<span class="bar-count">${item.count}</span>` : ''}
                            </div>
                            <div class="hourly-label">${item.hour}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderHeatmapZones() {
        const zones = analytics.getHeatmapData();

        if (zones.length === 0) {
            heatmapZonesEl.innerHTML = '<p class="empty-state">No hay datos de ubicación disponibles</p>';
            return;
        }

        const topZones = zones.slice(0, 10);
        const maxCount = Math.max(...topZones.map(z => z.count));

        heatmapZonesEl.innerHTML = topZones.map((zone, index) => {
            const intensity = (zone.count / maxCount) * 100;
            return `
                <div class="zone-card">
                    <div class="zone-rank">#${index + 1}</div>
                    <div class="zone-info">
                        <div class="zone-location">
                            📍 ${zone.lat.toFixed(4)}, ${zone.lon.toFixed(4)}
                        </div>
                        <div class="zone-count">${zone.count} incidentes</div>
                    </div>
                    <div class="zone-intensity-bar">
                        <div class="zone-intensity-fill" style="width: ${intensity}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function animateCounter(element, target) {
        const duration = 1000;
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    }

    // Event listeners
    btnRefresh.onclick = loadAnalytics;

    // Carga inicial
    loadAnalytics();

    // Auto-refresh cada 30 segundos
    setInterval(loadAnalytics, CONFIG.REFRESH.ANALYTICS);
});