const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createState } = require('./gameEngine');

const STORE_PATH = path.join(__dirname, '..', 'data', 'game-sessions.json');
const sessions = new Map();
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET est obligatoire en production');
}
const cookieSecret = process.env.SESSION_SECRET || 'infra-clicker-development-secret-change-me';
let persistTimer = null;

try {
  const stored = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  Object.entries(stored).forEach(([id, state]) => sessions.set(id, state));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Impossible de charger les sessions de jeu', error);
}

function persist() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const temporaryPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(Object.fromEntries(sessions)), 'utf8');
  fs.renameSync(temporaryPath, STORE_PATH);
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

function getSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  let id = verifiedId(cookies.infra_session);
  if (!id || !sessions.has(id)) {
    id = sessionId();
    sessions.set(id, createState());
    persist();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.append('Set-Cookie', `infra_session=${signedCookie(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`);
  }
  return { id, state: sessions.get(id) };
}

function saveSession(id) {
  if (!sessions.has(id)) throw new Error('Session inconnue');
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist();
  }, 500);
  persistTimer.unref();
}

function resetSession(id) {
  const state = createState();
  sessions.set(id, state);
  saveSession(id);
  return state;
}

module.exports = { getSession, resetSession, saveSession };
