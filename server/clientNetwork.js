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
  const rawCloudflareIp = firstHeaderValue(req.headers['cf-connecting-ip']);
  const rawCloudflareCountry = firstHeaderValue(req.headers['cf-ipcountry']);
  const cloudflareIp = cloudflareEnabled
    ? validIp(rawCloudflareIp)
    : null;
  const forwardedIp = cloudflareEnabled ? null : validIp(req.headers['x-forwarded-for']);
  const socketIp = validIp(req.socket?.remoteAddress);

  return {
    ip: cloudflareIp || forwardedIp || socketIp || null,
    countryCode: cloudflareEnabled
      ? validCountry(rawCloudflareCountry) || 'XX'
      : 'XX',
    source: cloudflareIp ? 'cloudflare' : forwardedIp ? 'forwarded' : 'socket',
    rawCloudflareIp: rawCloudflareIp || null,
    rawCloudflareCountry: rawCloudflareCountry || null
  };
}

function attachClientNetwork(req, res, next) {
  req.clientNetwork = clientNetwork(req);
  if (process.env.NETWORK_DEBUG === 'true') {
    console.log(
      `[Network] source=${req.clientNetwork.source}`
      + ` ip=${req.clientNetwork.ip || 'inconnue'}`
      + ` cf-ip=${req.clientNetwork.rawCloudflareIp || 'absente'}`
      + ` cf-country=${req.clientNetwork.rawCloudflareCountry || 'absent'}`
      + ` country=${req.clientNetwork.countryCode}`
    );
  }
  next();
}

module.exports = { attachClientNetwork, clientNetwork };
