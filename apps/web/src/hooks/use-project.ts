"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export interface Project {
  id: string;
  key: string;
  name: string;
  _count?: { testCases: number; testCycles: number };
}

const CHANGE_EVENT = "qa_tm_project_changed";
const REFRESH_EVENT = "qa_tm_projects_refresh";

function storageKey(tenantId: string | null | undefined): string {
  return tenantId ? `qa_tm_selected_project_${tenantId}` : "qa_tm_selected_project";
}

export function useProject() {
  const { data: session } = useSession();
  const tenantId = session?.user?.tenantId ?? null;
  const key = storageKey(tenantId);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>("");
  const [loading, setLoading] = useState(true);
  // Counter to trigger re-fetches
  const [fetchTick, setFetchTick] = useState(0);

  // Hydrate from localStorage once on mount (client only)
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) setSelectedProjectIdState(stored);
  }, [key]);

  // Listen for project changes from other hook instances (via custom event)
  useEffect(() => {
    function handleChange(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      setSelectedProjectIdState(id);
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  // Listen for refresh requests from other hook instances
  useEffect(() => {
    function handleRefresh() {
      setFetchTick((t) => t + 1);
    }
    window.addEventListener(REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, handleRefresh);
  }, []);

  // Fetch projects when tenantId changes or refresh is triggered
  useEffect(() => {
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        if (!Array.isArray(data)) return;
        setProjects(data);
        const stored = localStorage.getItem(key);
        if (!stored && data.length > 0) {
          const id = data[0].id;
          localStorage.setItem(key, id);
          setSelectedProjectIdState(id);
        }
        if (stored && !data.find((p) => p.id === stored) && data.length > 0) {
          const id = data[0].id;
          localStorage.setItem(key, id);
          setSelectedProjectIdState(id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [key, tenantId, fetchTick]);

  const setSelectedProject = useCallback((id: string) => {
    localStorage.setItem(key, id);
    setSelectedProjectIdState(id);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: id }));
  }, [key]);

  // Trigger a re-fetch across all useProject instances on the page
  const refresh = useCallback(() => {
    setFetchTick((t) => t + 1);
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  return { projects, selectedProject, selectedProjectId, setSelectedProject, loading, refresh };
}
