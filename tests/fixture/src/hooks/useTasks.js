import { useState, useEffect, useCallback } from 'react';
import { getTasks, createTask, updateTask } from '../api/client';

export function useTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTasks(projectId);
      setTasks(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (taskData) => {
    const result = await createTask({ ...taskData, project_id: projectId });
    setTasks((prev) => [result.data, ...prev]);
    return result.data;
  };

  const editTask = async (id, updates) => {
    const result = await updateTask(id, updates);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...result.data } : t)));
    return result.data;
  };

  return { tasks, loading, error, addTask, editTask, refresh: fetchTasks };
}
