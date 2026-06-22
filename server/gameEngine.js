const { DEFAULT_DLC_ID, getDlc, hasDlc } = require('./gameData');

const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
const SATURATION_START = 100e6;
const MIN_CAPACITY_EFFICIENCY = 0.35;

function capacityEfficiency(requests) {
  if (requests <= SATURATION_START) return 1;
  const decades = Math.log10(requests / SATURATION_START);
  return Math.max(MIN_CAPACITY_EFFICIENCY, 1 / (1 + 0.5 * decades));
}

function createState(dlcId = DEFAULT_DLC_ID) {
  const dlc = getDlc(dlcId);
  const now = Date.now();
  return {
    version: 2,
    dlcId: dlc.id,
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
    buildings: Object.fromEntries(dlc.BUILDINGS.map(building => [building.id, 0])),
    upgrades: [],
    certifications: [],
    certificationPoints: 0,
    prestigeCount: 0,
    completedAt: 0,
    startedAt: now,
    lastTick: now,
    lastSaved: now
  };
}

function hasUpgrade(state, id) {
  return state.upgrades.includes(id);
}

function globalMultiplier(state) {
  const { UPGRADES, CERTIFICATIONS } = getDlc(state.dlcId);
  const upgrades = UPGRADES
    .filter(upgrade => hasUpgrade(state, upgrade.id))
    .reduce((value, upgrade) => value * (upgrade.effect.production || 1), 1);
  const certifications = CERTIFICATIONS
    .filter(certification => state.certifications.includes(certification.id))
    .reduce((value, certification) => value + certification.bonus, 1);
  return upgrades * certifications;
}

function buildingMultiplier(state, id) {
  const { UPGRADES } = getDlc(state.dlcId);
  return UPGRADES
    .filter(upgrade => hasUpgrade(state, upgrade.id) && upgrade.effect.building === id)
    .reduce((value, upgrade) => value * upgrade.effect.multiplier, 1);
}

function production(state) {
  const { BUILDINGS } = getDlc(state.dlcId);
  const base = BUILDINGS.reduce((total, building) => (
    total + state.buildings[building.id] * building.baseProduction * buildingMultiplier(state, building.id)
  ), 0) * globalMultiplier(state);
  return base
    * capacityEfficiency(state.lifetimeRequests)
    * (state.overclockEndsAt > Date.now() ? 2 : 1);
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

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function synchronizeState(state, input) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('État de synchronisation invalide'), { status: 400 });
  }
  const dlcId = hasDlc(input.dlcId) ? input.dlcId : DEFAULT_DLC_ID;
  const { BUILDINGS, UPGRADES, CERTIFICATIONS } = getDlc(dlcId);
  const buildingIds = new Set(BUILDINGS.map(building => building.id));
  const upgradeIds = new Set(UPGRADES.map(upgrade => upgrade.id));
  const certificationIds = new Set(CERTIFICATIONS.map(certification => certification.id));
  const now = Date.now();

  state.version = 2;
  state.dlcId = dlcId;
  state.requests = finite(input.requests);
  state.lifetimeRequests = finite(input.lifetimeRequests);
  state.allTimeRequests = finite(input.allTimeRequests);
  state.manualClicks = Math.floor(finite(input.manualClicks));
  state.criticalClicks = Math.floor(finite(input.criticalClicks));
  state.bestCombo = Math.floor(finite(input.bestCombo));
  state.combo = Math.floor(finite(input.combo));
  state.lastManualClick = finite(input.lastManualClick);
  state.overclockCharge = Math.min(100, finite(input.overclockCharge));
  state.overclockEndsAt = finite(input.overclockEndsAt);
  state.totalBuildingsPurchased = Math.floor(finite(input.totalBuildingsPurchased));
  state.buildings = Object.fromEntries([...buildingIds].map(id => [
    id,
    Math.floor(finite(input.buildings?.[id]))
  ]));
  state.upgrades = [...new Set(Array.isArray(input.upgrades)
    ? input.upgrades.filter(id => upgradeIds.has(id))
    : [])];
  state.certifications = [...new Set(Array.isArray(input.certifications)
    ? input.certifications.filter(id => certificationIds.has(id))
    : [])];
  state.certificationPoints = Math.floor(finite(input.certificationPoints));
  state.prestigeCount = Math.floor(finite(input.prestigeCount));
  state.completedAt = finite(input.completedAt);
  state.startedAt = finite(input.startedAt, state.startedAt);
  state.lastTick = now;
  state.lastSaved = now;
}

function publicState(state) {
  settle(state);
  return {
    ...state,
    production: production(state),
    capacityEfficiency: capacityEfficiency(state.lifetimeRequests)
  };
}

module.exports = {
  capacityEfficiency,
  createState,
  publicState,
  synchronizeState
};
