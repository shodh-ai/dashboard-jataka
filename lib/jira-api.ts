/**
 * API client for Jira integration
 */

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface JiraConfig {
  id: string;
  organizationId: string;
  baseUrl: string;
  email: string;
  projectKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveJiraConfigPayload {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface VerifyJiraConnectionPayload {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey?: string;
}

export interface VerifyJiraConnectionResponse {
  success: boolean;
  message: string;
  projects?: Array<{ key: string; name: string }>;
}

/**
 * Verify Jira connection before saving
 */
export async function verifyJiraConnection(
  payload: VerifyJiraConnectionPayload,
  authToken: string
): Promise<VerifyJiraConnectionResponse> {
  const response = await fetch(`${BASE_API}/integrations/jira/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify Jira connection');
  }

  return response.json();
}

/**
 * Save or update Jira configuration
 */
export async function saveJiraConfig(
  payload: SaveJiraConfigPayload,
  authToken: string
): Promise<JiraConfig> {
  const response = await fetch(`${BASE_API}/integrations/jira/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save Jira configuration');
  }

  return response.json();
}

/**
 * Get Jira configuration for the current organization
 */
export async function getJiraConfig(authToken: string): Promise<JiraConfig | null> {
  const response = await fetch(`${BASE_API}/integrations/jira/config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (response.status === 404 || response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Jira configuration');
  }

  return response.json();
}

/**
 * Delete Jira configuration
 */
export async function deleteJiraConfig(authToken: string): Promise<void> {
  const response = await fetch(`${BASE_API}/integrations/jira/config`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete Jira configuration');
  }
}
