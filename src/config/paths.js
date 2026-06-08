const path = require('path');

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), 'data');

function getDataPath(subpath = '') {
  return path.join(DATA_PATH, subpath);
}

module.exports = {
  DATA_PATH,
  getDataPath
};