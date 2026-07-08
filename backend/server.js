const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./database');

const authRoutes         = require('./routes/authRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes    = require('./routes/analyticsRoutes');

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true }
});
global.io = io; // Make accessible to controllers without circular require
module.exports.io = io;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Landing page — served BEFORE express.static so it takes priority over index.html
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/landing.html')));

// Serve frontend static files (index.html, admin.html, student.html, assets…)
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics',     analyticsRoutes);

// SPA fallback: named pages
app.get('/admin.html',   (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin.html')));
app.get('/student.html', (req, res) => res.sendFile(path.join(__dirname, '../frontend/student.html')));

// ── Socket.IO ──────────────────────────────────────────────
io.on('connection', (socket) => {
  // Students join their personal room for real-time notifications
  socket.on('join-student-room', (userId) => {
    if (userId) {
      socket.join(`student-${userId}`);
    }
  });

  socket.on('disconnect', () => {});
});

// ── Cron: publish scheduled announcements ─────────────────
// Runs every minute; finds announcements whose publish_date has arrived
// but haven't been notified yet
cron.schedule('* * * * *', () => {
  try {
    const now = new Date().toISOString();
    const newlyPublished = db.prepare(`
      SELECT a.*, u.username AS admin_username
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      WHERE a.publish_date <= ? AND a.is_deleted = 0 AND a.notified = 0
    `).all(now);

    if (newlyPublished.length === 0) return;

    const students = db.prepare("SELECT id FROM users WHERE role = 'student'").all();
    const insertNotif = db.prepare(`
      INSERT OR IGNORE INTO notifications (user_id, title, preview, announcement_id)
      VALUES (?, ?, ?, ?)
    `);
    const markNotified = db.prepare('UPDATE announcements SET notified = 1 WHERE id = ?');

    for (const ann of newlyPublished) {
      // Strip HTML tags for preview
      const preview = ann.content.replace(/<[^>]*>/g, '').substring(0, 120);

      // Create notification + emit to each student
      for (const student of students) {
        insertNotif.run(student.id, ann.title, preview, ann.id);
        io.to(`student-${student.id}`).emit('new-announcement', {
          id: ann.id,
          title: ann.title,
          preview,
          category: ann.category
        });
      }

      markNotified.run(ann.id);
      console.log(`[CRON] Published announcement "${ann.title}" to ${students.length} students`);
    }
  } catch (err) {
    console.error('[CRON] Error:', err.message);
  }
});

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n🎙️  ECHO BYTES server running → http://localhost:${PORT}\n`);
});
