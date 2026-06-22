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
        SUM(stats.session_id IS NULL) AS missing_stats
      FROM game_progress progress
      LEFT JOIN game_stats stats
        ON stats.session_id = progress.session_id
       AND stats.dlc_id = progress.dlc_id
    `);
    const dlcs = await connection.query(`
      SELECT dlc_id, COUNT(*) AS progressions
      FROM game_progress
      GROUP BY dlc_id
      ORDER BY dlc_id
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
      missingStats: Number(orphanRows[0].missing_stats || 0),
      dlcs: dlcs.map(row => ({
        id: row.dlc_id,
        progressions: Number(row.progressions)
      })),
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
