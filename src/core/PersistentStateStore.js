const CacheManager = require('./CacheManager');
const MonitorState = require('../database/models/MonitorState');
const { connectMongo } = require('../database/mongoManager');

class PersistentStateStore {
  constructor(namespace) {
    this.namespace = String(namespace || 'monitor').replace(/[^a-zA-Z0-9_-]/g, '_');
    this.fallback = new CacheManager(`./data/${this.namespace}`);
  }

  stateKey(key) {
    return `${this.namespace}:${key}`;
  }

  clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async load(key, defaultValue = {}) {
    const fallbackValue = this.fallback.load(key, defaultValue);

    try {
      await connectMongo();
      const document = await MonitorState.findOne({ key: this.stateKey(key) }).lean();
      if (!document) {
        await this.save(key, fallbackValue);
        return this.clone(fallbackValue);
      }

      this.fallback.save(key, document.value);
      return this.clone(document.value);
    } catch (error) {
      console.warn(`[State] MongoDB no disponible para ${this.stateKey(key)}; usando respaldo local: ${error.message}`);
      return this.clone(fallbackValue);
    }
  }

  async save(key, value) {
    this.fallback.save(key, value);

    try {
      await connectMongo();
      await MonitorState.findOneAndUpdate(
        { key: this.stateKey(key) },
        { $set: { value: this.clone(value) } },
        { upsert: true, returnDocument: 'after' }
      );
      return true;
    } catch (error) {
      console.warn(`[State] No se pudo persistir ${this.stateKey(key)} en MongoDB: ${error.message}`);
      return false;
    }
  }

  async delete(key) {
    this.fallback.delete(key);
    try {
      await connectMongo();
      await MonitorState.deleteOne({ key: this.stateKey(key) });
      return true;
    } catch (error) {
      console.warn(`[State] No se pudo eliminar ${this.stateKey(key)} de MongoDB: ${error.message}`);
      return false;
    }
  }
}

module.exports = PersistentStateStore;
