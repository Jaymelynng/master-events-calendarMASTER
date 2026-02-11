/**
 * Sync API - Functions for syncing events with external sources
 * 
 * This module handles communication with the automation API server
 * (either local or Railway-hosted) for automated event collection.
 */

// Configuration
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes for sync operations
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Get the API URL from environment or default to localhost
 */
const getApiUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:5000';
};

/**
 * Get API key for authenticated requests (if configured)
 */
const getApiKey = () => {
  return process.env.REACT_APP_API_KEY || '';
};

/**
 * Build headers for API requests
 */
const buildHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  return headers;
};

/**
 * Fetch with timeout
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = async (url, options = {}, timeout = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} retries - Number of retries
 * @returns {Promise<any>}
 */
const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries) throw error;
      
      // Don't retry if it's a validation error, auth error, or client error (4xx)
      const isClientError = error.message.includes('Authentication') || 
                           error.message.includes('Invalid response format');
      
      // Check status only if it exists (Response errors have status)
      const hasErrorStatus = typeof error.status === 'number' && 
                            error.status >= 400 && 
                            error.status < 500;
      
      if (isClientError || hasErrorStatus) {
        throw error; // Don't retry client errors
      }
      
      // Exponential backoff for network/server errors
      const delay = RETRY_DELAY_MS * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Sync events for a specific gym and event type
 * 
 * @param {string} gymId - The gym ID (e.g., 'RBA', 'CCP')
 * @param {string} eventType - The event type (e.g., 'KIDS NIGHT OUT', 'CLINIC')
 * @returns {Promise<{success: boolean, events?: Array, error?: string}>}
 */
export const syncEvents = async (gymId, eventType) => {
  const API_URL = getApiUrl();
  
  return retryWithBackoff(async () => {
    try {
      const response = await fetchWithTimeout(`${API_URL}/sync-events`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          gymId,
          eventType
        })
      });

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: 'Invalid response format from server' };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.events) {
        return {
          success: true,
          events: data.events,
          eventsFound: data.eventsFound,
          message: data.message
        };
      } else {
        return {
          success: false,
          error: data.error || 'No events found',
          events: []
        };
      }
    } catch (error) {
      if (error.message === 'Request timed out') {
        throw new Error(`Sync operation timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. The server may be busy or the request is taking too long.`);
      }
      throw new Error(`Failed to connect to API server at ${API_URL}: ${error.message}`);
    }
  });
};

/**
 * Import events to Supabase via the API server
 * 
 * @param {string} gymId - The gym ID
 * @param {string} eventType - The event type
 * @param {Array} events - Array of events to import
 * @returns {Promise<{success: boolean, imported?: number, error?: string}>}
 */
export const importEvents = async (gymId, eventType, events) => {
  const API_URL = getApiUrl();
  
  return retryWithBackoff(async () => {
    try {
      const response = await fetchWithTimeout(`${API_URL}/import-events`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          gymId,
          eventType,
          events
        })
      }, 60000); // 1 minute timeout for imports

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: 'Invalid response format from server' };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.message === 'Request timed out') {
        throw new Error(`Import operation timed out. The server may be busy processing the events.`);
      }
      throw new Error(`Failed to import events: ${error.message}`);
    }
  });
};

/**
 * Get list of available gyms from the API
 * 
 * @returns {Promise<{success: boolean, gyms?: Array, error?: string}>}
 */
export const getGyms = async () => {
  const API_URL = getApiUrl();
  
  try {
    const response = await fetch(`${API_URL}/gyms`);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch gyms: ${error.message}`
    };
  }
};

/**
 * Get available event types for a gym
 * 
 * @param {string} gymId - Optional gym ID to filter event types
 * @returns {Promise<{success: boolean, eventTypes?: Array, error?: string}>}
 */
export const getEventTypes = async (gymId = null) => {
  const API_URL = getApiUrl();
  const url = gymId 
    ? `${API_URL}/event-types?gymId=${gymId}`
    : `${API_URL}/event-types`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch event types: ${error.message}`
    };
  }
};

/**
 * Check if the API server is healthy
 * 
 * @returns {Promise<{ok: boolean, url: string, error?: string}>}
 */
export const checkHealth = async () => {
  const API_URL = getApiUrl();
  
  try {
    const response = await fetchWithTimeout(`${API_URL}/health`, {}, 5000); // 5 second timeout for health check
    const data = await response.json();
    return {
      ok: data.status === 'ok',
      url: API_URL,
      message: data.message
    };
  } catch (error) {
    return {
      ok: false,
      url: API_URL,
      error: error.message
    };
  }
};
