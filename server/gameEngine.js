const { BUILDINGS, CERTIFICATIONS, UPGRADES } = require('./gameData');

const MAX_CLICKS_PER_SECOND = 25;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
const PRESTIGE_TARGET = 1e6;

function prestigeGain(requests) {
  if (requests < PRESTIGE_TARGET) return 0;
  return Math.floor(Math.log10(requests / PRESTIGE_TARGET)) + 1;
}

function createState() {
  const now = Date.now();
  return {
    version: 2,
    requests: 0,
    lifetimeRequests: 0,
    allTimeRequests: 0,
    manualClicks: 0,
    criticalClicks: 0,
    bestCombo: 0,
    combo: 0,
    lastManualClick: 0,
    overclockCharge: 0,
    overclockEndsAt: 0,
    totalBuildingsPurchased: 0,
    buildings: Object.fromEntries(BUILDINGS.map(building => [building.id, 0])),
    upgrades: [],
    certifications: [],
    certificationPoints: 0,
    prestigeCount: 0,
    startedAt: now,
    lastTick: now,
    lastSaved: now,
    antiCheatViolations: 0,
    clickWindow: []
  };
}

function hasUpgrade(state, id) {
  return state.upgrades.includes(id);
}

function globalMultiplier(state) {
  const upgrades = UPGRADES
    .filter(upgrade => hasUpgrade(state, upgrade.id))
    .reduce((value, upgrade) => value * (upgrade.effect.production || 1), 1);
  const certifications = CERTIFICATIONS
    .filter(certification => state.certifications.includes(certification.id))
    .reduce((value, certification) => value + certification.bonus, 1);
  return upgrades * certifications;
}

function buildingMultiplier(state, id) {
  return UPGRADES
    .filter(upgrade => hasUpgrade(state, upgrade.id) && upgrade.effect.building === id)
    .reduce((value, upgrade) => value * upgrade.effect.multiplier, 1);
}

function production(state) {
  const base = BUILDINGS.reduce((total, building) => (
    total + state.buildings[building.id] * building.baseProduction * buildingMultiplier(state, building.id)
  ), 0) * globalMultiplier(state);
  return base * (state.overclockEndsAt > Date.now() ? 2 : 1);
}

function clickPower(state) {
  const multiplier = UPGRADES
    .filter(upgrade => hasUpgrade(state, upgrade.id))
    .reduce((value, upgrade) => value * (upgrade.effect.click || 1), 1);
  return Math.max(1, multiplier * (1 + production(state) * 0.01));
}

function settle(state) {
  const now = Date.now();
  const elapsed = Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (now - state.lastTick) / 1000));
  const gain = production(state) * elapsed;
  state.requests += gain;
  state.lifetimeRequests += gain;
  state.allTimeRequests += gain;
  if (now - state.lastManualClick > 1200) state.combo = 0;
  state.lastTick = now;
  state.lastSaved = now;
}

function costReduction(state) {
  return Math.min(0.35, UPGRADES
    .filter(upgrade => hasUpgrade(state, upgrade.id))
    .reduce((value, upgrade) => value + (upgrade.effect.costReduction || 0), 0));
}

function unitCost(state, building, offset = 0) {
  return building.baseCost * Math.pow(1.15, state.buildings[building.id] + offset) * (1 - costReduction(state));
}

function buildingPurchase(state, building, requestedAmount) {
  const max = requestedAmount === 'max';
  const limit = max ? 10000 : Math.min(1000, Math.max(1, Number.parseInt(requestedAmount, 10) || 1));
  let amount = 0;
  let cost = 0;
  while (amount < limit) {
    const next = unitCost(state, building, amount);
    if (cost + next > state.requests) break;
    cost += next;
    amount += 1;
  }
  return { amount, cost };
}

function violation(state, message, status = 400) {
  state.antiCheatViolations += 1;
  const error = new Error(message);
  error.status = status;
  throw error;
}

