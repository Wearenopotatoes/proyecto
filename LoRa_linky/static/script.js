document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN ---
    // 
    const API_BASE_URL = 'http://api.loralink.live';
    const API_KEY = 'linkONxM0Jn';

    // --- Referencias a Elementos del DOM ---
    const map = L.map('map').setView([13.7942, -88.8965], 9);
    const markersLayer = L.layerGroup().addTo(map);
    const tableBody = document.getElementById('alerts-table-body');
    const dialog = document.getElementById('assign-unit-dialog');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    // --- Iconos de Mapa ---
    const iconAccidente = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    const iconEnCamino = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    
    let selectedAlertId = null;

    // --- Inicialización del Mapa ---
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    setTimeout(() => map.invalidateSize(), 100);

    // --- Lógica de la API ---
    async function apiFetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            ...options.headers,
        };
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error en la API:', errorData);
            throw new Error(`Error en la API: ${response.statusText}`);
        }
        return response.json();
    }

    async function fetchDashboardData() {
        try {
            const [alerts, units] = await Promise.all([
                apiFetch('/emergencies/'),
                apiFetch('/units/')
            ]);
            renderDashboard(alerts, units);
        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error al cargar los datos de la API.</td></tr>`;
        }
    }

    function renderDashboard(alerts, units) {
        markersLayer.clearLayers();
        tableBody.innerHTML = '';

        if (!alerts || alerts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay reportes de emergencia.</td></tr>`;
            return;
        }

        alerts.forEach(alert => {
            const statusText = (alert.status ? alert.status.description : 'desconocido').toLowerCase().replace(' ', '_');
            
            if (statusText !== 'atendido' && alert.latitud && alert.longitud) {
                const icon = statusText === 'en_camino' ? iconEnCamino : iconAccidente;
                const unitsText = alert.assigned_units.map(u => u.name).join(', ') || 'N/A';
                const popupTexto = `<b>Tipo:</b> ${alert.accident_type.description}<br><b>Unidades:</b> ${unitsText}`;
                
                L.marker([alert.latitud, alert.longitud], { icon: icon })
                    .addTo(markersLayer)
                    .bindPopup(popupTexto);
            }

            const row = document.createElement('tr');
            const statusClass = statusText === 'atendido' ? 'green' : (statusText === 'en_camino' ? 'orange' : 'red');
            const unitsText = alert.assigned_units.length > 0 ? alert.assigned_units.map(u => `<span class="unit-tag">${u.name}</span>`).join(' ') : '<span class="muted">N/A</span>';

            row.innerHTML = `
                <td class="type">${alert.accident_type.description}</td>
                <td><span class="badge ${statusClass}">${statusText.replace('_', ' ')}</span></td>
                <td>${unitsText}</td>
                <td class="muted">${alert.user ? alert.user.name : 'N/A'}</td>
                <td class="muted">${new Date(alert.timestamp).toLocaleString('es-SV')}</td>
                <td class="actions">
                    <button class="btn btn-primary btn-asignar" data-id="${alert.emergency_id}">Asignar</button>
                    <button class="btn btn-success btn-atendido" data-id="${alert.emergency_id}">Atendido</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        assignButtonEvents(alerts, units);
    }
    
    function assignButtonEvents(alerts, units) {
        document.querySelectorAll('.btn-asignar').forEach(btn => {
            btn.onclick = (e) => {
                selectedAlertId = e.target.dataset.id;
                
                const currentAlert = alerts.find(a => a.emergency_id == selectedAlertId);
                const assignedUnitIds = currentAlert.assigned_units.map(u => u.unit_id);
                
                const availableUnits = units.filter(u => u.available && !assignedUnitIds.includes(u.unit_id));
                
                if (availableUnits.length > 0) {
                    selectUnit.innerHTML = availableUnits.map(u => `<option value="${u.unit_id}">${u.name}</option>`).join('');
                    dialog.showModal();
                } else {
                    alert('No hay más unidades disponibles para asignar a esta emergencia.');
                }
            };
        });

        document.querySelectorAll('.btn-atendido').forEach(btn => {
            btn.onclick = async (e) => {
                const emergency_id = e.target.dataset.id;
                await apiFetch(`/emergencies/${emergency_id}/attend`, { method: 'POST' });
                fetchDashboardData();
            };
        });
    }

    // --- Eventos del Dialog y Botones Principales ---
    btnCancelAssign.onclick = () => dialog.close();
    
    btnConfirmAssign.onclick = async () => {
        const unit_id = parseInt(selectUnit.value, 10);
        if (selectedAlertId && unit_id) {
            await apiFetch(`/emergencies/${selectedAlertId}/assign`, {
                method: 'POST',
                body: JSON.stringify({ unit_id: unit_id })
            });
            dialog.close();
            fetchDashboardData();
        }
    };
    
    btnClearAlerts.onclick = async () => {
        if(confirm('¿Estás seguro de que quieres borrar todos los reportes?')) {
            try {
                await apiFetch('/emergencies/clear_all', { method: 'DELETE' }); 
            } catch (e) {
                console.error("La API no parece tener un endpoint para limpiar todo. Borrando uno por uno...");
                const alertsResponse = await apiFetch('/emergencies/');
                for(const alert of alertsResponse) {
                    await apiFetch(`/emergencies/${alert.emergency_id}`, { method: 'DELETE'});
                }
            }
            fetchDashboardData();
        }
    };

    // --- Carga Inicial y Actualización Periódica ---
    fetchDashboardData();
    setInterval(fetchDashboardData, 5000);
});