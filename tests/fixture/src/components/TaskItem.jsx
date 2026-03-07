import React from 'react';

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export default function TaskItem({ task, onStatusChange }) {
  return (
    <li className={`task-item task-${task.status}`}>
      <span className="task-title">{task.title}</span>
      <select
        value={task.status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="task-status-select"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </li>
  );
}
