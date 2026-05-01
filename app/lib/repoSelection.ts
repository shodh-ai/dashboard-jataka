export const REPO_QUERY_PARAM = "repo";
const LS_KEY = "jataka:selectedRepo";

export function getStoredRepo(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LS_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredRepo(repoFullName: string) {
  if (typeof window === "undefined") return;
  try {
    if (!repoFullName) {
      window.localStorage.removeItem(LS_KEY);
    } else {
      window.localStorage.setItem(LS_KEY, repoFullName);
    }
  } catch {
    // ignore storage failures (private mode, disabled storage)
  }
}

export function withRepoInSearchParams(
  searchParams: URLSearchParams,
  repoFullName: string,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (!repoFullName) next.delete(REPO_QUERY_PARAM);
  else next.set(REPO_QUERY_PARAM, repoFullName);
  return next;
}

