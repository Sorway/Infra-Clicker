const test = require('node:test');
const assert = require('node:assert/strict');
const { hydrateLegacyState } = require('../server/gameRepository');

test('normalise une ancienne sauvegarde JSON pour le schéma relationnel', () => {
  const state = hydrateLegacyState({
    version: 2,
    requests: 42,
    buildings: { bash: 3 },
    upgrades: ['ssd'],
    certifications: ['lpic'],
    clickWindow: [100, 200]
  });

  assert.equal(state.requests, 42);
  assert.equal(state.buildings.bash, 3);
  assert.equal(state.buildings.worldcloud, 0);
  assert.deepEqual(state.upgrades, ['ssd']);
  assert.deepEqual(state.certifications, ['lpic']);
  assert.deepEqual(state.clickWindow, [100, 200]);
});

test('remplace les collections JSON invalides par des collections sûres', () => {
  const state = hydrateLegacyState({
    buildings: null,
    upgrades: 'ssd',
    certifications: {},
    clickWindow: null
  });

  assert.deepEqual(state.upgrades, []);
  assert.deepEqual(state.certifications, []);
  assert.deepEqual(state.clickWindow, []);
  assert.equal(state.buildings.bash, 0);
});
