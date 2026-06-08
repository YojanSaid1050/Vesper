const fs = require('fs');
const path = require('path');
const { getDataPath } = require('../config/paths');

class CacheManager {
  constructor(baseDir) {
    this.baseDir = getDataPath(baseDir);
    this.cache = new Map();
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getFilePath(key) {
    return path.join(this.baseDir, `${key}.json`);
  }

  load(key, defaultValue = {}) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      this.save(key, defaultValue);
      return defaultValue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.cache.set(key, data);
      return data;
    } catch {
      return defaultValue;
    }
  }

  save(key, data) {
    try {
      const filePath = this.getFilePath(key);
      const tmpPath = `${filePath}.tmp`;
      
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpPath, filePath);
      
      this.cache.set(key, data);
      return true;
    } catch (error) {
      console.error(`Error saving cache ${key}:`, error);
      return false;
    }
  }

  delete(key) {
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    const files = fs.readdirSync(this.baseDir);
    for (const file of files) {
      fs.unlinkSync(path.join(this.baseDir, file));
    }
  }
}

module.exports = CacheManager;