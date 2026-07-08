const db = require('../database');
const fs = require('fs');
const path = require('path');

// Helper: strip HTML for preview text
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ── CREATE ────────────────────────────────────────────────
function create(req, res) {
  try {
    const { title, content, category, publish_date } = req.body;
    if (!title || !content || !publish_date) {
      return res.status(400).json({ error: 'Title, content, and publish date are required.' });
    }

    const audioFile = req.file ? req.file.filename : null;
    const now = new Date().toISOString();
    const publishISO = new Date(publish_date).toISOString();

    // Determine if we should notify immediately
    const notifyNow = new Date(publish_date) <= new Date() ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO announcements (title, content, audio_file, category, publish_date, created_by, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title.trim(), content, audioFile, category || 'General', publishISO, req.user.id, notifyNow);

    const annId = result.lastInsertRowid;

    // If publish_date is now or past → notify all students immediately
    if (notifyNow) {
      const students = db.prepare("SELECT id FROM users WHERE role = 'student'").all();
      const preview = stripHtml(content).substring(0, 120);
      const insertNotif = db.prepare(`
        INSERT OR IGNORE INTO notifications (user_id, title, preview, announcement_id)
        VALUES (?, ?, ?, ?)
      `);

      for (const student of students) {
        insertNotif.run(student.id, title, preview, annId);
      }

      // Emit via Socket.IO (set as global in server.js)
      try {
        const { io } = global;
        if (io) {
          for (const student of students) {
            io.to(`student-${student.id}`).emit('new-announcement', {
              id: annId, title, preview, category: category || 'General'
            });
          }
        }
      } catch (e) { /* socket optional */ }
    }

    return res.status(201).json({ message: 'Announcement created.', id: annId });
  } catch (err) {
    console.error('[ANN] Create error:', err.message);
    return res.status(500).json({ error: 'Failed to create announcement.' });
  }
}

// ── ADMIN LIST ────────────────────────────────────────────
function adminList(req, res) {
  try {
    const announcements = db.prepare(`
      SELECT a.*, u.username AS created_by_name,
        (SELECT COUNT(*) FROM announcement_views v WHERE v.announcement_id = a.id) AS total_views,
        (SELECT COUNT(DISTINCT v.student_id) FROM announcement_views v WHERE v.announcement_id = a.id) AS unique_views
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      WHERE a.is_deleted = 0
      ORDER BY a.created_at DESC
    `).all();

    return res.json({ announcements });
  } catch (err) {
    console.error('[ANN] Admin list error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch announcements.' });
  }
}

// ── SEARCH ────────────────────────────────────────────────
function search(req, res) {
  try {
    const { q, category, date_from, date_to } = req.query;

    // Save search to history (if non-empty query)
    if (q && q.trim()) {
      // Keep max 10 recent searches per admin
      const count = db.prepare('SELECT COUNT(*) as c FROM search_history WHERE admin_id = ?').get(req.user.id).c;
      if (count >= 10) {
        db.prepare(`
          DELETE FROM search_history WHERE id = (
            SELECT id FROM search_history WHERE admin_id = ? ORDER BY searched_at ASC LIMIT 1
          )
        `).run(req.user.id);
      }
      // Don't duplicate consecutive same query
      const last = db.prepare('SELECT query FROM search_history WHERE admin_id = ? ORDER BY searched_at DESC LIMIT 1').get(req.user.id);
      if (!last || last.query !== q.trim()) {
        db.prepare('INSERT INTO search_history (admin_id, query) VALUES (?, ?)').run(req.user.id, q.trim());
      }
    }

    let sql = `
      SELECT a.*, u.username AS created_by_name,
        (SELECT COUNT(*) FROM announcement_views v WHERE v.announcement_id = a.id) AS total_views,
        (SELECT COUNT(DISTINCT v.student_id) FROM announcement_views v WHERE v.announcement_id = a.id) AS unique_views
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      WHERE a.is_deleted = 0
    `;
    const params = [];

    if (q && q.trim()) {
      sql += ` AND (a.title LIKE ? OR a.content LIKE ?)`;
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }
    if (category && category !== 'All') {
      sql += ` AND a.category = ?`;
      params.push(category);
    }
    if (date_from) {
      sql += ` AND a.publish_date >= ?`;
      params.push(new Date(date_from).toISOString());
    }
    if (date_to) {
      sql += ` AND a.publish_date <= ?`;
      params.push(new Date(date_to + 'T23:59:59').toISOString());
    }
    sql += ` ORDER BY a.created_at DESC`;

    const announcements = db.prepare(sql).all(...params);
    return res.json({ announcements });
  } catch (err) {
    console.error('[ANN] Search error:', err.message);
    return res.status(500).json({ error: 'Search failed.' });
  }
}

