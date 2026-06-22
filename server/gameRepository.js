const { BUILDINGS, CERTIFICATIONS, UPGRADES } = require('./gameData');
const { createState } = require('./gameEngine');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS game_sessions (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    username VARCHAR(24) NULL,
    username_key VARCHAR(24) NULL,
    country_code CHAR(2) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ON UPDATE CURRENT_TIMESTAMP(3),
    last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_game_sessions_username (username),
    UNIQUE KEY uq_game_sessions_username_key (username_key),
    INDEX idx_game_sessions_last_seen (last_seen_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS game_progress (
    session_id VARCHAR(64) NOT NULL PRIMARY KEY,
    version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
    requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    lifetime_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    combo INT UNSIGNED NOT NULL DEFAULT 0,
    last_manual_click BIGINT UNSIGNED NOT NULL DEFAULT 0,
    overclock_charge DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    overclock_ends_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
    certification_points INT UNSIGNED NOT NULL DEFAULT 0,
    last_tick BIGINT UNSIGNED NOT NULL,
    click_window LONGTEXT NOT NULL,
    CONSTRAINT fk_progress_session FOREIGN KEY (session_id)
      REFERENCES game_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS game_stats (
    session_id VARCHAR(64) NOT NULL PRIMARY KEY,
    all_time_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    manual_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
    critical_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
    best_combo INT UNSIGNED NOT NULL DEFAULT 0,
    total_buildings_purchased BIGINT UNSIGNED NOT NULL DEFAULT 0,
    prestige_count INT UNSIGNED NOT NULL DEFAULT 0,
    completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
    started_at BIGINT UNSIGNED NOT NULL,
    last_saved BIGINT UNSIGNED NOT NULL,
    anti_cheat_violations INT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT fk_stats_session FOREIGN KEY (session_id)
      REFERENCES game_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS game_buildings (
    session_id VARCHAR(64) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, building_id),
    CONSTRAINT fk_buildings_session FOREIGN KEY (session_id)
      REFERENCES game_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS game_upgrades (
    session_id VARCHAR(64) NOT NULL,
    upgrade_id VARCHAR(64) NOT NULL,
    acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (session_id, upgrade_id),
    CONSTRAINT fk_upgrades_session FOREIGN KEY (session_id)
      REFERENCES game_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS game_certifications (
    session_id VARCHAR(64) NOT NULL,
    certification_id VARCHAR(64) NOT NULL,
    acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (session_id, certification_id),
    CONSTRAINT fk_certifications_session FOREIGN KEY (session_id)
      REFERENCES game_sessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

function hydrateLegacyState(value) {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  const defaults = createState();
  return {
    ...defaults,
    ...(raw && typeof raw === 'object' ? raw : {}),
    buildings: { ...defaults.buildings, ...(raw?.buildings || {}) },
    upgrades: Array.isArray(raw?.upgrades) ? raw.upgrades : [],
    certifications: Array.isArray(raw?.certifications) ? raw.certifications : [],
    clickWindow: Array.isArray(raw?.clickWindow) ? raw.clickWindow : []
  };
}

async function hasColumn(connection, table, column) {
  const rows = await connection.query(
    `SELECT 1
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function hasIndex(connection, table, index) {
  const rows = await connection.query(
    `SELECT 1
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1`,
    [table, index]
  );
  return rows.length > 0;
}

async function saveCollection(connection, table, idColumn, sessionId, values) {
  await connection.query(`DELETE FROM ${table} WHERE session_id = ?`, [sessionId]);
  if (!values.length) return;
  await connection.batch(
    `INSERT INTO ${table} (session_id, ${idColumn}) VALUES (?, ?)`,
    values.map(value => [sessionId, value])
  );
}

async function saveState(connection, sessionId, state) {
  await connection.query(
    `INSERT INTO game_progress (
       session_id, version, requests, lifetime_requests, combo, last_manual_click,
       overclock_charge, overclock_ends_at, certification_points, last_tick, click_window
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       version = VALUES(version),
       requests = VALUES(requests),
       lifetime_requests = VALUES(lifetime_requests),
       combo = VALUES(combo),
       last_manual_click = VALUES(last_manual_click),
       overclock_charge = VALUES(overclock_charge),
       overclock_ends_at = VALUES(overclock_ends_at),
       certification_points = VALUES(certification_points),
       last_tick = VALUES(last_tick),
       click_window = VALUES(click_window)`,
    [
      sessionId, state.version, state.requests, state.lifetimeRequests, state.combo,
      state.lastManualClick, state.overclockCharge, state.overclockEndsAt,
      state.certificationPoints, state.lastTick, JSON.stringify(state.clickWindow)
    ]
  );

  await connection.query(
    `INSERT INTO game_stats (
       session_id, all_time_requests, manual_clicks, critical_clicks, best_combo,
       total_buildings_purchased, prestige_count, completed_at, started_at,
       last_saved, anti_cheat_violations
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       all_time_requests = VALUES(all_time_requests),
       manual_clicks = VALUES(manual_clicks),
       critical_clicks = VALUES(critical_clicks),
       best_combo = VALUES(best_combo),
       total_buildings_purchased = VALUES(total_buildings_purchased),
       prestige_count = VALUES(prestige_count),
       completed_at = CASE
         WHEN game_stats.completed_at = 0 THEN VALUES(completed_at)
         ELSE game_stats.completed_at
       END,
       started_at = LEAST(game_stats.started_at, VALUES(started_at)),
       last_saved = VALUES(last_saved),
       anti_cheat_violations = VALUES(anti_cheat_violations)`,
    [
      sessionId, state.allTimeRequests, state.manualClicks, state.criticalClicks,
      state.bestCombo, state.totalBuildingsPurchased, state.prestigeCount,
      state.completedAt, state.startedAt, state.lastSaved, state.antiCheatViolations
    ]
  );

  await connection.query('DELETE FROM game_buildings WHERE session_id = ?', [sessionId]);
  await connection.batch(
    'INSERT INTO game_buildings (session_id, building_id, quantity) VALUES (?, ?, ?)',
    BUILDINGS.map(building => [sessionId, building.id, state.buildings[building.id] || 0])
  );
  await saveCollection(connection, 'game_upgrades', 'upgrade_id', sessionId, state.upgrades);
  await saveCollection(
    connection,
    'game_certifications',
    'certification_id',
    sessionId,
    state.certifications
  );
  await connection.query(
    'UPDATE game_sessions SET updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [sessionId]
  );
}

async function loadState(connection, sessionId) {
  const progressRows = await connection.query(
    `SELECT version, requests, lifetime_requests, combo, last_manual_click,
            overclock_charge, overclock_ends_at, certification_points, last_tick,
            click_window
       FROM game_progress WHERE session_id = ?`,
    [sessionId]
  );
  if (!progressRows.length) return null;

  const statsRows = await connection.query(
    'SELECT * FROM game_stats WHERE session_id = ?',
    [sessionId]
  );
  const buildingRows = await connection.query(
    'SELECT building_id, quantity FROM game_buildings WHERE session_id = ?',
    [sessionId]
  );
  const upgradeRows = await connection.query(
    'SELECT upgrade_id FROM game_upgrades WHERE session_id = ?',
    [sessionId]
  );
  const certificationRows = await connection.query(
    'SELECT certification_id FROM game_certifications WHERE session_id = ?',
    [sessionId]
  );

  const progress = progressRows[0];
  const stats = statsRows[0] || {};
  const state = createState();
  state.version = Number(progress.version);
  state.requests = Number(progress.requests);
  state.lifetimeRequests = Number(progress.lifetime_requests);
  state.combo = Number(progress.combo);
  state.lastManualClick = Number(progress.last_manual_click);
  state.overclockCharge = Number(progress.overclock_charge);
  state.overclockEndsAt = Number(progress.overclock_ends_at);
  state.certificationPoints = Number(progress.certification_points);
  state.lastTick = Number(progress.last_tick);
  state.clickWindow = JSON.parse(progress.click_window || '[]');
  state.allTimeRequests = Number(stats.all_time_requests || 0);
  state.manualClicks = Number(stats.manual_clicks || 0);
  state.criticalClicks = Number(stats.critical_clicks || 0);
  state.bestCombo = Number(stats.best_combo || 0);
  state.totalBuildingsPurchased = Number(stats.total_buildings_purchased || 0);
  state.prestigeCount = Number(stats.prestige_count || 0);
  state.completedAt = Number(stats.completed_at || 0);
  state.startedAt = Number(stats.started_at || state.startedAt);
  state.lastSaved = Number(stats.last_saved || state.lastSaved);
  state.antiCheatViolations = Number(stats.anti_cheat_violations || 0);
  buildingRows.forEach(row => {
    if (Object.hasOwn(state.buildings, row.building_id)) {
      state.buildings[row.building_id] = Number(row.quantity);
    }
  });
  state.upgrades = upgradeRows.map(row => row.upgrade_id);
  state.certifications = certificationRows.map(row => row.certification_id);
  if (!state.completedAt
    && state.upgrades.length >= UPGRADES.length
    && state.certifications.length >= CERTIFICATIONS.length) {
    state.completedAt = Date.now();
  }
  return state;
}

async function createSession(connection, sessionId, state = createState()) {
  await connection.query('INSERT INTO game_sessions (id) VALUES (?)', [sessionId]);
  await saveState(connection, sessionId, hydrateLegacyState(state));
  return state;
}

async function migrateLegacyStates(connection) {
  if (!await hasColumn(connection, 'game_sessions', 'state')) return 0;
  await connection.query('ALTER TABLE game_sessions MODIFY state LONGTEXT NULL');
  const rows = await connection.query(
    `SELECT sessions.id, sessions.state
       FROM game_sessions sessions
       LEFT JOIN game_progress progress ON progress.session_id = sessions.id
      WHERE sessions.state IS NOT NULL AND progress.session_id IS NULL`
  );
  for (const row of rows) {
    await saveState(connection, row.id, hydrateLegacyState(row.state));
    await connection.query('UPDATE game_sessions SET state = NULL WHERE id = ?', [row.id]);
  }
  await connection.query('ALTER TABLE game_sessions DROP COLUMN state');
  return rows.length;
}

async function initializeSchema(connection) {
  for (const statement of TABLES) await connection.query(statement);
  if (!await hasColumn(connection, 'game_sessions', 'username')) {
    await connection.query(`
      ALTER TABLE game_sessions
      ADD COLUMN username VARCHAR(24) NULL,
      ADD UNIQUE KEY uq_game_sessions_username (username)
    `);
  }
  if (!await hasColumn(connection, 'game_sessions', 'username_key')) {
    await connection.query(
      'ALTER TABLE game_sessions ADD COLUMN username_key VARCHAR(24) NULL AFTER username'
    );
    await connection.query(
      'UPDATE game_sessions SET username_key = LOWER(TRIM(username)) WHERE username IS NOT NULL'
    );
  }
  if (!await hasIndex(connection, 'game_sessions', 'uq_game_sessions_username_key')) {
    await connection.query(
      'ALTER TABLE game_sessions ADD UNIQUE KEY uq_game_sessions_username_key (username_key)'
    );
  }
  if (!await hasColumn(connection, 'game_sessions', 'country_code')) {
    await connection.query(
      'ALTER TABLE game_sessions ADD COLUMN country_code CHAR(2) NULL'
    );
  }
  if (!await hasColumn(connection, 'game_sessions', 'last_seen_at')) {
    await connection.query(`
      ALTER TABLE game_sessions
      ADD COLUMN last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ADD INDEX idx_game_sessions_last_seen (last_seen_at)
    `);
  }
  if (!await hasColumn(connection, 'game_stats', 'completed_at')) {
    await connection.query(
      'ALTER TABLE game_stats ADD COLUMN completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER prestige_count'
    );
  }
  await connection.query(
    `UPDATE game_stats stats
        SET stats.completed_at = stats.last_saved
      WHERE stats.completed_at = 0
        AND (SELECT COUNT(*) FROM game_upgrades upgrades
              WHERE upgrades.session_id = stats.session_id) >= ?
        AND (SELECT COUNT(*) FROM game_certifications certifications
              WHERE certifications.session_id = stats.session_id) >= ?`,
    [UPGRADES.length, CERTIFICATIONS.length]
  );
  await connection.query(
    'ALTER TABLE game_buildings MODIFY quantity BIGINT UNSIGNED NOT NULL DEFAULT 0'
  );
  await connection.query(
    'ALTER TABLE game_progress MODIFY certification_points BIGINT UNSIGNED NOT NULL DEFAULT 0'
  );
  const migrated = await migrateLegacyStates(connection);
  const sessions = await connection.query('SELECT id FROM game_sessions');
  for (const session of sessions) {
    await connection.batch(
      `INSERT IGNORE INTO game_buildings (session_id, building_id, quantity)
       VALUES (?, ?, 0)`,
      BUILDINGS.map(building => [session.id, building.id])
    );
  }
  return migrated;
}

module.exports = {
  createSession,
  hydrateLegacyState,
  initializeSchema,
  loadState,
  saveState
};
