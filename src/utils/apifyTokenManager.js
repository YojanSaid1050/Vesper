// src/utils/apifyTokenManager.js
const { ApifyClient } = require('apify');

/**
 * Apify Token Manager - Maneja múltiples tokens con rotación automática
 * 
 * Características:
 * - Rotación automática cuando un token se queda sin créditos
 * - Detección de errores (rate limit, timeout, créditos insuficientes)
 * - Caché de clientes por token
 * - Estadísticas de uso por token
 */

class ApifyTokenManager {
    constructor() {
        // Obtener tokens del .env
        const tokensStr = process.env.APIFY_TOKENS || process.env.APIFY_TOKEN;
        this.tokens = tokensStr ? tokensStr.split(',').map(t => t.trim()).filter(t => t) : [];
        
        if (this.tokens.length === 0) {
            console.error('❌ No hay tokens de Apify configurados');
            throw new Error('APIFY_TOKENS no configurado');
        }
        
        this.currentIndex = 0;
        this.clients = new Map(); // Cache de clientes por token
        this.tokenStatus = new Map(); // Estado de cada token
        
        // Inicializar estado de tokens
        this.tokens.forEach(token => {
            this.tokenStatus.set(token, {
                isActive: true,
                consecutiveErrors: 0,
                totalErrors: 0,
                totalSuccess: 0,
                lastError: null,
                lastSuccess: null,
                creditsRemaining: null,
                tokenPrefix: token.substring(0, 20) + '...'
            });
        });
        
        console.log(`🎫 Apify Token Manager inicializado con ${this.tokens.length} tokens`);
        this.tokens.forEach((_, i) => {
            const status = this.tokenStatus.get(this.tokens[i]);
            console.log(`   Token ${i + 1}: ${status.tokenPrefix} (activo)`);
        });
    }
    
    /**
     * Obtener cliente de Apify para el token actual
     */
    getCurrentClient() {
        const token = this.getCurrentToken();
        
        if (!this.clients.has(token)) {
            this.clients.set(token, new ApifyClient({ token }));
            console.log(`🔑 Cliente creado para token: ${token.substring(0, 20)}...`);
        }
        
        return this.clients.get(token);
    }
    
    /**
     * Obtener el token actual
     */
    getCurrentToken() {
        return this.tokens[this.currentIndex];
    }
    
    /**
     * Cambiar al siguiente token activo
     * @returns {string|null} El nuevo token o null si todos están inactivos
     */
    rotateToNextToken() {
        const previousToken = this.getCurrentToken();
        const previousStatus = this.tokenStatus.get(previousToken);
        
        // Buscar siguiente token activo
        let attempts = 0;
        let newIndex = this.currentIndex;
        
        while (attempts < this.tokens.length) {
            newIndex = (newIndex + 1) % this.tokens.length;
            const candidateToken = this.tokens[newIndex];
            const candidateStatus = this.tokenStatus.get(candidateToken);
            
            if (candidateStatus.isActive) {
                this.currentIndex = newIndex;
                console.log(`🔄 Rotando token: ${previousStatus.tokenPrefix} → ${candidateStatus.tokenPrefix}`);
                return this.getCurrentToken();
            }
            attempts++;
        }
        
        // Si todos están inactivos, resetear y usar el primero
        console.warn('⚠️ Todos los tokens están inactivos, resetear estado');
        this.resetAllTokens();
        this.currentIndex = 0;
        return this.getCurrentToken();
    }
    
    /**
     * Reportar error en el token actual
     * @param {Error} error - El error ocurrido
     * @returns {string} El nuevo token a usar
     */
    reportError(error) {
        const currentToken = this.getCurrentToken();
        const status = this.tokenStatus.get(currentToken);
        
        status.consecutiveErrors++;
        status.totalErrors++;
        status.lastError = {
            message: error.message || String(error),
            timestamp: Date.now()
        };
        
        console.warn(`⚠️ Error en token ${status.tokenPrefix}: ${error.message?.substring(0, 100)} (error ${status.consecutiveErrors})`);
        
        // Detectar si es error de créditos insuficientes
        const isCreditError = error.message?.toLowerCase().includes('credit') ||
                              error.message?.toLowerCase().includes('insufficient') ||
                              error.message?.toLowerCase().includes('quota') ||
                              error.message?.toLowerCase().includes('balance');
        
        // Detectar rate limit
        const isRateLimit = error.message?.toLowerCase().includes('rate limit') ||
                            error.message?.toLowerCase().includes('429');
        
        if (isCreditError) {
            console.error(`❌ Token ${status.tokenPrefix} SIN CRÉDITOS, desactivando...`);
            status.isActive = false;
            status.creditsRemaining = 0;
        } else if (status.consecutiveErrors >= 3) {
            console.error(`❌ Token ${status.tokenPrefix} desactivado por ${status.consecutiveErrors} errores consecutivos`);
            status.isActive = false;
        } else if (isRateLimit) {
            console.log(`⏳ Token ${status.tokenPrefix} en rate limit, se reintentará más tarde`);
            // No desactivar por rate limit, solo rotar temporalmente
        }
        
        // Rotar al siguiente token
        return this.rotateToNextToken();
    }
    
