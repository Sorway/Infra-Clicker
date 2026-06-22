const mariadb = require('mariadb');
const { closeDatabase, initializeDatabase } = require('../server/gameStore');

const configuredHost = process.env.DB_HOST || '127.0.0.1';
const hostWithPort = configuredHost.match(/^([^:]+):(\d+)$/);
const pool = mariadb.createPool({
  host: hostWithPort ? hostWithPort[1] : configuredHost,
  port: Number(hostWithPort?.[2] || process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 1
});

async function count(connection, table) {
  const rows = await connection.query(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(rows[0].count);
}

async function migrate() {
  await initializeDatabase();
  const connection = await pool.getConnection();
  try {
    const tables = [
      'game_sessions',
      'game_progress',
      'game_stats',
      'game_buildings',
      'game_upgrades',
      'game_certifications'
    ];
    const counts = {};
    for (const table of tables) counts[table] = await count(connection, table);

    const orphanRows = await connection.query(`
      SELECT
        SUM(progress.session_id IS NULL) AS missing_progress,
        SUM(stats.session_id IS NULL) AS missing_stats
      FROM game_sessions sessions
      LEFT JOIN game_progress progress ON progress.session_id = sessions.id
      LEFT JOIN game_stats stats ON stats.session_id = sessions.id
    `);
    const stateColumn = await connection.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'game_sessions'
        AND COLUMN_NAME = 'state'
    `);

    console.log(JSON.stringify({
      migrated: true,
      counts,
      missingProgress: Number(orphanRows[0].missing_progress || 0),
      missingStats: Number(orphanRows[0].missing_stats || 0),
      legacyStateColumnPresent: Number(stateColumn[0].count) > 0
    }, null, 2));
  } finally {
    connection.release();
  }
}

migrate()
  .catch(error => {
    console.error(`Migration relationnelle impossible : ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    await closeDatabase();
  });
