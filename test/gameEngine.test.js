const test = require('node:test');
const assert = require('node:assert/strict');
const {
  capacityEfficiency,
  createState,
  publicState,
  synchronizeState
} = require('../server/gameEngine');

test('synchronise un instantané de progression calculé par le client', () => {
  const state = createState();
  synchronizeState(state, {
    requests: 1234,
    lifetimeRequests: 5678,
    allTimeRequests: 9012,
    manualClicks: 42,
    criticalClicks: 3,
    bestCombo: 20,
    combo: 4,
    lastManualClick: Date.now(),
    overclockCharge: 75,
    buildings: { bash: 5 },
    upgrades: ['cat5'],
    certifications: [],
    certificationPoints: 2,
    prestigeCount: 1,
    totalBuildingsPurchased: 5,
    startedAt: Date.now() - 1000
  });

  assert.equal(state.requests, 1234);
  assert.equal(state.manualClicks, 42);
  assert.equal(state.buildings.bash, 5);
  assert.deepEqual(state.upgrades, ['cat5']);
});

test('ignore les identifiants inconnus pendant la synchronisation', () => {
  const state = createState();
  synchronizeState(state, {
    buildings: { inconnu: 999 },
    upgrades: ['inconnu'],
    certifications: ['inconnue']
  });

  assert.equal(Object.hasOwn(state.buildings, 'inconnu'), false);
  assert.deepEqual(state.upgrades, []);
  assert.deepEqual(state.certifications, []);
});

test('retombe sur le DLC infra pour un DLC supprimé', () => {
  const state = createState('space');
  assert.equal(state.dlcId, 'infra');
  assert.equal(Object.hasOwn(state.buildings, 'bash'), true);
  assert.equal(Object.hasOwn(state.buildings, 'probe'), false);

  synchronizeState(state, {
    dlcId: 'space',
    requests: 500,
    buildings: { probe: 3, bash: 99 },
    upgrades: ['ion-drive', 'ssd'],
    certifications: ['pilot', 'lpic']
  });

  assert.equal(state.dlcId, 'infra');
  assert.equal(state.buildings.bash, 99);
  assert.equal(Object.hasOwn(state.buildings, 'probe'), false);
  assert.deepEqual(state.upgrades, ['ssd']);
  assert.deepEqual(state.certifications, ['lpic']);
});

test('refuse un corps de synchronisation absent', () => {
  assert.throws(() => synchronizeState(createState()), /État de synchronisation invalide/);
});

test('calcule la production hors ligne lors du chargement', () => {
  const state = createState();
  state.buildings.bash = 10;
  state.lastTick = Date.now() - 1000;
  const before = state.requests;

  publicState(state);

  assert.ok(state.requests > before);
});

test('applique une saturation progressive avec un plancher', () => {
  assert.equal(capacityEfficiency(100e6), 1);
  assert.ok(Math.abs(capacityEfficiency(1e9) - 2 / 3) < 0.001);
  assert.equal(capacityEfficiency(10e9), 0.5);
  assert.equal(capacityEfficiency(1e15), 0.35);
});
