/*
 * Template de DLC
 *
 * 1. Copiez ce fichier sous public/js/dlcs/mon-dlc.js.
 * 2. Remplissez toutes les collections.
 * 3. Importez puis ajoutez le DLC dans registry.js.
 * 4. Ajoutez le même contenu économique dans server/dlcs/registry.js.
 *
 * Les identifiants doivent être uniques à l’intérieur du DLC.
 * Effets supportés pour une amélioration :
 * production, click, building + multiplier, costReduction, eventResistance.
 */
export const DLC = {
  id: 'mon-dlc',
  name: 'Mon Clicker',
  shortName: 'Mon univers',
  description: 'Description affichée dans le sélecteur.',
  currency: 'points',
  clickVerb: 'CRÉER',
  clickerIcon: '●',
  buildings: [
    { id: 'item-1', name: 'Premier item', icon: '●', description: 'Description.', baseCost: 15, baseProduction: 0.2 }
  ],
  upgrades: [
    { id: 'upgrade-1', category: 'Général', name: 'Amélioration', icon: '+', cost: 100, description: 'Description.', effect: { production: 1.2 } }
  ],
  events: [
    { id: 'bonus-1', title: 'Événement bonus', description: 'Description.', duration: 20, multiplier: 2, type: 'bonus' }
  ],
  certifications: [
    { id: 'permanent-1', name: 'Bonus permanent', icon: 'B', cost: 1, description: '+10% permanent.', bonus: 0.1 }
  ],
  achievements: [
    { id: 'start', name: 'Départ', description: 'Obtenir un point.', type: 'requests', value: 1 }
  ],
  levels: [
    [0, 'Début'],
    [1e3, 'Intermédiaire'],
    [1e6, 'Expert']
  ]
};
