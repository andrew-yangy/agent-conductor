const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');

// GET /api/users — list users with pagination
// BUG: Off-by-one error in pagination offset calculation.
// When page=1, offset should be 0 but calculates as `limit` (skips first page).
router.get('/', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = page * limit; // BUG: should subtract 1 from page before multiplying

  try {
    const users = db.prepare('SELECT id, name, email, role FROM users LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({
      data: users,
      pagination: { page, limit, total: total.count }
    });
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ data: user });
  } catch (err) {
    console.error('Failed to fetch user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', (req, res) => {
  const db = getDb();
  const { name, email, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  try {
    const result = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)').run(name, email, role || 'member');
    res.status(201).json({ data: { id: result.lastInsertRowid, name, email, role: role || 'member' } });
  } catch (err) {
    console.error('Failed to create user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
