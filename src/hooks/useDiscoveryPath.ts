import { useEffect } from "react";

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

export function useDiscoveryPath(label: string | undefined, currentPath: string): DiscoveryStep[] {
  useEffect(() => {
    if (!label) return;

    const existing = getPath();
    const idx = existing.findIndex((s) => s.path === currentPath);
    if (idx >= 0) {
      // User navigated back — truncate
      setPath(existing.slice(0, idx + 1));
    } else {
      existing.push({ label, path: currentPath });
      setPath(existing);
    }
  }, [label, currentPath]);

  return getPath();
}
