const colors = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m'
};

function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const color = { ERROR: colors.red, WARN: colors.yellow, SUCCESS: colors.green, INFO: colors.cyan }[level] || colors.reset;
  console.log(`${color}[${timestamp}] [${level}] ${message}${colors.reset}`, ...args);
}

function error(message, ...args) { log('ERROR', message, ...args); }
function warn(message, ...args) { log('WARN', message, ...args); }
function info(message, ...args) { log('INFO', message, ...args); }
function success(message, ...args) { log('SUCCESS', message, ...args); }

module.exports = { error, warn, info, success, log };