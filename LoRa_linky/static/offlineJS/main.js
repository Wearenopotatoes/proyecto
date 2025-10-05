// ============================================
// MAIN.JS - Punto de entrada del dashboard offline
// ============================================

import { MapManager } from './mapManager.js';
import { DataManager } from './dataManager.js';
import { UIManager } from './uiManager.js';
import { updateClock } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar módulos
    const mapManager = new MapManager();
    const dataManager = new DataManager();
    const uiManager = new UIManager(mapManager, dataManager);

    // Inicializar reloj
    updateClock();
    setInterval(updateClock, 1000);

    // Inicializar mapa
    mapManager.initialize();

    // Conectar eventos de UI
    uiManager.setupEventListeners();

    // Actualizar tiempos transcurridos cada segundo
    setInterval(() => {
        uiManager.updateElapsedTimes();
    }, 1000);

    console.log('Dashboard offline inicializado correctamente');
});