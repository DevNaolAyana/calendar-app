const express = require('express');
const router = express.Router();
const { getAnalyticsData, exportAnalyticsData } = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

router.get('/', auth, getAnalyticsData);
router.get('/export', auth, exportAnalyticsData);

module.exports = router;
