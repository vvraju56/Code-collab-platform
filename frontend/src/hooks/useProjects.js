import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/projects`);
      setProjects(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const createProject = useCallback(async (payload) => {
    const { data } = await axios.post(`${API}/projects`, payload);
    setProjects(prev => [data, ...prev]);
    return data;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await axios.delete(`${API}/projects/${id}`);
    setProjects(prev => prev.filter(p => p._id !== id));
  }, []);

  const updateProject = useCallback(async (id, payload) => {
    const { data } = await axios.put(`${API}/projects/${id}`, payload);
    setProjects(prev => prev.map(p => p._id === id ? data : p));
    return data;
  }, []);

  return { projects, loading, error, fetchProjects, createProject, deleteProject, updateProject };
}
