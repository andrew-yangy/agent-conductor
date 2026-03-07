const express = require('express');
const usersRouter = require('./routes/users');
const tasksRouter = require('./routes/tasks');
const projectsRouter = require('./routes/projects');
const { authMiddleware } = require('./middleware/auth');
const { getDb } = require('./utils/db');

const app = express();
app.use(express.json());

// Apply auth middleware to all API routes
app.use('/api', authMiddleware);

app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/projects', projectsRouter);

// Health check (no auth)
app.get('/health', (req, res) => {
  const db = getDb();
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
