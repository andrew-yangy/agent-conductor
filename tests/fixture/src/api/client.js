// API client for the fixture app
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

export function getUsers(page = 1, limit = 20) {
  return apiFetch(`/users?page=${page}&limit=${limit}`);
}

export function getProjects() {
  return apiFetch('/projects');
}

export function getTasks(projectId) {
  const query = projectId ? `?project_id=${projectId}` : '';
  return apiFetch(`/tasks${query}`);
}

export function createTask(task) {
  return apiFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export function updateTask(id, updates) {
  return apiFetch(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
