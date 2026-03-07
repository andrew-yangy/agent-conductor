const express = require('express');
const router = express.Router();
const { getDb } = require('../utils/db');

// GET /api/projects
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const projects = db.prepare('SELECT id, name, description, owner_id, created_at FROM projects').all();
    res.json({ data: projects });
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id — includes task count
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const project = db.prepare('SELECT id, name, description, owner_id, created_at FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE project_id = ?').get(req.params.id);
    res.json({ data: { ...project, task_count: taskCount.count } });
  } catch (err) {
    console.error('Failed to fetch project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, owner_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  try {
    const result = db.prepare('INSERT INTO projects (name, description, owner_id, created_at) VALUES (?, ?, ?, ?)').run(
      name, description || '', owner_id, new Date().toISOString()
    );
    res.status(201).json({ data: { id: result.lastInsertRowid, name, description: description || '' } });
  } catch (err) {
    console.error('Failed to create project:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
