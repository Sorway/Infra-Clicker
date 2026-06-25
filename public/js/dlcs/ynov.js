// DLC « Ynov Campus » : le jeu Infra, habillé du skin Ynov.
// Réutilise tout le contenu (bâtiments, améliorations, événements, certifs,
// succès, niveaux) du DLC de base ; seule l'identité + le skin changent.
import { DLC as infra } from './infra.js';

export const DLC = {
  ...infra,
  id: 'ynov',
  name: 'Ynov Campus',
  shortName: 'Ynov',
  description: 'Infra Clicker — édition campus Ynov.',
  theme: 'ynov'
};
