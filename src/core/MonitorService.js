class MonitorService {
  constructor(options) {
    this.name = options.name;
    this.interval = options.interval || 120000;
    this.executeFunction = options.executeFunction;
    this.timer = null;
    this.isRunning = false;
    this.client = null;
  }

  start(client) {
    this.client = client;
    
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.run();
    this.timer = setInterval(() => this.run(), this.interval);
    console.log(`Monitor ${this.name} iniciado (intervalo: ${this.interval / 1000}s)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(`Monitor ${this.name} detenido`);
    }
  }

  async run() {
    if (this.isRunning) {
      console.log(`Monitor ${this.name} ya está ejecutándose, omitiendo...`);
      return;
    }

    this.isRunning = true;

    try {
      await this.executeFunction(this.client);
    } catch (error) {
      console.error(`Error en monitor ${this.name}:`, error);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = MonitorService;