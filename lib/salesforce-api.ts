/**
 * API client for Salesforce integration
 */

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface SalesforceConnectionResponse {
  connected: boolean;
  user_id?: string;
  org_id?: string;
  instance_url?: string;
  sf_username?: string;
  connected_at?: string;
  last_used_at?: string;
}

/**
 * Check Salesforce connection status for the current organization
 */
export async function getSalesforceStatus(authToken: string): Promise<SalesforceConnectionResponse> {
  const response = await fetch(`${BASE_API}/integrations/salesforce/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check Salesforce connection status');
  }

  return response.json();
}

/**
 * Initiate Salesforce OAuth flow
 * This will redirect the user to Salesforce for authorization
 */
export function connectSalesforce(authToken: string) {
  // Redirect to the backend endpoint which will handle the OAuth flow
  window.location.href = `${BASE_API}/integrations/salesforce/connect`;
}

/**
 * Disconnect Salesforce for the current organization
 */
export async function disconnectSalesforce(authToken: string): Promise<void> {
  const response = await fetch(`${BASE_API}/integrations/salesforce/disconnect`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disconnect Salesforce');
  }
}
