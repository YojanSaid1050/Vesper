// src/utils/logger.js
const fs = require('fs').promises;
const path = require('path');
const { createLog } = require('./logCache');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m'
};

const LOG_DIR = path.join(process.cwd(), 'logs');
let logQueue = [];
let isWriting = false;

async function ensureLogDir() {
    try {
        await fs.access(LOG_DIR);
    } catch {
        await fs.mkdir(LOG_DIR, { recursive: true });
    }
}

async function writeToFile(level, message, timestamp) {
    await ensureLogDir();
    
    const date = new Date(timestamp).toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `${date}_${level}.log`);
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    logQueue.push({ file: logFile, line: logLine });
    
    if (!isWriting) {
        isWriting = true;
        while (logQueue.length > 0) {
            const { file, line } = logQueue.shift();
            try {
                await fs.appendFile(file, line);
            } catch (error) {
                console.error(`Failed to write to log file: ${error.message}`);
            }
        }
        isWriting = false;
    }
}

function formatMessage(message, args) {
    let formattedMessage = message;
    
    if (args && args.length > 0) {
        let argIndex = 0;
        formattedMessage = message.replace(/%s/g, () => {
            const arg = args[argIndex++];
            if (arg === undefined) return '%s';
            if (typeof arg === 'object') return JSON.stringify(arg);
            return String(arg);
        });
        
        if (argIndex < args.length) {
            const remaining = args.slice(argIndex).map(a => 
                typeof a === 'object' ? JSON.stringify(a) : String(a)
            ).join(' ');
            formattedMessage += ' ' + remaining;
        }
    }
    
    return formattedMessage;
}

function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const color = {
        ERROR: colors.red,
        WARN: colors.yellow,
        SUCCESS: colors.green,
        INFO: colors.cyan,
        DEBUG: colors.magenta
    }[level] || colors.reset;
    
    const formattedMessage = formatMessage(message, args);
    
    console.log(`${color}[${timestamp}] [${level}] ${formattedMessage}${colors.reset}`);
    
    if (level !== 'DEBUG' || process.env.LOG_DEBUG === 'true') {
        writeToFile(level, formattedMessage, timestamp).catch(console.error);
    }
}

function error(message, ...args) {
    const cacheKey = `error_${String(message).substring(0, 50)}`;
    if (createLog(cacheKey, 3000)) {
        log('ERROR', message, ...args);
    }
}

function warn(message, ...args) {
    const cacheKey = `warn_${String(message).substring(0, 50)}`;
    if (createLog(cacheKey, 2000)) {
        log('WARN', message, ...args);
    }
}

function info(message, ...args) {
    log('INFO', message, ...args);
}

function success(message, ...args) {
    log('SUCCESS', message, ...args);
}

function debug(message, ...args) {
    if (process.env.DEBUG === 'true') {
        log('DEBUG', message, ...args);
    }
}

function monitor(platform, action, guildId, details = {}) {
    const detailsStr = Object.entries(details)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
    const message = `[${platform}] ${action} | Guild: ${guildId || 'global'}${detailsStr ? ` | ${detailsStr}` : ''}`;
    info(message);
}

// ==================================================
// CORREGIDA: Manejo seguro de errores para monitorError
// ==================================================
function monitorError(platform, action, guildId, error, details = {}) {
    let errorMessage = 'Error desconocido';
    
    // SANEAMIENTO COMPLETO DEL ERROR
    if (typeof error === 'function') {
        errorMessage = `Se recibió una función (${error.name || 'anonymous'}) como error. Verifica el código.`;
    } else if (!error) {
        errorMessage = 'Error vacío o indefinido';
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (typeof error === 'object') {
        try {
            // Intentar obtener message si existe
            if (error.message && typeof error.message === 'string') {
                errorMessage = error.message;
            } else if (error.error && typeof error.error === 'string') {
                errorMessage = error.error;
            } else {
                errorMessage = JSON.stringify(error);
            }
        } catch (e) {
            errorMessage = String(error);
        }
    } else {
        errorMessage = String(error);
    }
    
    // Limitar longitud del mensaje para la cache key
    const cacheKey = `${platform}_${action}_${guildId || 'global'}_${errorMessage.substring(0, 30)}`;
    
    if (createLog(cacheKey, 10000)) {
        const detailsStr = Object.entries(details)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');
        const logMessage = `[${platform}] ${action} | Guild: ${guildId || 'global'} | Error: ${errorMessage}${detailsStr ? ` | ${detailsStr}` : ''}`;
        error(logMessage);
    }
}

async function cleanOldLogs(daysToKeep = 7) {
    await ensureLogDir();
    
    try {
        const files = await fs.readdir(LOG_DIR);
        const now = Date.now();
        const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
        let deleted = 0;
        
        for (const file of files) {
            const filePath = path.join(LOG_DIR, file);
            try {
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > maxAge) {
                    await fs.unlink(filePath);
                    deleted++;
                }
            } catch (err) {
                // Ignorar errores de archivos individuales
            }
        }
        
        if (deleted > 0) {
            console.log(`🗑️ Deleted ${deleted} old log files (older than ${daysToKeep} days)`);
        }
    } catch (err) {
        // Si el directorio no existe o hay otro error, lo ignoramos
    }
}

// Limpiar logs al inicio y periódicamente
cleanOldLogs(7).catch(() => {});
setInterval(() => {
    cleanOldLogs(7).catch(() => {});
}, 24 * 60 * 60 * 1000);

module.exports = { 
    error, 
    warn, 
    info, 
    success, 
    debug,
    monitor,
    monitorError,
    log,
    cleanOldLogs
};