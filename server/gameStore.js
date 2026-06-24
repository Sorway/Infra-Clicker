const crypto = require('crypto');
const mariadb = require('mariadb');
const { createState } = require('./gameEngine');
const { DEFAULT_DLC_ID, DLC_REGISTRY, hasDlc } = require('./gameData');
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
const DISCORD_AUTH_MAX_AGE = 24 * 60 * 60;
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
const PROFILE_REFRESH_MS = 15000;

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

function setDiscordAuthCookie(res, discordId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `infra_discord=${signedCookie(discordId)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DISCORD_AUTH_MAX_AGE}${secure}`);
}

function discordAvatarUrl(userId, avatarHash) {
  if (!userId) return null;
  if (!avatarHash) {
    let index = 0;
    try {
      index = Number((BigInt(userId) >> 22n) % 6n);
    } catch {
      index = 0;
    }
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const extension = String(avatarHash).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatarHash)}.${extension}?size=64`;
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
  const discordId = row.user_id || row.discord_id || null;
  return {
    username: row.discord_global_name || row.discord_username || row.username || null,
    countryCode: String(row.country_code || 'XX').trim().toUpperCase(),
    discord: discordId ? {
      id: discordId,
      username: row.discord_username || null,
      globalName: row.discord_global_name || null,
      avatarUrl: discordAvatarUrl(discordId, row.discord_avatar)
    } : null
  };
}

async function loadProfileRow(connection, id) {
  const rows = await connection.query(
    `SELECT sessions.username, sessions.country_code, sessions.user_id,
            users.id AS discord_id, users.discord_username,
            users.discord_global_name, users.discord_avatar
       FROM GameSessions sessions
       LEFT JOIN GameUsers users ON users.id = sessions.user_id
      WHERE sessions.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function refreshCachedProfile(entry, force = false) {
  if (!force && entry.profileLoadedAt && Date.now() - entry.profileLoadedAt < PROFILE_REFRESH_MS) return entry;
  const connection = await pool.getConnection();
  try {
    const row = await loadProfileRow(connection, entry.id);
    if (!row) return null;
    entry.profile = profileFromRow(row);
    entry.countryCode = entry.profile.countryCode;
    entry.profileLoadedAt = Date.now();
    return entry;
  } finally {
    connection.release();
  }
}

async function loadCachedSession(id) {
  const cached = sessionCache.get(id);
  if (cached) {
    cached.lastAccess = Date.now();
    if (!cached.profile?.discord) return refreshCachedProfile(cached, true);
    await refreshCachedProfile(cached).catch(() => cached);
    return cached;
  }

  const connection = await pool.getConnection();
  try {
    const row = await loadProfileRow(connection, id);
    if (!row) return null;
    const entry = {
      id,
      states: new Map(),
      dirtyStates: new Set(),
      profile: profileFromRow(row),
      countryCode: profileFromRow(row).countryCode,
      dirty: false,
      lastAccess: Date.now(),
      lastSeen: Date.now(),
      profileLoadedAt: Date.now()
    };
    sessionCache.set(id, entry);
    return entry;
  } finally {
    connection.release();
  }
}

async function loadCachedDiscordSession(discordId) {
  if (!/^\d{5,32}$/.test(String(discordId || ''))) return null;
  const rows = await pool.query(
    'SELECT id FROM GameSessions WHERE user_id = ? LIMIT 1',
    [discordId]
  );
  return rows.length ? loadCachedSession(rows[0].id) : null;
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
  const discordId = verifiedId(cookies.infra_discord);
  if (discordId) {
    const discordEntry = await loadCachedDiscordSession(discordId);
    if (discordEntry) {
      setSessionCookie(res, discordEntry.id);
      setDiscordAuthCookie(res, discordId);
      return discordEntry;
    }
  }
  const id = verifiedId(cookies.infra_session);
  const sessionEntry = id && await loadCachedSession(id);
  if (sessionEntry?.profile?.discord?.id) {
    setDiscordAuthCookie(res, sessionEntry.profile.discord.id);
    return sessionEntry;
  }
  return sessionEntry || createCachedSession(res);
}

