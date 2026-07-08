const db = require('../database');

// ── DASHBOARD STATS ───────────────────────────────────────
function dashboard(req, res) {
  try {
    const totalAnnouncements = db.prepare(
      "SELECT COUNT(*) as c FROM announcements WHERE is_deleted = 0"
    ).get().c;

    const totalStudents = db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE role = 'student'"
    ).get().c;

    const totalViews = db.prepare(
      "SELECT COUNT(*) as c FROM announcement_views"
    ).get().c;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const viewsToday = db.prepare(
      "SELECT COUNT(*) as c FROM announcement_views WHERE viewed_at >= ?"
    ).get(todayStart.toISOString()).c;

    const recentAnnouncements = db.prepare(`
      SELECT a.id, a.title, a.category, a.publish_date,
        (SELECT COUNT(*) FROM announcement_views v WHERE v.announcement_id = a.id) AS views
      FROM announcements a
      WHERE a.is_deleted = 0
      ORDER BY a.created_at DESC
      LIMIT 5
    `).all();

    return res.json({
      totalAnnouncements,
      totalStudents,
      totalViews,
      viewsToday,
      recentAnnouncements
    });
  } catch (err) {
    console.error('[ANALYTICS] Dashboard error:', err.message);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

// ── PER-ANNOUNCEMENT ANALYTICS ────────────────────────────
function forAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;

    const ann = db.prepare(
      "SELECT id, title FROM announcements WHERE id = ? AND is_deleted = 0"
    ).get(id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });

    let viewsSql = `
      SELECT av.*, u.username, u.roll_number, u.class, u.section
      FROM announcement_views av JOIN users u ON av.student_id = u.id
      WHERE av.announcement_id = ?
    `;
    const params = [id];
    if (date_from) { viewsSql += ` AND av.viewed_at >= ?`; params.push(new Date(date_from).toISOString()); }
    if (date_to)   { viewsSql += ` AND av.viewed_at <= ?`; params.push(new Date(date_to + 'T23:59:59').toISOString()); }

    const views = db.prepare(viewsSql).all(...params);
    const totalViews   = views.length;
    const uniqueViewers = new Set(views.map(v => v.student_id)).size;

    // Group by date
    const byDate = {};
    views.forEach(v => {
      const d = v.viewed_at.substring(0, 10);
      byDate[d] = (byDate[d] || 0) + 1;
    });
    const viewsByDate = Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({
      announcement: ann,
      totalViews,
      uniqueViewers,
      viewsByDate,
      viewers: views
    });
  } catch (err) {
    console.error('[ANALYTICS] forAnnouncement error:', err.message);
    return res.status(500).json({ error: 'Failed to load analytics.' });
  }
}

// ── CSV EXPORT ────────────────────────────────────────────
function exportCSV(req, res) {
  try {
    const { id } = req.params;
    const ann = db.prepare("SELECT title FROM announcements WHERE id = ?").get(id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });

    const views = db.prepare(`
      SELECT u.username, u.roll_number, u.class, u.section, av.viewed_at
      FROM announcement_views av JOIN users u ON av.student_id = u.id
      WHERE av.announcement_id = ?
      ORDER BY av.viewed_at DESC
    `).all(id);

    const rows = [
      ['Announcement', ann.title],
      [],
      ['Username', 'Roll Number', 'Class', 'Section', 'Viewed At'],
      ...views.map(v => [
        v.username, v.roll_number || '', v.class || '', v.section || '',
        new Date(v.viewed_at).toLocaleString()
      ])
    ];

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const filename = `analytics_${id}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('[ANALYTICS] CSV export error:', err.message);
    return res.status(500).json({ error: 'Failed to export CSV.' });
  }
}

module.exports = { dashboard, forAnnouncement, exportCSV };
