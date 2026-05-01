export const REPO_QUERY_PARAM = "repo";
const LS_KEY = "jataka:selectedRepo";

export interface LinkedRepository {
  id: number;
  name?: string;
  full_name: string;
  default_branch?: string;
  installation_id?: string;
  curriculum_id?: string;
  brain_id?: string;
  brain_name?: string;
}

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

export async function fetchLinkedRepositories(
  baseApi: string,
  token: string,
): Promise<{ repositories: LinkedRepository[]; message: string }> {
  const linkedRes = await fetch(`${baseApi}/integrations/github/linked-repos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!linkedRes.ok) {
    return { repositories: [], message: "Unable to fetch linked repositories" };
  }
  const reposJson = await linkedRes.json();
  const repositories = Array.isArray(reposJson?.repositories)
    ? reposJson.repositories
    : [];
  return {
    repositories,
    message: repositories.length === 0 ? "No repositories available" : "",
  };
}

