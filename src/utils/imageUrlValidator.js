const dns = require('dns').promises;
const net = require('net');

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10
      || a === 127
      || a === 0
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
      || a >= 224;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb');
  }

  return true;
}

async function assertPublicHost(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    throw new Error('Host no permitido');
  }

  if (net.isIP(normalized)) {
    if (isPrivateIp(normalized)) throw new Error('Dirección privada no permitida');
    return;
  }

  const addresses = await dns.lookup(normalized, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
    throw new Error('El host no es público');
  }
}

async function isValidImageUrl(input, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const maxRedirects = options.maxRedirects || 3;
  const maxBytes = options.maxBytes || 10 * 1024 * 1024;

  try {
    let currentUrl = new URL(input);

    for (let redirect = 0; redirect <= maxRedirects; redirect++) {
      if (currentUrl.protocol !== 'https:') return false;
      await assertPublicHost(currentUrl.hostname);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === maxRedirects) return false;
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (!response.ok) return false;
      const contentType = response.headers.get('content-type') || '';
      const contentLength = Number(response.headers.get('content-length') || 0);
      return contentType.startsWith('image/') && (!contentLength || contentLength <= maxBytes);
    }
  } catch {
    return false;
  }

  return false;
}

module.exports = { isValidImageUrl, isPrivateIp };
