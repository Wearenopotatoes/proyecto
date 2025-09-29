document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a Elementos del DOM (sin cambios) ---
    const tableBody = document.getElementById('alerts-table-body');
    const dialog = document.getElementById('assign-unit-dialog');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    let map;
    const alertMarkers = L.markerClusterGroup();
    let selectedAlertId = null;

    // --- Inicialización del Mapa (MODIFICADO) ---
    function initializeMap() {
        // 1. Define las capas de mapa
        const mapaOnline = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        });

        const mapaOffline = L.tileLayer('/tiles/{z}/{x}/{y}.png', { // La nueva ruta que creamos en Flask
            attribution: 'Mapa Offline',
            minZoom: 5, // Ajusta estos valores según tu mbtiles
            maxZoom: 18
        });

        // 2. Crea el mapa, cargando la capa OFFLINE por defecto
        map = L.map('map', {
            layers: [mapaOffline] // Carga el mapa offline al iniciar
        }).setView([13.6929, -89.2182], 13);
        
        map.addLayer(alertMarkers);

        // 3. Añade el control para cambiar de mapa
        const baseMaps = {
            "Offline": mapaOffline,
            "Online": mapaOnline
        };
        L.control.layers(baseMaps).addTo(map);
    }

    // --- Lógica Principal de Datos (sin cambios) ---
    function fetchDashboardData() {
        fetch('/api/dashboard_data')
            .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
            .then(data => {
                updateAlertsTable(data.alerts);
                updateAlertsMap(data.alerts);
            })
            .catch(error => console.error("Error fetching data:", error));
    }

    function updateAlertsTable(alerts) {
        tableBody.innerHTML = '';
        alerts.forEach(alert => {
            const row = document.createElement('tr');
            const isAssignable = alert.status === 'accidente';
            const isResolvable = alert.status === 'en_camino';
            row.innerHTML = `
                <td>${traducirTipoAccidente(alert.type)}</td>
                <td><span class="status-badge ${alert.status}">${alert.status.replace('_', ' ')}</span></td>
                <td>${alert.units.join(', ') || 'N/A'}</td>
                <td>${alert.timestamp}</td>
                <td class="actions">
                    <button class="btn assign" data-alert-id="${alert.id}" ${!isAssignable ? 'disabled' : ''}>Asignar</button>
                    <button class="btn resolve" data-alert-id="${alert.id}" ${!isResolvable ? 'disabled' : ''}>Resolver</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updateAlertsMap(alerts) {
        alertMarkers.clearLayers();
        alerts.forEach(alert => {
            if (alert.lat && alert.lon) {
                const marker = L.marker([alert.lat, alert.lon], {
                    icon: L.divIcon({
                        className: `marker-icon status-${alert.status}`,
                        html: '🚨', iconSize: [30, 30], iconAnchor: [15, 15]
                    })
                });
                marker.bindPopup(`<b>${traducirTipoAccidente(alert.type)}</b><br>Estado: ${alert.status}`);
                alertMarkers.addLayer(marker);
            }
        });
    }

    // --- Manejadores de Eventos (sin cambios) ---
    tableBody.addEventListener('click', (event) => {
        const target = event.target;
        const alertId = target.dataset.alertId;
        if (!alertId) return;
        if (target.classList.contains('assign')) {
            selectedAlertId = alertId;
            fetch('/api/dashboard_data').then(r => r.json()).then(data => {
                const availableUnits = data.units.filter(u => u.available);
                if (availableUnits.length > 0) {
                    selectUnit.innerHTML = availableUnits.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
                    dialog.showModal();
                } else {
                    alert('No hay unidades disponibles.');
                }
            });
        }
        if (target.classList.contains('resolve')) {
            fetch('/update_alert_status', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: alertId, status: 'resuelto' })
            }).then(response => response.ok && fetchDashboardData());
        }
    });
    
    btnConfirmAssign.onclick = () => {
        const unitName = selectUnit.value;
        if (selectedAlertId && unitName) {
            fetch('/assign_unit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: selectedAlertId, unit_name: unitName })
            }).then(response => { if (response.ok) { dialog.close(); fetchDashboardData(); } });
        }
    };

    btnCancelAssign.onclick = () => dialog.close();
    btnClearAlerts.onclick = () => {
        if (confirm('¿Estás seguro de que quieres borrar todos los reportes?')) {
            fetch('/clear_alerts', { method: 'DELETE' }).then(fetchDashboardData);
        }
    };

    function traducirTipoAccidente(tipoId) {
        const tipos = { '1': 'Colisión', '2': 'Incendio', '3': 'Derrumbe', '4': 'Inundación', '5': 'Otro' };
        return tipos[String(tipoId)] || 'Desconocido';
    }

    // --- Arranque ---
    initializeMap();
    fetchDashboardData();
    setInterval(fetchDashboardData, 5000);
});