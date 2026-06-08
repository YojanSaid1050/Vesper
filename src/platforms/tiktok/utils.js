function normalize(username) {
  if (!username) return '';
  return username.toLowerCase().trim().replace('@', '');
}

module.exports = { normalize };