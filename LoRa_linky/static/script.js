document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a Elementos del DOM (sin cambios) ---
    const tableBody = document.getElementById('alerts-table-body');
    const dialog = document.getElementById('assign-unit-dialog');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    // --- Definición de Capas de Mapa ---
    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const mapaSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    // --- Inicialización del Mapa ---
    const map = L.map('map', {
        center: [13.7942, -88.8965],
        zoom: 9,
        layers: [mapaCalles]
    });
    
    // --- Control de Capas ---
    const baseMaps = {
        "Calles": mapaCalles,
        "Satélite": mapaSatelital
    };
    L.control.layers(baseMaps).addTo(map);

    // --- CAMBIO CLAVE: Solución para el mapa en negro ---
    // Forzamos al mapa a recalcular su tamaño después de que la página se haya renderizado.
    setTimeout(function () {
        map.invalidateSize();
    }, 100); // 100 milisegundos de espera es suficiente.

    // --- Grupo de Clústeres ---
    const markersLayer = L.markerClusterGroup();
    map.addLayer(markersLayer);

    // ... (El resto del archivo script.js no necesita ningún cambio) ...

    // --- Iconos de Mapa Personalizados ---
    const iconAccidente = L.divIcon({
        className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>",
        iconSize: [20, 20], iconAnchor: [10, 10]
    });
    const iconEnCamino = L.divIcon({
        className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>",
        iconSize: [20, 20], iconAnchor: [10, 10]
    });
    let selectedAlertId = null;

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
        const tipos = { '1': 'Colisión', '2': 'Incendio', '3': 'Derrumbe', '4': 'Inundación', "5":"Otro" };
        return tipos[String(tipoId)] || tipoId;
    }
    fetchDashboardData();
    setInterval(fetchDashboardData, 5000);
});