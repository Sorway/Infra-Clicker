const fs = require('fs/promises');
const path = require('path');
const { closeDatabase, importSessions } = require('../server/gameStore');

async function migrate() {
  const source = path.resolve(process.argv[2] || path.join('data', 'game-sessions.json'));
  const sessions = JSON.parse(await fs.readFile(source, 'utf8'));
  const imported = await importSessions(sessions);
  console.log(`${imported} session(s) importée(s) dans MariaDB depuis ${source}`);
}

migrate()
  .catch(error => {
    console.error('Migration impossible :', error.message);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