function applyAction(state, action = {}) {
  settle(state);
  const now = Date.now();

  if (action.type === 'click') {
    state.clickWindow = state.clickWindow.filter(timestamp => now - timestamp < 1000);
    if (state.clickWindow.length >= MAX_CLICKS_PER_SECOND) violation(state, 'Cadence de clics refusée', 429);
    state.clickWindow.push(now);
    state.combo = now - state.lastManualClick <= 900 ? state.combo + 1 : 1;
    state.lastManualClick = now;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const comboMultiplier = Math.min(3, 1 + Math.floor((state.combo - 1) / 10) * 0.25);
    const critical = Math.random() < 0.05;
    const power = clickPower(state) * comboMultiplier * (critical ? 10 : 1);
    state.requests += power;
    state.lifetimeRequests += power;
    state.allTimeRequests += power;
    state.manualClicks += 1;
    if (critical) state.criticalClicks += 1;
    if (state.overclockEndsAt <= now) state.overclockCharge = Math.min(100, state.overclockCharge + (critical ? 8 : 1));
    return { critical, comboMultiplier, power };
  }

  if (action.type === 'buyBuilding') {
    const building = BUILDINGS.find(item => item.id === action.id);
    if (!building) violation(state, 'Bâtiment inconnu');
    const purchase = buildingPurchase(state, building, action.amount);
    if (purchase.amount < 1) violation(state, 'Budget insuffisant', 409);
    state.requests -= purchase.cost;
    state.buildings[building.id] += purchase.amount;
    state.totalBuildingsPurchased += purchase.amount;
    return purchase;
  }

  if (action.type === 'buyUpgrade') {
    const upgrade = UPGRADES.find(item => item.id === action.id);
    if (!upgrade) violation(state, 'Upgrade inconnu');
    if (hasUpgrade(state, upgrade.id)) violation(state, 'Upgrade déjà acquis', 409);
    if (upgrade.requires && !hasUpgrade(state, upgrade.requires)) violation(state, 'Prérequis manquant', 409);
    if (state.requests < upgrade.cost) violation(state, 'Budget insuffisant', 409);
    state.requests -= upgrade.cost;
    state.upgrades.push(upgrade.id);
    return {};
  }

  if (action.type === 'buyCertification') {
    const certification = CERTIFICATIONS.find(item => item.id === action.id);
    if (!certification) violation(state, 'Certification inconnue');
    if (state.certifications.includes(certification.id)) violation(state, 'Certification déjà acquise', 409);
    if (state.certificationPoints < certification.cost) violation(state, 'Points insuffisants', 409);
    state.certificationPoints -= certification.cost;
    state.certifications.push(certification.id);
    return {};
  }

  if (action.type === 'prestige') {
    const gain = prestigeGain(state.lifetimeRequests);
    if (gain < 1) violation(state, 'Prestige indisponible', 409);
    if (state.certifications.length >= CERTIFICATIONS.length) violation(state, 'Toutes les certifications sont acquises', 409);
    const originalStartedAt = state.startedAt;
    const persistent = {
      allTimeRequests: state.allTimeRequests,
      manualClicks: state.manualClicks,
      criticalClicks: state.criticalClicks,
      bestCombo: state.bestCombo,
      certifications: [...state.certifications],
      certificationPoints: state.certificationPoints + gain,
      prestigeCount: state.prestigeCount + 1,
      totalBuildingsPurchased: state.totalBuildingsPurchased,
      startedAt: originalStartedAt,
      antiCheatViolations: state.antiCheatViolations
    };
    Object.assign(state, createState(), persistent);
    return { gain };
  }

  if (action.type === 'overclock') {
    if (state.overclockCharge < 100 || state.overclockEndsAt > now) violation(state, 'Surcharge indisponible', 409);
    state.overclockCharge = 0;
    state.overclockEndsAt = now + 30000;
    return {};
  }

  violation(state, 'Action inconnue');
}

function publicState(state) {
  settle(state);
  const { clickWindow, ...safeState } = state;
  return { ...safeState, production: production(state) };
}

module.exports = { applyAction, createState, prestigeGain, publicState };
