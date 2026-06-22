const express = require('express');
const { applyAction, publicState } = require('../server/gameEngine');
const { getSession, resetSession, saveSession } = require('../server/gameStore');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/state', (req, res) => {
  const session = getSession(req, res);
  const state = publicState(session.state);
  saveSession(session.id);
  res.json({ state });
});

router.post('/action', (req, res) => {
  const session = getSession(req, res);
  try {
    const result = applyAction(session.state, req.body);
    const state = publicState(session.state);
    saveSession(session.id);
    res.json({ state, result });
  } catch (error) {
    const state = publicState(session.state);
    saveSession(session.id);
    res.status(error.status || 400).json({
      error: error.message,
      state
    });
  }
});

router.post('/reset', (req, res) => {
  const session = getSession(req, res);
  res.json({ state: publicState(resetSession(session.id)) });
});

module.exports = router;
