const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleGuard');
const ctrl = require('../controllers/analyticsController');

router.get('/dashboard',           authMiddleware, requireAdmin, ctrl.dashboard);
router.get('/announcement/:id',    authMiddleware, requireAdmin, ctrl.forAnnouncement);
router.get('/announcement/:id/csv',authMiddleware, requireAdmin, ctrl.exportCSV);

module.exports = router;