// ── UPDATE ────────────────────────────────────────────────
function update(req, res) {
  try {
    const { id } = req.params;
    const { title, content, category, publish_date } = req.body;

    const ann = db.prepare('SELECT * FROM announcements WHERE id = ? AND is_deleted = 0').get(id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });

    let audioFile = ann.audio_file;
    if (req.file) {
      // Delete old audio file
      if (audioFile) {
        const oldPath = path.join(__dirname, '../uploads/audio', audioFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      audioFile = req.file.filename;
    } else if (req.body.delete_audio === 'true') {
      if (audioFile) {
        const oldPath = path.join(__dirname, '../uploads/audio', audioFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      audioFile = null;
    }

    db.prepare(`
      UPDATE announcements
      SET title=?, content=?, audio_file=?, category=?, publish_date=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      title?.trim() || ann.title,
      content || ann.content,
      audioFile,
      category || ann.category,
      publish_date ? new Date(publish_date).toISOString() : ann.publish_date,
      id
    );

    return res.json({ message: 'Announcement updated.' });
  } catch (err) {
    console.error('[ANN] Update error:', err.message);
    return res.status(500).json({ error: 'Failed to update announcement.' });
  }
}

// ── SOFT DELETE ───────────────────────────────────────────
function remove(req, res) {
  try {
    const { id } = req.params;
    const ann = db.prepare('SELECT * FROM announcements WHERE id = ? AND is_deleted = 0').get(id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });

    db.prepare('UPDATE announcements SET is_deleted = 1 WHERE id = ?').run(id);
    return res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    console.error('[ANN] Delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete announcement.' });
  }
}

// ── GET ONE ───────────────────────────────────────────────
function getOne(req, res) {
  try {
    const { id } = req.params;
    const ann = db.prepare(`
      SELECT a.*, u.username AS created_by_name
      FROM announcements a JOIN users u ON a.created_by = u.id
      WHERE a.id = ? AND a.is_deleted = 0
    `).get(id);
    if (!ann) return res.status(404).json({ error: 'Not found.' });
    return res.json({ announcement: ann });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch announcement.' });
  }
}

// ── STUDENT FEED ──────────────────────────────────────────
function studentFeed(req, res) {
  try {
    const { category } = req.query;
    const now = new Date().toISOString();
    let sql = `
      SELECT a.*, u.username AS created_by_name
      FROM announcements a JOIN users u ON a.created_by = u.id
      WHERE a.is_deleted = 0
        AND a.publish_date <= ?
        AND a.id NOT IN (
          SELECT announcement_id FROM hidden_announcements WHERE student_id = ?
        )
    `;
    const params = [now, req.user.id];

    if (category && category !== 'All') {
      sql += ` AND a.category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY a.publish_date DESC`;

    const announcements = db.prepare(sql).all(...params);
    return res.json({ announcements });
  } catch (err) {
    console.error('[ANN] Feed error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch feed.' });
  }
}

// ── TRACK VIEW ────────────────────────────────────────────
function trackView(req, res) {
  try {
    const { id } = req.params;
    db.prepare(`
      INSERT OR IGNORE INTO announcement_views (announcement_id, student_id)
      VALUES (?, ?)
    `).run(id, req.user.id);
    return res.json({ message: 'View tracked.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to track view.' });
  }
}

// ── GET VIEWERS ───────────────────────────────────────────
function getViewers(req, res) {
  try {
    const { id } = req.params;
    const viewers = db.prepare(`
      SELECT u.username, u.roll_number, u.class, u.section, av.viewed_at
      FROM announcement_views av
      JOIN users u ON av.student_id = u.id
      WHERE av.announcement_id = ?
      ORDER BY av.viewed_at DESC
    `).all(id);
    return res.json({ viewers });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch viewers.' });
  }
}

// ── HIDE (Student) ────────────────────────────────────────
function hide(req, res) {
  try {
    const { id } = req.params;
    db.prepare(`
      INSERT OR IGNORE INTO hidden_announcements (announcement_id, student_id)
      VALUES (?, ?)
    `).run(id, req.user.id);
    return res.json({ message: 'Announcement hidden.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to hide announcement.' });
  }
}

// ── UNHIDE (Student) ──────────────────────────────────────
function unhide(req, res) {
  try {
    const { id } = req.params;
    db.prepare(`
      DELETE FROM hidden_announcements WHERE announcement_id = ? AND student_id = ?
    `).run(id, req.user.id);
    return res.json({ message: 'Announcement restored.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to restore announcement.' });
  }
}

// ── GET HIDDEN ────────────────────────────────────────────
function getHidden(req, res) {
  try {
    const announcements = db.prepare(`
      SELECT a.id, a.title, a.category, a.publish_date, h.hidden_at
      FROM hidden_announcements h
      JOIN announcements a ON h.announcement_id = a.id
      WHERE h.student_id = ? AND a.is_deleted = 0
      ORDER BY h.hidden_at DESC
    `).all(req.user.id);
    return res.json({ announcements });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch hidden.' });
  }
}

// ── SEARCH HISTORY ────────────────────────────────────────
function getSearchHistory(req, res) {
  try {
    const history = db.prepare(`
      SELECT id, query, searched_at FROM search_history
      WHERE admin_id = ? ORDER BY searched_at DESC LIMIT 10
    `).all(req.user.id);
    return res.json({ history });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch search history.' });
  }
}

function clearSearchHistory(req, res) {
  try {
    db.prepare('DELETE FROM search_history WHERE admin_id = ?').run(req.user.id);
    return res.json({ message: 'Search history cleared.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear history.' });
  }
}

module.exports = {
  create, adminList, search, update, remove, getOne,
  studentFeed, trackView, getViewers, hide, unhide, getHidden,
  getSearchHistory, clearSearchHistory
};
