const express = require('express');
const {
  showGame,
  showLeaderboard,
  showStatistics,
  showPrivacy
} = require('../controllers/gameController');

const router = express.Router();

router.get('/', showGame);
router.get('/statistics', showStatistics);
router.get('/leaderboard', showLeaderboard);
router.get('/privacy', showPrivacy);

module.exports = router;
