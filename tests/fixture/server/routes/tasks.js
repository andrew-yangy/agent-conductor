const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');

// GET /api/tasks — list tasks, optionally filter by project_id and status
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let query = 'SELECT id, title, status, project_id, assignee_id, created_at FROM tasks';
    const params = [];
    const conditions = [];
    if (req.query.project_id) {
      conditions.push('project_id = ?');
      params.push(req.query.project_id);
    }
    // BUG (SWE-bench adapted): Status filter uses string interpolation instead of
    // parameterized query. This is a SQL injection vulnerability.
    // Adapted from Django QuerySet filter issues (e.g., django#31443) where
    // unsanitized user input flows directly into query construction.
    if (req.query.status) {
      conditions.push(`status = '${req.query.status}'`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';
    const tasks = db.prepare(query).all(...params);
    res.json({ data: tasks });
  } catch (err) {
    console.error('Failed to fetch tasks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks
// MISSING FEATURE: No input validation on this endpoint.
router.post('/', (req, res) => {
  const db = getDb();
  const { title, status, project_id, assignee_id } = req.body;
  // No checks on the incoming body fields
  try {
    const result = db.prepare(
      'INSERT INTO tasks (title, status, project_id, assignee_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(title, status || 'todo', project_id, assignee_id, new Date().toISOString());
    res.status(201).json({
      data: { id: result.lastInsertRowid, title, status: status || 'todo', project_id, assignee_id }
    });
  } catch (err) {
    console.error('Failed to create task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { title, status, assignee_id } = req.body;
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }
    db.prepare('UPDATE tasks SET title = ?, status = ?, assignee_id = ? WHERE id = ?').run(
      title || existing.title,
      status || existing.status,
      assignee_id !== undefined ? assignee_id : existing.assignee_id,
      req.params.id
    );
    res.json({ data: { id: req.params.id, title: title || existing.title, status: status || existing.status } });
  } catch (err) {
    console.error('Failed to update task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
