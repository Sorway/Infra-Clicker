const express = require('express');
const { attachClientNetwork } = require('../server/clientNetwork');
const { recordPageAccess } = require('../server/gameStore');
const {
  showGame,
  showLeaderboard,
  showStatistics,
  showPrivacy
} = require('../controllers/gameController');

const router = express.Router();

router.get('/', attachClientNetwork, async (req, res, next) => {
  try {
    await recordPageAccess(req, res);
    next();
  } catch (error) {
    next(error);
  }
}, showGame);
router.get('/statistics', showStatistics);
router.get('/leaderboard', showLeaderboard);
router.get('/privacy', showPrivacy);

module.exports = router;
