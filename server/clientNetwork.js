const net = require('net');

function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim();
}

function validIp(value) {
  const ip = firstHeaderValue(value);
  return net.isIP(ip) ? ip : null;
}

function validCountry(value) {
  const country = firstHeaderValue(value).toUpperCase();
  return /^(?:[A-Z]{2}|T1)$/.test(country) ? country : null;
}

function clientNetwork(req) {
  const cloudflareEnabled = process.env.CLOUDFLARE_PROXY === 'true';
  const cloudflareIp = cloudflareEnabled
    ? validIp(req.headers['cf-connecting-ip'])
    : null;
  const forwardedIp = cloudflareEnabled ? null : validIp(req.headers['x-forwarded-for']);
  const socketIp = validIp(req.socket?.remoteAddress);

  return {
    ip: cloudflareIp || forwardedIp || socketIp || null,
    countryCode: cloudflareEnabled
      ? validCountry(req.headers['cf-ipcountry']) || 'XX'
      : 'XX',
    source: cloudflareIp ? 'cloudflare' : forwardedIp ? 'forwarded' : 'socket'
  };
}

function attachClientNetwork(req, res, next) {
  req.clientNetwork = clientNetwork(req);
  next();
}

module.exports = { attachClientNetwork, clientNetwork };
