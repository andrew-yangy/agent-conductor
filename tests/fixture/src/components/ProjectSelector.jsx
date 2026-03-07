import React, { useState, useEffect } from 'react';
import { getProjects } from '../api/client';

export default function ProjectSelector({ onSelect, selectedId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects()
      .then((res) => setProjects(res.data))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading projects...</div>;

  return (
    <div className="project-selector">
      <label htmlFor="project-select">Project:</label>
      <select
        id="project-select"
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
