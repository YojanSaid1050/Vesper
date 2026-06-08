class ErrorHandler {
  static handle(error, context = 'General') {
    console.error(`[${context}] Error:`, error.message);
    
    if (error.stack) {
      console.error(`Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
    }

    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'RATE_LIMIT':
        return 'Demasiadas solicitudes. Por favor, espera un momento.';
      case 'API_KEY':
        return 'Error de API. Contacta al administrador.';
      case 'NOT_FOUND':
        return 'No se encontró el recurso solicitado.';
      case 'PERMISSION':
        return 'No tengo permisos para hacer eso.';
      default:
        return 'Ocurrió un error inesperado.';
    }
  }

  static classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('rate limit') || message.includes('429')) {
      return 'RATE_LIMIT';
    }
    if (message.includes('quota') || message.includes('api key')) {
      return 'API_KEY';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }
    if (message.includes('permission') || message.includes('403')) {
      return 'PERMISSION';
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
    } catch {}
  }
}

module.exports = ErrorHandler;