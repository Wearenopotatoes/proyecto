// config.js - Configuración centralizada del proyecto

export const CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'https://api.loralink.live',
        KEY: 'linkONxM0Jn',
        TIMEOUT: 10000, // 10 segundos
        RETRY_ATTEMPTS: 3
    },

    // Map Configuration
    MAP: {
        INITIAL_CENTER: [13.7942, -88.8965], // San Salvador
        INITIAL_ZOOM: 9,
        MAX_ZOOM: 18,
        MIN_ZOOM: 7
    },

    // Polling Intervals (ms)
    REFRESH: {
        DASHBOARD: 5000,      // 5 segundos
        ANALYTICS: 30000,     // 30 segundos
        UNITS: 10000          // 10 segundos
    },

    // Timezone
    TIMEZONE: 'America/El_Salvador',
    GMT_OFFSET: -6,

    // Emergency Status
    STATUS: {
        PENDING: 1,
        IN_PROGRESS: 2,
        RESOLVED: 3
    },

    STATUS_LABELS: {
        1: 'accidente',
        2: 'en_camino',
        3: 'atendido'
    },

    // Notification Settings
    NOTIFICATIONS: {
        ENABLED: true,
        SOUND: true,
        DURATION: 5000 // ms
    },

    // Feature Flags
    FEATURES: {
        ANALYTICS: true,
        EXPORT: true,
        NOTIFICATIONS: true,
        ROUTE_OPTIMIZATION: true,
        HEATMAP: true
    }
};

// Utility functions
export const UTILS = {
    formatTime: (date) => {
        return new Date(date).toLocaleTimeString('es-SV', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: CONFIG.TIMEZONE
        });
    },

    formatDate: (date) => {
        return new Date(date).toLocaleDateString('es-SV', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: CONFIG.TIMEZONE
        });
    },

    formatDateTime: (date) => {
        return new Date(date + 'Z').toLocaleString('es-SV', {
            timeZone: CONFIG.TIMEZONE,
            hour12: false,
            dateStyle: 'short',
            timeStyle: 'short'
        });
    },

    calculateDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    getStatusClass: (statusId) => {
        return CONFIG.STATUS_LABELS[statusId] || 'desconocido';
    }
};