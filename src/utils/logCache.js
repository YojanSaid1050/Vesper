const recentLogs = new Set();

function createLog(key) {
  if (recentLogs.has(key)) return false;
  recentLogs.add(key);
  setTimeout(() => recentLogs.delete(key), 3000);
  return true;
}

module.exports = { createLog };