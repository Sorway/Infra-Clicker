const BUILDINGS = [
  ['probe', 'Sonde automatique', '◉', 15, 0.2],
  ['satellite', 'Satellite', '◇', 120, 1.2],
  ['moonbase', 'Base lunaire', '◐', 900, 7],
  ['shipyard', 'Chantier orbital', '▱', 6500, 35],
  ['colony', 'Colonie martienne', '●', 55000, 220],
  ['asteroid', 'Mine d’astéroïdes', '◆', 480000, 1600],
  ['dyson', 'Essaim de Dyson', '☀', 8e6, 30000],
  ['stargate', 'Porte stellaire', '◎', 180e6, 850000]
].map(([id, name, icon, baseCost, baseProduction]) => ({
  id, name, icon, baseCost, baseProduction,
  description: `${name} dédiée à l’expansion spatiale.`
}));

const UPGRADES = [
  ['ion-drive', 'Propulsion', 'Moteur ionique', '↗', 250, null, { click: 2 }],
  ['fusion', 'Propulsion', 'Fusion', '☼', 4000, 'ion-drive', { production: 1.3 }],
  ['warp', 'Propulsion', 'Distorsion', '∞', 120000, 'fusion', { production: 1.8 }],
  ['robotics', 'Industrie', 'Robotique autonome', 'R', 800, null, { building: 'probe', multiplier: 4 }],
  ['zero-g', 'Industrie', 'Usine zéro-G', '0G', 25000, 'robotics', { building: 'shipyard', multiplier: 3 }],
  ['von-neumann', 'Industrie', 'Sondes autoréplicantes', 'V', 3e6, 'zero-g', { production: 2 }],
  ['quantum-link', 'Science', 'Communication quantique', 'Q', 1500, null, { click: 2 }],
  ['terraforming', 'Science', 'Terraformation', 'T', 350000, 'quantum-link', { building: 'colony', multiplier: 4 }],
  ['stellar-ai', 'Science', 'IA stellaire', 'AI', 45e6, 'terraforming', { production: 2.5, eventResistance: 0.4 }]
].map(([id, category, name, icon, cost, requires, effect]) => ({
  id, category, name, icon, cost, requires, effect,
  description: `${name} améliore votre programme spatial.`
}));

const EVENTS = [
  { id: 'solar-storm', title: 'Tempête solaire', description: 'Les communications sont perturbées.', duration: 20, multiplier: 0.45, type: 'danger' },
  { id: 'meteor', title: 'Pluie de météorites', description: 'Les boucliers encaissent les impacts.', duration: 18, multiplier: 0.6, type: 'danger' },
  { id: 'alien-signal', title: 'Signal extraterrestre', description: 'Une transmission accélère vos recherches.', duration: 25, multiplier: 3, clickMultiplier: 2, type: 'bonus' },
  { id: 'gravity-assist', title: 'Assistance gravitationnelle', description: 'Toutes les trajectoires sont optimales.', duration: 22, multiplier: 2.2, type: 'bonus' },
  { id: 'comet', title: 'Comète riche en ressources', description: 'Une extraction exceptionnelle est possible.', duration: 1, multiplier: 1, instantSeconds: 240, type: 'bonus' }
];

const CERTIFICATIONS = [
  ['pilot', 'Pilote orbital', 'P', 1, 0.15],
  ['engineer', 'Ingénieur spatial', 'E', 2, 0.3],
  ['exobiologist', 'Exobiologiste', 'X', 3, 0.45],
  ['admiral', 'Amiral interstellaire', 'A', 5, 0.8]
].map(([id, name, icon, cost, bonus]) => ({
  id, name, icon, cost, bonus,
  description: `+${Math.round(bonus * 100)}% de production permanente.`
}));

const ACHIEVEMENTS = [
  ['first-launch', 'Décollage', 'Lancer votre première mission.', 'requests', 1],
  ['orbit', 'En orbite', 'Produire 1 000 données.', 'requests', 1e3],
  ['space-clicks', 'Centre de contrôle', 'Cliquer 100 fois.', 'clicks', 100],
  ['first-probe', 'Messager robotique', 'Posséder une sonde.', 'building', 'probe', 1],
  ['first-colony', 'Nouvelle frontière', 'Fonder une colonie.', 'building', 'colony', 1],
  ['all-space-upgrades', 'Civilisation avancée', 'Acquérir toutes les améliorations.', 'upgradeCount', null, UPGRADES.length],
  ['all-space-certs', 'Équipage d’élite', 'Obtenir toutes les accréditations.', 'certCount', null, CERTIFICATIONS.length],
  ['space-prestige', 'Nouveau système', 'Effectuer un prestige.', 'prestige', null, 1]
].map(([id, name, description, type, target, value]) => ({
  id, name, description, type, ...(target ? { target } : {}), value: value ?? target
}));

const INFRA_LEVELS = [
  [0, 'Programme expérimental'],
  [1e3, 'Agence orbitale'],
  [1e5, 'Civilisation lunaire'],
  [1e7, 'Espèce multiplanétaire'],
  [1e10, 'Empire interstellaire'],
  [1e14, 'Civilisation galactique']
];

export const DLC = {
  id: 'space',
  name: 'Space Clicker',
  shortName: 'Conquête spatiale',
  description: 'Explorez et industrialisez la galaxie.',
  currency: 'données',
  clickVerb: 'LANCER',
  clickerIcon: '🚀',
  buildings: BUILDINGS,
  upgrades: UPGRADES,
  events: EVENTS,
  certifications: CERTIFICATIONS,
  achievements: ACHIEVEMENTS,
  levels: INFRA_LEVELS
};
