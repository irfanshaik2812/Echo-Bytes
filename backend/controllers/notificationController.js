const db = require('../database');

// ── LIST notifications for current user ───────────────────
function list(req, res) {
  try {
    const notifications = db.prepare(`
      SELECT n.*, a.title AS ann_title
      FROM notifications n
      LEFT JOIN announcements a ON n.announcement_id = a.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(req.user.id);

    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
}

// ── UNREAD COUNT ──────────────────────────────────────────
function unreadCount(req, res) {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(req.user.id);
    return res.json({ count: row.count });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch count.' });
  }
}

// ── MARK ONE AS READ ──────────────────────────────────────
function markRead(req, res) {
  try {
    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);
    return res.json({ message: 'Marked as read.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
}

// ── MARK ALL AS READ ──────────────────────────────────────
function markAllRead(req, res) {
  try {
    db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE user_id = ?
    `).run(req.user.id);
    return res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
}

module.exports = { list, unreadCount, markRead, markAllRead };
