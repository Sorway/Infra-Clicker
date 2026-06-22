const express = require('express');
const { applyAction, createState, publicState } = require('../server/gameEngine');
const {
  countOnlinePlayers,
  getLeaderboard,
  getProfile,
  setProfile,
  transactSession
} = require('../server/gameStore');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/state', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, async (state, id, connection) => ({
      state: publicState(state),
      profile: await getProfile(connection, id)
    }));
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/profile', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, async (state, id, connection) => ({
      state: publicState(state),
      profile: await setProfile(connection, id, req.body?.username)
    }));
    res.json(payload);
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
    res.json({ players: await getLeaderboard(100) });
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

router.post('/action', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, state => {
      try {
        const result = applyAction(state, req.body);
        return { state: publicState(state), result };
      } catch (error) {
        return {
          status: error.status || 400,
          body: { error: error.message, state: publicState(state) }
        };
      }
    });

    if (payload.status) {
      res.status(payload.status).json(payload.body);
      return;
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/reset', async (req, res, next) => {
  try {
    const payload = await transactSession(req, res, state => {
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, createState());
      return { state: publicState(state) };
    });
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
