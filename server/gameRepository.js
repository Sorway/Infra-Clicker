const { getDlc, hasDlc, DEFAULT_DLC_ID } = require('./gameData');
const { createState } = require('./gameEngine');

const TABLE_RENAMES = [
  ['game_users', 'GameUsers'],
  ['game_sessions', 'GameSessions'],
  ['game_session_links', 'GameSessionLinks'],
  ['game_progress', 'GameProgress'],
  ['game_stats', 'GameStats'],
  ['game_buildings', 'GameBuildings'],
  ['game_upgrades', 'GameUpgrades'],
  ['game_certifications', 'GameCertifications']
];

const TABLES = [
  `CREATE TABLE IF NOT EXISTS GameUsers (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    discord_username VARCHAR(64) NULL,
    discord_global_name VARCHAR(64) NULL,
    discord_avatar VARCHAR(128) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_login_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameSessions (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(32) NULL,
    linked_at DATETIME(3) NULL,
    username VARCHAR(64) NULL,
    username_key VARCHAR(128) NULL,
    country_code CHAR(2) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ON UPDATE CURRENT_TIMESTAMP(3),
    last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_GameSessions_user_id (user_id),
    INDEX idx_GameSessions_username_key (username_key),
    INDEX idx_GameSessions_last_seen (last_seen_at),
    CONSTRAINT fk_GameSessions_user FOREIGN KEY (user_id)
      REFERENCES GameUsers(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameSessionLinks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_session_links_user (user_id),
    INDEX idx_session_links_session (session_id),
    INDEX idx_GameSessionLinks_user_created (user_id, created_at),
    INDEX idx_GameSessionLinks_session_created (session_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameProgress (
    session_id VARCHAR(64) NOT NULL,
    dlc_id VARCHAR(64) NOT NULL,
    version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
    requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    lifetime_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    combo INT UNSIGNED NOT NULL DEFAULT 0,
    last_manual_click BIGINT UNSIGNED NOT NULL DEFAULT 0,
    overclock_charge DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    overclock_ends_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
    certification_points INT UNSIGNED NOT NULL DEFAULT 0,
    last_tick BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (session_id, dlc_id),
    INDEX idx_GameProgress_dlc (dlc_id),
    CONSTRAINT fk_progress_session FOREIGN KEY (session_id)
      REFERENCES GameSessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameStats (
    session_id VARCHAR(64) NOT NULL,
    dlc_id VARCHAR(64) NOT NULL,
    all_time_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
    manual_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
    critical_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
    best_combo INT UNSIGNED NOT NULL DEFAULT 0,
    total_buildings_purchased BIGINT UNSIGNED NOT NULL DEFAULT 0,
    prestige_count INT UNSIGNED NOT NULL DEFAULT 0,
    completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
    started_at BIGINT UNSIGNED NOT NULL,
    last_saved BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (session_id, dlc_id),
    INDEX idx_GameStats_leaderboard (dlc_id, prestige_count, all_time_requests),
    CONSTRAINT fk_stats_session FOREIGN KEY (session_id)
      REFERENCES GameSessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameBuildings (
    session_id VARCHAR(64) NOT NULL,
    dlc_id VARCHAR(64) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, dlc_id, building_id),
    INDEX idx_GameBuildings_dlc (dlc_id),
    CONSTRAINT fk_buildings_session FOREIGN KEY (session_id)
      REFERENCES GameSessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameUpgrades (
    session_id VARCHAR(64) NOT NULL,
    dlc_id VARCHAR(64) NOT NULL,
    upgrade_id VARCHAR(64) NOT NULL,
    acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (session_id, dlc_id, upgrade_id),
    INDEX idx_GameUpgrades_dlc (dlc_id),
    CONSTRAINT fk_upgrades_session FOREIGN KEY (session_id)
      REFERENCES GameSessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS GameCertifications (
    session_id VARCHAR(64) NOT NULL,
    dlc_id VARCHAR(64) NOT NULL,
    certification_id VARCHAR(64) NOT NULL,
    acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (session_id, dlc_id, certification_id),
    INDEX idx_GameCertifications_dlc (dlc_id),
    CONSTRAINT fk_certifications_session FOREIGN KEY (session_id)
      REFERENCES GameSessions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

function hydrateLegacyState(value) {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  const dlcId = hasDlc(raw?.dlcId) ? raw.dlcId : DEFAULT_DLC_ID;
  const dlc = getDlc(dlcId);
  const defaults = createState(dlcId);
  return {
    ...defaults,
    ...(raw && typeof raw === 'object' ? raw : {}),
    dlcId,
    buildings: Object.fromEntries(dlc.BUILDINGS.map(building => [
      building.id,
      Math.max(0, Number(raw?.buildings?.[building.id]) || 0)
    ])),
    upgrades: Array.isArray(raw?.upgrades)
      ? raw.upgrades.filter(id => dlc.UPGRADES.some(upgrade => upgrade.id === id))
      : [],
    certifications: Array.isArray(raw?.certifications)
      ? raw.certifications.filter(id => dlc.CERTIFICATIONS.some(certification => certification.id === id))
      : []
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

async function hasTable(connection, table) {
  const rows = await connection.query(
    `SELECT 1
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1`,
    [table]
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

async function hasAnyIndex(connection, table, indexes) {
  for (const index of indexes) {
    if (await hasIndex(connection, table, index)) return true;
  }
  return false;
}

async function hasConstraint(connection, table, constraint) {
  const rows = await connection.query(
    `SELECT 1
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
      LIMIT 1`,
    [table, constraint]
  );
  return rows.length > 0;
}

async function hasAnyConstraint(connection, table, constraints) {
  for (const constraint of constraints) {
    if (await hasConstraint(connection, table, constraint)) return true;
  }
  return false;
}

async function migratePascalCaseTables(connection) {
  const renames = [];
  for (const [legacyName, targetName] of TABLE_RENAMES) {
    const legacyExists = await hasTable(connection, legacyName);
    const targetExists = await hasTable(connection, targetName);
    if (legacyExists && targetExists) {
      throw new Error(`Migration impossible : ${legacyName} et ${targetName} existent déjà.`);
    }
    if (legacyExists && !targetExists) renames.push(`${legacyName} TO ${targetName}`);
  }
  if (!renames.length) return 0;
  await connection.query(`RENAME TABLE ${renames.join(', ')}`);
  return renames.length;
}

async function saveCollection(connection, table, idColumn, sessionId, dlcId, values) {
  await connection.query(
    `DELETE FROM ${table} WHERE session_id = ? AND dlc_id = ?`,
    [sessionId, dlcId]
  );
  if (!values.length) return;
  await connection.batch(
    `INSERT INTO ${table} (session_id, dlc_id, ${idColumn}) VALUES (?, ?, ?)`,
    values.map(value => [sessionId, dlcId, value])
  );
}

async function saveState(connection, sessionId, state) {
  await connection.query(
    `INSERT INTO GameProgress (
       session_id, dlc_id, version, requests, lifetime_requests, combo, last_manual_click,
       overclock_charge, overclock_ends_at, certification_points, last_tick
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       version = VALUES(version),
       dlc_id = VALUES(dlc_id),
       requests = VALUES(requests),
       lifetime_requests = VALUES(lifetime_requests),
       combo = VALUES(combo),
       last_manual_click = VALUES(last_manual_click),
       overclock_charge = VALUES(overclock_charge),
       overclock_ends_at = VALUES(overclock_ends_at),
       certification_points = VALUES(certification_points),
       last_tick = VALUES(last_tick)`,
    [
      sessionId, state.dlcId || DEFAULT_DLC_ID, state.version, state.requests, state.lifetimeRequests, state.combo,
      state.lastManualClick, state.overclockCharge, state.overclockEndsAt,
      state.certificationPoints, state.lastTick
    ]
  );

  await connection.query(
    `INSERT INTO GameStats (
       session_id, dlc_id, all_time_requests, manual_clicks, critical_clicks, best_combo,
       total_buildings_purchased, prestige_count, completed_at, started_at, last_saved
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       all_time_requests = VALUES(all_time_requests),
       manual_clicks = VALUES(manual_clicks),
       critical_clicks = VALUES(critical_clicks),
       best_combo = VALUES(best_combo),
       total_buildings_purchased = VALUES(total_buildings_purchased),
       prestige_count = VALUES(prestige_count),
       completed_at = CASE
         WHEN GameStats.completed_at = 0 THEN VALUES(completed_at)
         ELSE GameStats.completed_at
       END,
       started_at = LEAST(GameStats.started_at, VALUES(started_at)),
       last_saved = VALUES(last_saved)`,
    [
      sessionId, state.dlcId || DEFAULT_DLC_ID, state.allTimeRequests, state.manualClicks, state.criticalClicks,
      state.bestCombo, state.totalBuildingsPurchased, state.prestigeCount,
      state.completedAt, state.startedAt, state.lastSaved
    ]
  );

  const dlcId = state.dlcId || DEFAULT_DLC_ID;
  await connection.query(
    'DELETE FROM GameBuildings WHERE session_id = ? AND dlc_id = ?',
    [sessionId, dlcId]
  );
  await connection.batch(
    'INSERT INTO GameBuildings (session_id, dlc_id, building_id, quantity) VALUES (?, ?, ?, ?)',
    getDlc(dlcId).BUILDINGS.map(building => [
      sessionId, dlcId, building.id, state.buildings[building.id] || 0
    ])
  );
  await saveCollection(connection, 'GameUpgrades', 'upgrade_id', sessionId, dlcId, state.upgrades);
  await saveCollection(
    connection,
    'GameCertifications',
    'certification_id',
    sessionId,
    dlcId,
    state.certifications
  );
  await connection.query(
    'UPDATE GameSessions SET updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [sessionId]
  );
}

async function loadState(connection, sessionId, requestedDlcId = DEFAULT_DLC_ID) {
  const dlcId = hasDlc(requestedDlcId) ? requestedDlcId : DEFAULT_DLC_ID;
  const progressRows = await connection.query(
    `SELECT version, dlc_id, requests, lifetime_requests, combo, last_manual_click,
            overclock_charge, overclock_ends_at, certification_points, last_tick
       FROM GameProgress WHERE session_id = ? AND dlc_id = ?`,
    [sessionId, dlcId]
  );
  if (!progressRows.length) return null;

  const statsRows = await connection.query(
    'SELECT * FROM GameStats WHERE session_id = ? AND dlc_id = ?',
    [sessionId, dlcId]
  );
  const buildingRows = await connection.query(
    'SELECT building_id, quantity FROM GameBuildings WHERE session_id = ? AND dlc_id = ?',
    [sessionId, dlcId]
  );
  const upgradeRows = await connection.query(
    'SELECT upgrade_id FROM GameUpgrades WHERE session_id = ? AND dlc_id = ?',
    [sessionId, dlcId]
  );
  const certificationRows = await connection.query(
    'SELECT certification_id FROM GameCertifications WHERE session_id = ? AND dlc_id = ?',
    [sessionId, dlcId]
  );

  const progress = progressRows[0];
  const stats = statsRows[0] || {};
  const state = createState(progress.dlc_id);
  state.version = Number(progress.version);
  state.dlcId = getDlc(progress.dlc_id).id;
  state.requests = Number(progress.requests);
  state.lifetimeRequests = Number(progress.lifetime_requests);
  state.combo = Number(progress.combo);
  state.lastManualClick = Number(progress.last_manual_click);
  state.overclockCharge = Number(progress.overclock_charge);
  state.overclockEndsAt = Number(progress.overclock_ends_at);
  state.certificationPoints = Number(progress.certification_points);
  state.lastTick = Number(progress.last_tick);
  state.allTimeRequests = Number(stats.all_time_requests || 0);
  state.manualClicks = Number(stats.manual_clicks || 0);
  state.criticalClicks = Number(stats.critical_clicks || 0);
  state.bestCombo = Number(stats.best_combo || 0);
  state.totalBuildingsPurchased = Number(stats.total_buildings_purchased || 0);
  state.prestigeCount = Number(stats.prestige_count || 0);
  state.completedAt = Number(stats.completed_at || 0);
  state.startedAt = Number(stats.started_at || state.startedAt);
  state.lastSaved = Number(stats.last_saved || state.lastSaved);
  buildingRows.forEach(row => {
    if (Object.hasOwn(state.buildings, row.building_id)) {
      state.buildings[row.building_id] = Number(row.quantity);
    }
  });
  state.upgrades = upgradeRows.map(row => row.upgrade_id);
  state.certifications = certificationRows.map(row => row.certification_id);
  if (!state.completedAt
    && state.upgrades.length >= getDlc(state.dlcId).UPGRADES.length
    && state.certifications.length >= getDlc(state.dlcId).CERTIFICATIONS.length) {
    state.completedAt = Date.now();
  }
  return state;
}

async function createSession(connection, sessionId, state = createState()) {
  await connection.query('INSERT INTO GameSessions (id) VALUES (?)', [sessionId]);
  await saveState(connection, sessionId, hydrateLegacyState(state));
  return state;
}

async function migrateLegacyStates(connection) {
  if (!await hasColumn(connection, 'GameSessions', 'state')) return 0;
  await connection.query('ALTER TABLE GameSessions MODIFY state LONGTEXT NULL');
  const rows = await connection.query(
    `SELECT sessions.id, sessions.state
       FROM GameSessions sessions
       LEFT JOIN GameProgress progress ON progress.session_id = sessions.id
      WHERE sessions.state IS NOT NULL AND progress.session_id IS NULL`
  );
  for (const row of rows) {
    await saveState(connection, row.id, hydrateLegacyState(row.state));
    await connection.query('UPDATE GameSessions SET state = NULL WHERE id = ?', [row.id]);
  }
  await connection.query('ALTER TABLE GameSessions DROP COLUMN state');
  return rows.length;
}

async function migrateToMultiDlcSchema(connection) {
  if (await hasColumn(connection, 'GameStats', 'dlc_id')
    && await hasColumn(connection, 'GameBuildings', 'dlc_id')
    && await hasColumn(connection, 'GameUpgrades', 'dlc_id')
    && await hasColumn(connection, 'GameCertifications', 'dlc_id')) {
    await connection.query('DROP TABLE IF EXISTS GameCertificationsLegacy');
    await connection.query('DROP TABLE IF EXISTS GameUpgradesLegacy');
    await connection.query('DROP TABLE IF EXISTS GameBuildingsLegacy');
    await connection.query('DROP TABLE IF EXISTS GameStatsLegacy');
    await connection.query('DROP TABLE IF EXISTS GameProgressLegacy');
    return 0;
  }

  await connection.query('DROP TABLE IF EXISTS GameCertificationsMulti');
  await connection.query('DROP TABLE IF EXISTS GameUpgradesMulti');
  await connection.query('DROP TABLE IF EXISTS GameBuildingsMulti');
  await connection.query('DROP TABLE IF EXISTS GameStatsMulti');
  await connection.query('DROP TABLE IF EXISTS GameProgressMulti');

  await connection.query(`
    CREATE TABLE GameProgressMulti (
      session_id VARCHAR(64) NOT NULL,
      dlc_id VARCHAR(64) NOT NULL,
      version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
      requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
      lifetime_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
      combo INT UNSIGNED NOT NULL DEFAULT 0,
      last_manual_click BIGINT UNSIGNED NOT NULL DEFAULT 0,
      overclock_charge DOUBLE UNSIGNED NOT NULL DEFAULT 0,
      overclock_ends_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
      certification_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
      last_tick BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (session_id, dlc_id),
      CONSTRAINT fk_progress_multi_session FOREIGN KEY (session_id)
        REFERENCES GameSessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE GameStatsMulti (
      session_id VARCHAR(64) NOT NULL,
      dlc_id VARCHAR(64) NOT NULL,
      all_time_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
      manual_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
      critical_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
      best_combo INT UNSIGNED NOT NULL DEFAULT 0,
      total_buildings_purchased BIGINT UNSIGNED NOT NULL DEFAULT 0,
      prestige_count INT UNSIGNED NOT NULL DEFAULT 0,
      completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
      started_at BIGINT UNSIGNED NOT NULL,
      last_saved BIGINT UNSIGNED NOT NULL,
      PRIMARY KEY (session_id, dlc_id),
      CONSTRAINT fk_stats_multi_session FOREIGN KEY (session_id)
        REFERENCES GameSessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE GameBuildingsMulti (
      session_id VARCHAR(64) NOT NULL,
      dlc_id VARCHAR(64) NOT NULL,
      building_id VARCHAR(64) NOT NULL,
      quantity BIGINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, dlc_id, building_id),
      CONSTRAINT fk_buildings_multi_session FOREIGN KEY (session_id)
        REFERENCES GameSessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE GameUpgradesMulti (
      session_id VARCHAR(64) NOT NULL,
      dlc_id VARCHAR(64) NOT NULL,
      upgrade_id VARCHAR(64) NOT NULL,
      acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (session_id, dlc_id, upgrade_id),
      CONSTRAINT fk_upgrades_multi_session FOREIGN KEY (session_id)
        REFERENCES GameSessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE GameCertificationsMulti (
      session_id VARCHAR(64) NOT NULL,
      dlc_id VARCHAR(64) NOT NULL,
      certification_id VARCHAR(64) NOT NULL,
      acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (session_id, dlc_id, certification_id),
      CONSTRAINT fk_certifications_multi_session FOREIGN KEY (session_id)
        REFERENCES GameSessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const progressCount = await connection.query('SELECT COUNT(*) AS count FROM GameProgress');
  await connection.query(`
    INSERT INTO GameProgressMulti
    SELECT session_id, COALESCE(NULLIF(dlc_id, ''), 'infra'), version, requests,
           lifetime_requests, combo, last_manual_click, overclock_charge,
           overclock_ends_at, certification_points, last_tick
      FROM GameProgress
  `);
  await connection.query(`
    INSERT INTO GameStatsMulti
    SELECT stats.session_id, COALESCE(NULLIF(progress.dlc_id, ''), 'infra'),
           stats.all_time_requests, stats.manual_clicks, stats.critical_clicks,
           stats.best_combo, stats.total_buildings_purchased, stats.prestige_count,
           stats.completed_at, stats.started_at, stats.last_saved
      FROM GameStats stats
      JOIN GameProgress progress ON progress.session_id = stats.session_id
  `);
  await connection.query(`
    INSERT INTO GameBuildingsMulti
    SELECT buildings.session_id, COALESCE(NULLIF(progress.dlc_id, ''), 'infra'),
           buildings.building_id, buildings.quantity
      FROM GameBuildings buildings
      JOIN GameProgress progress ON progress.session_id = buildings.session_id
  `);
  await connection.query(`
    INSERT INTO GameUpgradesMulti
    SELECT upgrades.session_id, COALESCE(NULLIF(progress.dlc_id, ''), 'infra'),
           upgrades.upgrade_id, upgrades.acquired_at
      FROM GameUpgrades upgrades
      JOIN GameProgress progress ON progress.session_id = upgrades.session_id
  `);
  await connection.query(`
    INSERT INTO GameCertificationsMulti
    SELECT certifications.session_id, COALESCE(NULLIF(progress.dlc_id, ''), 'infra'),
           certifications.certification_id, certifications.acquired_at
      FROM GameCertifications certifications
      JOIN GameProgress progress ON progress.session_id = certifications.session_id
  `);

  await connection.query(`
    RENAME TABLE
      GameProgress TO GameProgressLegacy,
      GameStats TO GameStatsLegacy,
      GameBuildings TO GameBuildingsLegacy,
      GameUpgrades TO GameUpgradesLegacy,
      GameCertifications TO GameCertificationsLegacy,
      GameProgressMulti TO GameProgress,
      GameStatsMulti TO GameStats,
      GameBuildingsMulti TO GameBuildings,
      GameUpgradesMulti TO GameUpgrades,
      GameCertificationsMulti TO GameCertifications
  `);
  await connection.query('DROP TABLE GameCertificationsLegacy');
  await connection.query('DROP TABLE GameUpgradesLegacy');
  await connection.query('DROP TABLE GameBuildingsLegacy');
  await connection.query('DROP TABLE GameStatsLegacy');
  await connection.query('DROP TABLE GameProgressLegacy');
  return Number(progressCount[0].count || 0);
}

async function purgeRemovedDlcData(connection) {
  const removedDlcIds = ['space'];
  const tables = [
    'GameCertifications',
    'GameUpgrades',
    'GameBuildings',
    'GameStats',
    'GameProgress'
  ];
  for (const table of tables) {
    await connection.query(
      `DELETE FROM ${table} WHERE dlc_id = ?`,
      [removedDlcIds[0]]
    );
  }
}

async function ensureIndex(connection, table, index, definition, aliases = []) {
  if (await hasAnyIndex(connection, table, [index, ...aliases])) return;
  await connection.query(`ALTER TABLE ${table} ADD INDEX ${index} ${definition}`);
}

async function optimizeSchema(connection) {
  await ensureIndex(
    connection,
    'GameStats',
    'idx_GameStats_leaderboard',
    '(dlc_id, prestige_count, all_time_requests)',
    ['idx_game_stats_leaderboard']
  );
  await ensureIndex(connection, 'GameProgress', 'idx_GameProgress_dlc', '(dlc_id)', ['idx_game_progress_dlc']);
  await ensureIndex(connection, 'GameBuildings', 'idx_GameBuildings_dlc', '(dlc_id)', ['idx_game_buildings_dlc']);
  await ensureIndex(connection, 'GameUpgrades', 'idx_GameUpgrades_dlc', '(dlc_id)', ['idx_game_upgrades_dlc']);
  await ensureIndex(
    connection,
    'GameCertifications',
    'idx_GameCertifications_dlc',
    '(dlc_id)',
    ['idx_game_certifications_dlc']
  );
  await ensureIndex(
    connection,
    'GameSessionLinks',
    'idx_GameSessionLinks_user_created',
    '(user_id, created_at)',
    ['idx_game_session_links_user_created']
  );
  await ensureIndex(
    connection,
    'GameSessionLinks',
    'idx_GameSessionLinks_session_created',
    '(session_id, created_at)',
    ['idx_game_session_links_session_created']
  );
}

async function initializeSchema(connection) {
  const tableRenamed = await migratePascalCaseTables(connection);
  for (const statement of TABLES) await connection.query(statement);
  if (!await hasColumn(connection, 'GameSessions', 'user_id')) {
    await connection.query(
      'ALTER TABLE GameSessions ADD COLUMN user_id VARCHAR(32) NULL AFTER id'
    );
  }
  if (!await hasColumn(connection, 'GameSessions', 'linked_at')) {
    await connection.query(
      'ALTER TABLE GameSessions ADD COLUMN linked_at DATETIME(3) NULL AFTER user_id'
    );
  }
  if (!await hasAnyIndex(connection, 'GameSessions', ['uq_GameSessions_user_id', 'uq_game_sessions_user_id'])) {
    await connection.query(
      'ALTER TABLE GameSessions ADD UNIQUE KEY uq_GameSessions_user_id (user_id)'
    );
  }
  if (!await hasAnyConstraint(connection, 'GameSessions', ['fk_GameSessions_user', 'fk_game_sessions_user'])) {
    await connection.query(
      `ALTER TABLE GameSessions
       ADD CONSTRAINT fk_GameSessions_user FOREIGN KEY (user_id)
       REFERENCES GameUsers(id) ON DELETE SET NULL`
    );
  }
  if (await hasIndex(connection, 'GameSessions', 'uq_GameSessions_username')) {
    await connection.query('ALTER TABLE GameSessions DROP INDEX uq_GameSessions_username');
  }
  if (await hasIndex(connection, 'GameSessions', 'uq_game_sessions_username')) {
    await connection.query('ALTER TABLE GameSessions DROP INDEX uq_game_sessions_username');
  }
  if (await hasIndex(connection, 'GameSessions', 'uq_GameSessions_username_key')) {
    await connection.query('ALTER TABLE GameSessions DROP INDEX uq_GameSessions_username_key');
  }
  if (await hasIndex(connection, 'GameSessions', 'uq_game_sessions_username_key')) {
    await connection.query('ALTER TABLE GameSessions DROP INDEX uq_game_sessions_username_key');
  }
  if (!await hasColumn(connection, 'GameSessions', 'username')) {
    await connection.query(`
      ALTER TABLE GameSessions
      ADD COLUMN username VARCHAR(64) NULL
    `);
  } else {
    await connection.query('ALTER TABLE GameSessions MODIFY username VARCHAR(64) NULL');
  }
  if (!await hasColumn(connection, 'GameSessions', 'username_key')) {
    await connection.query(
      'ALTER TABLE GameSessions ADD COLUMN username_key VARCHAR(128) NULL AFTER username'
    );
    await connection.query(
      'UPDATE GameSessions SET username_key = LOWER(TRIM(username)) WHERE username IS NOT NULL'
    );
  } else {
    await connection.query('ALTER TABLE GameSessions MODIFY username_key VARCHAR(128) NULL');
  }
  if (!await hasAnyIndex(connection, 'GameSessions', ['idx_GameSessions_username_key', 'idx_game_sessions_username_key'])) {
    await connection.query(
      'ALTER TABLE GameSessions ADD INDEX idx_GameSessions_username_key (username_key)'
    );
  }
  if (!await hasColumn(connection, 'GameSessions', 'country_code')) {
    await connection.query(
      'ALTER TABLE GameSessions ADD COLUMN country_code CHAR(2) NULL'
    );
  }
  if (!await hasColumn(connection, 'GameSessions', 'last_seen_at')) {
    await connection.query(`
      ALTER TABLE GameSessions
      ADD COLUMN last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      ADD INDEX idx_GameSessions_last_seen (last_seen_at)
    `);
  }
  if (!await hasColumn(connection, 'GameStats', 'completed_at')) {
    await connection.query(
      'ALTER TABLE GameStats ADD COLUMN completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER prestige_count'
    );
  }
  if (!await hasColumn(connection, 'GameProgress', 'dlc_id')) {
    await connection.query(
      "ALTER TABLE GameProgress ADD COLUMN dlc_id VARCHAR(64) NOT NULL DEFAULT 'infra' AFTER version"
    );
  }
  const multiDlcMigrated = await migrateToMultiDlcSchema(connection);
  await purgeRemovedDlcData(connection);
  if (await hasColumn(connection, 'GameProgress', 'click_window')) {
    await connection.query('ALTER TABLE GameProgress DROP COLUMN click_window');
  }
  if (await hasColumn(connection, 'GameStats', 'anti_cheat_violations')) {
    await connection.query('ALTER TABLE GameStats DROP COLUMN anti_cheat_violations');
  }
  await connection.query(
    `UPDATE GameStats stats
        SET stats.completed_at = stats.last_saved
      WHERE stats.completed_at = 0
        AND (SELECT COUNT(*) FROM GameUpgrades upgrades
              WHERE upgrades.session_id = stats.session_id
                AND upgrades.dlc_id = stats.dlc_id) >= ?
        AND (SELECT COUNT(*) FROM GameCertifications certifications
              WHERE certifications.session_id = stats.session_id
                AND certifications.dlc_id = stats.dlc_id) >= ?`,
    [getDlc(DEFAULT_DLC_ID).UPGRADES.length, getDlc(DEFAULT_DLC_ID).CERTIFICATIONS.length]
  );
  await connection.query(
    'ALTER TABLE GameBuildings MODIFY quantity BIGINT UNSIGNED NOT NULL DEFAULT 0'
  );
  await connection.query(
    'ALTER TABLE GameProgress MODIFY certification_points BIGINT UNSIGNED NOT NULL DEFAULT 0'
  );
  const migrated = await migrateLegacyStates(connection);
  const progressRows = await connection.query('SELECT session_id, dlc_id FROM GameProgress');
  for (const progress of progressRows) {
    const dlc = getDlc(progress.dlc_id);
    await connection.batch(
      `INSERT IGNORE INTO GameBuildings (session_id, dlc_id, building_id, quantity)
       VALUES (?, ?, ?, 0)`,
      dlc.BUILDINGS.map(building => [progress.session_id, dlc.id, building.id])
    );
  }
  await optimizeSchema(connection);
  return migrated + multiDlcMigrated + tableRenamed;
}

module.exports = {
  createSession,
  hydrateLegacyState,
  initializeSchema,
  loadState,
  saveState
};
