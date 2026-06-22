/*
 * Copiez ce fichier, adaptez les tableaux puis enregistrez le module dans
 * server/dlcs/registry.js avec le même id que le DLC navigateur.
 * Seules les données économiques nécessaires à la sauvegarde serveur vivent ici.
 */
const BUILDINGS = [
  { id: 'item-1', baseCost: 15, baseProduction: 0.2 }
];

const UPGRADES = [
  { id: 'upgrade-1', cost: 100, requires: null, effect: { production: 1.2 } }
];

const CERTIFICATIONS = [
  { id: 'permanent-1', cost: 1, bonus: 0.1 }
];

module.exports = {
  id: 'mon-dlc',
  BUILDINGS,
  UPGRADES,
  CERTIFICATIONS
};
