const test = require('node:test');
const assert = require('node:assert/strict');
const { applyAction, createState, publicState } = require('../server/gameEngine');

test('ignore les valeurs économiques envoyées avec une action', () => {
  const state = createState();
  applyAction(state, { type: 'click', requests: 1e99, buildings: { worldcloud: 999999 } });
  assert.ok(state.requests < 100);
  assert.equal(state.buildings.worldcloud, 0);
});

test('calcule et débite un achat côté serveur', () => {
  const state = createState();
  state.requests = 100;
  const result = applyAction(state, { type: 'buyBuilding', id: 'bash', amount: 2 });
  assert.equal(result.amount, 2);
  assert.equal(state.buildings.bash, 2);
  assert.ok(state.requests < 70);
});

test('refuse un upgrade sans budget même si le client prétend être riche', () => {
  const state = createState();
  assert.throws(
    () => applyAction(state, { type: 'buyUpgrade', id: 'ssd', requests: 1e99 }),
    /Budget insuffisant/
  );
  assert.deepEqual(state.upgrades, []);
});

test('limite la cadence de clics sur le serveur', () => {
  const state = createState();
  for (let index = 0; index < 25; index += 1) applyAction(state, { type: 'click' });
  assert.throws(() => applyAction(state, { type: 'click' }), /Cadence de clics refusée/);
  assert.equal(state.antiCheatViolations, 1);
});

test('n’expose pas la fenêtre interne de détection', () => {
  const state = createState();
  applyAction(state, { type: 'click' });
  assert.equal(Object.hasOwn(publicState(state), 'clickWindow'), false);
});

test('conserve le temps de jeu cumulé après un prestige', () => {
  const state = createState();
  const startedAt = Date.now() - 4 * 60 * 60 * 1000;
  state.startedAt = startedAt;
  state.lifetimeRequests = 1e6;
  state.requests = 1e6;

  applyAction(state, { type: 'prestige' });

  assert.equal(state.startedAt, startedAt);
  assert.equal(state.prestigeCount, 1);
  assert.equal(state.lifetimeRequests, 0);
});
