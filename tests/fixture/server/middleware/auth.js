// Simple token-based auth middleware
// REFACTOR OPPORTUNITY: Error handling is duplicated across every route file.
// Each route has its own try/catch with console.error + res.status(500).json({ error: 'Internal server error' }).
// This should be extracted into a centralized error-handling middleware.

function authMiddleware(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  // Simple bearer token check (in production, verify JWT)
  if (!token.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const tokenValue = token.slice(7);
  if (tokenValue.length < 10) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Attach decoded user info (stubbed)
  req.user = { id: 1, role: 'admin' };
  next();
}

module.exports = { authMiddleware };
