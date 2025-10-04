// js/uiRenderer.js

function traducirStatus(statusId) {
    const statuses = { 1: 'accidente', 2: 'en_camino', 3: 'atendido' };
    return statuses[statusId] || 'desconocido';
}

export function renderTable(tableBody, alerts) {
    // ... (El resto de la función no cambia)
    tableBody.innerHTML = '';
    const activeAlerts = alerts.filter(alert => alert.status !== 3);
    if (!activeAlerts.length) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay reportes activos.</td></tr>`;
        return;
    }
    activeAlerts.forEach(alert => {
        const statusText = traducirStatus(alert.status);
        const typeText = alert.accident_type?.description || 'N/A';
        const userName = alert.user?.name || 'N/A';
        const userId = alert.user?.user_id;
        const assignedUnit = alert.assigned_unit_rel;
        const row = document.createElement('tr');
        row.id = `row-${alert.emergency_id}`;

        row.innerHTML = `
            <td>${typeText}</td>
            <td><span class="badge ${statusText.replace('_', '-')}">${statusText}</span></td>
            <td>${assignedUnit ? `<span class="unit-tag">${assignedUnit.name}</span>` : '<span class="muted">N/A</span>'}</td>
            <td>${userId ? `<a class="user-link" data-user-id="${userId}">${userName}</a>` : `<span class="muted">${userName}</span>`}</td>
            
            <td class="muted">${new Date(alert.timestamp + 'Z').toLocaleString('es-SV', { timeZone: 'America/El_Salvador', hour12: false })}</td>
            
            <td class="actions">
                <button class="btn btn-details" data-id="${alert.emergency_id}">Ver</button>
                <button class="btn btn-primary btn-asignar" data-id="${alert.emergency_id}">Asignar</button>
                <button class="btn btn-success btn-atendido" data-id="${alert.emergency_id}">Atendido</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

export function renderUserDetails(contentElement, user, kinCatalog) {
    const conditionsHtml = user.conditions?.length ? user.conditions.map(c => `<li>${c.description}</li>`).join('') : '<li>Ninguna registrada</li>';
    const contactsHtml = user.emergency_contacts?.length ? user.emergency_contacts.map(c => {
        const kinshipName = kinCatalog.find(k => k.kin_id === c.kin)?.kin_name || 'N/A';
        return `<li><b>${c.contact_name}</b> (${kinshipName}): ${c.contact_phone}</li>`;
    }).join('') : '<li>Ninguno registrado</li>';

    contentElement.innerHTML = `
        <button class="btn-close" id="close-user-dialog-btn">X</button>
        <h3>Detalles de Usuario</h3>
        <ul>
            <li><b>Nombre:</b> ${user.name || 'N/A'}</li>
            <li><b>Teléfono:</b> ${user.phone || 'N/A'}</li>
        </ul>
        <h4>Condiciones Médicas</h4>
        <ul>${conditionsHtml}</ul>
        <h4>Contactos de Emergencia</h4>
        <ul>${contactsHtml}</ul>
    `;
    document.getElementById('close-user-dialog-btn').onclick = () => contentElement.parentElement.close();
}

// En js/uiRenderer.js

export function renderEmergencyDetails(contentElement, details) {
    const statusText = traducirStatus(details.status);
    const typeText = details.accident_type?.description || 'N/A';
    const userName = details.user?.name || 'N/A';
    const unitName = details.assigned_unit_rel?.name || 'Ninguna asignada';
    
    // CAMBIO AQUÍ: Se añade 'Z' para indicar que es UTC y hour12: false a las opciones
    const timestamp = new Date(details.timestamp + 'Z').toLocaleString('es-SV', { 
        dateStyle: 'long', 
        timeStyle: 'short',
        timeZone: 'America/El_Salvador',
        hour12: false 
    });

    contentElement.innerHTML = `
        <button class="btn-close" id="close-emergency-details-btn">X</button>
        <h3>Detalles de la Emergencia</h3>
        <ul class="details-list">
            <li><b>Tipo:</b> ${typeText}</li>
            <li><b>Estado:</b> <span class="badge ${statusText.replace('_','-')}">${statusText}</span></li>
            <li><b>Fecha y Hora:</b> ${timestamp}</li>
            <li><b>Ubicación:</b> ${details.latitud}, ${details.longitud}</li>
            <li><b>Reportado por:</b> ${userName}</li>
            <li><b>Unidad Asignada:</b> ${unitName}</li>
        </ul>
        <div class="dialog-actions">
            <button class="btn" id="close-emergency-details-btn2">Cerrar</button>
        </div>
    `;
    document.getElementById('close-emergency-details-btn').onclick = () => contentElement.parentElement.close();
    document.getElementById('close-emergency-details-btn2').onclick = () => contentElement.parentElement.close();
}