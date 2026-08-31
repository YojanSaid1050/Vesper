const fs = require('fs');
const path = require('path');
const { getDataPath } = require('../config/paths');

// Una caché compartida evita que distintas instancias mantengan copias
// incompatibles del mismo archivo dentro de un único proceso.
const sharedCache = new Map();

class CacheManager {
  constructor(baseDir) {
    const normalizedDir = String(baseDir || '')
      .replace(/^[.\\/]*data[\\/]?/, '')
      .replace(/^[\\/]+/, '');
    this.baseDir = getDataPath(normalizedDir);
    this.cache = sharedCache;
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
      console.log(`📁 Directorio de caché creado: ${this.baseDir}`);
    }
  }

  getFilePath(key) {
    // Sanitizar key para evitar problemas con caracteres especiales
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, `${sanitizedKey}.json`);
  }

  load(key, defaultValue = {}) {
    const filePath = this.getFilePath(key);
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    if (!fs.existsSync(filePath)) {
      this.save(key, defaultValue);
      return defaultValue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.cache.set(filePath, data);
      return data;
    } catch (error) {
      console.error(`Error loading cache ${key}:`, error.message);
      return defaultValue;
    }
  }

  save(key, data) {
    try {
      const filePath = this.getFilePath(key);
      const tmpPath = `${filePath}.tmp`;
      
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpPath, filePath);
      
      this.cache.set(filePath, data);
      return true;
    } catch (error) {
      console.error(`Error saving cache ${key}:`, error.message);
      return false;
    }
  }

  has(key) {
    const filePath = this.getFilePath(key);
    return this.cache.has(filePath) || fs.existsSync(filePath);
  }

  delete(key) {
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.cache.delete(filePath);
  }

  clear() {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${this.baseDir}${path.sep}`)) this.cache.delete(key);
    }
    try {
      const files = fs.readdirSync(this.baseDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.baseDir, file));
      }
      console.log(`🗑️ Caché limpiado: ${this.baseDir}`);
    } catch (error) {
      console.error(`Error clearing cache:`, error.message);
    }
  }

  getStats() {
    let fileCount = 0;
    let fileSize = 0;
    
    try {
      const files = fs.readdirSync(this.baseDir);
      fileCount = files.length;
      
      for (const file of files) {
        const stats = fs.statSync(path.join(this.baseDir, file));
        fileSize += stats.size;
      }
    } catch (error) {
      console.error(`Error getting cache stats:`, error.message);
    }
    
    const memoryEntries = [...this.cache.keys()]
      .filter(key => key.startsWith(`${this.baseDir}${path.sep}`)).length;

    return {
      memoryEntries,
      fileCount: fileCount,
      totalSizeKB: (fileSize / 1024).toFixed(2)
    };
  }
}

module.exports = CacheManager;
