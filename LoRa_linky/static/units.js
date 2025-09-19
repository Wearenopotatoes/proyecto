document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN ---
    const API_BASE_URL = 'https://loralink.live';
    const API_KEY = 'linkONxM0Jn';

    // --- Referencias a Elementos del DOM ---
    const tableBody = document.getElementById('units-table-body');
    const addUnitForm = document.getElementById('add-unit-form');

    // --- Lógica de la API (sin cambios) ---
    async function apiFetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            ...options.headers,
        };
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Error en API [${endpoint}]:`, errorData);
            throw new Error(`Error en la API: ${response.statusText}`);
        }
        return response.status !== 204 ? response.json() : null;
    }

    async function fetchAndRenderUnits() {
        try {
            // 1. Obtenemos la lista maestra de todas las unidades
            const units = await apiFetch('/emergency-units');
            tableBody.innerHTML = ''; 

            if (!units || units.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay unidades registradas.</td></tr>`;
                return;
            }

            // 2. Para cada unidad, pedimos sus estadísticas.
            const statsPromises = units.map(unit =>
                apiFetch(`/emergency-units/${unit.emergency_unit_id}/stats`).catch(e => ({ active_emergencies: 'Error' }))
            );
            const allStats = await Promise.all(statsPromises);

            // 3. Renderizamos la tabla con toda la información.
            units.forEach((unit, index) => {
                const stats = allStats[index];
                const activeCount = stats ? stats.active_emergencies : 0;
                
                // --- LÓGICA CORREGIDA: Deducimos el estado a partir del CONTEO ---
                const isAvailable = activeCount === 0;

                const row = document.createElement('tr');
                row.className = 'unit-row';
                if (!isAvailable) {
                    row.classList.add('occupied');
                }
                row.dataset.unitId = unit.emergency_unit_id;
                
                const statusClass = isAvailable ? 'green' : 'red';
                const statusText = isAvailable ? 'Disponible' : 'Ocupada';
                const expanderIcon = isAvailable ? '' : `<span class="expand-icon">&#9654;</span>`;

                row.innerHTML = `
                    <td>${unit.name}</td>
                    <td>${unit.latitud}</td>
                    <td>${unit.longitud}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>${expanderIcon}</td>
                `;
                tableBody.appendChild(row);

                // La fila de detalles ahora muestra el conteo.
                const detailsRow = document.createElement('tr');
                detailsRow.className = 'details-row';
                detailsRow.id = `details-for-${unit.emergency_unit_id}`;
                detailsRow.innerHTML = `<td colspan="5" class="details-cell"><b>Emergencias Activas Asignadas:</b> ${activeCount}</td>`;
                tableBody.appendChild(detailsRow);

            });

            assignClickEvents();

        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error al cargar las unidades.</td></tr>`;
            console.error("Error al cargar unidades:", error);
        }
    }
    
    // --- Lógica de Clics (Ahora más simple) ---
    function assignClickEvents() {
        tableBody.addEventListener('click', (event) => {
            const clickedRow = event.target.closest('.unit-row.occupied');
            if (!clickedRow) return;

            const unitId = clickedRow.dataset.unitId;
            const detailsRow = document.getElementById(`details-for-${unitId}`);
            if (!detailsRow) return;

            const isExpanded = clickedRow.classList.contains('expanded');

            // Cerramos cualquier otra fila abierta
            document.querySelectorAll('.unit-row.expanded').forEach(r => {
                if(r !== clickedRow) r.classList.remove('expanded');
            });
            document.querySelectorAll('.details-row').forEach(dr => {
                if(dr !== detailsRow) dr.style.display = 'none';
            });

            // Abrimos o cerramos la fila actual
            if (isExpanded) {
                clickedRow.classList.remove('expanded');
                detailsRow.style.display = 'none';
            } else {
                clickedRow.classList.add('expanded');
                detailsRow.style.display = 'table-row';
            }
        });
    }

    // --- Lógica del Formulario (sin cambios) ---
    addUnitForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const formData = new FormData(addUnitForm);
        const unitData = {
            name: formData.get('name'),
            latitud: parseFloat(formData.get('latitud')),
            longitud: parseFloat(formData.get('longitud'))
        };
        try {
            await apiFetch('/emergency-units', {
                method: 'POST',
                body: JSON.stringify(unitData)
            });
            addUnitForm.reset();
            fetchAndRenderUnits();
            alert('¡Unidad agregada exitosamente!');
        } catch (error) {
            alert('Error al agregar la unidad. Revisa la consola para más detalles.');
        }
    });

    // --- Carga Inicial ---
    fetchAndRenderUnits();
});