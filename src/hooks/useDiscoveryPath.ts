import { useEffect, useCallback } from "react";

export interface DiscoveryStep {
  label: string;
  path: string;
}

const STORAGE_KEY = "discovery-path";

function getPath(): DiscoveryStep[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setPath(steps: DiscoveryStep[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
}

export function clearDiscoveryPath() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function useDiscoveryPath(label: string, currentPath: string): DiscoveryStep[] {
  useEffect(() => {
    const existing = getPath();
    // If already in path, truncate to that point (user navigated back)
    const idx = existing.findIndex((s) => s.path === currentPath);
    if (idx >= 0) {
      setPath(existing.slice(0, idx + 1));
    } else {
      existing.push({ label, path: currentPath });
      setPath(existing);
    }
  }, [label, currentPath]);

  return getPath();
}
