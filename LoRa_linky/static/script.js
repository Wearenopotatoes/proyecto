document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a Elementos del DOM ---
    const tableBody = document.getElementById('alerts-table-body');
    const dialog = document.getElementById('assign-unit-dialog');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    // --- Definición de TODAS las capas de mapa ---

    // Capas Online (con zoom completo)
    const mapaCallesOnline = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19
    });
    const mapaSatelitalOnline = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri', maxZoom: 19
    });

    // Capa Offline (SOLO el mapa de calles)
    const mapaCallesOffline = L.tileLayer('/static/map_tiles/calles/{z}/{x}/{y}.png', {
        attribution: 'Mapa Offline - Calles', minZoom: 8, maxZoom: 17 // maxZoom hasta 17 para el detalle urbano
    });

    // --- Lógica para detectar conexión y elegir las capas correctas ---
    let baseMaps;
    let defaultLayer;

    if (navigator.onLine) {
        console.log("Modo Online: Usando mapas de Internet.");
        baseMaps = {
            "Calles": mapaCallesOnline,
            "Satélite": mapaSatelitalOnline
        };
        defaultLayer = mapaCallesOnline;
    } else {
        console.log("Modo Offline: Usando mapa local de calles.");
        baseMaps = {
            "Calles (Offline)": mapaCallesOffline
        };
        defaultLayer = mapaCallesOffline;
    }

    // --- Inicialización del Mapa ---
    const map = L.map('map', {
        center: [13.7942, -88.8965],
        zoom: 9,
        layers: [defaultLayer]
    });

    L.control.layers(baseMaps).addTo(map);
    
    // Solución para el mapa en negro
    setTimeout(() => map.invalidateSize(), 100);

    // Usamos MarkerClusterGroup para agrupar marcadores
    const markersLayer = L.markerClusterGroup();
    map.addLayer(markersLayer);

    // --- Iconos de Mapa Personalizados ---
    const iconAccidente = L.divIcon({
        className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>",
        iconSize: [20, 20], iconAnchor: [10, 10]
    });
    const iconEnCamino = L.divIcon({
        className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>",
        iconSize: [20, 20], iconAnchor: [10, 10]
    });

    // --- Estado de la Aplicación ---
    let selectedAlertId = null;

    // --- Lógica Principal ---
    async function fetchDashboardData() {
        try {
            const response = await fetch('/api/dashboard_data');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            renderDashboard(data.alerts, data.units);
        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error al cargar los datos.</td></tr>`;
        }
    }

    function renderDashboard(alerts, units) {
        markersLayer.clearLayers();
        tableBody.innerHTML = '';

        if (!alerts || alerts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay reportes de emergencia.</td></tr>`;
            return;
        }

        alerts.forEach(alert => {
            // Renderizar Marcador
            if (alert.status !== 'atendido' && alert.lat && alert.lon) {
                const icon = alert.status === 'en_camino' ? iconEnCamino : iconAccidente;
                const tipoTraducido = traducirTipoAccidente(alert.type);
                const unitsAssigned = alert.unit_assigned || [];
                const unitsPopupText = unitsAssigned.length > 0 ? unitsAssigned.join(', ') : 'N/A';
                const popupTexto = `<b>Tipo:</b> ${tipoTraducido}<br><b>Unidades:</b> ${unitsPopupText}`;
                const marker = L.marker([alert.lat, alert.lon], { icon: icon });
                marker.bindPopup(popupTexto);
                markersLayer.addLayer(marker);
            }

            // Renderizar Fila en la Tabla
            const row = document.createElement('tr');
            const statusClass = alert.status === 'atendido' ? 'green' : (alert.status === 'en_camino' ? 'orange' : 'red');
            const typeText = traducirTipoAccidente(alert.type);
            const unitsAssigned = alert.unit_assigned || [];
            const unitsText = unitsAssigned.length > 0 ? unitsAssigned.map(u => `<span class="unit-tag">${u}</span>`).join(' ') : '<span class="muted">N/A</span>';
            row.innerHTML = `
                <td class="type">${typeText}</td>
                <td><span class="badge ${statusClass}">${alert.status.replace('_', ' ')}</span></td>
                <td>${unitsText}</td>
                <td class="muted">${alert.timestamp}</td>
                <td class="actions">
                    <button class="btn locate btn-ver-mapa" data-lat="${alert.lat}" data-lon="${alert.lon}">Ver</button>
                    <button class="btn btn-primary btn-asignar" data-id="${alert.id}">Asignar</button>
                    <button class="btn btn-success btn-atendido" data-id="${alert.id}">Atendido</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        assignButtonEvents(alerts, units);
    }

    function assignButtonEvents(alerts, units) {
        document.querySelectorAll('.btn-ver-mapa').forEach(btn => {
            btn.onclick = (e) => {
                const button = e.currentTarget;
                const lat = parseFloat(button.dataset.lat);
                const lon = parseFloat(button.dataset.lon);
                if (!isNaN(lat) && !isNaN(lon)) {
                    map.flyTo([lat, lon], 16);
                }
            };
        });
        document.querySelectorAll('.btn-asignar').forEach(btn => {
            btn.onclick = (e) => {
                selectedAlertId = e.currentTarget.dataset.id;
                const currentAlert = alerts.find(a => a.id === selectedAlertId);
                const assignedUnitsToThisAlert = currentAlert ? currentAlert.unit_assigned : [];
                const availableUnits = units.filter(u => u.available && !assignedUnitsToThisAlert.includes(u.name));
                if (availableUnits.length > 0) {
                    selectUnit.innerHTML = availableUnits.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
                    dialog.showModal();
                } else {
                    alert('No hay más unidades disponibles para asignar a esta emergencia.');
                }
            };
        });
        document.querySelectorAll('.btn-atendido').forEach(btn => {
            btn.onclick = (e) => {
                const alert_id = e.currentTarget.dataset.id;
                fetch('/mark_attended', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ alert_id })
                }).then(response => response.ok && fetchDashboardData());
            };
        });
    }

    btnCancelAssign.onclick = () => dialog.close();
    btnConfirmAssign.onclick = () => {
        const unit_name = selectUnit.value;
        if (selectedAlertId && unit_name) {
            fetch('/assign_unit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alert_id: selectedAlertId, unit_name })
            }).then(response => {
                if (response.ok) {
                    dialog.close();
                    fetchDashboardData();
                }
            });
        }
    };
    btnClearAlerts.onclick = () => {
        if(confirm('¿Estás seguro de que quieres borrar todos los reportes? Esta acción no se puede deshacer.')) {
            fetch('/clear_alerts', { method: 'DELETE' })
                .then(response => response.ok && fetchDashboardData());
        }
    };

    function traducirTipoAccidente(tipoId) {
        // Lista actualizada de tipos de emergencia
        const tipos = {
            '1': 'Colisión',
            '2': 'Incendio',
            '3': 'Derrumbe',
            '4': 'Inundación',
            '5': 'Otro'
        };
        return tipos[String(tipoId)] || tipoId;
    }

    fetchDashboardData();
    setInterval(fetchDashboardData, 5000);
});