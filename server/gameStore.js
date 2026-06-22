const crypto = require('crypto');
const mariadb = require('mariadb');
const { createState } = require('./gameEngine');
const { DEFAULT_DLC_ID, hasDlc } = require('./gameData');
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

const CACHE_FLUSH_MS = Math.max(5000, Number(process.env.CACHE_FLUSH_MS) || 5000);
const CACHE_TTL_MS = Math.max(60000, Number(process.env.CACHE_TTL_MS) || 30 * 60 * 1000);
const LEADERBOARD_CACHE_MS = Math.max(5000, Number(process.env.LEADERBOARD_CACHE_MS) || 15000);
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

const sessionCache = new Map();
const sessionLocks = new Map();
let initialization;
const leaderboardCache = new Map();
let maintenanceTimer;

function missingDatabaseVariables() {
  return ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
    .filter(name => !process.env[name]?.trim());
}

async function connectAndPrepareDatabase() {
  const missing = missingDatabaseVariables();
  if (missing.length) throw new Error(`Configuration MariaDB incomplète : ${missing.join(', ')}`);

  console.log(`[MariaDB] Tentative de connexion à ${databaseConfig.host}:${databaseConfig.port}`);
  const connection = await pool.getConnection();
  try {
    console.log('[MariaDB] Connexion établie');
    const migrated = await initializeSchema(connection);
    console.log(`[MariaDB] Schéma relationnel prêt${migrated ? ` — ${migrated} progression(s) migrée(s)` : ''}`);
  } finally {
    connection.release();
  }

  if (!maintenanceTimer) {
    maintenanceTimer = setInterval(runCacheMaintenance, CACHE_FLUSH_MS);
    maintenanceTimer.unref();
    console.log(`[Cache] Sessions actives en mémoire — flush ${CACHE_FLUSH_MS} ms, TTL ${CACHE_TTL_MS} ms`);
  }
}

