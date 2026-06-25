// DLC « Ynov Campus » côté serveur : mêmes données économiques que Infra
// (le skin est purement client). Seul l'id change → sauvegarde/classement propres.
const infra = require('./infra');

module.exports = { ...infra, id: 'ynov' };
