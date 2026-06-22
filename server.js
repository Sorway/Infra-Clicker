process.stderr.write(`[Bootstrap] Démarrage — Node ${process.version}\n`);

const { start } = require('./app');

process.stderr.write('[Bootstrap] Application chargée, initialisation en cours\n');

start().catch(error => {
  process.stderr.write(`[Bootstrap] Échec du démarrage : ${error.stack || error.message}\n`);
  process.exit(1);
});