async function persistEntry(entry) {
  if (!entry.dirty && !entry.dirtyStates.size) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE GameSessions
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

async function resolveCurrentProfile(req, res) {
  await initializeDatabase();
  const entry = await resolveSession(req, res);
  return getProfile(entry);
}

async function setProfile(entry, username) {
  throw Object.assign(new Error('Le pseudo est maintenant fourni automatiquement par Discord.'), { status: 410 });
}

function discordDisplayName(discordUser) {
  return String(discordUser.global_name || discordUser.username || 'Discord').trim().slice(0, 64);
}

function progressionScore(state) {
  if (!state) return [-1, -1, -1];
  return [
    Number(state.prestigeCount) || 0,
    Number(state.allTimeRequests) || Number(state.lifetimeRequests) || 0,
    Number(state.lastSaved) || 0
  ];
}

function isBetterProgress(candidate, current) {
  const candidateScore = progressionScore(candidate);
  const currentScore = progressionScore(current);
  return candidateScore.some((value, index) => (
    value > currentScore[index]
      && candidateScore.slice(0, index).every((previous, previousIndex) => previous === currentScore[previousIndex])
  ));
}

function mergeProgressState(localState, discordState) {
  if (!localState) return discordState;
  if (!discordState) return localState;
  const base = isBetterProgress(localState, discordState) ? localState : discordState;
  const other = base === localState ? discordState : localState;
  const dlcId = base.dlcId || other.dlcId || DEFAULT_DLC_ID;
  const buildingIds = Object.keys({ ...(base.buildings || {}), ...(other.buildings || {}) });
  const completedDates = [base.completedAt, other.completedAt]
    .map(value => Number(value) || 0)
    .filter(Boolean);
  return {
    ...base,
    dlcId,
    requests: Math.max(Number(base.requests) || 0, Number(other.requests) || 0),
    lifetimeRequests: Math.max(Number(base.lifetimeRequests) || 0, Number(other.lifetimeRequests) || 0),
    allTimeRequests: Math.max(Number(base.allTimeRequests) || 0, Number(other.allTimeRequests) || 0),
    manualClicks: Math.max(Number(base.manualClicks) || 0, Number(other.manualClicks) || 0),
    criticalClicks: Math.max(Number(base.criticalClicks) || 0, Number(other.criticalClicks) || 0),
    bestCombo: Math.max(Number(base.bestCombo) || 0, Number(other.bestCombo) || 0),
    totalBuildingsPurchased: Math.max(Number(base.totalBuildingsPurchased) || 0, Number(other.totalBuildingsPurchased) || 0),
    buildings: Object.fromEntries(buildingIds.map(id => [
      id,
      Math.max(Number(base.buildings?.[id]) || 0, Number(other.buildings?.[id]) || 0)
    ])),
    upgrades: [...new Set([...(base.upgrades || []), ...(other.upgrades || [])])],
    certifications: [...new Set([...(base.certifications || []), ...(other.certifications || [])])],
    certificationPoints: Math.max(Number(base.certificationPoints) || 0, Number(other.certificationPoints) || 0),
    prestigeCount: Math.max(Number(base.prestigeCount) || 0, Number(other.prestigeCount) || 0),
    completedAt: completedDates.length ? Math.min(...completedDates) : 0,
    startedAt: Math.min(Number(base.startedAt) || Date.now(), Number(other.startedAt) || Date.now()),
    lastTick: Math.max(Number(base.lastTick) || 0, Number(other.lastTick) || 0),
    lastSaved: Math.max(Number(base.lastSaved) || 0, Number(other.lastSaved) || 0)
  };
}

async function mergeSessionProgress(connection, sourceSessionId, targetSessionId) {
  if (!sourceSessionId || !targetSessionId || sourceSessionId === targetSessionId) return 0;
  const rows = await connection.query(
    `SELECT DISTINCT dlc_id FROM GameProgress WHERE session_id IN (?, ?)`,
    [sourceSessionId, targetSessionId]
  );
  const dlcIds = rows.map(row => row.dlc_id).filter(hasDlc);
  if (!dlcIds.length) dlcIds.push(...Object.keys(DLC_REGISTRY));
  let merged = 0;
  for (const dlcId of [...new Set(dlcIds)]) {
    const localState = await loadState(connection, sourceSessionId, dlcId);
    if (!localState) continue;
    const discordState = await loadState(connection, targetSessionId, dlcId);
    await saveState(connection, targetSessionId, mergeProgressState(localState, discordState));
    merged += 1;
  }
  return merged;
}

async function authenticateDiscordUser(req, res, discordUser, preferredSessionId = null) {
  await initializeDatabase();
  const preferredEntry = preferredSessionId ? await loadCachedSession(preferredSessionId) : null;
  const entry = preferredEntry || await resolveSession(req, res);
  setSessionCookie(res, entry.id);
  await flushSession(entry.id);
  const discordId = String(discordUser.id || '').trim();
  if (!/^\d{5,32}$/.test(discordId)) {
    throw Object.assign(new Error('Identité Discord invalide.'), { status: 400 });
  }

  const connection = await pool.getConnection();
  let targetSessionId = entry.id;
  let action = 'linked';
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO GameUsers (
         id, discord_username, discord_global_name, discord_avatar, last_login_at
       ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         discord_username = VALUES(discord_username),
         discord_global_name = VALUES(discord_global_name),
         discord_avatar = VALUES(discord_avatar),
         last_login_at = CURRENT_TIMESTAMP(3)`,
      [
        discordId,
        String(discordUser.username || '').slice(0, 64) || null,
        discordDisplayName(discordUser).slice(0, 64) || null,
        String(discordUser.avatar || '').slice(0, 128) || null
      ]
    );

    const linkedRows = await connection.query(
      'SELECT id FROM GameSessions WHERE user_id = ? LIMIT 1',
      [discordId]
    );
    const publicName = discordDisplayName(discordUser);
    const publicKey = usernameKey(`${discordId}:${publicName}`).slice(0, 128);
    if (linkedRows.length && linkedRows[0].id !== entry.id) {
      targetSessionId = linkedRows[0].id;
      const mergedDlcs = await mergeSessionProgress(connection, entry.id, targetSessionId);
      action = mergedDlcs ? 'merged' : 'existing';
      await connection.query(
        'UPDATE GameSessions SET username = ?, username_key = ? WHERE id = ?',
        [publicName, publicKey, targetSessionId]
      );
    } else {
      await connection.query(
        `UPDATE GameSessions
            SET user_id = ?,
                linked_at = COALESCE(linked_at, CURRENT_TIMESTAMP(3)),
                username = ?,
                username_key = ?
          WHERE id = ?`,
        [discordId, publicName, publicKey, entry.id]
      );
      entry.profile.username = publicName;
      entry.profile.discord = {
        id: discordId,
        username: String(discordUser.username || '').slice(0, 64) || null,
        globalName: publicName,
        avatarUrl: discordAvatarUrl(discordId, discordUser.avatar)
      };
      entry.profileLoadedAt = 0;
    }

    await connection.query(
      'INSERT INTO GameSessionLinks (user_id, session_id, action) VALUES (?, ?, ?)',
      [discordId, targetSessionId, action]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  setDiscordAuthCookie(res, discordId);
  if (targetSessionId !== entry.id) setSessionCookie(res, targetSessionId);
  sessionCache.delete(entry.id);
  sessionCache.delete(targetSessionId);
  leaderboardCache.clear();
  return { action, sessionId: targetSessionId };
}

async function getLeaderboard(dlcId = 'infra', limit = 23) {
  await initializeDatabase();
  const cached = leaderboardCache.get(dlcId);
  if (cached?.expiresAt > Date.now()) return cached.players;
  const safeLimit = Math.min(23, Math.max(1, Number(limit) || 23));
  const rows = await pool.query(
    `SELECT COALESCE(NULLIF(users.discord_global_name, ''), users.discord_username, sessions.username) AS username,
            sessions.country_code, sessions.user_id, users.discord_avatar, progress.dlc_id,
            stats.all_time_requests, stats.prestige_count,
            stats.total_buildings_purchased, stats.started_at, stats.completed_at
       FROM GameSessions sessions
       JOIN GameUsers users ON users.id = sessions.user_id
       JOIN GameStats stats ON stats.session_id = sessions.id
       JOIN GameProgress progress
         ON progress.session_id = stats.session_id
        AND progress.dlc_id = stats.dlc_id
      WHERE sessions.user_id IS NOT NULL
        AND stats.dlc_id = ?
      ORDER BY stats.prestige_count DESC, stats.all_time_requests DESC, sessions.created_at ASC
      LIMIT ?`,
    [dlcId, safeLimit]
  );
  const players = rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    avatarUrl: discordAvatarUrl(row.user_id, row.discord_avatar),
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
  return [...sessionCache.values()].filter(entry => (
    entry.lastSeen >= threshold
    && entry.profile?.discord?.id
  )).length;
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
        'INSERT INTO GameSessions (id) VALUES (?) ON DUPLICATE KEY UPDATE id = VALUES(id)',
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
  authenticateDiscordUser,
  countOnlinePlayers,
  flushAllSessions,
  getLeaderboard,
  getProfile,
  importSessions,
  initializeDatabase,
  recordPageAccess,
  resolveCurrentProfile,
  setProfile,
  transactSession
};
