const crypto = require('crypto');
const mariadb = require('mariadb');
const { createState } = require('./gameEngine');
const {
  createSession,
  hydrateLegacyState,
  initializeSchema,
  loadState,
  saveState
} = require('./gameRepository');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET est obligatoire en production');
}

const cookieSecret = process.env.SESSION_SECRET || 'infra-clicker-development-secret-change-me';
const configuredHost = process.env.DB_HOST || '127.0.0.1';
const hostWithPort = configuredHost.match(/^([^:]+):(\d+)$/);
const databaseConfig = {
  host: hostWithPort ? hostWithPort[1] : configuredHost,
  port: Number(hostWithPort?.[2] || process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'infra_clicker',
  database: process.env.DB_NAME || 'infra_clicker'
};
const pool = mariadb.createPool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: process.env.DB_PASSWORD || '',
  database: databaseConfig.database,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  acquireTimeout: 10000,
  bigIntAsNumber: true
});

let initialization;

function missingDatabaseVariables() {
  return ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
    .filter(name => !process.env[name]?.trim());
}

async function connectAndPrepareDatabase() {
  const missing = missingDatabaseVariables();
  if (missing.length) {
    throw new Error(`Configuration MariaDB incomplète : ${missing.join(', ')}`);
  }

  console.log(`[MariaDB] Tentative de connexion à ${databaseConfig.host}:${databaseConfig.port}`);
  const connection = await pool.getConnection();
  try {
    console.log('[MariaDB] Connexion établie');
    const migrated = await initializeSchema(connection);
    console.log(`[MariaDB] Schéma relationnel prêt${migrated ? ` — ${migrated} session(s) migrée(s)` : ''}`);
  } finally {
    connection.release();
  }
}

function initializeDatabase() {
  if (!initialization) {
    initialization = connectAndPrepareDatabase()
      .catch(error => {
        initialization = null;
        console.error(
          `[MariaDB] Échec de connexion (${error.code || error.errno || 'ERREUR'}) : ${error.message}`
        );
        throw error;
      });
  }
  return initialization;
}

function sessionId() {
  return crypto.randomBytes(24).toString('base64url');
}

function sign(id) {
  return crypto.createHmac('sha256', cookieSecret).update(id).digest('base64url');
}

function signedCookie(id) {
  return `${id}.${sign(id)}`;
}

function verifiedId(value = '') {
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter(([key]) => key));
}

function setSessionCookie(res, id) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `infra_session=${signedCookie(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`
  );
}

function countryFromRequest(req) {
  return req.clientNetwork?.countryCode || 'XX';
}

function normalizeUsername(value) {
  const username = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (username.length < 3 || username.length > 20) {
    throw Object.assign(new Error('Le pseudo doit contenir entre 3 et 20 caractères.'), { status: 400 });
  }
  if (!/^[\p{L}\p{N}_ -]+$/u.test(username)) {
    throw Object.assign(new Error('Utilisez uniquement des lettres, chiffres, espaces, tirets ou underscores.'), { status: 400 });
  }
  return username;
}

function usernameKey(username) {
  return username.normalize('NFKC').toLocaleLowerCase('fr-FR');
}

async function transactSession(req, res, handler) {
  await initializeDatabase();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const cookies = parseCookies(req.headers.cookie);
    let id = verifiedId(cookies.infra_session);
    let state;

    if (id) {
      const rows = await connection.query(
        'SELECT id FROM game_sessions WHERE id = ? FOR UPDATE',
        [id]
      );
      if (rows.length) state = await loadState(connection, id);
    }

    if (!state) {
      id = sessionId();
      state = createState();
      await createSession(connection, id, state);
      setSessionCookie(res, id);
    }

    await connection.query(
      `UPDATE game_sessions
          SET last_seen_at = CURRENT_TIMESTAMP(3),
              country_code = CASE
                WHEN country_code IS NULL OR country_code = 'XX' THEN ?
                ELSE country_code
              END
        WHERE id = ?`,
      [countryFromRequest(req), id]
    );
    const result = await handler(state, id, connection);
    await saveState(connection, id, state);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error(
      `[MariaDB] Transaction annulée (${error.code || error.errno || 'ERREUR'}) : ${error.message}`
    );
    throw error;
  } finally {
    connection.release();
  }
}

async function getProfile(connection, sessionId) {
  const rows = await connection.query(
    'SELECT username, country_code FROM game_sessions WHERE id = ?',
    [sessionId]
  );
  return rows.length ? {
    username: rows[0].username || null,
    countryCode: String(rows[0].country_code || 'XX').trim().toUpperCase()
  } : null;
}

async function setProfile(connection, sessionId, username) {
  const normalized = normalizeUsername(username);
  const key = usernameKey(normalized);
  const duplicates = await connection.query(
    'SELECT 1 FROM game_sessions WHERE username_key = ? AND id <> ? LIMIT 1',
    [key, sessionId]
  );
  if (duplicates.length) {
    throw Object.assign(new Error('Ce pseudo est déjà utilisé.'), { status: 409 });
  }
  try {
    await connection.query(
      'UPDATE game_sessions SET username = ?, username_key = ? WHERE id = ?',
      [normalized, key, sessionId]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw Object.assign(new Error('Ce pseudo est déjà utilisé.'), { status: 409 });
    }
    throw error;
  }
  return getProfile(connection, sessionId);
}

async function getLeaderboard(limit = 100) {
  await initializeDatabase();
  const safeLimit = Math.min(100, Math.max(10, Number(limit) || 50));
  const rows = await pool.query(
    `SELECT sessions.username, sessions.country_code,
            stats.all_time_requests, stats.prestige_count,
            stats.total_buildings_purchased
       FROM game_sessions sessions
       JOIN game_stats stats ON stats.session_id = sessions.id
      WHERE sessions.username IS NOT NULL
      ORDER BY stats.all_time_requests DESC, stats.prestige_count DESC, sessions.created_at ASC
      LIMIT ?`,
    [safeLimit]
  );
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    countryCode: String(row.country_code || 'XX').trim().toUpperCase(),
    requests: Number(row.all_time_requests),
    prestigeCount: Number(row.prestige_count),
    buildings: Number(row.total_buildings_purchased)
  }));
}

async function closeDatabase() {
  await pool.end();
}

async function countOnlinePlayers(activeSeconds = 30) {
  await initializeDatabase();
  const seconds = Math.min(300, Math.max(10, Number(activeSeconds) || 30));
  const rows = await pool.query(
    `SELECT COUNT(*) AS count
       FROM game_sessions
      WHERE last_seen_at >= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ? SECOND)`,
    [seconds]
  );
  return Number(rows[0].count);
}

async function importSessions(sessions) {
  await initializeDatabase();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    let imported = 0;
    for (const [id, state] of Object.entries(sessions)) {
      if (!/^[A-Za-z0-9_-]{32}$/.test(id) || !state || typeof state !== 'object') continue;
      await connection.query(
        'INSERT INTO game_sessions (id) VALUES (?) ON DUPLICATE KEY UPDATE id = VALUES(id)',
        [id]
      );
      await saveState(connection, id, hydrateLegacyState(state));
      imported += 1;
    }
    await connection.commit();
    return imported;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  closeDatabase,
  countOnlinePlayers,
  getLeaderboard,
  getProfile,
  importSessions,
  initializeDatabase,
  setProfile,
  transactSession
};
