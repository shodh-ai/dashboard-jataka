/**
 * API client for Jira OAuth integration
 */

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface JiraConnectionResponse {
  connected: boolean;
  cloud_id?: string;
  site_url?: string;
  project_key?: string;
  connected_at?: string;
  last_used_at?: string;
}

export interface UpdateProjectKeyPayload {
  projectKey: string;
}

/**
 * Check Jira connection status for the current organization
 */
export async function getJiraStatus(authToken: string): Promise<JiraConnectionResponse> {
  const response = await fetch(`${BASE_API}/integrations/jira/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check Jira connection status');
  }

  return response.json();
}

/**
 * Initiate Jira OAuth flow
 * Gets the authorization URL from backend and redirects user to Atlassian
 */
export async function connectJira(authToken: string): Promise<void> {
  try {
    // First, get the authorization URL from the backend (with auth header)
    const response = await fetch(`${BASE_API}/integrations/jira/auth-url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get authorization URL');
    }

    const { url } = await response.json();

    // Now redirect the browser to Atlassian authorization page
    window.location.href = url;
  } catch (error: any) {
    console.error('Failed to initiate Jira OAuth:', error);
    throw error;
  }
}

/**
 * Update project key for existing Jira connection
 */
export async function updateJiraProjectKey(
  payload: UpdateProjectKeyPayload,
  authToken: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BASE_API}/integrations/jira/project-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update project key');
  }

  return response.json();
}

/**
 * Disconnect Jira for the current organization
 */
export async function disconnectJira(authToken: string): Promise<void> {
  const response = await fetch(`${BASE_API}/integrations/jira/disconnect`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disconnect Jira');
  }
}
