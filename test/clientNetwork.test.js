const test = require('node:test');
const assert = require('node:assert/strict');
const { clientNetwork } = require('../server/clientNetwork');

function request(headers = {}, remoteAddress = '127.0.0.1') {
  return { headers, socket: { remoteAddress } };
}

test('utilise les en-têtes Cloudflare quand le proxy est activé', () => {
  const previous = process.env.CLOUDFLARE_PROXY;
  process.env.CLOUDFLARE_PROXY = 'true';
  const network = clientNetwork(request({
    'cf-connecting-ip': '203.0.113.42',
    'cf-ipcountry': 'FR',
    'x-forwarded-for': '198.51.100.10'
  }));
  if (previous === undefined) delete process.env.CLOUDFLARE_PROXY;
  else process.env.CLOUDFLARE_PROXY = previous;

  assert.equal(network.ip, '203.0.113.42');
  assert.equal(network.countryCode, 'FR');
  assert.equal(network.source, 'cloudflare');
});

test('ignore un CF-Connecting-IP invalide', () => {
  const previous = process.env.CLOUDFLARE_PROXY;
  process.env.CLOUDFLARE_PROXY = 'true';
  const network = clientNetwork(request({
    'cf-connecting-ip': 'adresse-fausse',
    'cf-ipcountry': 'France',
    'x-forwarded-for': '198.51.100.10, 10.0.0.2'
  }));
  if (previous === undefined) delete process.env.CLOUDFLARE_PROXY;
  else process.env.CLOUDFLARE_PROXY = previous;

  assert.equal(network.ip, '127.0.0.1');
  assert.equal(network.countryCode, 'XX');
});
