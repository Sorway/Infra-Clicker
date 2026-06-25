// DLC « NOC » : le jeu Infra, habillé du skin NOC (console de supervision).
import { DLC as infra } from './infra.js';

export const DLC = {
  ...infra,
  id: 'noc',
  name: 'NOC',
  shortName: 'NOC',
  description: 'Infra Clicker — console de supervision NOC.',
  theme: 'noc'
};
