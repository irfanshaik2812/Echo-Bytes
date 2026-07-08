const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin, requireStudent } = require('../middleware/roleGuard');
const ctrl = require('../controllers/announcementController');

// Configure multer for audio uploads
const uploadDir = path.join(__dirname, '../uploads/audio');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /audio\//;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only audio files are allowed.'));
  }
});

// ── Admin routes ───────────────────────────────────────────
router.post('/',              authMiddleware, requireAdmin, upload.single('audio'), ctrl.create);
router.get('/admin/list',     authMiddleware, requireAdmin, ctrl.adminList);
router.get('/admin/search',   authMiddleware, requireAdmin, ctrl.search);
router.put('/:id',            authMiddleware, requireAdmin, upload.single('audio'), ctrl.update);
router.delete('/:id',         authMiddleware, requireAdmin, ctrl.remove);
router.get('/:id/viewers',    authMiddleware, requireAdmin, ctrl.getViewers);

// Search history
router.get('/search/history',   authMiddleware, requireAdmin, ctrl.getSearchHistory);
router.delete('/search/history',authMiddleware, requireAdmin, ctrl.clearSearchHistory);

// ── Student routes ─────────────────────────────────────────
router.get('/student/feed',  authMiddleware, requireStudent, ctrl.studentFeed);
router.get('/student/hidden',authMiddleware, requireStudent, ctrl.getHidden);
router.post('/:id/view',     authMiddleware, requireStudent, ctrl.trackView);
router.post('/:id/hide',     authMiddleware, requireStudent, ctrl.hide);
router.delete('/:id/hide',   authMiddleware, requireStudent, ctrl.unhide);

// Shared single get (admin & student)
router.get('/:id',           authMiddleware, ctrl.getOne);

module.exports = router;
