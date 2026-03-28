/**
 * API client for Salesforce integration
 */

const BASE_API = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface SalesforceConnectionResponse {
  connected: boolean;
  actorRole?: string; // NEW
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
export async function getSalesforceStatus(authToken: string): Promise<SalesforceConnectionResponse[]> {
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
 * Gets the authorization URL from backend and redirects user to Salesforce
 */
export async function connectSalesforce(authToken: string, role: string = 'admin', isSandbox: boolean = false): Promise<void> {
  try {
    // Determine the environment string to send to the backend
    const env = isSandbox ? 'sandbox' : 'production';
    
    // Include &env= in the fetch URL
    const response = await fetch(`${BASE_API}/integrations/salesforce/auth-url?role=${role}&env=${env}`, {
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

    // Now redirect the browser to Salesforce authorization page
    window.location.href = url;
  } catch (error: any) {
    console.error('Failed to initiate Salesforce OAuth:', error);
    throw error;
  }
}

/**
 * Manually trigger Salesforce schema sync for the current organization
 */
export async function syncSalesforceSchema(authToken: string): Promise<void> {
  const response = await fetch(`${BASE_API}/integrations/salesforce/sync-schema`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync schema');
  }
}

/**
 * Disconnect Salesforce for the current organization
 */
export async function disconnectSalesforce(authToken: string, role: string = 'admin'): Promise<void> {
  const response = await fetch(`${BASE_API}/integrations/salesforce/disconnect?role=${role}`, {
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
