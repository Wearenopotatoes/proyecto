// notifications.js - Sistema de notificaciones y alertas

import { CONFIG } from './config.js';

class NotificationManager {
    constructor() {
        this.container = null;
        this.audio = null;
        this.previousEmergencies = new Set();
        this.init();
    }

    init() {
        // Crear contenedor de notificaciones
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);

        // Preparar audio de alerta
        this.audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZVRQMUZXW8cN0KAUth8r01YM4CBl0x/Lfk0gMDlKk5O2rYBoGO5LY8s1zKwUme8n03YY7CBp4yPLhjlAOC1am5e6uZx4FO5Pe8sd0LAUne8r02YY7CBt8yfHgjlEPC1Wl5u6wah4GOZPe88h1LAYpe8z134c7CBx+yvLgjlEPC1Sl5+6xax4HOZP');

        // Solicitar permisos de notificación del navegador
        if (CONFIG.NOTIFICATIONS.ENABLED && 'Notification' in window) {
            Notification.requestPermission();
        }
    }

    checkNewEmergencies(emergencies) {
        if (!CONFIG.NOTIFICATIONS.ENABLED) return;

        const currentIds = new Set(emergencies.map(e => e.emergency_id));
        
        emergencies.forEach(emergency => {
            if (!this.previousEmergencies.has(emergency.emergency_id) && 
                emergency.status === CONFIG.STATUS.PENDING) {
                this.showNotification(emergency);
            }
        });

        this.previousEmergencies = currentIds;
    }

    showNotification(emergency) {
        // Notificación visual en la app
        this.showInAppNotification(emergency);

        // Sonido de alerta
        if (CONFIG.NOTIFICATIONS.SOUND) {
            this.playSound();
        }

        // Notificación del navegador
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 Nueva Emergencia', {
                body: `${emergency.accident_type?.description || 'Incidente'} - ${emergency.user?.name || 'Usuario desconocido'}`,
                icon: '/static/images/logo.png',
                badge: '/static/images/badge.png',
                tag: `emergency-${emergency.emergency_id}`,
                requireInteraction: false
            });
        }
    }

    showInAppNotification(emergency) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-error';
        
        const typeText = emergency.accident_type?.description || 'Incidente';
        const userName = emergency.user?.name || 'Usuario desconocido';
        
        notification.innerHTML = `
            <div class="notification-icon">🚨</div>
            <div class="notification-content">
                <div class="notification-title">Nueva Emergencia</div>
                <div class="notification-message">${typeText} - ${userName}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(notification);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            notification.classList.add('notification-fade-out');
            setTimeout(() => notification.remove(), 300);
        }, CONFIG.NOTIFICATIONS.DURATION);
    }

    showSuccess(message) {
        this.showCustomNotification(message, 'success', '✓');
    }

    showError(message) {
        this.showCustomNotification(message, 'error', '✕');
    }

    showInfo(message) {
        this.showCustomNotification(message, 'info', 'ℹ');
    }

    showCustomNotification(message, type = 'info', icon = 'ℹ') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('notification-fade-out');
            setTimeout(() => notification.remove(), 300);
        }, CONFIG.NOTIFICATIONS.DURATION);
    }

    playSound() {
        if (this.audio) {
            this.audio.currentTime = 0;
            this.audio.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
        }
    }
}

// Exportar instancia única
export const notificationManager = new NotificationManager();