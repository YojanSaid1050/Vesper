class ErrorHandler {
  static handle(error, context = 'General') {
    console.error(`[${context}] Error:`, error.message);
    
    if (error.stack && process.env.DEBUG === 'true') {
      console.error(`Stack:`, error.stack.split('\n').slice(0, 5).join('\n'));
    }

    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'RATE_LIMIT':
        return '⏰ Demasiadas solicitudes. Por favor, espera un momento.';
      case 'API_KEY':
        return '🔑 Error de API. Contacta al administrador.';
      case 'NOT_FOUND':
        return '🔍 No se encontró el recurso solicitado.';
      case 'PERMISSION':
        return '🔒 No tengo permisos para hacer eso.';
      case 'NETWORK':
        return '🌐 Error de red. Intenta nuevamente.';
      case 'TIMEOUT':
        return '⏱️ La solicitud expiró. Intenta nuevamente.';
      case 'DATABASE':
        return '💾 Error de base de datos. Contacta al administrador.';
      default:
        return '❌ Ocurrió un error inesperado.';
    }
  }

  static classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || '';
    
    if (message.includes('rate limit') || message.includes('429') || code === 'RATE_LIMIT') {
      return 'RATE_LIMIT';
    }
    if (message.includes('quota') || message.includes('api key') || message.includes('invalid key')) {
      return 'API_KEY';
    }
    if (message.includes('not found') || message.includes('404') || code === 'NOT_FOUND') {
      return 'NOT_FOUND';
    }
    if (message.includes('permission') || message.includes('403') || code === 'PERMISSION') {
      return 'PERMISSION';
    }
    if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
      return 'NETWORK';
    }
    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'TIMEOUT';
    }
    if (message.includes('mongodb') || message.includes('database')) {
      return 'DATABASE';
    }
    
    return 'UNKNOWN';
  }

  static async handleInteraction(interaction, error) {
    const message = this.handle(error, 'Interaction');
    
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: message });
      } else if (!interaction.replied) {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch (err) {
      console.error('Error al responder al usuario:', err.message);
    }
  }

  static logError(error, context, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      error: error.message,
      stack: error.stack,
      ...metadata
    };
    
    console.error(`[ERROR][${context}]`, JSON.stringify(logEntry, null, 2));
    
    // Opcional: Guardar en archivo de errores
    if (process.env.LOG_ERRORS === 'true') {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(process.cwd(), 'logs', 'errors.json');
      const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
      logs.push(logEntry);
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    }
  }
}

module.exports = ErrorHandler;