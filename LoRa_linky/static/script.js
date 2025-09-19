+document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN ---
    const API_BASE_URL = 'https://loralink.live';
    const API_KEY = 'linkONxM0Jn';

    // --- Referencias a Elementos del DOM ---
    const tableBody = document.getElementById('alerts-table-body');
    const assignDialog = document.getElementById('assign-unit-dialog');
    const userDialog = document.getElementById('user-details-dialog');
    const userDialogContent = document.getElementById('user-details-content');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    // --- Iconos de Mapa ---
    const iconAccidente = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    const iconEnCamino = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    
    // --- Estado de la Aplicación ---
    let selectedAlertId = null;
    const markers = {};
    let kinCatalog = [];

    // --- INICIALIZACIÓN DEL MAPA Y CAPAS ---
    // 1. Definimos las diferentes capas base.
    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const mapaSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    // 2. Inicializamos el mapa con la capa de calles por defecto.
    const map = L.map('map', {
        center: [13.7942, -88.8965],
        zoom: 9,
        layers: [mapaCalles]
    });

    const markersLayer = L.layerGroup().addTo(map);

    // 3. Creamos el objeto para el control y lo añadimos al mapa.
    const baseMaps = {
        "Calles": mapaCalles,
        "Satélite": mapaSatelital
    };
    L.control.layers(baseMaps).addTo(map);

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
            const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }));
            console.error(`Error en API [${endpoint}]:`, errorData);
            throw new Error(`Error en la API: ${response.statusText}`);
        }
        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return null;
        }
        return response.json();
    }

    async function fetchDashboardData() {
        try {
            const [alerts, units, kins] = await Promise.all([
                apiFetch('/emergencies'),
                apiFetch('/emergency-units'),
                apiFetch('/catalogs/kin-catalog')
            ]);
            kinCatalog = kins;
            renderDashboard(alerts, units);
        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error al cargar los datos de la API.</td></tr>`;
        }
    }

    function traducirStatus(statusId) {
        const statuses = { 1: 'accidente', 2: 'en_camino', 3: 'atendido' };
        return statuses[statusId] || 'desconocido';
    }

    function renderDashboard(alerts, units) {
        Object.values(markers).forEach(marker => marker.remove());
        tableBody.innerHTML = '';

        if (!alerts || !alerts.length) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay reportes de emergencia.</td></tr>`;
            return;
        }

        alerts.forEach(alert => {
            const statusText = traducirStatus(alert.status);
            const typeText = alert.accident_type?.description || 'N/A';
            const userName = alert.user?.name || 'N/A';
            const userId = alert.user?.user_id;
            const assignedUnits = alert.assigned_unit_rel ? [alert.assigned_unit_rel] : [];
            
            if (statusText !== 'atendido' && alert.latitud && alert.longitud) {
                const icon = statusText === 'en_camino' ? iconEnCamino : iconAccidente;
                const unitsPopupText = assignedUnits.map(u => u.name).join(', ') || 'N/A';
                const popupTexto = `<b>Tipo:</b> ${typeText}<br><b>Unidad:</b> ${unitsPopupText}`;
                const marker = L.marker([alert.latitud, alert.longitud], { icon: icon }).addTo(map).bindPopup(popupTexto);
                markers[alert.emergency_id] = marker;
            }

            const row = document.createElement('tr');
            row.id = `row-${alert.emergency_id}`;
            const statusClass = statusText.replace('_', '-');
            const unitsTableText = assignedUnits.length > 0 ? assignedUnits.map(u => `<span class="unit-tag">${u.name}</span>`).join(' ') : '<span class="muted">N/A</span>';
            const userHtml = userId ? `<a class="user-link" data-user-id="${userId}">${userName}</a>` : `<span class="muted">${userName}</span>`;

            row.innerHTML = `
                <td class="type">${typeText}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${unitsTableText}</td>
                <td class="muted">${userHtml}</td>
                <td class="muted">${new Date(alert.timestamp).toLocaleString('es-SV')}</td>
                <td class="actions">
                    <button class="btn btn-primary btn-asignar" data-id="${alert.emergency_id}">Asignar</button>
                    <button class="btn btn-success btn-atendido" data-id="${alert.emergency_id}">Atendido</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        assignEvents(alerts, units);
    }
    
    function assignEvents(alerts, units) {
        // --- Interacción Mapa-Tabla ---
        document.querySelectorAll('#alerts-table-body tr').forEach(row => {
            const emergencyId = row.id.replace('row-', '');
            const marker = markers[emergencyId];
            if (!marker) return;

            row.addEventListener('mouseenter', () => {
                row.classList.add('highlighted');
                marker.getElement()?.classList.add('highlighted-marker');
            });
            row.addEventListener('mouseleave', () => {
                row.classList.remove('highlighted');
                marker.getElement()?.classList.remove('highlighted-marker');
            });
            marker.on('mouseover', () => row.classList.add('highlighted'));
            marker.on('mouseout', () => row.classList.remove('highlighted'));
        });

        // --- Panel de Detalles del Usuario ---
        document.querySelectorAll('.user-link').forEach(link => {
            link.onclick = async (e) => {
                const userId = e.target.dataset.userId;
                userDialogContent.innerHTML = '<h3>Cargando información...</h3>';
                userDialog.showModal();
                try {
                    const user = await apiFetch(`/users/${userId}`);
                    renderUserDetails(user);
                } catch (error) {
                    userDialogContent.innerHTML = '<h3>Error al cargar datos</h3><p>No se pudo obtener la información del usuario.</p><div class="dialog-actions"><button id="close-user-dialog" class="btn">Cerrar</button></div>';
                    document.getElementById('close-user-dialog').onclick = () => userDialog.close();
                }
            };
        });

        // --- Botones de Acción ---
        document.querySelectorAll('.btn-asignar').forEach(btn => {
            btn.onclick = (e) => {
                selectedAlertId = e.target.dataset.id;
                const currentAlert = alerts.find(a => a.emergency_id == selectedAlertId);
                const assignedUnitIds = (currentAlert.assigned_unit_rel ? [currentAlert.assigned_unit_rel.emergency_unit_id] : []);
                const availableUnits = units.filter(u => u.available && !assignedUnitIds.includes(u.emergency_unit_id));
                
                if (availableUnits.length > 0) {
                    selectUnit.innerHTML = availableUnits.map(u => `<option value="${u.emergency_unit_id}">${u.name}</option>`).join('');
                    assignDialog.showModal();
                } else {
                    alert('No hay más unidades disponibles para asignar a esta emergencia.');
                }
            };
        });

        document.querySelectorAll('.btn-atendido').forEach(btn => {
            btn.onclick = async (e) => {
                const emergency_id = e.target.dataset.id;
                await apiFetch(`/emergencies/${emergency_id}`, { 
                    method: 'PUT',
                    body: JSON.stringify({ status_id: 3 })
                });
                fetchDashboardData();
            };
        });
    }

    function renderUserDetails(user) {
        if (!user) {
            userDialogContent.innerHTML = '<h3>Error</h3><p>No se recibieron datos del usuario.</p><div class="dialog-actions"><button id="close-user-dialog" class="btn">Cerrar</button></div>';
            document.getElementById('close-user-dialog').onclick = () => userDialog.close();
            return;
        }

        const conditionsHtml = (user.conditions && user.conditions.length > 0)
            ? user.conditions.map(c => `<li>${c?.description || 'N/A'}</li>`).join('') 
            : '<li>Ninguna registrada</li>';
        
        const contactsHtml = (user.emergency_contacts && user.emergency_contacts.length > 0)
            ? user.emergency_contacts.map(c => {
                const contactName = c?.contact_name || 'Contacto sin nombre';
                const kinshipObj = kinCatalog.find(k => k.kin_id === c.kin);
                const kinshipName = kinshipObj ? kinshipObj.kin_name : 'N/A';
                const contactPhone = c?.contact_phone || 'N/A';
                return `<li><b>${contactName}</b> (${kinshipName}): ${contactPhone}</li>`;
            }).join('')
            : '<li>Ninguno registrado</li>';

        userDialogContent.innerHTML = `
            <button id="close-user-dialog" class="btn" style="position: absolute; top: 10px; right: 10px; padding: 4px 8px;">X</button>
            <h3>Detalles de Usuario</h3>
            <div class="user-details-section">
                <h4>Información General</h4>
                <ul>
                    <li><b>Nombre:</b> ${user.name || 'N/A'}</li>
                    <li><b>Teléfono:</b> ${user.phone || 'N/A'}</li>
                    <li><b>Nacimiento:</b> ${user.birthday || 'N/A'}</li>
                </ul>
            </div>
            <div class="user-details-section">
                <h4>Condiciones Médicas</h4>
                <ul>${conditionsHtml}</ul>
            </div>
            <div class="user-details-section">
                <h4>Contactos de Emergencia</h4>
                <ul>${contactsHtml}</ul>
            </div>
        `;
        document.getElementById('close-user-dialog').onclick = () => userDialog.close();
    }
    
    btnCancelAssign.onclick = () => assignDialog.close();
    
    btnConfirmAssign.onclick = async () => {
        const unit_id = parseInt(selectUnit.value, 10);
        if (selectedAlertId && unit_id) {
            await apiFetch(`/emergencies/${selectedAlertId}`, {
                method: 'PUT',
                body: JSON.stringify({ 
                    status_id: 2,
                    assigned_unit_id: unit_id 
                })
            });
            assignDialog.close();
            fetchDashboardData();
        }
    };
    
    btnClearAlerts.onclick = async () => {
        if(confirm('¿Estás seguro de que quieres borrar todos los reportes?')) {
            const alertsResponse = await apiFetch('/emergencies');
            await Promise.all(alertsResponse.map(alert => 
                apiFetch(`/emergencies/${alert.emergency_id}`, { method: 'DELETE' })
            ));
            fetchDashboardData();
        }
    };

    fetchDashboardData();
    setInterval(fetchDashboardData, 5000);
});