const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/',             authMiddleware, ctrl.list);
router.get('/unread-count', authMiddleware, ctrl.unreadCount);
router.put('/read-all',     authMiddleware, ctrl.markAllRead);
router.put('/:id/read',     authMiddleware, ctrl.markRead);

module.exports = router;
