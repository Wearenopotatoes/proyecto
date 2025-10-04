// uiRenderer.js - Renderizado de componentes UI

import { CONFIG, UTILS } from './config.js';

function traducirStatus(statusId) {
    return CONFIG.STATUS_LABELS[statusId] || 'desconocido';
}

export function renderTable(tableBody, alerts, elapsedTimeCalculator) {
    tableBody.innerHTML = '';
    const activeAlerts = alerts.filter(alert => alert.status !== 3);
    
    if (!activeAlerts.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 40px;">
                    <div style="opacity: 0.5;">
                        <div style="font-size: 3em; margin-bottom: 10px;">✓</div>
                        <div>No hay reportes activos</div>
                    </div>
                </td>
            </tr>`;
        return;
    }
    
    activeAlerts.forEach(alert => {
        const statusText = traducirStatus(alert.status);
        const typeText = alert.accident_type?.description || 'N/A';
        const userName = alert.user?.name || 'N/A';
        const userId = alert.user?.user_id;
        const assignedUnit = alert.assigned_unit_rel;
        const elapsedTime = elapsedTimeCalculator(alert.timestamp);
        
        const row = document.createElement('tr');
        row.id = `row-${alert.emergency_id}`;

        row.innerHTML = `
            <td>
                <div class="accident-type-cell">
                    <span class="type-icon">${getTypeIcon(alert.tipo_accidente)}</span>
                    <span>${typeText}</span>
                </div>
            </td>
            <td><span class="badge ${statusText.replace('_', '-')}">${statusText}</span></td>
            <td>
                ${assignedUnit 
                    ? `<span class="unit-tag">${assignedUnit.name}</span>` 
                    : '<span class="muted">Sin asignar</span>'}
            </td>
            <td>
                ${userId 
                    ? `<a class="user-link" data-user-id="${userId}">${userName}</a>` 
                    : `<span class="muted">${userName}</span>`}
            </td>
            <td class="muted">
                <div class="time-cell">
                    <div>${UTILS.formatTime(alert.timestamp + 'Z')}</div>
                    <div class="elapsed-time" data-timestamp="${alert.timestamp}" style="font-size: 0.85em; opacity: 0.7;">
                        Hace ${elapsedTime}
                    </div>
                </div>
            </td>
            <td class="actions">
                <button class="btn btn-details" data-id="${alert.emergency_id}" title="Ver detalles">
                    <span>👁️</span> Ver
                </button>
                ${!assignedUnit 
                    ? `<button class="btn btn-primary btn-asignar" data-id="${alert.emergency_id}" title="Asignar unidad">
                        <span>🚑</span> Asignar
                      </button>` 
                    : `<button class="btn btn-info btn-route" data-id="${alert.emergency_id}" title="Ver ruta">
                        <span>🗺️</span> Ruta
                      </button>`}
                <button class="btn btn-success btn-atendido" data-id="${alert.emergency_id}" title="Marcar como atendido">
                    <span>✓</span> Atendido
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function getTypeIcon(typeId) {
    const icons = {
        1: '🚗',  // Accidente de tráfico
        2: '🏥',  // Emergencia médica
        3: '🔥',  // Incendio
        4: '⚠️',  // Otro
    };
    return icons[typeId] || '🚨';
}

export function renderUserDetails(contentElement, user, kinCatalog) {
    const conditionsHtml = user.conditions?.length 
        ? user.conditions.map(c => `
            <li class="condition-item">
                <span class="condition-icon">💊</span>
                <span>${c.description}</span>
            </li>
          `).join('') 
        : '<li class="empty-state">Ninguna registrada</li>';
    
    const contactsHtml = user.emergency_contacts?.length 
        ? user.emergency_contacts.map(c => {
            const kinshipName = kinCatalog.find(k => k.kin_id === c.kin)?.kin_name || 'N/A';
            return `
                <li class="contact-item">
                    <div class="contact-header">
                        <span class="contact-icon">👤</span>
                        <strong>${c.contact_name}</strong>
                    </div>
                    <div class="contact-details">
                        <span class="contact-relation">${kinshipName}</span>
                        <a href="tel:${c.contact_phone}" class="contact-phone">📞 ${c.contact_phone}</a>
                    </div>
                </li>
            `;
          }).join('') 
        : '<li class="empty-state">Ninguno registrado</li>';

    const age = user.birthday ? calculateAge(user.birthday) : 'N/A';

    contentElement.innerHTML = `
        <button class="btn-close" id="close-user-dialog-btn">×</button>
        <div class="dialog-header">
            <div class="user-avatar">👤</div>
            <h3>Información del Usuario</h3>
        </div>
        
        <div class="user-info-grid">
            <div class="info-card">
                <div class="info-label">Nombre Completo</div>
                <div class="info-value">${user.name || 'N/A'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Teléfono</div>
                <div class="info-value">
                    <a href="tel:${user.phone}" class="phone-link">📱 ${user.phone || 'N/A'}</a>
                </div>
            </div>
            <div class="info-card">
                <div class="info-label">Edad</div>
                <div class="info-value">${age} años</div>
            </div>
            <div class="info-card">
                <div class="info-label">Fecha de Nacimiento</div>
                <div class="info-value">${user.birthday ? UTILS.formatDate(user.birthday) : 'N/A'}</div>
            </div>
        </div>

        <div class="section-divider"></div>

        <h4 class="section-title">
            <span class="section-icon">🏥</span>
            Condiciones Médicas
        </h4>
        <ul class="details-list medical-list">${conditionsHtml}</ul>

        <div class="section-divider"></div>

        <h4 class="section-title">
            <span class="section-icon">📞</span>
            Contactos de Emergencia
        </h4>
        <ul class="details-list contacts-list">${contactsHtml}</ul>
    `;
    
    document.getElementById('close-user-dialog-btn').onclick = () => contentElement.parentElement.close();
}

export function renderEmergencyDetails(contentElement, details, nearestUnit) {
    const statusText = traducirStatus(details.status);
    const typeText = details.accident_type?.description || 'N/A';
    const userName = details.user?.name || 'N/A';
    const unitName = details.assigned_unit_rel?.name || 'Sin asignar';
    
    const timestamp = UTILS.formatDateTime(details.timestamp);
    const elapsedMinutes = Math.floor((new Date() - new Date(details.timestamp + 'Z')) / 60000);

    let nearestUnitHtml = '';
    if (nearestUnit && !details.assigned_unit_rel) {
        nearestUnitHtml = `
            <div class="alert-info">
                <strong>💡 Unidad más cercana:</strong> ${nearestUnit.unit.name} 
                (${nearestUnit.distance.toFixed(2)} km - ~${Math.ceil(nearestUnit.distance * 2)} min)
            </div>
        `;
    }

    contentElement.innerHTML = `
        <button class="btn-close" id="close-emergency-details-btn">×</button>
        <div class="dialog-header emergency-header">
            <div class="emergency-icon ${statusText.replace('_','-')}">${getTypeIcon(details.tipo_accidente)}</div>
            <h3>Detalles de Emergencia #${details.emergency_id}</h3>
        </div>

        <div class="status-banner status-${statusText.replace('_','-')}">
            <span class="badge ${statusText.replace('_','-')}">${statusText}</span>
            <span class="elapsed-badge">⏱️ Hace ${elapsedMinutes} minutos</span>
        </div>

        ${nearestUnitHtml}
        
        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Tipo de Incidente</div>
                <div class="detail-value">${typeText}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Fecha y Hora</div>
                <div class="detail-value">${timestamp}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Ubicación</div>
                <div class="detail-value">
                    <a href="https://www.google.com/maps?q=${details.latitud},${details.longitud}" 
                       target="_blank" class="location-link">
                       📍 ${details.latitud.toFixed(6)}, ${details.longitud.toFixed(6)}
                    </a>
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Reportado por</div>
                <div class="detail-value">${userName}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Unidad Asignada</div>
                <div class="detail-value">
                    ${details.assigned_unit_rel 
                        ? `<span class="unit-tag">${unitName}</span>` 
                        : '<span class="muted">Sin asignar</span>'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">ID de Emergencia</div>
                <div class="detail-value"><code>#${details.emergency_id}</code></div>
            </div>
        </div>

        <div class="dialog-actions">
            <button class="btn" id="close-emergency-details-btn2">Cerrar</button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${details.latitud},${details.longitud}" 
               target="_blank" class="btn btn-primary">
               🗺️ Abrir en Google Maps
            </a>
        </div>
    `;
    
    document.getElementById('close-emergency-details-btn').onclick = () => contentElement.parentElement.close();
    document.getElementById('close-emergency-details-btn2').onclick = () => contentElement.parentElement.close();
}

function calculateAge(birthday) {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}