    /**
     * Reportar éxito en el token actual
     */
    reportSuccess() {
        const currentToken = this.getCurrentToken();
        const status = this.tokenStatus.get(currentToken);
        
        status.consecutiveErrors = 0;
        status.totalSuccess++;
        status.lastSuccess = Date.now();
        
        // Reactivar token si estaba desactivado
        if (!status.isActive) {
            status.isActive = true;
            console.log(`🔄 Token ${status.tokenPrefix} reactivado`);
        }
    }
    
    /**
     * Resetear todos los tokens (útil para reintentos globales)
     */
    resetAllTokens() {
        this.tokens.forEach(token => {
            const status = this.tokenStatus.get(token);
            if (status) {
                status.isActive = true;
                status.consecutiveErrors = 0;
            }
        });
        console.log('🔄 Todos los tokens han sido reactivados');
    }
    
    /**
     * Ejecutar una función con reintentos y rotación de tokens
     * @param {Function} fn - Función que recibe un cliente de Apify
     * @param {string} context - Contexto para logs
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<any>}
     */
    async executeWithRetry(fn, context, options = {}) {
        const maxTokenRetries = options.maxTokenRetries || this.tokens.length;
        const maxAttemptsPerToken = options.maxAttemptsPerToken || 2;
        
        let lastError = null;
        
        for (let tokenAttempt = 0; tokenAttempt < maxTokenRetries; tokenAttempt++) {
            const client = this.getCurrentClient();
            const currentToken = this.getCurrentToken();
            
            for (let attempt = 0; attempt < maxAttemptsPerToken; attempt++) {
                try {
                    const result = await fn(client);
                    this.reportSuccess();
                    return result;
                } catch (error) {
                    lastError = error;
                    console.warn(`⚠️ Error en ${context} (token ${this.tokenStatus.get(currentToken)?.tokenPrefix}, intento ${attempt + 1}/${maxAttemptsPerToken}): ${error.message}`);
                    
                    // Si es error de créditos, rotar token inmediatamente
                    const isCreditError = error.message?.toLowerCase().includes('credit') ||
                                          error.message?.toLowerCase().includes('insufficient');
                    
                    if (isCreditError || attempt === maxAttemptsPerToken - 1) {
                        this.reportError(error);
                        break; // Salir del bucle de intentos, rotar token
                    }
                    
                    // Esperar antes de reintentar
                    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
                }
            }
        }
        
        throw lastError || new Error(`Todos los tokens fallaron para ${context}`);
    }
    
    /**
     * Obtener estadísticas de los tokens
     */
    getStats() {
        const stats = [];
        for (let i = 0; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            const status = this.tokenStatus.get(token);
            stats.push({
                index: i + 1,
                isActive: status.isActive,
                isCurrent: i === this.currentIndex,
                tokenPrefix: status.tokenPrefix,
                consecutiveErrors: status.consecutiveErrors,
                totalErrors: status.totalErrors,
                totalSuccess: status.totalSuccess,
                lastError: status.lastError,
                creditsRemaining: status.creditsRemaining
            });
        }
        return stats;
    }
    
    /**
     * Verificar si hay al menos un token activo
     */
    hasActiveToken() {
        return this.tokens.some(token => this.tokenStatus.get(token)?.isActive);
    }
}

// Singleton
let instance = null;

function getApifyTokenManager() {
    if (!instance) {
        instance = new ApifyTokenManager();
    }
    return instance;
}

module.exports = { getApifyTokenManager };