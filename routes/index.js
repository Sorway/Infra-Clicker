const express = require('express');
const { showGame } = require('../controllers/gameController');

const router = express.Router();

router.get('/', showGame);

module.exports = router;
