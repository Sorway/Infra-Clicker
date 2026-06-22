const infra = require('./infra');

const DEFAULT_DLC_ID = 'infra';
const DLC_REGISTRY = Object.freeze({ infra });

function getDlc(id) {
  return DLC_REGISTRY[id] || DLC_REGISTRY[DEFAULT_DLC_ID];
}

function hasDlc(id) {
  return Object.hasOwn(DLC_REGISTRY, id);
}

function allBuildings() {
  return Object.values(DLC_REGISTRY).flatMap(dlc => dlc.BUILDINGS);
}

module.exports = { DEFAULT_DLC_ID, DLC_REGISTRY, allBuildings, getDlc, hasDlc };
