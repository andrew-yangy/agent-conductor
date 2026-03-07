import React from 'react';
import { useTasks } from '../hooks/useTasks';
import TaskItem from './TaskItem';

export default function TaskList({ projectId }) {
  const { tasks, loading, error, editTask } = useTasks(projectId);

  if (loading) return <div className="loading">Loading tasks...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (tasks.length === 0) return <div className="empty">No tasks yet.</div>;

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onStatusChange={(status) => editTask(task.id, { status })} />
      ))}
    </ul>
  );
}
