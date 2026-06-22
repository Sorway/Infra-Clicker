const BUILDINGS = [
  ['probe', 15, 0.2],
  ['satellite', 120, 1.2],
  ['moonbase', 900, 7],
  ['shipyard', 6500, 35],
  ['colony', 55000, 220],
  ['asteroid', 480000, 1600],
  ['dyson', 8e6, 30000],
  ['stargate', 180e6, 850000]
].map(([id, baseCost, baseProduction]) => ({ id, baseCost, baseProduction }));

const UPGRADES = [
  ['ion-drive', 250, null, { click: 2 }],
  ['fusion', 4000, 'ion-drive', { production: 1.3 }],
  ['warp', 120000, 'fusion', { production: 1.8 }],
  ['robotics', 800, null, { building: 'probe', multiplier: 4 }],
  ['zero-g', 25000, 'robotics', { building: 'shipyard', multiplier: 3 }],
  ['von-neumann', 3e6, 'zero-g', { production: 2 }],
  ['quantum-link', 1500, null, { click: 2 }],
  ['terraforming', 350000, 'quantum-link', { building: 'colony', multiplier: 4 }],
  ['stellar-ai', 45e6, 'terraforming', { production: 2.5, eventResistance: 0.4 }]
].map(([id, cost, requires, effect]) => ({ id, cost, requires, effect }));

const CERTIFICATIONS = [
  ['pilot', 1, 0.15],
  ['engineer', 2, 0.3],
  ['exobiologist', 3, 0.45],
  ['admiral', 5, 0.8]
].map(([id, cost, bonus]) => ({ id, cost, bonus }));

module.exports = { id: 'space', BUILDINGS, CERTIFICATIONS, UPGRADES };
