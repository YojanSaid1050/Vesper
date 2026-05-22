const recentLogs = new Set();

function createLog(key) {

  // Si ya existe → cancelar

  if (recentLogs.has(key)) {
    return false;
  }

  // Guardar log temporalmente

  recentLogs.add(key);

  // Borrarlo después de 3 segundos

  setTimeout(() => {
    recentLogs.delete(key);
  }, 3000);

  return true;
}

module.exports = {
  createLog
};