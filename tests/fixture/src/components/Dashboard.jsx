import React, { useState } from 'react';
import ProjectSelector from './ProjectSelector';
import TaskList from './TaskList';

export default function Dashboard() {
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div className="dashboard">
      <h1>Task Manager</h1>
      <ProjectSelector onSelect={setSelectedProject} selectedId={selectedProject} />
      <TaskList projectId={selectedProject} />
    </div>
  );
}
