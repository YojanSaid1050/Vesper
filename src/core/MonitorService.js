// src/core/MonitorService.js
const ErrorHandler = require('./ErrorHandler');

class MonitorService {
  constructor(options) {
    this.name = options.name;
    this.interval = options.interval || 120000;
    this.executeFunction = options.executeFunction;
    this.timer = null;
    this.isRunning = false;
    this.client = null;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors || 5;
    this.lastRunTime = 0;
    this.totalRuns = 0;
    this.successfulRuns = 0;
    this.failedRuns = 0;
    this.lastError = null;
  }

  start(client) {
    this.client = client;
    
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.run();
    this.timer = setInterval(() => this.run(), this.interval);
    console.log(`✅ Monitor ${this.name} iniciado (intervalo: ${this.interval / 1000}s)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(`🛑 Monitor ${this.name} detenido`);
    }
  }

  async run() {
    if (this.isRunning) {
      console.log(`⏭️ Monitor ${this.name} ya está ejecutándose, omitiendo...`);
      return;
    }

    this.isRunning = true;

    try {
      const startTime = Date.now();
      const result = await this.executeFunction(this.client);
      const duration = Date.now() - startTime;
      
      this.consecutiveErrors = 0;
      this.successfulRuns++;
      this.totalRuns++;
      this.lastRunTime = startTime;
      
      if (duration > this.interval) {
        console.warn(`⚠️ Monitor ${this.name} tardó ${duration}ms (intervalo: ${this.interval}ms)`);
      }
      
      return result;
    } catch (err) {
      this.consecutiveErrors++;
      this.failedRuns++;
      this.totalRuns++;
      this.lastError = err;
      
      let error = err;
      if (!(error instanceof Error)) {
        error = new Error(String(error));
      }
      
      ErrorHandler.logError(error, `Monitor ${this.name}`, { 
        consecutiveErrors: this.consecutiveErrors,
        maxConsecutiveErrors: this.maxConsecutiveErrors
      });
      
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.error(`❌ Monitor ${this.name} detenido por ${this.consecutiveErrors} errores consecutivos`);
        this.stop();
      }
      
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async runManual() {
    if (this.isRunning) {
      console.log(`⚠️ Monitor ${this.name} ya está ejecutándose`);
      return { success: false, reason: 'already_running' };
    }
    
    this.isRunning = true;
    let result = null;
    
    try {
      result = await this.executeFunction(this.client);
      
      if (result && typeof result === 'object' && 'success' in result) {
        return result;
      }
      
      return { success: true, data: result };
    } catch (err) {
      let error = err;
      if (!(error instanceof Error)) {
        error = new Error(String(error));
      }
      
      ErrorHandler.logError(error, `Monitor ${this.name} (Manual)`);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  getStats() {
    return {
      name: this.name,
      interval: this.interval,
      isRunning: this.isRunning,
      consecutiveErrors: this.consecutiveErrors,
      isActive: this.timer !== null,
      totalRuns: this.totalRuns,
      successfulRuns: this.successfulRuns,
      failedRuns: this.failedRuns,
      lastRunTime: this.lastRunTime ? new Date(this.lastRunTime).toISOString() : null,
      lastError: this.lastError ? this.lastError.message : null
    };
  }

  // Método para actualizar intervalo dinámicamente
  updateInterval(newInterval) {
    this.interval = newInterval;
    if (this.timer) {
      this.stop();
      this.start(this.client);
      console.log(`🔄 Monitor ${this.name} intervalo actualizado a ${newInterval / 1000}s`);
    }
  }
}

module.exports = MonitorService;