// DLC « NOC » côté serveur : mêmes données économiques que Infra.
const infra = require('./infra');

module.exports = { ...infra, id: 'noc' };
