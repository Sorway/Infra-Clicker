const crypto = require('crypto');
const express = require('express');
const { authenticateDiscordUser } = require('../server/gameStore');

const router = express.Router();
const cookieSecret = process.env.SESSION_SECRET || 'infra-clicker-development-secret-change-me';
const DISCORD_API = 'https://discord.com/api/v10';
const OAUTH_COOKIE = 'infra_oauth_state';

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }).filter(([key]) => key));
}

function sign(value) {
  return crypto.createHmac('sha256', cookieSecret).update(value).digest('base64url');
}

function verifiedSessionId(value = '') {
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}

function baseUrl(req) {
  return (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function redirectUri(req) {
  return process.env.DISCORD_REDIRECT_URI || `${baseUrl(req)}/auth/discord/callback`;
}

function stateToken(nonce, sessionId) {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = `${nonce}.${sessionId || 'guest'}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function readStateToken(value = '') {
  const parts = String(value).split('.');
  if (parts.length !== 4) return null;
  const [nonce, sessionId, expiresAt, signature] = parts;
  const payload = `${nonce}.${sessionId}.${expiresAt}`;
  if (signature !== sign(payload)) return null;
  if (Number(expiresAt) < Date.now()) return null;
  return { nonce, sessionId: sessionId === 'guest' ? null : sessionId };
}

function setCookie(res, name, value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`);
}

function clearCookie(res, name) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function requireDiscordConfig() {
  const missing = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET']
    .filter(name => !process.env[name]?.trim());
  if (missing.length) {
    throw Object.assign(new Error(`Configuration Discord manquante : ${missing.join(', ')}`), { status: 503 });
  }
}

async function exchangeCode(req, code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(req)
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || 'Connexion Discord refusée.');
  return payload;
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Profil Discord indisponible.');
  return payload;
}

router.get('/discord', (req, res, next) => {
  try {
    requireDiscordConfig();
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = verifiedSessionId(cookies.infra_session);
    const nonce = crypto.randomBytes(18).toString('base64url');
    const state = stateToken(nonce, sessionId);
    setCookie(res, OAUTH_COOKIE, nonce, 600);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.DISCORD_CLIENT_ID,
      scope: 'identify',
      state,
      redirect_uri: redirectUri(req)
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  } catch (error) {
    next(error);
  }
});

router.get('/discord/callback', async (req, res, next) => {
  try {
    requireDiscordConfig();
    const cookies = parseCookies(req.headers.cookie);
    const state = readStateToken(req.query.state);
    clearCookie(res, OAUTH_COOKIE);
    if (!state || !cookies[OAUTH_COOKIE] || cookies[OAUTH_COOKIE] !== state.nonce) {
      res.redirect('/game?discord=state');
      return;
    }
    if (!req.query.code) {
      res.redirect('/game?discord=cancelled');
      return;
    }
    const token = await exchangeCode(req, req.query.code);
    const discordUser = await fetchDiscordUser(token.access_token);
    const result = await authenticateDiscordUser(req, res, discordUser, state.sessionId);
    res.redirect(`/game?discord=${encodeURIComponent(result.action)}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
