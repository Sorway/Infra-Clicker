const express = require('express');
const { showGame, showStatistics, showPrivacy } = require('../controllers/gameController');

const router = express.Router();

router.get('/', showGame);
router.get('/statistics', showStatistics);
router.get('/privacy', showPrivacy);

module.exports = router;
