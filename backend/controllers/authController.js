const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

// Determine role from username suffix (backend only – never exposed in UI)
function detectRole(username) {
  if (username.endsWith('@mngrhereavvn26')) return 'admin';
  if (username.endsWith('@studavvn26'))     return 'student';
  return null;
}

// ── REGISTER ──────────────────────────────────────────────
async function register(req, res) {
  try {
    const {
      username, password,
      manager_id, qualification, role_post,   // Admin fields
      roll_number, class: cls, section        // Student fields
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const role = detectRole(username.trim());
    if (!role) {
      return res.status(400).json({ error: 'Invalid username format. Please use your assigned username.' });
    }

    // Validate role-specific required fields
    if (role === 'admin') {
      if (!manager_id?.trim() || !qualification?.trim() || !role_post?.trim()) {
        return res.status(400).json({ error: 'All admin fields are required.' });
      }
    }
    if (role === 'student') {
      if (!roll_number?.trim() || !cls?.trim() || !section?.trim()) {
        return res.status(400).json({ error: 'All student fields are required.' });
      }
    }

    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'This username is already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    db.prepare(`
      INSERT INTO users (username, password_hash, role, manager_id, qualification, role_post, roll_number, class, section)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      username.trim(), password_hash, role,
      manager_id?.trim() || null,
      qualification?.trim() || null,
      role_post?.trim() || null,
      roll_number?.trim() || null,
      cls?.trim() || null,
      section?.trim() || null
    );

    return res.status(201).json({ message: 'Account created successfully.' });
  } catch (err) {
    console.error('[AUTH] Register error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}

// ── LOGIN ─────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('echoToken', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });

    return res.json({
      message: 'Logged in successfully.',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}

// ── LOGOUT ────────────────────────────────────────────────
function logout(req, res) {
  res.clearCookie('echoToken');
  return res.json({ message: 'Logged out successfully.' });
}

// ── ME ────────────────────────────────────────────────────
function me(req, res) {
  const user = db.prepare(
    'SELECT id, username, role, manager_id, qualification, role_post, roll_number, class, section, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user });
}

module.exports = { register, login, logout, me };
