const express = require('express');
const router = express.Router();
const { getStreakStats } = require('../controllers/streakController');
const auth = require('../middleware/auth');

router.get('/', auth, getStreakStats);

module.exports = router;
