const crypto = require('crypto');
const mariadb = require('mariadb');
const { createState } = require('./gameEngine');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET est obligatoire en production');
}

const cookieSecret = process.env.SESSION_SECRET || 'infra-clicker-development-secret-change-me';
const configuredHost = process.env.DB_HOST || '127.0.0.1';
const hostWithPort = configuredHost.match(/^([^:]+):(\d+)$/);
const pool = mariadb.createPool({
  host: hostWithPort ? hostWithPort[1] : configuredHost,
  port: Number(hostWithPort?.[2] || process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'infra_clicker',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'infra_clicker',
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  acquireTimeout: 10000,
  bigIntAsNumber: true
});

let initialization;

function initializeDatabase() {
  if (!initialization) {
    initialization = pool.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        state LONGTEXT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => {
      initialization = null;
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

function hydrateState(value) {
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
        'SELECT state FROM game_sessions WHERE id = ? FOR UPDATE',
        [id]
      );
      if (rows.length) state = hydrateState(rows[0].state);
    }

    if (!state) {
      id = sessionId();
      state = createState();
      await connection.query(
        'INSERT INTO game_sessions (id, state) VALUES (?, ?)',
        [id, JSON.stringify(state)]
      );
      setSessionCookie(res, id);
    }

    const result = await handler(state, id);
    await connection.query(
      'UPDATE game_sessions SET state = ? WHERE id = ?',
      [JSON.stringify(state), id]
    );
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function closeDatabase() {
  await pool.end();
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
        `INSERT INTO game_sessions (id, state)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE state = VALUES(state)`,
        [id, JSON.stringify(hydrateState(state))]
      );
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
  importSessions,
  initializeDatabase,
  transactSession
};
