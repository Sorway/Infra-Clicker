const express = require('express');
const { createState, publicState, synchronizeState } = require('../server/gameEngine');
const { DEFAULT_DLC_ID, hasDlc } = require('../server/gameData');
const {
  countOnlinePlayers,
  getLeaderboard,
  getProfile,
  transactSession
} = require('../server/gameStore');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/state', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, (state, id, session) => ({
      state: publicState(state),
      profile: getProfile(session)
    }));
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/profile', async (req, res, next) => {
  try {
    res.status(410).json({ error: 'Le pseudo est maintenant synchronisé avec Discord.' });
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const dlcId = hasDlc(req.query.dlc) ? req.query.dlc : DEFAULT_DLC_ID;
    res.json({ dlcId, players: await getLeaderboard(dlcId, 23) });
  } catch (error) {
    next(error);
  }
});

router.get('/presence', async (req, res, next) => {
  try {
    res.json({ online: await countOnlinePlayers() });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, state => {
      synchronizeState(state, req.body?.state);
      return { savedAt: state.lastSaved };
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/reset', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, state => {
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, createState(req.body?.dlcId));
      return { state: publicState(state) };
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