function initializeDatabase() {
  if (!initialization) {
    initialization = connectAndPrepareDatabase().catch(error => {
      initialization = null;
      console.error(`[MariaDB] Échec de connexion (${error.code || error.errno || 'ERREUR'}) : ${error.message}`);
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
  res.append('Set-Cookie', `infra_session=${signedCookie(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`);
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

async function withSessionLock(id, callback) {
  const previous = sessionLocks.get(id) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  sessionLocks.set(id, gate);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (sessionLocks.get(id) === gate) sessionLocks.delete(id);
  }
}

function profileFromRow(row = {}) {
  return {
    username: row.username || null,
    countryCode: String(row.country_code || 'XX').trim().toUpperCase()
  };
}

async function loadCachedSession(id) {
  const cached = sessionCache.get(id);
  if (cached) {
    cached.lastAccess = Date.now();
    return cached;
  }

  const connection = await pool.getConnection();
  try {
    const rows = await connection.query(
      'SELECT username, country_code FROM game_sessions WHERE id = ?',
      [id]
    );
    if (!rows.length) return null;
    const entry = {
      id,
      states: new Map(),
      dirtyStates: new Set(),
      profile: profileFromRow(rows[0]),
      countryCode: profileFromRow(rows[0]).countryCode,
      dirty: false,
      lastAccess: Date.now(),
      lastSeen: Date.now()
    };
    sessionCache.set(id, entry);
    return entry;
  } finally {
    connection.release();
  }
}

async function createCachedSession(res) {
  const id = sessionId();
  const state = createState(DEFAULT_DLC_ID);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await createSession(connection, id, state);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  const entry = {
    id,
    states: new Map([[state.dlcId, state]]),
    dirtyStates: new Set(),
    profile: { username: null, countryCode: 'XX' },
    countryCode: 'XX',
    dirty: false,
    lastAccess: Date.now(),
    lastSeen: Date.now()
  };
  sessionCache.set(id, entry);
  setSessionCookie(res, id);
  return entry;
}

async function resolveSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const id = verifiedId(cookies.infra_session);
  return (id && await loadCachedSession(id)) || createCachedSession(res);
}

async function persistEntry(entry) {
  if (!entry.dirty && !entry.dirtyStates.size) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE game_sessions
          SET last_seen_at = FROM_UNIXTIME(? / 1000),
              country_code = CASE WHEN ? <> 'XX' THEN ? ELSE country_code END
        WHERE id = ?`,
      [entry.lastSeen, entry.countryCode, entry.countryCode, entry.id]
    );
    for (const dlcId of entry.dirtyStates) {
      const state = entry.states.get(dlcId);
      if (state) await saveState(connection, entry.id, state);
    }
    await connection.commit();
    entry.dirty = false;
    entry.dirtyStates.clear();
  } catch (error) {
    await connection.rollback();
    console.error(`[Cache] Échec du flush ${entry.id.slice(0, 8)}… : ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

async function flushSession(id) {
  return withSessionLock(id, async () => {
    const entry = sessionCache.get(id);
    if (entry) await persistEntry(entry);
  });
}

async function flushAllSessions() {
  await Promise.allSettled([...sessionCache.keys()].map(flushSession));
}

async function runCacheMaintenance() {
  const now = Date.now();
  for (const [id, entry] of sessionCache) {
    if (entry.dirty || entry.dirtyStates.size) await flushSession(id).catch(() => {});
    if (!entry.dirty && !entry.dirtyStates.size && now - entry.lastAccess > CACHE_TTL_MS) {
      sessionCache.delete(id);
    }
  }
}

async function transactSession(req, res, handler) {
  await initializeDatabase();
  const entry = await resolveSession(req, res);
  return withSessionLock(entry.id, async () => {
    entry.lastAccess = Date.now();
    entry.lastSeen = Date.now();
    const dlcId = requestDlcId(req);
    const state = await resolveDlcState(entry, dlcId);
    const result = await handler(state, entry.id, entry);
    entry.dirtyStates.add(dlcId);
    entry.dirty = true;
    if (process.env.NETWORK_DEBUG === 'true') {
      console.log(`[Network] session=${entry.id.slice(0, 8)}… pays-cache=${entry.countryCode}`);
    }
    return result;
  });
}

function requestDlcId(req) {
  const candidate = req.body?.state?.dlcId || req.body?.dlcId || req.query?.dlc;
  return hasDlc(candidate) ? candidate : DEFAULT_DLC_ID;
}

async function resolveDlcState(entry, dlcId) {
  const cached = entry.states.get(dlcId);
  if (cached) return cached;
  const connection = await pool.getConnection();
  try {
    const storedState = await loadState(connection, entry.id, dlcId);
    const state = storedState || createState(dlcId);
    entry.states.set(dlcId, state);
    if (!storedState) entry.dirtyStates.add(dlcId);
    return state;
  } finally {
    connection.release();
  }
}

async function recordPageAccess(req, res) {
  await initializeDatabase();
  const entry = await resolveSession(req, res);
  return withSessionLock(entry.id, async () => {
    entry.lastAccess = Date.now();
    entry.lastSeen = Date.now();
    const detectedCountry = req.clientNetwork?.countryCode || 'XX';
    if (detectedCountry !== 'XX') {
      entry.countryCode = detectedCountry;
      entry.profile.countryCode = detectedCountry;
    }
    entry.dirty = true;
    if (process.env.NETWORK_DEBUG === 'true') {
      console.log(
        `[Network] accès-page session=${entry.id.slice(0, 8)}…`
        + ` ip=${req.clientNetwork?.ip || 'inconnue'}`
        + ` pays=${entry.countryCode}`
      );
    }
  });
}

function getProfile(entry) {
  return { ...entry.profile };
}

async function setProfile(entry, username) {
  const normalized = normalizeUsername(username);
  const key = usernameKey(normalized);
  const connection = await pool.getConnection();
  try {
    const duplicates = await connection.query(
      'SELECT 1 FROM game_sessions WHERE username_key = ? AND id <> ? LIMIT 1',
      [key, entry.id]
    );
    if (duplicates.length) throw Object.assign(new Error('Ce pseudo est déjà utilisé.'), { status: 409 });
    await connection.query(
      'UPDATE game_sessions SET username = ?, username_key = ? WHERE id = ?',
      [normalized, key, entry.id]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw Object.assign(new Error('Ce pseudo est déjà utilisé.'), { status: 409 });
    }
    throw error;
  } finally {
    connection.release();
  }
  entry.profile.username = normalized;
  leaderboardCache.clear();
  return getProfile(entry);
}

async function getLeaderboard(dlcId = 'infra', limit = 23) {
  await initializeDatabase();
  const cached = leaderboardCache.get(dlcId);
  if (cached?.expiresAt > Date.now()) return cached.players;
  const safeLimit = Math.min(23, Math.max(1, Number(limit) || 23));
  const rows = await pool.query(
    `SELECT sessions.username, sessions.country_code, progress.dlc_id,
            stats.all_time_requests, stats.prestige_count,
            stats.total_buildings_purchased, stats.started_at, stats.completed_at
       FROM game_sessions sessions
       JOIN game_stats stats ON stats.session_id = sessions.id
       JOIN game_progress progress
         ON progress.session_id = stats.session_id
        AND progress.dlc_id = stats.dlc_id
      WHERE sessions.username IS NOT NULL
        AND stats.dlc_id = ?
      ORDER BY stats.prestige_count DESC, stats.all_time_requests DESC, sessions.created_at ASC
      LIMIT ?`,
    [dlcId, safeLimit]
  );
  const players = rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    dlcId: row.dlc_id || 'infra',
    countryCode: String(row.country_code || 'XX').trim().toUpperCase(),
    requests: Number(row.all_time_requests),
    prestigeCount: Number(row.prestige_count),
    buildings: Number(row.total_buildings_purchased),
    completed: Number(row.completed_at) > 0,
    completionTimeMs: Number(row.completed_at) > 0
      ? Math.max(0, Number(row.completed_at) - Number(row.started_at))
      : null
  }));
  leaderboardCache.set(dlcId, { players, expiresAt: Date.now() + LEADERBOARD_CACHE_MS });
  return players;
}

function countOnlinePlayers(activeSeconds = 30) {
  const threshold = Date.now() - Math.min(300, Math.max(10, Number(activeSeconds) || 30)) * 1000;
  return [...sessionCache.values()].filter(entry => entry.lastSeen >= threshold).length;
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

async function closeDatabase() {
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  await flushAllSessions();
  await pool.end();
}

module.exports = {
  closeDatabase,
  countOnlinePlayers,
  flushAllSessions,
  getLeaderboard,
  getProfile,
  importSessions,
  initializeDatabase,
  recordPageAccess,
  setProfile,
  transactSession
};
